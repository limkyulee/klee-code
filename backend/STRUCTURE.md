# Backend 구조 문서

`backend/`는 Klee Code의 서버 애플리케이션입니다. Spring Boot 4, Java 21, Spring AI, MongoDB를 사용하며 VS Code 확장에서 전달한 질문과 코드 컨텍스트를 LLM에 전달하고, 대화 메모리와 감사 로그를 MongoDB에 저장합니다.

## 최상위 구조

```text
backend/
├── build.gradle
├── settings.gradle
├── gradlew
├── gradlew.bat
├── gradle/
│   └── wrapper/
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties
└── src/
    ├── main/
    │   ├── java/
    │   │   └── com/kleecode/backend/
    │   └── resources/
    └── test/
        └── java/
            └── com/kleecode/backend/
```

## 루트 파일

- `build.gradle`: Spring Boot, Java toolchain, Spring AI, MongoDB, Web MVC, 테스트 의존성을 정의합니다.
- `settings.gradle`: Gradle 루트 프로젝트 이름을 `backend`로 지정합니다.
- `gradlew`, `gradlew.bat`: 로컬 Gradle 설치 없이 빌드와 테스트를 실행하기 위한 Gradle Wrapper 실행 파일입니다.
- `gradle/wrapper/gradle-wrapper.jar`: Gradle Wrapper 런타임 파일입니다.
- `gradle/wrapper/gradle-wrapper.properties`: Gradle 배포판 버전과 다운로드 위치를 정의합니다.

## 애플리케이션 소스

```text
src/main/java/com/kleecode/backend/
├── BackendApplication.java
├── audit/
│   ├── dto/
│   │   ├── AuditLog.java
│   │   └── AuditLogStatus.java
│   ├── repository/
│   │   └── AuditLogRepository.java
│   ├── service/
│   │   └── AuditLogService.java
│   └── package-info.java
├── chat/
│   ├── controller/
│   │   └── ChatController.java
│   ├── dto/
│   │   ├── ChatRequest.java
│   │   ├── ChatResponse.java
│   │   ├── CodeContext.java
│   │   └── SelectionRange.java
│   ├── repository/
│   │   └── package-info.java
│   └── service/
│       └── ChatService.java
└── config/
    ├── ChatConfig.java
    └── WebConfig.java
```

### 공통 엔트리

- `BackendApplication.java`: Spring Boot 애플리케이션 시작점입니다.

### `chat/`

채팅 API와 LLM 호출 흐름을 담당하는 도메인 패키지입니다.

- `chat/controller/ChatController.java`: `/chat`, `/chat/stream` 엔드포인트를 제공합니다. 일반 JSON 응답과 SSE 스트리밍 응답을 모두 지원합니다.
- `chat/service/ChatService.java`: Spring AI `ChatClient`를 통해 모델에 질문을 전달합니다. 선택 코드, 파일 정보, 주변 코드 조각을 프롬프트로 구성하고 대화 메모리와 감사 로그 처리를 연결합니다.
- `chat/dto/ChatRequest.java`: 확장에서 백엔드로 전달하는 요청 DTO입니다. `conversationId`, 선택 코드, 질문, 코드 컨텍스트를 포함합니다.
- `chat/dto/ChatResponse.java`: 일반 `/chat` 응답 DTO입니다. 모델 응답 텍스트를 담습니다.
- `chat/dto/CodeContext.java`: 파일 경로, 언어 ID, 선택 범위, 선택 텍스트, 주변 코드 조각을 담는 코드 메타데이터입니다.
- `chat/dto/SelectionRange.java`: 에디터 선택 영역의 시작/끝 라인과 문자 위치를 표현합니다.
- `chat/repository/package-info.java`: 향후 채팅 저장소 패키지를 위한 패키지 문서 자리입니다.

### `audit/`

채팅 요청과 응답 결과를 MongoDB에 감사 로그로 저장하는 패키지입니다.

- `audit/dto/AuditLog.java`: `audit_logs` 컬렉션에 저장되는 MongoDB 문서입니다. 대화 ID, 모델 제공자, 외부 전송 여부, 코드 컨텍스트, 질문, 답변, 오류 정보를 포함합니다.
- `audit/dto/AuditLogStatus.java`: 감사 로그 상태 enum입니다. 요청 시작, 성공, 실패 상태를 표현합니다.
- `audit/repository/AuditLogRepository.java`: `AuditLog` 문서를 저장하는 Spring Data MongoDB repository입니다.
- `audit/service/AuditLogService.java`: 감사 로그 생성과 성공/실패 갱신을 담당합니다. 저장 실패가 채팅 응답 흐름을 깨지 않도록 예외를 흡수하고 경고 로그만 남깁니다.
- `audit/package-info.java`: 감사 로그 패키지 설명을 담는 패키지 문서입니다.

### `config/`

Spring Bean과 Web MVC 설정을 모아둔 패키지입니다.

- `config/ChatConfig.java`: Spring AI `ChatClient` Bean을 구성합니다. `MessageChatMemoryAdvisor`를 기본 advisor로 등록해 MongoDB 기반 대화 메모리를 사용합니다.
- `config/WebConfig.java`: 전역 CORS 설정을 제공합니다. 개발 편의를 위해 모든 origin 패턴과 `GET`, `POST`, `OPTIONS` 메서드를 허용합니다.

## 리소스

```text
src/main/resources/
└── application.yml
```

- `application.yml`: 애플리케이션 이름, MongoDB URI, AI provider, Anthropic/Ollama 모델 설정을 환경 변수 기반으로 정의합니다.

## 테스트

```text
src/test/java/com/kleecode/backend/
├── BackendApplicationTests.java
└── audit/
    └── AuditLogServiceTest.java
```

- `BackendApplicationTests.java`: Spring Boot 컨텍스트 로딩 테스트입니다.
- `audit/AuditLogServiceTest.java`: 감사 로그 저장 서비스의 동작을 검증하는 테스트입니다.

## 생성물 및 제외 대상

다음 디렉터리는 개발/빌드 과정에서 생성되는 산출물이므로 소스 구조 문서의 기준에서 제외합니다.

- `.gradle/`: Gradle 로컬 캐시와 실행 이력입니다.
- `build/`: 컴파일 결과, 테스트 결과, jar 산출물, 리포트가 생성되는 디렉터리입니다.

## 주요 실행 흐름

1. VS Code 확장이 `/chat/stream`으로 질문, 대화 ID, 코드 컨텍스트를 전송합니다.
2. `ChatController`가 요청을 받고 `ChatService`에 위임합니다.
3. `ChatService`가 선택 코드와 주변 컨텍스트를 사용자 메시지로 구성합니다.
4. `ChatClient`가 Spring AI 설정에 따라 Anthropic 또는 Ollama 모델을 호출합니다.
5. `MessageChatMemoryAdvisor`가 `conversationId`를 기준으로 MongoDB 대화 메모리를 읽고 갱신합니다.
6. `AuditLogService`가 요청 시작, 성공, 실패 상태를 MongoDB 감사 로그로 저장합니다.
7. 스트리밍 응답은 `progress`, `token`, `done` SSE 이벤트로 확장에 전달됩니다.
