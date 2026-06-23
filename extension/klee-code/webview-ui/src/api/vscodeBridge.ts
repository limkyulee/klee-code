export interface SendMessagePayload {
    text: string;
}

export type WebviewToExtensionMessage =
    | { type: 'WEBVIEW_READY' }
    | { type: 'SEND_MESSAGE'; payload: SendMessagePayload }
    | { type: 'NEW_CONVERSATION' };

export type ExtensionToWebviewMessage =
    | { type: 'STATUS'; payload: { backendUrl: string } }
    | { type: 'REQUEST_STARTED'; payload: { messageId: string } }
    | { type: 'USER_MESSAGE'; payload: { text: string } }
    | { type: 'PROGRESS_DELTA'; payload: { messageId: string; text: string } }
    | { type: 'ASSISTANT_DELTA'; payload: { messageId: string; text: string } }
    | { type: 'ASSISTANT_RESPONSE'; payload: { messageId: string } }
    | { type: 'ERROR'; payload: { message: string; messageId?: string } }
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
