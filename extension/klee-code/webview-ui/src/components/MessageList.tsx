import { useEffect, useRef } from 'react';
import { MessageBubble, type ChatMessage } from './MessageBubble';

interface MessageListProps {
    messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
    const endRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            endRef.current?.scrollIntoView({ block: 'end' });
        });

        return () => cancelAnimationFrame(frame);
    }, [messages]);

    return (
        <main className="messages">
            {messages.length === 0 ? (
                <div className="empty">Ask about the selected code or the current workspace.</div>
            ) : (
                messages.map((message) => <MessageBubble key={message.id} message={message} />)
            )}
            <div ref={endRef} />
        </main>
    );
}
