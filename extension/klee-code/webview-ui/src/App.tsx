import { useEffect, useReducer, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatInput } from './components/ChatInput';
import { MessageList } from './components/MessageList';
import type { ChatMessage } from './components/MessageBubble';
import { vscode, type ExtensionToWebviewMessage } from './api/vscodeBridge';
import './style/style.css';

type MessageAction =
    | { type: 'add'; message: Omit<ChatMessage, 'id'>; id?: string }
    | { type: 'appendText'; id: string; text: string }
    | { type: 'appendProgress'; id: string; text: string }
    | { type: 'finish'; id: string }
    | { type: 'reset' };

function messageReducer(messages: ChatMessage[], action: MessageAction): ChatMessage[] {
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

function App() {
    const [messages, dispatch] = useReducer(messageReducer, []);
    const [pending, setPending] = useState(false);
    const [status, setStatus] = useState('Connecting...');

    useEffect(() => {
        function handleMessage(event: MessageEvent<ExtensionToWebviewMessage>) {
            const message = event.data;

            switch (message.type) {
                case 'STATUS':
                    setStatus(`Backend: ${message.payload.backendUrl}`);
                    return;
                case 'REQUEST_STARTED':
                    setPending(true);
                    dispatch({
                        type: 'add',
                        id: message.payload.messageId,
                        message: {
                            role: 'assistant',
                            text: '',
                            progress: ['Request sent. Waiting for the model stream...'],
                            streaming: true,
                        },
                    });
                    return;
                case 'PROGRESS_DELTA':
                    dispatch({
                        type: 'appendProgress',
                        id: message.payload.messageId,
                        text: message.payload.text,
                    });
                    return;
                case 'ASSISTANT_DELTA':
                    dispatch({
                        type: 'appendText',
                        id: message.payload.messageId,
                        text: message.payload.text,
                    });
                    return;
                case 'USER_MESSAGE':
                    dispatch({ type: 'add', message: { role: 'user', text: message.payload.text } });
                    return;
                case 'ASSISTANT_RESPONSE':
                    setPending(false);
                    dispatch({ type: 'finish', id: message.payload.messageId });
                    return;
                case 'ERROR':
                    setPending(false);
                    if (message.payload.messageId) {
                        dispatch({ type: 'finish', id: message.payload.messageId });
                    }
                    dispatch({ type: 'add', message: { role: 'error', text: message.payload.message } });
                    return;
                case 'CONVERSATION_RESET':
                    setPending(false);
                    setStatus('New conversation');
                    dispatch({ type: 'reset' });
                    return;
            }
        }

        window.addEventListener('message', handleMessage);
        vscode.postMessage({ type: 'WEBVIEW_READY' });

        return () => window.removeEventListener('message', handleMessage);
    }, []);

    function sendMessage(text: string) {
        dispatch({ type: 'add', message: { role: 'user', text } });
        vscode.postMessage({ type: 'SEND_MESSAGE', payload: { text } });
    }

    function newConversation() {
        vscode.postMessage({ type: 'NEW_CONVERSATION' });
    }

    return (
        <div className="shell">
            <header>
                <div className="toolbar">
                    <div className="title">Klee Code</div>
                    <button
                        aria-label="New conversation"
                        className="icon-button"
                        onClick={newConversation}
                        title="New conversation"
                        type="button"
                    >
                        +
                    </button>
                </div>
                <div className="status">{status}</div>
            </header>
            <MessageList messages={messages} />
            <ChatInput disabled={pending} onSend={sendMessage} />
        </div>
    );
}

const root = document.getElementById('root');

if (root) {
    createRoot(root).render(<App />);
}
