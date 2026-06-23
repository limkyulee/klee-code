# Extension Structure

This package has two runtime boundaries:

- `src/extension-host`: Node.js code that runs in the VS Code extension host.
- `webview-ui`: React code that runs in the isolated VS Code webview iframe.

Generated artifacts are kept out of source folders:

- `dist/extension.js`: bundled extension host entry.
- `dist/webview/app.js` and `dist/webview/app.css`: bundled webview assets loaded through `Webview.asWebviewUri`.

## Extension Host

- `extension.ts`: activation entry; registers commands and the chat webview view provider.
- `webview/AssistantViewProvider.ts`: VS Code `WebviewViewProvider` implementation for `klee-code.chatView`.
- `webview/ChatWebviewMessageHandler.ts`: message boundary between extension host and webview UI.
- `webview/getWebviewHtml.ts`: complete HTML document, CSP, nonce, and bundled asset URIs.
- `chat/context.ts`: builds chat request context from the active editor selection.
- `chat/types.ts`: backend chat request and response DTOs.
- `services/chatApiClient.ts`: backend HTTP/SSE client for chat endpoints.
- `config/settings.ts`: VS Code configuration access.
- `constants.ts`: shared extension-host constants.

## Webview UI

- `src/main.tsx`: React bootstrap only.
- `src/features/chat/ChatView.tsx`: chat feature container and webview message handling.
- `src/features/chat/api/webviewProtocol.ts`: typed webview-to-extension protocol.
- `src/features/chat/api/vscodeBridge.ts`: wrapper around `acquireVsCodeApi`.
- `src/features/chat/model/messageReducer.ts`: chat message state transitions.
- `src/features/chat/components`: presentational chat components.
- `src/features/chat/types.ts`: chat UI domain types.
- `src/styles/global.css`: VS Code theme-aware global styles.

## Naming Rules

- Name VS Code integration files by the VS Code API role: `AssistantViewProvider`, not `AssistantPanel`, because this extension contributes a `WebviewView`.
- Keep protocol and bridge separate: protocol files describe message shapes; bridge files call `acquireVsCodeApi`.
- Keep React entry files thin. Feature state, reducers, API bridges, and components live under `features/<feature>`.
- Keep bundled output under `dist`; source folders should stay framework/runtime specific.

## Reference Basis

- React 19.2 docs recommend starting with a framework for new apps, and using build tools such as Vite when app constraints require a custom setup: https://react.dev/learn/creating-a-react-app
- VS Code webviews run in isolated contexts, require `asWebviewUri` for local assets, should use restrictive `localResourceRoots`, and should include a Content Security Policy: https://code.visualstudio.com/api/extension-guides/webview
