import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { sendChatMessage } from '../services/llmService';
import { getBackendUrl } from '../config/settings';

export type WebviewMessage =
    | { type: 'WEBVIEW_READY' }
    | { type: 'SEND_MESSAGE'; payload: { text: string } }
    | { type: 'NEW_CONVERSATION' };

export class WebviewMessageHandler {
    private conversationId = randomUUID();

    constructor(private readonly postMessage: (message: Record<string, unknown>) => Thenable<boolean>) {}

    async handle(message: WebviewMessage): Promise<void> {
        switch (message.type) {
            case 'WEBVIEW_READY':
                await this.postBackendStatus();
                return;
            case 'NEW_CONVERSATION':
                await this.resetConversation();
                return;
            case 'SEND_MESSAGE':
                await this.ask(message.payload.text);
                return;
        }
    }

    async askExternal(question: string): Promise<void> {
        await this.postMessage({ type: 'USER_MESSAGE', payload: { text: question } });
        await this.ask(question);
    }

    async resetConversation(): Promise<void> {
        this.conversationId = randomUUID();
        await this.postMessage({ type: 'CONVERSATION_RESET' });
    }

    private async ask(question: string): Promise<void> {
        const trimmedQuestion = question.trim();

        if (!trimmedQuestion) {
            return;
        }

        await this.postMessage({ type: 'REQUEST_STARTED' });

        try {
            const editor = vscode.window.activeTextEditor;
            const code = editor?.document.getText(editor.selection) ?? '';
            const response = await sendChatMessage({
                conversationId: this.conversationId,
                code,
                question: trimmedQuestion,
            });

            await this.postMessage({
                type: 'ASSISTANT_RESPONSE',
                payload: { text: response.answer },
            });
        } catch (err) {
            await this.postMessage({
                type: 'ERROR',
                payload: { message: err instanceof Error ? err.message : String(err) },
            });
        }
    }

    private async postBackendStatus(): Promise<void> {
        await this.postMessage({
            type: 'STATUS',
            payload: { backendUrl: getBackendUrl() },
        });
    }
}
