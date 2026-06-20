package com.kleecode.backend.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * POST /chat 응답 바디.
 *
 * <p>LLM 이 생성한 텍스트를 answer 필드 하나로 감싸 반환한다.
 * Phase 3 이후 스트리밍(SSE) 으로 전환할 때 이 DTO 는 제거되고
 * Flux&lt;String&gt; 으로 대체될 예정이다.
 */
@Data
@AllArgsConstructor
public class ChatResponse {

    /* LLM 이 생성한 응답 텍스트 */
    private String answer;
}
