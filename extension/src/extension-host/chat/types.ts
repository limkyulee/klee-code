/*
 * 백엔드 POST /chat API 의 요청·응답 타입 정의.
 * 백엔드 ChatRequest / ChatResponse DTO 와 필드가 일치해야 한다.
 */

export interface SelectionRange {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
}

export interface CodeContext {
    filePath: string;
    languageId: string;
    selectionRange: SelectionRange;
    selectedText: string;
    surroundingSnippet: string;
}

/** POST /chat 요청 바디 */
export interface ChatRequest {
    /** 연속 대화를 식별하는 UUID — extension 이 세션 시작 시 생성하고 보관 */
    conversationId: string;

    /** 에디터에서 선택한 코드 스니펫 (없으면 빈 문자열) */
    code: string;

    /** 사용자 질문 */
    question: string;

    /** 코드 위치/언어/주변 컨텍스트 메타데이터 */
    context?: CodeContext;
}

/** POST /chat 응답 바디 */
export interface ChatResponse {
    /** LLM 이 생성한 응답 텍스트 */
    answer: string;
}

/** GET /chat/status 응답 바디 */
export interface ChatStatus {
    /** Whether the signed-in user has model configuration */
    configured: boolean;

    /** Spring AI provider 이름 */
    provider?: string;

    /** provider 별 실제 모델 이름 */
    model?: string;
}

export interface UserProfile {
    userId: string;
    roles: string[];
    status: string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresInSeconds: number;
    user: UserProfile;
}

export interface ModelConfig {
    configured: boolean;
    provider?: 'OLLAMA';
    baseUrl?: string;
    modelName?: string;
}

export interface ChatHistoryItem {
    id: string;
    conversationId: string;
    title: string;
    status: 'STARTED' | 'SUCCEEDED' | 'FAILED';
    createdAt: string;
    updatedAt: string;
    turnCount: number;
}
