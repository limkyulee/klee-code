/*
 * 백엔드 채팅 API HTTP 클라이언트.
 */

import { getBackendUrl } from '../config/settings';
import { API_CHAT } from '../constants';
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
