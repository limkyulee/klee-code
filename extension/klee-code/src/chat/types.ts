/*
 * 백엔드 POST /chat API 의 요청·응답 타입 정의.
 * 백엔드 ChatRequest / ChatResponse DTO 와 필드가 일치해야 한다.
 */

/** POST /chat 요청 바디 */
export interface ChatRequest {
    /** 연속 대화를 식별하는 UUID — extension 이 세션 시작 시 생성하고 보관 */
    conversationId: string;

    /** 에디터에서 선택한 코드 스니펫 (없으면 빈 문자열) */
    code: string;

    /** 사용자 질문 */
    question: string;
}

/** POST /chat 응답 바디 */
export interface ChatResponse {
    /** LLM 이 생성한 응답 텍스트 */
    answer: string;
}
