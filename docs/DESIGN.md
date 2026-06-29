# Klee Code 온프레미스 설계 문서

## 1. 목표

Klee Code는 개인용 AI 클라이언트가 아니라 기업 내부망에서 운영되는 보안형 AI Coding Assistant다.
소스코드와 프로젝트 문서는 외부 AI 서비스로 전송하지 않고, 회사 내부에 구축된 중앙 Ollama 기반 LLM만 사용한다.

핵심 가치는 다음 세 가지다.

- 중앙 LLM Gateway가 운영자 설정의 Ollama 서버만 호출한다.
- 사용자는 URL을 입력하지 않고, 허용된 모델 목록에서 하나를 선택한다.
- 감사 로그와 대화 메모리는 유지하되 `externalTransfer=false` 경계를 명확히 한다.

## 2. 아키텍처

```text
[ VS Code Extension ]
        |
        | HTTP / SSE + JWT
        v
[ Spring Boot Backend ]
        |
        +-- Auth / Conversation / Audit Log / ChatMemory
        |
        v
[ Internal LLM Gateway ]
        |
        | application.yml / env managed by operators
        v
[ Ollama inside corporate network ]
        |
        v
[ Qwen / DeepSeek 등 승인 모델 ]
```

모델 서버 주소는 API로 조회하거나 수정할 수 없다. `klee.llm.base-url`은 운영자가 배포 설정이나 환경변수로만 관리한다.

## 3. 주요 결정

### ADR-1. 클라이언트와 백엔드를 분리한다

확장은 얇은 클라이언트로 유지하고 인증, LLM 호출, 정책, 감사 로그는 백엔드에 둔다. 정책 강제 지점이 백엔드 한 곳이어야 사용자 PC나 확장 코드를 신뢰하지 않아도 보안 경계를 유지할 수 있다.

### ADR-2. 중앙 LLM Gateway를 둔다

개인별 모델 서버 주소 저장은 SSRF와 내부망 오남용 위험을 만든다. `LLMGateway` Spring Bean이 `klee.llm` 설정으로만 Ollama `ChatClient`를 생성하고, `ChatService`는 이 Bean을 통해서만 모델을 호출한다.

### ADR-3. 모델 선택은 allow-list 기반으로 제한한다

`GET /models`는 운영자가 허용한 모델 목록만 반환한다. 사용자 개인 설정에는 `selectedModel`, `temperature`, `responseLanguage`만 저장하며 서버 URL, provider, 임의 모델 endpoint는 저장하지 않는다.

### ADR-4. ChatMemory와 Audit Log를 유지한다

`MessageChatMemoryAdvisor`는 `conversationId` 기준으로 MongoDB 대화 메모리를 읽고 쓴다. `audit_logs`에는 요청 주체, 코드 컨텍스트, 질문, 답변, 모델 provider, `externalTransfer=false`를 기록한다.

## 4. 데이터 흐름

1. 사용자가 VS Code 확장에서 질문과 선택 코드를 전송한다.
2. JWT 인증 필터가 사용자를 확인한다.
3. `ChatService`가 사용자 preference를 읽고, 없으면 중앙 기본 모델 설정을 사용한다.
4. `ChatService`가 `LLMGateway`의 `ChatClient`로 Ollama에 요청한다.
5. 응답은 SSE `progress`, `token`, `done` 이벤트로 확장에 스트리밍된다.
6. 대화 메모리와 감사 로그가 MongoDB에 저장된다.

## 5. MongoDB 컬렉션

- `users`: 사용자 계정, 권한, 상태
- `sessions`: refresh token 세션과 TTL
- `user_preferences`: 선택 모델, temperature, 응답 언어
- `audit_logs`: 요청/응답 감사 로그
- `ai_chat_memory`: Spring AI 대화 메모리
- `conversations`: 대화 목록과 턴 상태

모델 서버 주소를 저장하는 사용자별 컬렉션은 사용하지 않는다.

## 6. 배포

Docker Compose는 백엔드, MongoDB, Ollama, 모델 pull 컨테이너를 같은 내부 네트워크에 둔다. 백엔드는 `http://ollama:11434`만 사용하며 외부 LLM API 키를 요구하지 않는다.
