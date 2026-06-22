import { FormEvent, KeyboardEvent, useState } from 'react';

interface ChatInputProps {
    disabled: boolean;
    onSend(text: string): void;
}

export function ChatInput({ disabled, onSend }: ChatInputProps) {
    const [text, setText] = useState('');

    function submit(event?: FormEvent<HTMLFormElement>) {
        event?.preventDefault();

        const trimmedText = text.trim();

        if (!trimmedText || disabled) {
            return;
        }

        onSend(trimmedText);
        setText('');
    }

    function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit();
        }
    }

    return (
        <form className="composer" onSubmit={submit}>
            <textarea
                disabled={disabled}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Klee Code..."
                rows={4}
                value={text}
            />
            <div className="actions">
                <button className="send" disabled={disabled || text.trim().length === 0} type="submit">
                    {disabled ? 'Sending' : 'Send'}
                </button>
            </div>
        </form>
    );
}
