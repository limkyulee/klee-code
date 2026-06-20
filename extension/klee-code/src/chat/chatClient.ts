/*
 * 백엔드 채팅 API HTTP 클라이언트.
 *
 * fetch 호출과 에러 처리를 한 곳에 모아 extension.ts 가
 * HTTP 세부 사항을 알지 않아도 되게 한다.
 * Node 18+ 의 전역 fetch 를 사용한다 (@types/node 22.x 타입 포함).
 */

import { getBackendUrl } from '../config/settings';
import { API_CHAT } from '../constants';
import type { ChatRequest, ChatResponse } from './types';

/**
 * 백엔드 POST /chat 를 호출하고 LLM 응답을 반환한다.
 *
 * @param request conversationId, code, question 을 담은 요청
 * @returns LLM 응답
 * @throws HTTP 오류 또는 네트워크 오류 시 Error 를 throw
 */
export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    const url = `${getBackendUrl()}${API_CHAT}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });

    /* HTTP 4xx / 5xx 는 fetch 가 throw 하지 않으므로 상태 코드를 직접 확인한다 */
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<ChatResponse>;
}
