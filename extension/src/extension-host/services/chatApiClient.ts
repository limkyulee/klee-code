/*
 * Backend chat API client.
 */

import { getBackendUrl } from '../config/settings';
import {
    API_AUTH_LOGIN,
    API_AUTH_LOGOUT,
    API_AUTH_ME,
    API_AUTH_REFRESH,
    API_AUTH_REGISTER,
    API_AGENT_STREAM,
    API_AGENT_TOOL_RESULTS,
    API_CHAT,
    API_CHAT_STATUS,
    API_CHAT_STREAM,
    API_CONVERSATIONS,
    API_MODELS,
    API_PREFERENCES,
} from '../constants';
import type {
    AvailableModel,
    AgentRequest,
    AuthResponse,
    ChatHistoryItem,
    ChatRequest,
    ChatResponse,
    ChatStatus,
    ConversationDetail,
    ToolCallRequest,
    ToolResultRequest,
    UserPreferences,
    UserProfile,
} from '../chat/types';

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export interface RequestAuth {
    accessToken?: string;
}

export async function sendChatMessage(request: ChatRequest, auth?: RequestAuth): Promise<ChatResponse> {
    const url = `${getBackendUrl()}${API_CHAT}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: jsonHeaders(auth),
        body: JSON.stringify(request),
    });

    await ensureOk(response);

    return response.json() as Promise<ChatResponse>;
}

export interface ChatStreamHandlers {
    onProgressDelta?(text: string): void | Promise<void>;
    onAnswerDelta?(text: string): void | Promise<void>;
    onToolCallRequested?(toolCall: ToolCallRequest): void | Promise<void>;
    onDone?(): void | Promise<void>;
}

export async function getChatStatus(auth?: RequestAuth): Promise<ChatStatus> {
    const url = `${getBackendUrl()}${API_CHAT_STATUS}`;

    const response = await fetch(url, { headers: authHeaders(auth) });

    await ensureOk(response);

    return response.json() as Promise<ChatStatus>;
}

export async function getChatHistory(auth?: RequestAuth): Promise<ChatHistoryItem[]> {
    const url = `${getBackendUrl()}${API_CONVERSATIONS}`;

    const response = await fetch(url, { headers: authHeaders(auth) });

    await ensureOk(response);

    return response.json() as Promise<ChatHistoryItem[]>;
}

export async function getConversation(conversationId: string, auth?: RequestAuth): Promise<ConversationDetail> {
    const url = `${getBackendUrl()}${API_CONVERSATIONS}/${encodeURIComponent(conversationId)}`;

    const response = await fetch(url, { headers: authHeaders(auth) });

    await ensureOk(response);

    return response.json() as Promise<ConversationDetail>;
}

export async function deleteConversation(conversationId: string, auth?: RequestAuth): Promise<void> {
    const url = `${getBackendUrl()}${API_CONVERSATIONS}/${encodeURIComponent(conversationId)}`;

    const response = await fetch(url, { method: 'DELETE', headers: authHeaders(auth) });

    await ensureOk(response);
}

export async function sendChatMessageStream(
    request: ChatRequest,
    handlers: ChatStreamHandlers,
    auth?: RequestAuth,
    signal?: AbortSignal,
): Promise<void> {
    const url = `${getBackendUrl()}${API_CHAT_STREAM}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { ...jsonHeaders(auth), Accept: 'text/event-stream' },
        body: JSON.stringify(request),
        signal,
    });

    await ensureOk(response);

    await readEventStream(response, handlers);
}

export async function sendAgentMessageStream(
    request: AgentRequest,
    handlers: ChatStreamHandlers,
    auth?: RequestAuth,
    signal?: AbortSignal,
): Promise<void> {
    const url = `${getBackendUrl()}${API_AGENT_STREAM}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { ...jsonHeaders(auth), Accept: 'text/event-stream' },
        body: JSON.stringify(request),
        signal,
    });

    await ensureOk(response);
    await readEventStream(response, handlers);
}

export async function postToolResult(result: ToolResultRequest, auth?: RequestAuth): Promise<void> {
    const response = await fetch(`${getBackendUrl()}${API_AGENT_TOOL_RESULTS}`, {
        method: 'POST',
        headers: jsonHeaders(auth),
        body: JSON.stringify(result),
    });
    await ensureOk(response);
}

async function readEventStream(response: Response, handlers: ChatStreamHandlers): Promise<void> {
    if (!response.body) {
        throw new Error('Streaming response body is unavailable');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? '';

        for (const event of events) {
            await handleServerSentEvent(event, handlers);
        }
    }

    buffer += decoder.decode();

    if (buffer.length > 0) {
        await handleServerSentEvent(buffer, handlers);
    }
}

export async function register(userId: string, password: string): Promise<AuthResponse> {
    return postJson<AuthResponse>(API_AUTH_REGISTER, { userId, password });
}

export async function login(userId: string, password: string): Promise<AuthResponse> {
    return postJson<AuthResponse>(API_AUTH_LOGIN, { userId, password });
}

export async function refresh(refreshToken: string): Promise<AuthResponse> {
    return postJson<AuthResponse>(API_AUTH_REFRESH, { refreshToken });
}

export async function logout(refreshToken: string, auth?: RequestAuth): Promise<void> {
    const response = await fetch(`${getBackendUrl()}${API_AUTH_LOGOUT}`, {
        method: 'POST',
        headers: jsonHeaders(auth),
        body: JSON.stringify({ refreshToken }),
    });
    await ensureOk(response);
}

export async function me(auth?: RequestAuth): Promise<UserProfile> {
    const response = await fetch(`${getBackendUrl()}${API_AUTH_ME}`, { headers: authHeaders(auth) });
    await ensureOk(response);
    return response.json() as Promise<UserProfile>;
}

export async function getModels(auth?: RequestAuth): Promise<AvailableModel[]> {
    const response = await fetch(`${getBackendUrl()}${API_MODELS}`, { headers: authHeaders(auth) });
    await ensureOk(response);
    return response.json() as Promise<AvailableModel[]>;
}

export async function getPreferences(auth?: RequestAuth): Promise<UserPreferences> {
    const response = await fetch(`${getBackendUrl()}${API_PREFERENCES}`, { headers: authHeaders(auth) });
    await ensureOk(response);
    return response.json() as Promise<UserPreferences>;
}

export async function savePreferences(
    payload: { selectedModel: string; temperature: number; responseLanguage: string },
    auth?: RequestAuth,
): Promise<UserPreferences> {
    const response = await fetch(`${getBackendUrl()}${API_PREFERENCES}`, {
        method: 'PUT',
        headers: jsonHeaders(auth),
        body: JSON.stringify(payload),
    });
    await ensureOk(response);
    return response.json() as Promise<UserPreferences>;
}

async function handleServerSentEvent(eventText: string, handlers: ChatStreamHandlers): Promise<void> {
    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of eventText.split(/\r?\n/)) {
        if (line.startsWith('event:')) {
            eventName = readEventFieldValue(line, 'event');
        } else if (line.startsWith('data:')) {
            dataLines.push(readEventFieldValue(line, 'data'));
        }
    }

    const data = dataLines.join('\n');

    if (eventName === 'progress') {
        await handlers.onProgressDelta?.(parseStreamData(data));
    } else if (eventName === 'token') {
        await handlers.onAnswerDelta?.(parseStreamData(data));
    } else if (eventName === 'tool_call_requested') {
        await handlers.onToolCallRequested?.(parseJsonStreamData<ToolCallRequest>(data));
    } else if (eventName === 'done') {
        await handlers.onDone?.();
    } else if (eventName === 'error') {
        throw new Error(parseStreamData(data));
    }
}

function parseStreamData(data: string): string {
    try {
        return JSON.parse(data) as string;
    } catch {
        return data;
    }
}

function parseJsonStreamData<T>(data: string): T {
    return JSON.parse(data) as T;
}

function readEventFieldValue(line: string, fieldName: string): string {
    const value = line.slice(`${fieldName}:`.length);
    return value.startsWith(' ') ? value.slice(1) : value;
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
    const response = await fetch(`${getBackendUrl()}${path}`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify(payload),
    });
    await ensureOk(response);
    return response.json() as Promise<T>;
}

function authHeaders(auth?: RequestAuth): Record<string, string> {
    return auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {};
}

function jsonHeaders(auth?: RequestAuth): Record<string, string> {
    return { 'Content-Type': 'application/json', ...authHeaders(auth) };
}

async function ensureOk(response: Response): Promise<void> {
    if (response.ok) {
        return;
    }

    try {
        const body = (await response.json()) as { code?: string; message?: string };
        throw new ApiError(response.status, body.code ?? `HTTP_${response.status}`, body.message ?? response.statusText);
    } catch (err) {
        if (err instanceof ApiError) {
            throw err;
        }
        throw new ApiError(response.status, `HTTP_${response.status}`, response.statusText);
    }
}
