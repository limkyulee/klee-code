import type { ChatMessage, MessageRole } from '../types';

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
            <div className="bubble">
                {message.progress && message.progress.length > 0 ? (
                    <details className="progress" open={message.streaming}>
                        <summary>Progress</summary>
                        <div className="progress-log">
                            {message.progress.map((item, index) => (
                                <div key={`${message.id}-progress-${index}`}>{item}</div>
                            ))}
                        </div>
                    </details>
                ) : null}
                <div className="message-text">
                    {message.text}
                    {message.streaming ? <span className="cursor" aria-label="Streaming response" /> : null}
                </div>
            </div>
        </article>
    );
}
