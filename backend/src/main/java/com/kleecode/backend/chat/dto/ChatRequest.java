package com.kleecode.backend.chat.dto;

import lombok.Data;

/**
 * POST /chat 요청 바디.
 *
 * <p>conversationId 는 확장이 생성·보관하며, 같은 대화 세션의 요청에서 동일한 값을 전달한다.
 * MessageChatMemoryAdvisor 가 이 ID 를 키로 MongoDB 에서 과거 대화를 조회한다.
 *
 * <p>code 는 선택 값이다(null 또는 빈 문자열 허용).
 * 에디터에서 선택한 코드가 없으면 question 만 전달된다.
 */
@Data
public class ChatRequest {

    /* VS Code 확장이 세션 시작 시 생성하는 UUID — 연속 대화를 식별하는 키 */
    private String conversationId;

    /* 에디터에서 선택한 코드 스니펫 (없으면 null 또는 "") */
    private String code;

    /* 사용자 질문 */
    private String question;
}
