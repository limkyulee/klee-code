# Klee Code Design V2

## 목표

V2는 사용자별 로그인, 세션 처리, 사용자별 Ollama 모델 서버 설정을 추가한다. 대화 히스토리 목록/상세/이어가기는 다음 단계로 분리하고, 이번 단계에서는 사용자 식별자(`userId`)와 모델 설정을 채팅 요청 경로에 연결한다.

## 사용자 계정

- 로그인 식별자는 회원가입 시 사용자가 입력한 `userId`다.
- MongoDB `_id`는 내부 문서 ID로만 사용하고, 비즈니스 식별자는 `userId`로 유지한다.
- `userId`는 로그인과 표시가 필요하므로 해시하지 않는다.
- 비밀번호는 복호화가 필요 없는 값이므로 `BCryptPasswordEncoder`로 단방향 해시 저장한다.
- 권한은 `USER`, `ADMIN` 두 가지를 사용한다.
- 회원가입 API는 항상 `USER` 권한만 부여한다.
- 최초 `ADMIN`은 MongoDB에서 `users.roles`를 수동 수정해 지정한다.

## 세션

- access token은 JWT이며 HTTP `Authorization: Bearer` 헤더로 전달한다.
- refresh token은 opaque token으로 발급하고, MongoDB `sessions.refreshTokenHash`에는 SHA-256 해시만 저장한다.
- `sessions.expiresAt`에는 TTL 인덱스를 둬 만료 세션을 자동 정리한다.
- 로그아웃은 해당 refresh session의 `revokedAt`을 채운다.
- VS Code 확장은 refresh token을 `SecretStorage`에 저장하고 access token은 메모리에만 보관한다.

## 모델 설정

- 사용자별 모델 설정은 `user_model_configs`에 저장한다.
- V2 provider는 `OLLAMA`만 지원한다.
- 필수 값은 `baseUrl`, `modelName`이다.
- 모델 설정이 없는 사용자는 전역 기본값이나 개발자 토큰을 사용하지 않는다.
- 채팅 요청 시 설정이 없으면 백엔드는 `MODEL_CONFIG_REQUIRED` 오류를 반환하고, Webview는 모델 설정 입력 화면을 보여준다.

## 채팅 연동

- `/chat/status`, `/chat`, `/chat/stream`은 인증 필수다.
- 채팅 요청은 현재 로그인 사용자의 `user_model_configs`를 조회한 뒤 해당 Ollama 서버로 전달한다.
- `audit_logs`에는 `userId`를 추가해 요청 주체를 남긴다.
- `ai_chat_memory` 구조는 유지한다. 이후 히스토리 기능에서 `userId + conversationId` 소유권 검증을 추가한다.

## MongoDB 컬렉션

- `users`: 사용자 계정과 권한
- `sessions`: refresh token 기반 세션
- `user_model_configs`: 사용자별 Ollama 서버 설정
- `audit_logs`: 사용자별 채팅 요청 감사 로그
- `ai_chat_memory`: Spring AI 대화 메모리
