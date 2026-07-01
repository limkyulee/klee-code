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

export interface SkillCommand {
    name: string;
}

export interface KleePromptFile {
    name: string;
    path: string;
    content: string;
}

export interface KleeContext {
    rules: KleePromptFile[];
    skills: KleePromptFile[];
    hooks: KleePromptFile[];
}

export type PermissionMode = 'ask' | 'approve' | 'full';

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

    /** Slash skill command parsed from the first token, for example /review */
    skillCommand?: SkillCommand;

    /** Project customization files loaded from .klee */
    kleeContext?: KleeContext;
}

export interface AgentRequest extends ChatRequest {
    permissionMode: PermissionMode;
}

export interface ToolCallRequest {
    runId: string;
    toolCallId: string;
    toolName: string;
    arguments: Record<string, unknown>;
}

export interface ToolResultRequest {
    runId: string;
    toolCallId: string;
    status: 'SUCCEEDED' | 'FAILED';
    result?: string;
    errorMessage?: string;
}

/** POST /chat 응답 바디 */
export interface ChatResponse {
    /** LLM 이 생성한 응답 텍스트 */
    answer: string;
}

/** GET /chat/status 응답 바디 */
export interface ChatStatus {
    /** Whether the central LLM gateway is ready for this user */
    configured: boolean;

    /** 중앙 LLM provider 이름 */
    provider?: string;

    /** 호출에 사용할 실제 모델 이름 */
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

export interface AvailableModel {
    name: string;
    displayName: string;
    default: boolean;
}

export interface UserPreferences {
    selectedModel: string;
    temperature: number;
    responseLanguage: string;
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

export interface ConversationMessage {
    role: 'user' | 'assistant' | 'error';
    text: string;
    createdAt: string;
    status: 'STARTED' | 'SUCCEEDED' | 'FAILED';
}

export interface ConversationDetail {
    conversationId: string;
    messages: ConversationMessage[];
}
