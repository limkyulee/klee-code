import type { WebviewToExtensionMessage } from './webviewProtocol';

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
