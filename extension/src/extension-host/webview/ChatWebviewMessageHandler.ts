import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import {
    ApiError,
    deleteConversation,
    getChatHistory,
    getChatStatus,
    getConversation,
    getModels,
    getPreferences,
    savePreferences,
    postToolResult,
    sendAgentMessageStream,
} from '../services/chatApiClient';
import { getBackendUrl } from '../config/settings';
import { buildChatRequest } from '../chat/context';
import { readWorkspaceKleeContext } from '../chat/kleeContext';
import { executeLocalTool } from '../chat/localTools';
import { LOCAL_SLASH_COMMANDS, parseSlashCommand, type LocalSlashCommandName } from '../chat/slashCommand';
import type { PermissionMode } from '../chat/types';
import { AuthSession } from '../services/authSession';

export type WebviewMessage =
    | { type: 'WEBVIEW_READY' }
    | { type: 'LOGIN'; payload: { userId: string; password: string } }
    | { type: 'REGISTER'; payload: { userId: string; password: string } }
    | { type: 'LOGOUT' }
    | { type: 'SAVE_PREFERENCES'; payload: { selectedModel: string; temperature: number; responseLanguage: string } }
    | { type: 'REQUEST_CHAT_HISTORY' }
    | { type: 'SELECT_CONVERSATION'; payload: { conversationId: string } }
    | { type: 'DELETE_CONVERSATION'; payload: { conversationId: string } }
    | { type: 'SEND_MESSAGE'; payload: { text: string; permissionMode?: PermissionMode } }
    | { type: 'STOP_GENERATION' }
    | { type: 'NEW_CONVERSATION' };

type ConversationMessageStatus = 'STARTED' | 'SUCCEEDED' | 'FAILED';
type ConversationMessageRole = 'user' | 'assistant' | 'error';

interface ConversationSnapshotMessage {
    id: string;
    role: ConversationMessageRole;
    text: string;
    progress?: string[];
    streaming?: boolean;
    createdAt: string;
    status: ConversationMessageStatus;
}

interface ActiveRequest {
    abortController: AbortController;
    assistantMessageId: string;
}

export class ChatWebviewMessageHandler {
    private conversationId: string = randomUUID();
    private readonly activeRequests = new Map<string, ActiveRequest>();
    private readonly conversationSnapshots = new Map<string, ConversationSnapshotMessage[]>();

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
            case 'SAVE_PREFERENCES':
                await this.savePreferences(message.payload);
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
                await this.ask(message.payload.text, message.payload.permissionMode ?? 'ask');
                return;
            case 'STOP_GENERATION':
                this.stopActiveRequest();
                return;
        }
    }

    async askExternal(question: string): Promise<void> {
        await this.ask(question, 'ask');
    }

    async resetConversation(): Promise<void> {
        this.conversationId = randomUUID();
        await this.postMessage({
            type: 'CONVERSATION_RESET',
            payload: { conversationId: this.conversationId, pending: this.isConversationPending(this.conversationId) },
        });
    }

    private async clearConversation(): Promise<void> {
        const clearedConversationId = this.conversationId;
        this.abortConversationWithoutNotification(clearedConversationId);
        this.conversationSnapshots.delete(clearedConversationId);

        try {
            await this.withAuthorizedRetry((accessToken) => deleteConversation(clearedConversationId, { accessToken }));
        } catch (err) {
            if (!(err instanceof ApiError && err.status === 404)) {
                await this.postMessage({ type: 'ERROR', payload: { message: toErrorMessage(err) } });
            }
        }

        this.conversationId = randomUUID();
        await this.postMessage({
            type: 'CONVERSATION_RESET',
            payload: { conversationId: this.conversationId, pending: false },
        });
        await this.postChatHistory();
    }

    private async handleLocalSlashCommand(commandName: LocalSlashCommandName): Promise<void> {
        switch (commandName) {
            case 'clear':
                await this.clearConversation();
                return;
            case 'help':
                await this.postLocalCommandResponse('/help', this.localHelpText());
                return;
            case 'status':
                await this.postLocalCommandResponse('/status', await this.localStatusText());
                return;
        }
    }

    private async ask(question: string, permissionMode: PermissionMode): Promise<void> {
        const trimmedQuestion = question.trim();

        if (!trimmedQuestion) {
            return;
        }

        const parsedCommand = parseSlashCommand(trimmedQuestion);
        if (parsedCommand.type === 'local') {
            await this.handleLocalSlashCommand(parsedCommand.name);
            return;
        }

        const targetConversationId = this.conversationId;
        if (this.activeRequests.has(targetConversationId)) {
            return;
        }

        const assistantMessageId = randomUUID();
        const abortController = new AbortController();
        this.activeRequests.set(targetConversationId, { abortController, assistantMessageId });

        const userMessage = this.appendSnapshotMessage(targetConversationId, {
            id: randomUUID(),
            role: 'user',
            text: trimmedQuestion,
            createdAt: new Date().toISOString(),
            status: 'STARTED',
        });
        const assistantMessage = this.appendSnapshotMessage(targetConversationId, {
            id: assistantMessageId,
            role: 'assistant',
            text: '',
            progress: ['Request sent. Waiting for the model stream...'],
            streaming: true,
            createdAt: new Date().toISOString(),
            status: 'STARTED',
        });

        await this.postMessage({
            type: 'USER_MESSAGE',
            payload: { conversationId: targetConversationId, message: userMessage },
        });

        await this.postMessage({
            type: 'REQUEST_STARTED',
            payload: { messageId: assistantMessage.id, conversationId: targetConversationId },
        });

        try {
            const editor = vscode.window.activeTextEditor;
            const skillCommand = parsedCommand.type === 'promptSkill' ? parsedCommand.skillCommand : undefined;
            const kleeContext = await readWorkspaceKleeContext(skillCommand?.name);
            const request = buildChatRequest(editor, targetConversationId, parsedCommand.question, {
                skillCommand,
                kleeContext,
            });
            await this.withAuthorizedRetry((accessToken) =>
                sendAgentMessageStream(
                    { ...request, permissionMode },
                    {
                        onProgressDelta: async (text) => {
                            void this.postMessage({
                                type: 'PROGRESS_DELTA',
                                payload: {
                                    messageId: assistantMessageId,
                                    conversationId: targetConversationId,
                                    text,
                                },
                            });
                            this.appendSnapshotProgress(targetConversationId, assistantMessageId, text);
                        },
                        onAnswerDelta: async (text) => {
                            void this.postMessage({
                                type: 'ASSISTANT_DELTA',
                                payload: {
                                    messageId: assistantMessageId,
                                    conversationId: targetConversationId,
                                    text,
                                },
                            });
                            this.appendSnapshotText(targetConversationId, assistantMessageId, text);
                        },
                        onToolCallRequested: async (toolCall) => {
                            const result = await executeLocalTool(toolCall);
                            await postToolResult(result, { accessToken });
                            const statusText = result.status === 'SUCCEEDED' ? 'completed' : 'failed';
                            const progress = `Local tool ${statusText}: ${toolCall.toolName}`;
                            void this.postMessage({
                                type: 'PROGRESS_DELTA',
                                payload: {
                                    messageId: assistantMessageId,
                                    conversationId: targetConversationId,
                                    text: progress,
                                },
                            });
                            this.appendSnapshotProgress(targetConversationId, assistantMessageId, progress);
                        },
                        onDone: async () => {
                            this.finishSnapshotMessage(targetConversationId, assistantMessageId, 'SUCCEEDED');
                            void this.postMessage({
                                type: 'ASSISTANT_RESPONSE',
                                payload: { messageId: assistantMessageId, conversationId: targetConversationId },
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
                this.appendSnapshotProgress(targetConversationId, assistantMessageId, 'Response stopped.');
                this.finishSnapshotMessage(targetConversationId, assistantMessageId, 'STARTED');
                await this.postMessage({
                    type: 'REQUEST_STOPPED',
                    payload: { messageId: assistantMessageId, conversationId: targetConversationId },
                });
                return;
            }

            const message = err instanceof Error ? err.message : String(err);
            this.finishSnapshotMessage(targetConversationId, assistantMessageId, 'FAILED');
            this.appendSnapshotMessage(targetConversationId, {
                id: randomUUID(),
                role: 'error',
                text: message,
                createdAt: new Date().toISOString(),
                status: 'FAILED',
            });
            await this.postMessage({
                type: 'ERROR',
                payload: {
                    conversationId: targetConversationId,
                    messageId: assistantMessageId,
                    message,
                },
            });
        } finally {
            if (this.activeRequests.get(targetConversationId)?.abortController === abortController) {
                this.activeRequests.delete(targetConversationId);
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

    private async postLocalCommandResponse(commandText: string, responseText: string): Promise<void> {
        const targetConversationId = this.conversationId;
        const userMessage = this.appendSnapshotMessage(targetConversationId, {
            id: randomUUID(),
            role: 'user',
            text: commandText,
            createdAt: new Date().toISOString(),
            status: 'SUCCEEDED',
        });
        const assistantMessage = this.appendSnapshotMessage(targetConversationId, {
            id: randomUUID(),
            role: 'assistant',
            text: responseText,
            createdAt: new Date().toISOString(),
            status: 'SUCCEEDED',
        });

        await this.postMessage({
            type: 'USER_MESSAGE',
            payload: { conversationId: targetConversationId, message: userMessage },
        });
        await this.postMessage({
            type: 'USER_MESSAGE',
            payload: { conversationId: targetConversationId, message: assistantMessage },
        });
    }

    private localHelpText(): string {
        const commands = LOCAL_SLASH_COMMANDS
            .map((command) => `/${command.name}: ${command.description}`)
            .join('\n');
        return [
            '사용 가능한 내부 slash command:',
            commands,
            '',
            '.klee 커스터마이징:',
            '- .klee/rules/*.md: 모든 요청에 project rule로 포함됩니다.',
            '- .klee/skills/{name}.md: /{name} 명령을 사용할 때 custom skill로 포함됩니다.',
            '- .klee/hooks/*.md: 모든 요청에 project hook으로 포함됩니다.',
        ].join('\n');
    }

    private async localStatusText(): Promise<string> {
        try {
            const status = await this.withAuthorizedRetry((accessToken) => getChatStatus({ accessToken }));
            return [
                'Klee Code 상태:',
                `- Backend URL: ${getBackendUrl()}`,
                `- Provider: ${status.provider ?? 'unknown'}`,
                `- Model: ${status.model ?? 'unknown'}`,
                `- Configured: ${status.configured ? 'yes' : 'no'}`,
            ].join('\n');
        } catch (err) {
            return [
                'Klee Code 상태:',
                `- Backend URL: ${getBackendUrl()}`,
                `- Backend detail: ${toErrorMessage(err)}`,
            ].join('\n');
        }
    }

    private stopActiveRequest(): void {
        this.activeRequests.get(this.conversationId)?.abortController.abort();
    }

    private abortActiveRequestWithoutNotification(): void {
        for (const request of this.activeRequests.values()) {
            request.abortController.abort();
        }
        this.activeRequests.clear();
    }

    private abortConversationWithoutNotification(conversationId: string): void {
        const request = this.activeRequests.get(conversationId);
        this.activeRequests.delete(conversationId);
        request?.abortController.abort();
    }

    private isConversationPending(conversationId: string): boolean {
        return this.activeRequests.has(conversationId);
    }

    private appendSnapshotMessage(
        conversationId: string,
        message: ConversationSnapshotMessage,
    ): ConversationSnapshotMessage {
        const messages = this.conversationSnapshots.get(conversationId) ?? [];
        messages.push(message);
        this.conversationSnapshots.set(conversationId, messages);
        return message;
    }

    private appendSnapshotText(conversationId: string, messageId: string, text: string): void {
        this.updateSnapshotMessage(conversationId, messageId, (message) => ({
            ...message,
            text: `${message.text}${text}`,
        }));
    }

    private appendSnapshotProgress(conversationId: string, messageId: string, text: string): void {
        this.updateSnapshotMessage(conversationId, messageId, (message) => ({
            ...message,
            progress: [...(message.progress ?? []), text],
        }));
    }

    private finishSnapshotMessage(
        conversationId: string,
        messageId: string,
        status: ConversationMessageStatus,
    ): void {
        this.updateSnapshotMessage(conversationId, messageId, (message) => ({
            ...message,
            status,
            streaming: false,
        }));
    }

    private updateSnapshotMessage(
        conversationId: string,
        messageId: string,
        update: (message: ConversationSnapshotMessage) => ConversationSnapshotMessage,
    ): void {
        const messages = this.conversationSnapshots.get(conversationId);
        if (!messages) {
            return;
        }

        this.conversationSnapshots.set(
            conversationId,
            messages.map((message) => (message.id === messageId ? update(message) : message)),
        );
    }

    private async restoreSession(): Promise<void> {
        const user = await this.authSession.restore();
        if (!user) {
            await this.postMessage({ type: 'AUTH_REQUIRED' });
            return;
        }

        await this.postMessage({ type: 'AUTHENTICATED', payload: { user } });
        await this.postModels();
        await this.postPreferences();
        await this.postBackendStatus();
        await this.postChatHistory();
    }

    private async login(userId: string, password: string): Promise<void> {
        try {
            const user = await this.authSession.login(userId, password);
            await this.postMessage({ type: 'AUTHENTICATED', payload: { user } });
            await this.postModels();
            await this.postPreferences();
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
            await this.postModels();
            await this.postPreferences();
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

    private async savePreferences(payload: { selectedModel: string; temperature: number; responseLanguage: string }): Promise<void> {
        try {
            const preferences = await this.withAuthorizedRetry((accessToken) =>
                savePreferences(payload, { accessToken }),
            );
            await this.postMessage({ type: 'PREFERENCES', payload: { preferences } });
            await this.postBackendStatus();
        } catch (err) {
            await this.postMessage({ type: 'ERROR', payload: { message: toErrorMessage(err) } });
        }
    }

    private async postModels(): Promise<void> {
        try {
            const models = await this.withAuthorizedRetry((accessToken) => getModels({ accessToken }));
            await this.postMessage({ type: 'MODELS', payload: { models } });
        } catch {
            await this.postMessage({ type: 'MODELS', payload: { models: [] } });
        }
    }

    private async postPreferences(): Promise<void> {
        try {
            const preferences = await this.withAuthorizedRetry((accessToken) => getPreferences({ accessToken }));
            await this.postMessage({ type: 'PREFERENCES', payload: { preferences } });
        } catch {
            await this.postMessage({
                type: 'PREFERENCES',
                payload: { preferences: { selectedModel: '', temperature: 0.2, responseLanguage: 'Korean' } },
            });
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
        if (this.activeRequests.has(conversationId)) {
            this.conversationId = conversationId;
            await this.postMessage({
                type: 'CONVERSATION_LOADED',
                payload: {
                    conversationId,
                    messages: this.conversationSnapshots.get(conversationId) ?? [],
                    pending: true,
                },
            });
            return;
        }

        try {
            const detail = await this.withAuthorizedRetry((accessToken) => getConversation(conversationId, { accessToken }));
            this.conversationId = detail.conversationId;
            await this.postMessage({
                type: 'CONVERSATION_LOADED',
                payload: {
                    ...detail,
                    pending: this.isConversationPending(detail.conversationId),
                },
            });
        } catch (err) {
            await this.postMessage({ type: 'ERROR', payload: { message: toErrorMessage(err) } });
        }
    }

    private async deleteConversation(conversationId: string): Promise<void> {
        this.abortConversationWithoutNotification(conversationId);

        try {
            await this.withAuthorizedRetry((accessToken) => deleteConversation(conversationId, { accessToken }));
            const activeReset = this.conversationId === conversationId;
            if (activeReset) {
                this.conversationId = randomUUID();
            }
            this.conversationSnapshots.delete(conversationId);
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
