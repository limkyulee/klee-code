export interface SendMessagePayload {
    text: string;
}

export type WebviewToExtensionMessage =
    | { type: 'WEBVIEW_READY' }
    | { type: 'SEND_MESSAGE'; payload: SendMessagePayload }
    | { type: 'NEW_CONVERSATION' };

export type ExtensionToWebviewMessage =
    | { type: 'STATUS'; payload: { backendUrl: string } }
    | { type: 'REQUEST_STARTED' }
    | { type: 'USER_MESSAGE'; payload: { text: string } }
    | { type: 'ASSISTANT_RESPONSE'; payload: { text: string } }
    | { type: 'ERROR'; payload: { message: string } }
    | { type: 'CONVERSATION_RESET' };

interface VsCodeApi {
    postMessage(message: WebviewToExtensionMessage): void;
}

declare global {
    interface Window {
        acquireVsCodeApi?: () => VsCodeApi;
    }
}

const fallbackApi: VsCodeApi = {
    postMessage(message) {
        console.info('VS Code API unavailable', message);
    },
};

export const vscode = window.acquireVsCodeApi?.() ?? fallbackApi;
