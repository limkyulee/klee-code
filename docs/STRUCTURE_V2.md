# Klee Code Structure V2

## BackendServer

```text
com.kleecode.backend
├── auth
│   ├── controller
│   ├── dto
│   ├── repository
│   └── service
├── user
│   ├── dto
│   ├── repository
│   └── service
├── modelconfig
│   ├── controller
│   ├── dto
│   ├── repository
│   └── service
├── security
├── chat
├── audit
├── common
└── config
```

## Webview 흐름

1. Webview가 `WEBVIEW_READY`를 보낸다.
2. Extension host가 `SecretStorage`의 refresh token으로 세션 복구를 시도한다.
3. 세션이 없으면 Webview는 로그인/회원가입 화면을 표시한다.
4. 로그인 후 Webview는 모델 설정 상태를 조회한다.
5. 모델 설정이 없으면 Ollama URL과 모델명 입력 화면을 표시한다.
6. 모델 설정이 있으면 기존 채팅 화면을 표시한다.
7. 채팅 요청은 access token을 포함해 `/chat/stream`으로 전달된다.
8. 401 응답 시 Extension host가 refresh token으로 access token을 갱신하고 1회 재시도한다.

## MongoDB 흐름

```text
User
  -> users(userId)
  -> sessions(userId)
  -> user_model_configs(userId)
  -> audit_logs(userId, conversationId)
  -> ai_chat_memory(conversationId)
```

## User 흐름

1. 사용자는 `userId + password`로 회원가입한다.
2. 백엔드는 `users.userId` 중복을 확인하고 비밀번호를 BCrypt 해시로 저장한다.
3. 로그인 성공 시 access token과 refresh token을 발급한다.
4. refresh token은 SHA-256 해시로 `sessions`에 저장한다.
5. 사용자는 본인 `user_model_configs`만 조회/수정한다.
6. 채팅은 본인 모델 설정이 있는 경우에만 가능하다.

## BackendServer 요청 흐름

```text
Webview -> Extension host -> BackendServer
  Authorization: Bearer accessToken
      -> JwtAuthenticationFilter
      -> AuthenticatedUser(userId, roles)
      -> Controller
      -> Service
      -> MongoDB
```

채팅 요청은 `ModelConfigService.requireConfig(userId)`를 통과해야 모델 호출로 진행된다. 설정이 없으면 `MODEL_CONFIG_REQUIRED`를 반환한다.
