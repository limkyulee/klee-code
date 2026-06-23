/*
 * 백엔드 채팅 API HTTP 클라이언트.
 */

import { getBackendUrl } from '../config/settings';
import { API_CHAT, API_CHAT_STREAM } from '../constants';
import type { ChatRequest, ChatResponse } from '../chat/types';

export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    const url = `${getBackendUrl()}${API_CHAT}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<ChatResponse>;
}

export interface ChatStreamHandlers {
    onProgressDelta?(text: string): void | Promise<void>;
    onAnswerDelta?(text: string): void | Promise<void>;
    onDone?(): void | Promise<void>;
}

export async function sendChatMessageStream(request: ChatRequest, handlers: ChatStreamHandlers): Promise<void> {
    const url = `${getBackendUrl()}${API_CHAT_STREAM}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Accept: 'text/event-stream',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

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
            handleServerSentEvent(event, handlers);
        }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
        handleServerSentEvent(buffer, handlers);
    }
}

function handleServerSentEvent(eventText: string, handlers: ChatStreamHandlers): void {
    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of eventText.split(/\r?\n/)) {
        if (line.startsWith('event:')) {
            eventName = line.slice('event:'.length).trim();
        } else if (line.startsWith('data:')) {
            dataLines.push(line.slice('data:'.length).trimStart());
        }
    }

    const data = dataLines.join('\n');

    if (eventName === 'progress') {
        void handlers.onProgressDelta?.(parseStreamData(data));
    } else if (eventName === 'token') {
        void handlers.onAnswerDelta?.(parseStreamData(data));
    } else if (eventName === 'done') {
        void handlers.onDone?.();
    }
}

function parseStreamData(data: string): string {
    try {
        return JSON.parse(data) as string;
    } catch {
        return data;
    }
}
