import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import {
    ApiError,
    deleteConversation,
    getChatHistory,
    getChatStatus,
    getConversation,
    getModelConfig,
    saveModelConfig,
    sendChatMessageStream,
} from '../services/chatApiClient';
import { getBackendUrl } from '../config/settings';
import { buildChatRequest } from '../chat/context';
import { AuthSession } from '../services/authSession';

export type WebviewMessage =
    | { type: 'WEBVIEW_READY' }
    | { type: 'LOGIN'; payload: { userId: string; password: string } }
    | { type: 'REGISTER'; payload: { userId: string; password: string } }
    | { type: 'LOGOUT' }
    | { type: 'SAVE_MODEL_CONFIG'; payload: { baseUrl: string; modelName: string } }
    | { type: 'REQUEST_CHAT_HISTORY' }
    | { type: 'SELECT_CONVERSATION'; payload: { conversationId: string } }
    | { type: 'DELETE_CONVERSATION'; payload: { conversationId: string } }
    | { type: 'SEND_MESSAGE'; payload: { text: string } }
    | { type: 'STOP_GENERATION' }
    | { type: 'NEW_CONVERSATION' };

export class ChatWebviewMessageHandler {
    private conversationId: string = randomUUID();
    private activeAbortController: AbortController | undefined;
    private activeMessageId: string | undefined;

    constructor(
        private readonly postMessage: (message: Record<string, unknown>) => Thenable<boolean>,
        private readonly authSession: AuthSession,
    ) {}

    async handle(message: WebviewMessage): Promise<void> {
        switch (message.type) {
            case 'WEBVIEW_READY':
                await this.restoreSession();
                return;
            case 'LOGIN':
                await this.login(message.payload.userId, message.payload.password);
                return;
            case 'REGISTER':
                await this.register(message.payload.userId, message.payload.password);
                return;
            case 'LOGOUT':
                await this.logout();
                return;
            case 'SAVE_MODEL_CONFIG':
                await this.saveModelConfig(message.payload.baseUrl, message.payload.modelName);
                return;
            case 'REQUEST_CHAT_HISTORY':
                await this.postChatHistory();
                return;
            case 'SELECT_CONVERSATION':
                await this.selectConversation(message.payload.conversationId);
                return;
            case 'DELETE_CONVERSATION':
                await this.deleteConversation(message.payload.conversationId);
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
        await this.postMessage({ type: 'CONVERSATION_RESET', payload: { conversationId: this.conversationId } });
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

        await this.postMessage({
            type: 'REQUEST_STARTED',
            payload: { messageId: assistantMessageId, conversationId: this.conversationId },
        });

        try {
            const editor = vscode.window.activeTextEditor;
            const request = buildChatRequest(editor, this.conversationId, trimmedQuestion);
            await this.withAuthorizedRetry((accessToken) =>
                sendChatMessageStream(
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
                    { accessToken },
                    abortController.signal,
                ),
            );
            await this.postChatHistory();
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
            const status = await this.withAuthorizedRetry((accessToken) => getChatStatus({ accessToken }));
            await this.postMessage({
                type: 'STATUS',
                payload: {
                    backendUrl: getBackendUrl(),
                    configured: status.configured,
                    provider: status.provider,
                    model: status.model,
                },
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

    private async restoreSession(): Promise<void> {
        const user = await this.authSession.restore();
        if (!user) {
            await this.postMessage({ type: 'AUTH_REQUIRED' });
            return;
        }

        await this.postMessage({ type: 'AUTHENTICATED', payload: { user } });
        await this.postModelConfig();
        await this.postBackendStatus();
        await this.postChatHistory();
    }

    private async login(userId: string, password: string): Promise<void> {
        try {
            const user = await this.authSession.login(userId, password);
            await this.postMessage({ type: 'AUTHENTICATED', payload: { user } });
            await this.postModelConfig();
            await this.postBackendStatus();
            await this.postChatHistory();
        } catch (err) {
            await this.postAuthError(err);
        }
    }

    private async register(userId: string, password: string): Promise<void> {
        try {
            const user = await this.authSession.register(userId, password);
            await this.postMessage({ type: 'AUTHENTICATED', payload: { user } });
            await this.postModelConfig();
            await this.postBackendStatus();
            await this.postChatHistory();
        } catch (err) {
            await this.postAuthError(err);
        }
    }

    private async logout(): Promise<void> {
        await this.authSession.signOut();
        this.abortActiveRequestWithoutNotification();
        await this.postMessage({ type: 'SIGNED_OUT' });
    }

    private async saveModelConfig(baseUrl: string, modelName: string): Promise<void> {
        try {
            const modelConfig = await this.withAuthorizedRetry((accessToken) =>
                saveModelConfig({ provider: 'OLLAMA', baseUrl, modelName }, { accessToken }),
            );
            await this.postMessage({ type: 'MODEL_CONFIG', payload: { modelConfig } });
            await this.postBackendStatus();
        } catch (err) {
            await this.postMessage({ type: 'ERROR', payload: { message: toErrorMessage(err) } });
        }
    }

    private async postModelConfig(): Promise<void> {
        try {
            const modelConfig = await this.withAuthorizedRetry((accessToken) => getModelConfig({ accessToken }));
            await this.postMessage({ type: 'MODEL_CONFIG', payload: { modelConfig } });
        } catch {
            await this.postMessage({ type: 'MODEL_CONFIG', payload: { modelConfig: { configured: false } } });
        }
    }

    private async postChatHistory(): Promise<void> {
        try {
            const history = await this.withAuthorizedRetry((accessToken) => getChatHistory({ accessToken }));
            await this.postMessage({ type: 'CHAT_HISTORY', payload: { history } });
        } catch {
            await this.postMessage({ type: 'CHAT_HISTORY', payload: { history: [] } });
        }
    }

    private async selectConversation(conversationId: string): Promise<void> {
        if (this.activeAbortController) {
            return;
        }

        try {
            const detail = await this.withAuthorizedRetry((accessToken) => getConversation(conversationId, { accessToken }));
            this.conversationId = detail.conversationId;
            await this.postMessage({ type: 'CONVERSATION_LOADED', payload: detail });
        } catch (err) {
            await this.postMessage({ type: 'ERROR', payload: { message: toErrorMessage(err) } });
        }
    }

    private async deleteConversation(conversationId: string): Promise<void> {
        if (this.activeAbortController) {
            return;
        }

        try {
            await this.withAuthorizedRetry((accessToken) => deleteConversation(conversationId, { accessToken }));
            const activeReset = this.conversationId === conversationId;
            if (activeReset) {
                this.conversationId = randomUUID();
            }
            await this.postMessage({
                type: 'CONVERSATION_DELETED',
                payload: { conversationId, activeReset, nextConversationId: this.conversationId },
            });
            await this.postChatHistory();
        } catch (err) {
            await this.postMessage({ type: 'ERROR', payload: { message: toErrorMessage(err) } });
        }
    }

    private async withAuthorizedRetry<T>(operation: (accessToken: string) => Promise<T>): Promise<T> {
        const accessToken = await this.authSession.getAccessToken();
        if (!accessToken) {
            throw new Error('Sign in is required');
        }

        try {
            return await operation(accessToken);
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                const refreshedToken = await this.authSession.refreshAccessToken();
                if (refreshedToken) {
                    return operation(refreshedToken);
                }
            }
            throw err;
        }
    }

    private async postAuthError(err: unknown): Promise<void> {
        await this.postMessage({ type: 'AUTH_ERROR', payload: { message: toErrorMessage(err) } });
    }
}

function isAbortError(err: unknown): boolean {
    return err instanceof Error && err.name === 'AbortError';
}

function toErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}
