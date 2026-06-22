export type MessageRole = 'user' | 'assistant' | 'error';

export interface ChatMessage {
    id: string;
    role: MessageRole;
    text: string;
}

const roleLabel: Record<MessageRole, string> = {
    user: 'You',
    assistant: 'Assistant',
    error: 'Error',
};

interface MessageBubbleProps {
    message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
    return (
        <article className={`message ${message.role}`}>
            <div className="role">{roleLabel[message.role]}</div>
            <div className="bubble">{message.text}</div>
        </article>
    );
}
