import type { ChatMessage } from '../types';

export type MessageAction =
    | { type: 'add'; message: Omit<ChatMessage, 'id'>; id?: string }
    | { type: 'appendText'; id: string; text: string }
    | { type: 'appendProgress'; id: string; text: string }
    | { type: 'finish'; id: string }
    | { type: 'reset' };

export function messageReducer(messages: ChatMessage[], action: MessageAction): ChatMessage[] {
    switch (action.type) {
        case 'add':
            return [
                ...messages,
                {
                    ...action.message,
                    id: action.id ?? `${Date.now()}-${messages.length}`,
                },
            ];
        case 'appendText':
            return messages.map((message) =>
                message.id === action.id ? { ...message, text: `${message.text}${action.text}` } : message,
            );
        case 'appendProgress':
            return messages.map((message) =>
                message.id === action.id
                    ? { ...message, progress: [...(message.progress ?? []), action.text] }
                    : message,
            );
        case 'finish':
            return messages.map((message) =>
                message.id === action.id ? { ...message, streaming: false } : message,
            );
        case 'reset':
            return [];
    }
}
