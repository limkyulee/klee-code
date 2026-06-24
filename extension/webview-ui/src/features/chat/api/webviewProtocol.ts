export interface SendMessagePayload {
    text: string;
}

export type WebviewToExtensionMessage =
    | { type: 'WEBVIEW_READY' }
    | { type: 'LOGIN'; payload: { userId: string; password: string } }
    | { type: 'REGISTER'; payload: { userId: string; password: string } }
    | { type: 'LOGOUT' }
    | { type: 'SAVE_MODEL_CONFIG'; payload: { baseUrl: string; modelName: string } }
    | { type: 'REQUEST_CHAT_HISTORY' }
    | { type: 'SEND_MESSAGE'; payload: SendMessagePayload }
    | { type: 'STOP_GENERATION' }
    | { type: 'NEW_CONVERSATION' };

export type ExtensionToWebviewMessage =
    | { type: 'AUTH_REQUIRED' }
    | { type: 'AUTHENTICATED'; payload: { user: { userId: string; roles: string[]; status: string } } }
    | { type: 'AUTH_ERROR'; payload: { message: string } }
    | { type: 'SIGNED_OUT' }
    | { type: 'MODEL_CONFIG'; payload: { modelConfig: ModelConfigState } }
    | { type: 'CHAT_HISTORY'; payload: { history: ChatHistoryItem[] } }
    | { type: 'STATUS'; payload: { backendUrl: string; configured?: boolean; provider?: string; model?: string } }
    | { type: 'REQUEST_STARTED'; payload: { messageId: string } }
    | { type: 'REQUEST_STOPPED'; payload: { messageId: string } }
    | { type: 'USER_MESSAGE'; payload: { text: string } }
    | { type: 'PROGRESS_DELTA'; payload: { messageId: string; text: string } }
    | { type: 'ASSISTANT_DELTA'; payload: { messageId: string; text: string } }
    | { type: 'ASSISTANT_RESPONSE'; payload: { messageId: string } }
    | { type: 'ERROR'; payload: { message: string; messageId?: string } }
    | { type: 'CONVERSATION_RESET' };

export interface ModelConfigState {
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
