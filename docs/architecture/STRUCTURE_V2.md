# Klee Code Structure V2

## BackendServer

```text
com.kleecode.backend
├── auth
├── user
├── preference
├── llm
├── agent
├── tool
├── permission
├── security
├── chat
├── conversation
├── audit
├── common
└── config
```

## Webview 흐름

1. Webview가 `WEBVIEW_READY`를 보낸다.
2. Extension host가 `SecretStorage`의 refresh token으로 세션 복구를 시도한다.
3. 세션이 없으면 Webview는 로그인/회원가입 화면을 표시한다.
4. 로그인 후 Extension host가 `/models`, `/me/preferences`, `/chat/status`를 조회한다.
5. Settings는 허용 모델, temperature, 응답 언어만 표시한다.
6. 채팅 요청은 access token을 포함해 `/chat/stream`으로 전달된다.
7. 401 응답 시 Extension host가 refresh token으로 access token을 갱신하고 1회 재시도한다.

Agent 모드 채팅은 access token을 포함해 `/agent/stream`으로 전달된다. 백엔드는 `tool` 도메인의 schema/registry/policy/executor 서비스를 통해 tool 요청을 검증하고 `tool_call_requested` SSE 이벤트를 보낸다. Extension host는 로컬 tool executor registry에서 허용된 읽기 전용 tool을 찾아 워크스페이스 내부에서만 실행하고 `/agent/tool-results`로 결과를 반환한다.

## MongoDB 흐름

```text
User
  -> users(userId)
  -> sessions(userId)
  -> user_preferences(userId)
  -> audit_logs(userId, conversationId)
  -> conversations(userId, conversationId)
  -> ai_chat_memory(conversationId)
```

## User 흐름

1. 사용자는 `userId + password`로 회원가입한다.
2. 백엔드는 `users.userId` 중복을 확인하고 비밀번호를 BCrypt 해시로 저장한다.
3. 로그인 성공 시 access token과 refresh token을 발급한다.
4. refresh token은 SHA-256 해시로 `sessions`에 저장한다.
5. 사용자는 본인 `user_preferences`만 조회/수정한다.
6. 채팅은 중앙 LLM Gateway의 승인 모델로만 수행한다.

## BackendServer 요청 흐름

```text
Webview -> Extension host -> BackendServer
  Authorization: Bearer accessToken
      -> JwtAuthenticationFilter
      -> AuthenticatedUser(userId, roles)
      -> Controller
      -> Service
      -> MongoDB / LLMGateway
```

`ChatService`는 사용자 URL을 읽지 않는다. `UserPreferenceService`로 선택 모델과 응답 설정을 확인한 뒤 `LLMGateway`가 관리하는 중앙 Ollama `ChatClient`를 사용한다.

`AgentService`는 기존 프롬프트 조립, 중앙 `LLMGateway`, `ToolPromptService`, `ToolExecutorService`를 조합해 tool calling 루프를 수행한다. tool 이름, 설명, argument schema는 `ToolRegistry`에 모으고, 정책은 `ToolPolicyService`, 결과 대기는 `ToolResultRegistry`가 담당한다. 실제 로컬 파일 접근은 백엔드가 아니라 VS Code Extension Host의 local tool executor registry가 담당한다.
