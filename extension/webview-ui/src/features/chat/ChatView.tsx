import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { vscode } from './api/vscodeBridge';
import type { ChatHistoryItem, ExtensionToWebviewMessage, ModelConfigState } from './api/webviewProtocol';
import { ChatInput } from './components/ChatInput';
import { MessageList } from './components/MessageList';
import { messageReducer } from './model/messageReducer';

type AuthState =
    | { status: 'checking' }
    | { status: 'signedOut'; error?: string }
    | { status: 'signedIn'; userId: string; roles: string[] };

type Popover = 'history' | 'settings' | null;

export function ChatView() {
    const [messages, dispatch] = useReducer(messageReducer, []);
    const [pending, setPending] = useState(false);
    const [status, setStatus] = useState('Connecting...');
    const [modelLabel, setModelLabel] = useState('AI Model');
    const [auth, setAuth] = useState<AuthState>({ status: 'checking' });
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [modelConfig, setModelConfig] = useState<ModelConfigState>({ configured: false });
    const [history, setHistory] = useState<ChatHistoryItem[]>([]);
    const [popover, setPopover] = useState<Popover>(null);
    const headerActionsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handlePointerDown(event: PointerEvent) {
            if (!headerActionsRef.current?.contains(event.target as Node)) {
                setPopover(null);
            }
        }

        function handleKeyDown(event: globalThis.KeyboardEvent) {
            if (event.key === 'Escape') {
                setPopover(null);
            }
        }

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    useEffect(() => {
        function handleMessage(event: MessageEvent<ExtensionToWebviewMessage>) {
            const message = event.data;

            switch (message.type) {
                case 'AUTH_REQUIRED':
                    setAuth({ status: 'signedOut' });
                    setStatus('Sign in from settings');
                    return;
                case 'AUTHENTICATED':
                    setAuth({
                        status: 'signedIn',
                        userId: message.payload.user.userId,
                        roles: message.payload.user.roles,
                    });
                    setPopover(null);
                    return;
                case 'AUTH_ERROR':
                    setAuth({ status: 'signedOut', error: message.payload.message });
                    setPopover('settings');
                    return;
                case 'SIGNED_OUT':
                    setAuth({ status: 'signedOut' });
                    setModelConfig({ configured: false });
                    setHistory([]);
                    dispatch({ type: 'reset' });
                    setStatus('Signed out');
                    setPopover('settings');
                    return;
                case 'MODEL_CONFIG':
                    setModelConfig(message.payload.modelConfig);
                    return;
                case 'CHAT_HISTORY':
                    setHistory(message.payload.history);
                    return;
                case 'STATUS':
                    setStatus(`Backend: ${message.payload.backendUrl}`);
                    setModelLabel(
                        message.payload.configured
                            ? (message.payload.model ?? message.payload.provider ?? 'AI Model')
                            : 'Model required',
                    );
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
                case 'REQUEST_STOPPED':
                    setPending(false);
                    dispatch({
                        type: 'appendProgress',
                        id: message.payload.messageId,
                        text: 'Response stopped.',
                    });
                    dispatch({ type: 'finish', id: message.payload.messageId });
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
        setPopover(null);
        vscode.postMessage({ type: 'NEW_CONVERSATION' });
    }

    function stopGeneration() {
        vscode.postMessage({ type: 'STOP_GENERATION' });
    }

    function logout() {
        vscode.postMessage({ type: 'LOGOUT' });
    }

    function openHistory() {
        setPopover((current) => (current === 'history' ? null : 'history'));
        if (auth.status === 'signedIn') {
            vscode.postMessage({ type: 'REQUEST_CHAT_HISTORY' });
        }
    }

    const signedIn = auth.status === 'signedIn';
    const chatDisabled = auth.status !== 'signedIn' || !modelConfig.configured;
    const disabledReason = auth.status === 'signedIn' ? 'Configure Coder URL and model in settings' : 'Sign in from settings';
    const statusText = signedIn ? `${auth.userId} · ${status}` : status;

    return (
        <div className="shell">
            <header className="app-header">
                <div className="toolbar">
                    <div className="title">Klee Code</div>
                    <div className="header-actions" ref={headerActionsRef}>
                        <button
                            aria-expanded={popover === 'history'}
                            aria-label="Conversation history"
                            className="header-icon-button"
                            onClick={openHistory}
                            title="Conversation history"
                            type="button"
                        >
                            <span aria-hidden="true" className="header-icon icon-history" />
                        </button>
                        <button
                            aria-expanded={popover === 'settings'}
                            aria-label="Settings"
                            className="header-icon-button"
                            onClick={() => setPopover((current) => (current === 'settings' ? null : 'settings'))}
                            title="Settings"
                            type="button"
                        >
                            <span aria-hidden="true" className="header-icon icon-gear" />
                        </button>
                        <button
                            aria-label="New conversation"
                            className="header-icon-button"
                            onClick={newConversation}
                            title="New conversation"
                            type="button"
                        >
                            <span aria-hidden="true" className="header-icon icon-compose" />
                        </button>
                        {popover === 'history' ? <HistoryPopover auth={auth} history={history} /> : null}
                        {popover === 'settings' ? (
                            <SettingsPopover
                                auth={auth}
                                authMode={authMode}
                                modelConfig={modelConfig}
                                onAuthModeChange={setAuthMode}
                                onLogout={logout}
                            />
                        ) : null}
                    </div>
                </div>
                <div className="status">{statusText}</div>
            </header>
            <MessageList messages={messages} />
            <ChatInput
                disabled={chatDisabled}
                disabledReason={disabledReason}
                modelLabel={modelLabel}
                pending={pending}
                onNewConversation={newConversation}
                onSend={sendMessage}
                onStop={stopGeneration}
            />
        </div>
    );
}

function HistoryPopover({ auth, history }: { auth: AuthState; history: ChatHistoryItem[] }) {
    const [query, setQuery] = useState('');
    const filteredHistory = history.filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()));

    return (
        <section className="header-popover history-popover" aria-label="Conversation history">
            <label className="history-search">
                <span aria-hidden="true" className="history-search-icon" />
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search recent tasks"
                    autoComplete="off"
                />
            </label>
            <div className="history-filter-row">
                <button className="plain-menu-button" type="button">
                    All tasks <span aria-hidden="true" className="icon icon-chevron" />
                </button>
            </div>
            {auth.status !== 'signedIn' ? (
                <div className="popover-empty">Sign in to view your conversation history.</div>
            ) : filteredHistory.length === 0 ? (
                <div className="popover-empty">No matching conversations.</div>
            ) : (
                <div className="history-list">
                    {filteredHistory.map((item) => (
                        <button className="history-item" key={item.conversationId} type="button">
                            <span className="history-title">{item.title}</span>
                            <span className="history-meta">
                                {item.status === 'FAILED' ? <span className="history-failed">Failed</span> : null}
                                <span>{formatRelativeTime(item.updatedAt)}</span>
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
}

interface SettingsPopoverProps {
    auth: AuthState;
    authMode: 'login' | 'register';
    modelConfig: ModelConfigState;
    onAuthModeChange(mode: 'login' | 'register'): void;
    onLogout(): void;
}

function SettingsPopover({ auth, authMode, modelConfig, onAuthModeChange, onLogout }: SettingsPopoverProps) {
    if (auth.status !== 'signedIn') {
        return <AuthSettingsPanel mode={authMode} error={auth.status === 'signedOut' ? auth.error : undefined} onModeChange={onAuthModeChange} />;
    }

    return (
        <section className="header-popover settings-popover" aria-label="Settings">
            <div className="account-lines">
                <div className="account-line">
                    <span aria-hidden="true" className="settings-icon icon-user" />
                    <span>{auth.userId}</span>
                </div>
                <div className="account-line muted">
                    <span aria-hidden="true" className="settings-icon icon-account" />
                    <span>Personal account</span>
                </div>
            </div>
            <div className="settings-divider" />
            <ModelSettingsForm modelConfig={modelConfig} />
            <div className="settings-divider" />
            <button className="settings-menu-item" type="button" onClick={onLogout}>
                <span aria-hidden="true" className="settings-icon icon-logout" />
                <span>Log out</span>
            </button>
        </section>
    );
}

function AuthSettingsPanel({
    mode,
    error,
    onModeChange,
}: {
    mode: 'login' | 'register';
    error?: string;
    onModeChange(mode: 'login' | 'register'): void;
}) {
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        vscode.postMessage({ type: mode === 'login' ? 'LOGIN' : 'REGISTER', payload: { userId, password } });
    }

    return (
        <section className="header-popover settings-popover" aria-label={mode === 'login' ? 'Sign in' : 'Create account'}>
            <form className="form-stack compact-form" onSubmit={submit}>
                <div className="form-title">{mode === 'login' ? 'Log in' : 'Create account'}</div>
                <label className="field">
                    <span>User ID</span>
                    <input value={userId} onChange={(event) => setUserId(event.target.value)} autoComplete="username" />
                </label>
                <label className="field">
                    <span>Password</span>
                    <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    />
                </label>
                {error ? <div className="form-error">{error}</div> : null}
                <button className="primary-button" type="submit">
                    {mode === 'login' ? 'Log in' : 'Sign up'}
                </button>
                <button
                    className="link-button"
                    type="button"
                    onClick={() => onModeChange(mode === 'login' ? 'register' : 'login')}
                >
                    {mode === 'login' ? 'Create an account' : 'Back to log in'}
                </button>
            </form>
        </section>
    );
}

function ModelSettingsForm({ modelConfig }: { modelConfig: ModelConfigState }) {
    const [baseUrl, setBaseUrl] = useState(modelConfig.baseUrl ?? '');
    const [modelName, setModelName] = useState(modelConfig.modelName ?? '');

    useEffect(() => {
        setBaseUrl(modelConfig.baseUrl ?? '');
        setModelName(modelConfig.modelName ?? '');
    }, [modelConfig.baseUrl, modelConfig.modelName]);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        vscode.postMessage({ type: 'SAVE_MODEL_CONFIG', payload: { baseUrl, modelName } });
    }

    return (
        <form className="form-stack compact-form" onSubmit={submit}>
            <div className="form-title">Coder settings</div>
            <label className="field">
                <span>Coder URL</span>
                <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="http://localhost:11434" />
            </label>
            <label className="field">
                <span>Model</span>
                <input value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder="qwen2.5-coder:3b" />
            </label>
            <button className="primary-button" type="submit">
                Save
            </button>
        </form>
    );
}

function formatRelativeTime(value: string): string {
    const date = new Date(value);
    const elapsedMs = Date.now() - date.getTime();

    if (!Number.isFinite(elapsedMs)) {
        return '';
    }

    const minutes = Math.max(1, Math.round(elapsedMs / 60000));
    if (minutes < 60) {
        return `${minutes}m`;
    }

    const hours = Math.round(minutes / 60);
    if (hours < 24) {
        return `${hours}h`;
    }

    return `${Math.round(hours / 24)}d`;
}
