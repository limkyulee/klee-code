export type MessageRole = 'user' | 'assistant' | 'error';

export interface ChatMessage {
    id: string;
    role: MessageRole;
    text: string;
    progress?: string[];
    streaming?: boolean;
}

