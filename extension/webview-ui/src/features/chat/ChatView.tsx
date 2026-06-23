import { useEffect, useReducer, useState } from 'react';
import { vscode } from './api/vscodeBridge';
import type { ExtensionToWebviewMessage } from './api/webviewProtocol';
import { ChatInput } from './components/ChatInput';
import { MessageList } from './components/MessageList';
import { messageReducer } from './model/messageReducer';

export function ChatView() {
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
