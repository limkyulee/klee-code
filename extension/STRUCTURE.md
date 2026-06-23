# Extension 구조 문서

`extension/`은 Klee Code의 VS Code 확장 패키지입니다. 런타임은 두 영역으로 나뉩니다.

- `src/extension-host/`: VS Code extension host에서 실행되는 Node.js 코드입니다.
- `webview-ui/`: VS Code webview iframe 안에서 실행되는 React UI 코드입니다.

## 최상위 구조

```text
extension/
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.extension.config.ts
├── vite.webview.config.ts
├── README.md
├── CHANGELOG.md
├── STRUCTURE.md
├── resources/
├── src/
│   ├── extension-host/
│   └── test/
└── webview-ui/
    ├── tsconfig.json
    └── src/
```

## 루트 파일

- `package.json`: VS Code 확장 메타데이터, activation event, view/command/configuration contribution, npm script, 의존성을 정의합니다.
- `package-lock.json`: npm 의존성 잠금 파일입니다.
- `tsconfig.json`: extension host와 테스트 코드를 위한 TypeScript 설정입니다.
- `vite.extension.config.ts`: extension host 엔트리인 `src/extension-host/extension.ts`를 CommonJS 번들 `dist/extension.js`로 빌드합니다.
- `vite.webview.config.ts`: React webview 엔트리인 `webview-ui/src/main.tsx`를 `dist/webview/app.js`, `dist/webview/app.css`로 빌드합니다.
- `README.md`: 확장 사용 또는 개발 안내 문서입니다.
- `CHANGELOG.md`: 확장 변경 이력을 기록하는 문서입니다.
- `STRUCTURE.md`: 현재 파일입니다. 확장 패키지의 폴더와 파일 역할을 설명합니다.

## Extension Host

```text
src/extension-host/
├── extension.ts
├── constants.ts
├── chat/
│   ├── context.ts
│   └── types.ts
├── config/
│   └── settings.ts
├── services/
│   └── chatApiClient.ts
└── webview/
    ├── AssistantViewProvider.ts
    ├── ChatWebviewMessageHandler.ts
    └── getWebviewHtml.ts
```

Extension host 영역은 VS Code API, 사용자의 에디터 선택 영역, 백엔드 API, webview 메시지 경계를 담당합니다.

- `extension.ts`: 확장 활성화 엔트리입니다. `klee-code.chatView` webview view provider와 `klee-code.askAssistant`, `klee-code.newConversation` 커맨드를 등록합니다.
- `constants.ts`: 백엔드 API 경로 등 extension host에서 공유하는 상수를 둡니다.
- `chat/context.ts`: 현재 활성 에디터의 선택 영역, 파일 경로, 언어 ID, 주변 코드 조각을 백엔드 `ChatRequest` 형태로 변환합니다.
- `chat/types.ts`: 백엔드 채팅 요청/응답 타입을 정의합니다.
- `config/settings.ts`: VS Code 설정에서 `klee-code.backendUrl` 값을 읽는 설정 접근 레이어입니다.
- `services/chatApiClient.ts`: 백엔드 `/chat`, `/chat/stream` 호출을 담당합니다. SSE 응답의 `progress`, `token`, `done` 이벤트를 파싱해 핸들러로 전달합니다.
- `webview/AssistantViewProvider.ts`: VS Code `WebviewViewProvider` 구현체입니다. Klee Code 패널을 생성하고 webview HTML, local resource root, 메시지 수신 핸들러를 연결합니다.
- `webview/ChatWebviewMessageHandler.ts`: webview와 extension host 사이의 메시지 경계입니다. 대화 ID를 관리하고, 질문 전송/새 대화/상태 전달을 처리합니다.
- `webview/getWebviewHtml.ts`: webview에 주입할 HTML 문서, CSP, nonce, 번들 리소스 URI를 생성합니다.

## Webview UI

```text
webview-ui/
├── tsconfig.json
└── src/
    ├── main.tsx
    ├── styles/
    │   └── global.css
    └── features/
        └── chat/
            ├── ChatView.tsx
            ├── types.ts
            ├── api/
            │   ├── vscodeBridge.ts
            │   └── webviewProtocol.ts
            ├── components/
            │   ├── ChatInput.tsx
            │   ├── MessageBubble.tsx
            │   └── MessageList.tsx
            └── model/
                └── messageReducer.ts
```

Webview UI 영역은 React 기반 채팅 화면입니다. VS Code API를 직접 호출하지 않고 `vscodeBridge`와 message protocol을 통해 extension host와 통신합니다.

- `webview-ui/tsconfig.json`: React webview 전용 TypeScript 설정입니다.
- `webview-ui/src/main.tsx`: React 앱 부트스트랩 엔트리입니다.
- `webview-ui/src/styles/global.css`: VS Code 테마 변수 기반 전역 스타일입니다.
- `webview-ui/src/features/chat/ChatView.tsx`: 채팅 화면 컨테이너입니다. extension host에서 오는 메시지를 받아 상태를 갱신하고 사용자 입력을 전송합니다.
- `webview-ui/src/features/chat/types.ts`: webview 채팅 UI에서 사용하는 메시지 타입을 정의합니다.
- `webview-ui/src/features/chat/api/vscodeBridge.ts`: `acquireVsCodeApi` 접근을 감싼 브리지입니다.
- `webview-ui/src/features/chat/api/webviewProtocol.ts`: webview와 extension host 사이에서 주고받는 메시지 타입을 정의합니다.
- `webview-ui/src/features/chat/components/ChatInput.tsx`: 사용자 질문 입력 컴포넌트입니다.
- `webview-ui/src/features/chat/components/MessageBubble.tsx`: 사용자/어시스턴트/오류 메시지 표시 컴포넌트입니다.
- `webview-ui/src/features/chat/components/MessageList.tsx`: 채팅 메시지 목록 컴포넌트입니다.
- `webview-ui/src/features/chat/model/messageReducer.ts`: 메시지 추가, 토큰 누적, 진행 상태 누적, 스트리밍 완료, 초기화를 처리하는 reducer입니다.

## 테스트

```text
src/test/
└── chatContext.test.ts
```

- `src/test/chatContext.test.ts`: 선택 영역과 주변 코드 조각을 채팅 요청 컨텍스트로 변환하는 로직을 검증합니다.

## 리소스

```text
resources/
└── klee-code.svg
```

- `resources/klee-code.svg`: VS Code activity/view 아이콘으로 사용하는 확장 리소스입니다.

## 빌드 산출물 및 제외 대상

다음 디렉터리는 설치, 테스트, 빌드 과정에서 생성되는 산출물이므로 소스 구조 문서의 기준에서 제외합니다.

- `node_modules/`: npm 의존성 설치 디렉터리입니다.
- `dist/`: Vite 빌드 결과입니다. `dist/extension.js`, `dist/webview/app.js`, `dist/webview/app.css`가 생성됩니다.
- `out/`: TypeScript 테스트 컴파일 결과입니다.
- `.vscode-test/`: VS Code extension test 실행 시 다운로드되는 테스트용 VS Code와 사용자 데이터입니다.
- `.vscode/`: 로컬 VS Code 작업공간 설정입니다.

## 주요 실행 흐름

1. VS Code가 `onView:klee-code.chatView` 또는 커맨드 실행으로 확장을 활성화합니다.
2. `extension.ts`가 `AssistantViewProvider`와 명령을 등록합니다.
3. `AssistantViewProvider`가 webview HTML을 구성하고 `ChatWebviewMessageHandler`를 연결합니다.
4. webview UI가 준비되면 `WEBVIEW_READY` 메시지를 보내고 백엔드 URL 상태를 받습니다.
5. 사용자가 질문을 입력하거나 커맨드로 질문을 보내면 extension host가 활성 에디터의 코드 컨텍스트를 수집합니다.
6. `chatApiClient.ts`가 백엔드 `/chat/stream`으로 요청을 보내고 SSE 응답을 파싱합니다.
7. streaming token과 progress 이벤트가 webview로 전달되고 `messageReducer.ts`가 화면 상태를 갱신합니다.
8. `NEW_CONVERSATION` 요청은 새 `conversationId`를 생성하고 webview 메시지 상태를 초기화합니다.

## 구조 관리 원칙

- VS Code API와 직접 맞닿는 코드는 `src/extension-host/` 아래에 둡니다.
- React UI 코드는 `webview-ui/src/` 아래에 두고 extension host 코드와 섞지 않습니다.
- 메시지 타입은 protocol 파일에 모으고, 실제 VS Code bridge 호출은 bridge 파일에서 처리합니다.
- React 엔트리는 얇게 유지하고, 기능별 상태와 컴포넌트는 `features/<feature>/` 아래에 둡니다.
- 번들 결과는 `dist/`에만 생성하고 소스 디렉터리에는 생성물을 두지 않습니다.
