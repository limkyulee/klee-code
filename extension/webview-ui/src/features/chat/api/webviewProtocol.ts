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
    | { type: 'SELECT_CONVERSATION'; payload: { conversationId: string } }
    | { type: 'DELETE_CONVERSATION'; payload: { conversationId: string } }
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
    | { type: 'CONVERSATION_LOADED'; payload: ConversationDetail }
    | {
          type: 'CONVERSATION_DELETED';
          payload: { conversationId: string; activeReset: boolean; nextConversationId: string };
      }
    | { type: 'STATUS'; payload: { backendUrl: string; configured?: boolean; provider?: string; model?: string } }
    | { type: 'REQUEST_STARTED'; payload: { messageId: string; conversationId: string } }
    | { type: 'REQUEST_STOPPED'; payload: { messageId: string; conversationId: string } }
    | { type: 'USER_MESSAGE'; payload: { conversationId: string; message: ConversationMessage } }
    | { type: 'PROGRESS_DELTA'; payload: { messageId: string; conversationId: string; text: string } }
    | { type: 'ASSISTANT_DELTA'; payload: { messageId: string; conversationId: string; text: string } }
    | { type: 'ASSISTANT_RESPONSE'; payload: { messageId: string; conversationId: string } }
    | { type: 'ERROR'; payload: { message: string; conversationId?: string; messageId?: string } }
    | { type: 'CONVERSATION_RESET'; payload: { conversationId: string; pending?: boolean } };

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

export interface ConversationMessage {
    id?: string;
    role: 'user' | 'assistant' | 'error';
    text: string;
    progress?: string[];
    streaming?: boolean;
    createdAt: string;
    status: 'STARTED' | 'SUCCEEDED' | 'FAILED';
}

export interface ConversationDetail {
    conversationId: string;
    messages: ConversationMessage[];
    pending?: boolean;
}
