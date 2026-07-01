═══════════════════════════════════════════════════════
## 0. 프로젝트 한 줄 정의
═══════════════════════════════════════════════════════
기업 내부망의 **중앙 Ollama 서버**만 사용하는 **온프레미스(보안형) AI Coding Assistant**.
핵심 명제: "코드/문서가 보안 경계를 벗어나지 않으면서 동일한 UX를 제공한다."
정책 강제 지점을 백엔드 한 곳으로 집중 → 서버 한 대만 통제하면 보안 경계가 완성됨.
성격: 개인용 LLM 클라이언트가 아니라, **운영자가 승인한 모델 안에서만 동작하는 어시스턴트**.

═══════════════════════════════════════════════════════
## 1. 시스템 아키텍처 (3-tier + 보안 경계)
═══════════════════════════════════════════════════════
[ VSCode 확장 (TS + React Webview) ]  ← 얇은 클라이언트, 로컬 파일 접근 담당
        │ HTTP / SSE (Bearer accessToken)
        ▼
[ Spring Boot 백엔드 (온프렘, 보안 경계·정책 강제) ]
        │                         │
   [컨텍스트/감사/대화 DB]     [Internal LLM Gateway]
        │                         │
   [ MongoDB ]               [ Ollama 중앙 서버 (qwen2.5-coder) ]

설계 원칙:
- 확장 = 얇은 클라이언트. **정책·감사·프롬프트 조립은 전부 백엔드**.
- 단, **로컬 워크스페이스 파일 접근은 백엔드가 아니라 확장(Extension Host)**이 VS Code 권한 경계 안에서 수행.
- 아키텍처 유형: **모듈러 모놀리스** (MSA 아님). 도메인별 패키지로 분리하되 단일 Spring 앱.

ADR 요약:
- ADR-1 클라이언트-서버 분리 → 정책 강제 지점 단일화
- ADR-2 중앙 LLM Gateway → 운영자 설정 Ollama만 호출 (사용자는 서버 주소 못 바꿈)
- ADR-3 컨텍스트 조회는 직접 DB 조회로 시작 → 향후 MCP로 단계 전환
- ADR-4 감사 로그에 `externalTransfer=false` 기록 → 규제 감사 대응

═══════════════════════════════════════════════════════
## 2. 대화가 흐르는 계층 (레이어 흐름)
═══════════════════════════════════════════════════════
사용자 입력(코드 선택 + 질문 + permissionMode + 모델선택)
 → [Webview] postMessage(SEND_MESSAGE)
 → [Extension Host] ChatWebviewMessageHandler.ask()
     · parseSlashCommand() (text / local / promptSkill 분기)
     · buildChatRequest() (선택영역·주변코드·파일경로 수집)
     · readWorkspaceKleeContext() (.klee/rules,skills,hooks 읽기)
 → POST /agent/stream (SSE, Bearer token)
 → [Backend Agent 계층]
     · PromptAssemblyService.assemble() + ToolPromptService.instructions()
     · AuditLogService.start()
     · LLMGateway.chatClient() (+ MongoDB ChatMemory 히스토리 주입)
     · Tool calling 루프 (최대 3회)
 → SSE 이벤트(progress / token / tool_call_requested / done / error)
 → [Extension Host] tool_call_requested 수신 시 executeLocalTool() → POST /agent/tool-results
 → [Webview] messageReducer(appendText/appendProgress/finish) → MarkdownMessage 렌더링

**두 개의 채팅 모드가 공존**:
- `/chat`, `/chat/stream` : 일반 채팅 (도구 없음, 동기 or SSE)
- `/agent/stream` : Agent 모드 (도구 호출 지원, 현재 확장이 쓰는 기본 경로)

═══════════════════════════════════════════════════════
## 3. Tool Calling 구조 (핵심 설계)
═══════════════════════════════════════════════════════
방식: **함수콜 네이티브 API가 아니라, 프롬프트 태그 기반**.
모델이 `<klee_tool_call>{"toolName":"read_file","arguments":{"path":"..."}}</klee_tool_call>`
형식으로 응답하면 백엔드가 파싱.

백엔드 tool 도메인 (역할 분리):
- ToolRegistry      : 도구 정의(schema)의 단일 소스. 현재 read_file, search_files (읽기전용 2개)
- ToolPolicyService : 권한 판정. read-only는 ASK/APPROVE/FULL 모두 승인 없이 허용, FULL은 전부 허용
- ToolExecutorService: toolCallId(UUID) 발급, dispatcher로 SSE 송출, 결과 대기, 실패 시 pending 취소
- ToolResultRegistry: ConcurrentHashMap<runId:toolCallId, CompletableFuture>, 60초 타임아웃
- ToolPromptService : 도구 사용 지침 프롬프트 생성

실행 루프 (AgentService, MAX_TOOL_CALLS=3):
1) LLM 호출 → 응답에서 tool_call 태그 파싱 (단일 태그·순수 JSON만 허용, 공백 toolName·null arguments 거부)
2) 없으면 최종 답변, 있으면 ToolExecutorService.execute()
3) SSE tool_call_requested 송출 → 확장이 로컬 실행 → /agent/tool-results 로 결과 반환
4) 결과를 "## Tool Observation N" 섹션으로 누적해 다음 프롬프트에 주입
5) 반복 or limit 도달

**로컬 도구 실행은 확장(Extension Host)**:
- localToolRegistry.ts : executor 매핑만 보유 (schema는 백엔드가 소유 — 중복 제거됨)
- read_file   : resolveWorkspacePath()로 워크스페이스 이탈 방지, 최대 200KB, 초과 시 truncate
- search_files: findFiles로 파일명 검색, .git/node_modules/dist/build 등 제외, 최대 80개 결과

결과 상태: ToolResultStatus enum (wire value SUCCEEDED/FAILED 유지).
설계 의도: "쓰기/명령실행 도구를 붙일 때 정책 확장 지점을 명확히" 하려고 read-only부터 시작.

═══════════════════════════════════════════════════════
## 4. 백엔드 구조 (Spring Boot, 도메인별 패키지)
═══════════════════════════════════════════════════════
com.kleecode.backend/  (각 도메인 = controller/service/repository/dto, DTO는 record 선호)
├── agent/       AgentController(/agent/stream, /agent/tool-results), AgentService, AgentEventSink
├── chat/        ChatController(/chat,/chat/stream,/chat/status), ChatService, ChatModelExceptionMapper
├── tool/        ToolRegistry / ToolPolicyService / ToolExecutorService / ToolResultRegistry / ToolPromptService
├── permission/  PermissionMode(ASK, APPROVE, FULL)
├── prompt/      PromptAssemblyService (프롬프트 조립 책임의 단일 소유자)
├── llm/         LLMGateway, LlmProperties, OllamaApiConfig, ModelController(/models)
├── conversation/ ConversationController(/conversations…), ConversationService
├── audit/       AuditLogService, AuditLogRepository, AuditHistoryController(/audit/chat-history)
├── auth/        AuthController(/auth/register,login,refresh,logout,me), TokenService, RefreshTokenService
├── user/        UserService, AppUser(users 컬렉션)
├── preference/  UserPreferenceController(/me/preferences GET/PUT), UserPreferenceService
├── security/    JwtAuthenticationFilter, SecurityConfig, AuthenticatedUser
├── common/      ApiError, ApiException, ApiExceptionHandler
└── config/      WebConfig(CORS)
※ modelconfig/ 도 잔존 (과거 사용자별 URL 설정 흔적 — 아래 진화사 참고, 정리 후보)

프롬프트 조립 순서 (PromptAssemblyService):
system.md → 내부 slash skill → .klee/rules → 활성 .klee/skills → .klee/hooks
→ 응답언어 → 코드컨텍스트(선택+주변) → 사용자 질문

═══════════════════════════════════════════════════════
## 5. 확장(Extension) 구조 (TS + React)
═══════════════════════════════════════════════════════
extension/
├── src/extension-host/           ← VS Code 호스트(Node 런타임)
│   ├── extension.ts              activate(): 명령 2개(askAssistant, newConversation) + WebviewViewProvider 등록
│   ├── chat/                     types, context(선택→요청 변환), kleeContext(.klee 읽기),
│   │                             slashCommand(파싱), localToolRegistry, localTools(executeLocalTool)
│   ├── services/                 chatApiClient(HTTP/SSE), authSession(SecretStorage 토큰관리)
│   └── webview/                  AssistantViewProvider, ChatWebviewMessageHandler, getWebviewHtml
└── webview-ui/                   ← React Webview(브라우저 런타임)
    └── src/features/chat/        ChatView(컨테이너), model/messageReducer(useReducer 상태),
        components/               ChatInput(모델·권한 드롭다운), MessageList, MessageBubble,
                                  MarkdownMessage(수동 마크다운 파서 + highlight.js 코드 하이라이트)
        api/                      webviewProtocol(메시지 타입), vscodeBridge(postMessage 래퍼)

폴더 명명 규칙 의도: **런타임 경계로 분리** — extension-host(Node) vs webview-ui(브라우저),
그 안에서 feature 단위(features/chat) + 계층(components/model/api)로 나눔.

빌드: Vite (extension=CJS 번들, webview=IIFE 번들). React 19, highlight.js 11, oxlint, TS 5.9.
통신: Webview↔Host는 postMessage 프로토콜, Host↔Backend는 fetch 기반 SSE 파싱.
인증: refreshToken은 OS 키체인(SecretStorage), accessToken은 메모리, 401 시 refresh 후 1회 재시도.

═══════════════════════════════════════════════════════
## 6. 데이터 모델 (MongoDB)
═══════════════════════════════════════════════════════
users              : userId(unique), passwordHash(BCrypt), roles, status
sessions           : refresh 세션 상태 + TTL (refreshToken은 SHA-256 해시 저장)
user_preferences   : selectedModel, temperature(0~2), responseLanguage (null이면 기본값)
audit_logs         : userId, conversationId, status(STARTED/SUCCEEDED/FAILED),
                     modelProvider, externalTransfer, 선택영역·질문·답변·에러
conversations      : conversationId, title(첫 질문 기반), status, turnCount, timestamps
ai_chat_memory     : Spring AI MessageChatMemoryAdvisor가 conversationId 기준 관리

═══════════════════════════════════════════════════════
## 7. 기술 스택
═══════════════════════════════════════════════════════
Backend : Java 21, Spring Boot 4.1, Spring Web MVC, Spring Security(+OAuth2 JOSE JWT),
          Spring Data MongoDB, Spring AI 2.0 (Ollama + MongoDB ChatMemory), Gradle, Lombok
Client  : VS Code Extension API, TypeScript, React 19, Vite, highlight.js, SSE fetch, SecretStorage, oxlint
Infra   : MongoDB, Ollama(qwen2.5-coder:14b/7b), Docker Compose (backend+mongo+ollama+model-pull)
인증    : JWT AccessToken 15분 + RefreshToken 14일, BCrypt

═══════════════════════════════════════════════════════
## 8. 점진적 진화 (이 프로젝트가 걸어온 길 — 시간순)
═══════════════════════════════════════════════════════
처음부터 완성된 설계가 아니라, 문제를 확인하며 설계를 계속 좁혀온 프로젝트.

Phase 0  뼈대: VS Code 명령 1개 + POST /chat + ChatClient. 답변을 **OutputChannel**에 출력.
Phase 1  UI: Webview 패널 도입 → HTML 문자열 UI를 **React로 이관**.
Phase 2  스트리밍: **SSE 스트리밍** + Markdown 렌더링(코드펜스·하이라이트·복사버튼) 다듬기.
                   (공백 보존, 코드박스 렌더링, 입력창 Enter/Shift+Enter 등 UX 이슈 반복 수정)
Phase 3  컨텍스트 & 감사: 코드 컨텍스트 수집 + **감사 로그**(externalTransfer=false) 도입 → 설계 분리.
Phase 4  다중 사용자: **로그인/JWT/세션 + 대화 히스토리 그룹화**(conversations) → 다중 사용자 서비스화.
Phase 5  방향 전환(중요): 사용자별 Ollama URL 저장(modelconfig) 구조를 **폐기** →
                   **중앙 LLMGateway**로 전환. 사용자는 서버 주소를 못 바꾸고 preference만 조정.
                   /models는 실제 Ollama API로 설치 모델 조회. 연결 실패는 사용자메시지/운영로그 분리
                   (ChatModelExceptionMapper). → "제품 정체성"을 온프렘으로 재정의한 결정.
Phase 6  Skill/Rules/Hook: **Slash Skill** 문법 도입(`/review ...`). 내부 스킬(classpath) +
                   프로젝트별 `.klee/{rules,skills,hooks}` 커스텀 지침을 프롬프트에 합성.
                   `/clear`는 로컬 명령(새 conversationId로 context window 초기화).
Phase 7  Tool Calling: agent/tool/permission 도메인 추가. read-only 도구(read_file,search_files)부터.
                   permissionMode(ask/approve/full) 도입. 이후 정책·파싱·결과검증·pending정리·
                   schema 중복 제거 등 **tool 도메인 견고화**. 백엔드/확장 테스트 추가.
Phase 4(온프렘 패키징) docker-compose로 backend+mongo+ollama 일괄 기동. 데모 GIF는 미완.

미완/후보: Phase 2(MCP 승격) 미착수, 쓰기·명령실행 도구 + 실제 승인 팝업, 전역 .klee, 스킬 자동완성.

═══════════════════════════════════════════════════════
## 9. 알려진 특이점 / 논의하고 싶은 지점
═══════════════════════════════════════════════════════
- /chat 계열과 /agent/stream 이 공존 → 통합 여부 고민.
- modelconfig 도메인 잔재 → 제거 대상 후보.
- Tool calling이 네이티브 function-calling이 아닌 프롬프트 태그 파싱 → 견고성/모델의존성 trade-off.
- MarkdownMessage가 라이브러리 없는 수동 파서 → 유지보수성 vs 번들크기 trade-off.
- CORS 전체 허용(개발용) → 프로덕션 제한 필요.
- 로컬 도구는 확장, 정책·schema는 백엔드로 분리된 하이브리드 → MCP 전환 시 재배치 논점.

