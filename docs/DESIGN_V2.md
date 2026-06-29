# Klee Code Design V2

## 목표

V2는 로그인, 세션 처리, 중앙 LLM Gateway, 사용자 preference를 연결한다. 개인별 모델 서버 주소 입력은 제공하지 않으며, 채팅 요청은 운영자가 설정한 중앙 Ollama 서버로만 전달한다.

## 사용자 계정

- 로그인 식별자는 회원가입 시 사용자가 입력한 `userId`다.
- 비밀번호는 `BCryptPasswordEncoder`로 단방향 해시 저장한다.
- 권한은 `USER`, `ADMIN` 두 가지를 사용한다.
- 회원가입 API는 항상 `USER` 권한만 부여한다.
- 최초 `ADMIN`은 MongoDB에서 `users.roles`를 수동 수정해 지정한다.

## 세션

- access token은 JWT이며 HTTP `Authorization: Bearer` 헤더로 전달한다.
- refresh token은 opaque token으로 발급하고, MongoDB `sessions.refreshTokenHash`에는 SHA-256 해시만 저장한다.
- `sessions.expiresAt`에는 TTL 인덱스를 둔다.
- VS Code 확장은 refresh token을 `SecretStorage`에 저장하고 access token은 메모리에만 보관한다.

## LLM Gateway

- 모델 서버 주소는 `klee.llm.base-url` 설정으로만 관리한다.
- 백엔드는 `LLMGateway` Bean을 통해 중앙 Ollama `ChatClient`를 생성한다.
- 사용자는 서버 URL, provider, 임의 endpoint를 저장하거나 수정할 수 없다.
- `GET /models`는 운영자가 허용한 모델 목록만 반환한다.

## 사용자 Preference

- `user_preferences`에는 `selectedModel`, `temperature`, `responseLanguage`만 저장한다.
- `selectedModel`은 `klee.llm.models` allow-list에 포함된 값만 허용한다.
- preference가 없으면 `klee.llm.default-model`, `default-temperature`, `default-response-language`를 사용한다.

## 채팅 연동

- `/chat/status`, `/chat`, `/chat/stream`, `/models`, `/me/preferences`는 인증 필수다.
- `ChatService`는 preference를 읽은 뒤 `LLMGateway`의 `ChatClient`로 중앙 Ollama에 요청한다.
- `audit_logs`에는 `modelProvider=ollama`, `externalTransfer=false`를 기록한다.
- `ai_chat_memory`와 conversation 흐름은 기존 구조를 유지한다.

## MongoDB 컬렉션

- `users`: 사용자 계정과 권한
- `sessions`: refresh token 기반 세션
- `user_preferences`: 사용자 경험 설정
- `audit_logs`: 사용자별 채팅 요청 감사 로그
- `ai_chat_memory`: Spring AI 대화 메모리
- `conversations`: 대화 목록과 상태
