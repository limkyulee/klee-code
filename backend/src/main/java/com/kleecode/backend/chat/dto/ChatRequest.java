package com.kleecode.backend.chat.dto;

/**
 * POST /chat 요청 바디.
 *
 * <p>conversationId 는 확장이 생성·보관하며, 같은 대화 세션의 요청에서 동일한 값을 전달한다.
 * MessageChatMemoryAdvisor 가 이 ID 를 키로 MongoDB 에서 과거 대화를 조회한다.
 *
 * <p>code 는 선택 값이다(null 또는 빈 문자열 허용).
 * 에디터에서 선택한 코드가 없으면 question 만 전달된다.
 *
 * <p>context 는 파일 경로, 언어, 선택 범위, 주변 코드 조각을 담는 메타데이터다.
 */
public record ChatRequest(
        String conversationId,
        String code,
        String question,
        CodeContext context,
        SkillCommand skillCommand,
        KleeContext kleeContext
) {
}
