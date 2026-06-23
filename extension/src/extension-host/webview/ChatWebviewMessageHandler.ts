import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { getChatStatus, sendChatMessageStream } from '../services/chatApiClient';
import { getBackendUrl } from '../config/settings';
import { buildChatRequest } from '../chat/context';

export type WebviewMessage =
    | { type: 'WEBVIEW_READY' }
    | { type: 'SEND_MESSAGE'; payload: { text: string } }
    | { type: 'STOP_GENERATION' }
    | { type: 'NEW_CONVERSATION' };

export class ChatWebviewMessageHandler {
    private conversationId = randomUUID();
    private activeAbortController: AbortController | undefined;
    private activeMessageId: string | undefined;

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
            case 'STOP_GENERATION':
                this.stopActiveRequest();
                return;
        }
    }

    async askExternal(question: string): Promise<void> {
        await this.postMessage({ type: 'USER_MESSAGE', payload: { text: question } });
        await this.ask(question);
    }

    async resetConversation(): Promise<void> {
        this.abortActiveRequestWithoutNotification();
        this.conversationId = randomUUID();
        await this.postMessage({ type: 'CONVERSATION_RESET' });
    }

    private async ask(question: string): Promise<void> {
        const trimmedQuestion = question.trim();

        if (!trimmedQuestion) {
            return;
        }

        if (this.activeAbortController) {
            return;
        }

        const assistantMessageId = randomUUID();
        const abortController = new AbortController();
        this.activeAbortController = abortController;
        this.activeMessageId = assistantMessageId;

        await this.postMessage({ type: 'REQUEST_STARTED', payload: { messageId: assistantMessageId } });

        try {
            const editor = vscode.window.activeTextEditor;
            const request = buildChatRequest(editor, this.conversationId, trimmedQuestion);
            await sendChatMessageStream(
                request,
                {
                    onProgressDelta: async (text) => {
                        void this.postMessage({
                            type: 'PROGRESS_DELTA',
                            payload: { messageId: assistantMessageId, text },
                        });
                    },
                    onAnswerDelta: async (text) => {
                        void this.postMessage({
                            type: 'ASSISTANT_DELTA',
                            payload: { messageId: assistantMessageId, text },
                        });
                    },
                    onDone: async () => {
                        void this.postMessage({
                            type: 'ASSISTANT_RESPONSE',
                            payload: { messageId: assistantMessageId },
                        });
                    },
                },
                abortController.signal,
            );
        } catch (err) {
            if (isAbortError(err)) {
                if (this.activeMessageId === assistantMessageId) {
                    await this.postMessage({
                        type: 'REQUEST_STOPPED',
                        payload: { messageId: assistantMessageId },
                    });
                }
                return;
            }

            const message = err instanceof Error ? err.message : String(err);
            await this.postMessage({
                type: 'ERROR',
                payload: {
                    messageId: assistantMessageId,
                    message,
                },
            });
        } finally {
            if (this.activeAbortController === abortController) {
                this.activeAbortController = undefined;
                this.activeMessageId = undefined;
            }
        }
    }

    private async postBackendStatus(): Promise<void> {
        try {
            const status = await getChatStatus();
            await this.postMessage({
                type: 'STATUS',
                payload: { backendUrl: getBackendUrl(), provider: status.provider, model: status.model },
            });
        } catch {
            await this.postMessage({
                type: 'STATUS',
                payload: { backendUrl: getBackendUrl() },
            });
        }
    }

    private stopActiveRequest(): void {
        this.activeAbortController?.abort();
    }

    private abortActiveRequestWithoutNotification(): void {
        const abortController = this.activeAbortController;
        this.activeAbortController = undefined;
        this.activeMessageId = undefined;
        abortController?.abort();
    }
}

function isAbortError(err: unknown): boolean {
    return err instanceof Error && err.name === 'AbortError';
}
