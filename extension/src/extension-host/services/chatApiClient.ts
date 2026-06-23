/*
 * Backend chat API client.
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

    if (buffer.length > 0) {
        handleServerSentEvent(buffer, handlers);
    }
}

function handleServerSentEvent(eventText: string, handlers: ChatStreamHandlers): void {
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

function readEventFieldValue(line: string, fieldName: string): string {
    const value = line.slice(`${fieldName}:`.length);
    return value.startsWith(' ') ? value.slice(1) : value;
}
