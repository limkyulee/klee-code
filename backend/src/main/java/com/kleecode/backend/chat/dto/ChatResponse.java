package com.kleecode.backend.chat.dto;

/**
 * POST /chat 응답 바디.
 *
 * <p>LLM 이 생성한 텍스트를 answer 필드 하나로 감싸 반환한다.
 * SSE 기반 스트리밍 응답은 POST /chat/stream 에서 별도로 제공한다.
 */
public record ChatResponse(String answer) {
}
