import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { vscode } from './api/vscodeBridge';
import type {
    AvailableModel,
    ChatHistoryItem,
    ConversationMessage,
    ExtensionToWebviewMessage,
    UserPreferencesState,
} from './api/webviewProtocol';
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
    const [auth, setAuth] = useState<AuthState>({ status: 'checking' });
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [models, setModels] = useState<AvailableModel[]>([]);
    const [preferences, setPreferences] = useState<UserPreferencesState>({
        selectedModel: '',
        temperature: 0.2,
        responseLanguage: 'Korean',
    });
    const [preferencesLoaded, setPreferencesLoaded] = useState(false);
    const [history, setHistory] = useState<ChatHistoryItem[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | undefined>();
    const [popover, setPopover] = useState<Popover>(null);
    const headerActionsRef = useRef<HTMLDivElement>(null);
    const activeConversationIdRef = useRef<string | undefined>(undefined);

    function activateConversation(conversationId: string | undefined, nextPending: boolean) {
        activeConversationIdRef.current = conversationId;
        setActiveConversationId(conversationId);
        setPending(nextPending);
    }

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
                    setModels([]);
                    setPreferences({ selectedModel: '', temperature: 0.2, responseLanguage: 'Korean' });
                    setPreferencesLoaded(false);
                    setHistory([]);
                    activateConversation(undefined, false);
                    dispatch({ type: 'reset' });
                    setStatus('Signed out');
                    setPopover('settings');
                    return;
                case 'MODELS':
                    setModels(message.payload.models);
                    return;
                case 'PREFERENCES':
                    setPreferences(message.payload.preferences);
                    setPreferencesLoaded(true);
                    return;
                case 'CHAT_HISTORY':
                    setHistory(message.payload.history);
                    return;
                case 'CONVERSATION_LOADED':
                    activateConversation(message.payload.conversationId, message.payload.pending ?? false);
                    setPopover(null);
                    setStatus('Conversation loaded');
                    dispatch({
                        type: 'replace',
                        messages: message.payload.messages.map(toChatMessage),
                    });
                    return;
                case 'CONVERSATION_DELETED':
                    setHistory((items) => items.filter((item) => item.conversationId !== message.payload.conversationId));
                    if (message.payload.activeReset) {
                        activateConversation(message.payload.nextConversationId, false);
                        setStatus('Conversation deleted');
                        dispatch({ type: 'reset' });
                    }
                    return;
                case 'STATUS':
                    setStatus(`Backend: ${message.payload.backendUrl}`);
                    return;
                case 'REQUEST_STARTED':
                    activateConversation(message.payload.conversationId, true);
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
                    if (message.payload.conversationId !== activeConversationIdRef.current) {
                        return;
                    }
                    setPending(false);
                    dispatch({
                        type: 'appendProgress',
                        id: message.payload.messageId,
                        text: 'Response stopped.',
                    });
                    dispatch({ type: 'finish', id: message.payload.messageId });
                    return;
                case 'PROGRESS_DELTA':
                    if (message.payload.conversationId !== activeConversationIdRef.current) {
                        return;
                    }
                    dispatch({
                        type: 'appendProgress',
                        id: message.payload.messageId,
                        text: message.payload.text,
                    });
                    return;
                case 'ASSISTANT_DELTA':
                    if (message.payload.conversationId !== activeConversationIdRef.current) {
                        return;
                    }
                    dispatch({
                        type: 'appendText',
                        id: message.payload.messageId,
                        text: message.payload.text,
                    });
                    return;
                case 'USER_MESSAGE':
                    if (!activeConversationIdRef.current) {
                        activateConversation(message.payload.conversationId, false);
                    }
                    if (message.payload.conversationId !== activeConversationIdRef.current) {
                        return;
                    }
                    dispatch({ type: 'add', id: message.payload.message.id, message: toChatMessage(message.payload.message, 0) });
                    return;
                case 'ASSISTANT_RESPONSE':
                    if (message.payload.conversationId !== activeConversationIdRef.current) {
                        return;
                    }
                    setPending(false);
                    dispatch({ type: 'finish', id: message.payload.messageId });
                    return;
                case 'ERROR':
                    if (message.payload.conversationId && message.payload.conversationId !== activeConversationIdRef.current) {
                        return;
                    }
                    if (message.payload.conversationId) {
                        setPending(false);
                    }
                    if (message.payload.messageId) {
                        dispatch({ type: 'finish', id: message.payload.messageId });
                    }
                    dispatch({ type: 'add', message: { role: 'error', text: message.payload.message } });
                    return;
                case 'CONVERSATION_RESET':
                    activateConversation(message.payload.conversationId, message.payload.pending ?? false);
                    setStatus('New conversation');
                    dispatch({ type: 'reset' });
                    return;
            }
        }

        window.addEventListener('message', handleMessage);
        vscode.postMessage({ type: 'WEBVIEW_READY' });

        return () => window.removeEventListener('message', handleMessage);
    }, []);

    useEffect(() => {
        const firstModel = models[0]?.name;
        if (auth.status !== 'signedIn' || !preferencesLoaded || preferences.selectedModel || !firstModel) {
            return;
        }

        saveModelPreference(firstModel);
    }, [auth.status, models, preferences.selectedModel, preferencesLoaded]);

    function sendMessage(text: string) {
        vscode.postMessage({ type: 'SEND_MESSAGE', payload: { text } });
    }

    function newConversation() {
        setPopover(null);
        vscode.postMessage({ type: 'NEW_CONVERSATION' });
    }

    function stopGeneration() {
        vscode.postMessage({ type: 'STOP_GENERATION' });
    }

    function saveModelPreference(selectedModel: string) {
        if (!selectedModel) {
            return;
        }

        vscode.postMessage({
            type: 'SAVE_PREFERENCES',
            payload: {
                ...preferences,
                selectedModel,
            },
        });
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

    function selectConversation(conversationId: string) {
        vscode.postMessage({ type: 'SELECT_CONVERSATION', payload: { conversationId } });
    }

    function deleteConversation(conversationId: string) {
        if (window.confirm('Delete this conversation permanently?')) {
            vscode.postMessage({ type: 'DELETE_CONVERSATION', payload: { conversationId } });
        }
    }

    const signedIn = auth.status === 'signedIn';
    const chatDisabled = auth.status !== 'signedIn';
    const disabledReason = 'Sign in from settings';
    const statusText = signedIn ? `${auth.userId} · ${status}` : status;
    const selectedModel = preferences.selectedModel || models[0]?.name || '';

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
                        {popover === 'history' ? (
                            <HistoryPopover
                                activeConversationId={activeConversationId}
                                auth={auth}
                                disabled={false}
                                history={history}
                                onDelete={deleteConversation}
                                onSelect={selectConversation}
                            />
                        ) : null}
                        {popover === 'settings' ? (
                            <SettingsPopover
                                auth={auth}
                                authMode={authMode}
                                models={models}
                                preferences={preferences}
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
                models={models}
                pending={pending}
                selectedModel={selectedModel}
                onModelChange={saveModelPreference}
                onNewConversation={newConversation}
                onSend={sendMessage}
                onStop={stopGeneration}
            />
        </div>
    );
}

function HistoryPopover({
    activeConversationId,
    auth,
    disabled,
    history,
    onDelete,
    onSelect,
}: {
    activeConversationId?: string;
    auth: AuthState;
    disabled: boolean;
    history: ChatHistoryItem[];
    onDelete(conversationId: string): void;
    onSelect(conversationId: string): void;
}) {
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
                        <div
                            className={`history-row${activeConversationId === item.conversationId ? ' selected' : ''}`}
                            key={item.conversationId}
                        >
                            <button
                                className="history-item"
                                disabled={disabled}
                                onClick={() => onSelect(item.conversationId)}
                                type="button"
                            >
                                <span className="history-title">{item.title}</span>
                                <span className="history-meta">
                                    {item.status === 'FAILED' ? <span className="history-failed">Failed</span> : null}
                                    <span>{formatRelativeTime(item.updatedAt)}</span>
                                </span>
                            </button>
                            <button
                                aria-label={`Delete ${item.title}`}
                                className="history-delete"
                                disabled={disabled}
                                onClick={() => onDelete(item.conversationId)}
                                title="Delete conversation"
                                type="button"
                            >
                                <span aria-hidden="true" className="history-delete-icon" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function toChatMessage(message: ConversationMessage, index: number) {
    return {
        id: message.id ?? `${message.createdAt}-${index}`,
        role: message.role,
        text: message.text,
        progress: message.progress,
        streaming: message.streaming,
    };
}

interface SettingsPopoverProps {
    auth: AuthState;
    authMode: 'login' | 'register';
    models: AvailableModel[];
    preferences: UserPreferencesState;
    onAuthModeChange(mode: 'login' | 'register'): void;
    onLogout(): void;
}

function SettingsPopover({ auth, authMode, models, preferences, onAuthModeChange, onLogout }: SettingsPopoverProps) {
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
            <ModelSettingsForm models={models} preferences={preferences} />
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

function ModelSettingsForm({
    models,
    preferences,
}: {
    models: AvailableModel[];
    preferences: UserPreferencesState;
}) {
    const defaultModel = models[0]?.name ?? '';
    const [selectedModel, setSelectedModel] = useState(preferences.selectedModel || defaultModel);
    const [temperature, setTemperature] = useState(String(preferences.temperature ?? 0.2));
    const [responseLanguage, setResponseLanguage] = useState(preferences.responseLanguage || 'Korean');

    useEffect(() => {
        setSelectedModel(preferences.selectedModel || defaultModel);
        setTemperature(String(preferences.temperature ?? 0.2));
        setResponseLanguage(preferences.responseLanguage || 'Korean');
    }, [defaultModel, preferences.responseLanguage, preferences.selectedModel, preferences.temperature]);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        vscode.postMessage({
            type: 'SAVE_PREFERENCES',
            payload: {
                selectedModel,
                temperature: Number(temperature),
                responseLanguage,
            },
        });
    }

    return (
        <form className="form-stack compact-form" onSubmit={submit}>
            <div className="form-title">Coder settings</div>
            <label className="field">
                <span>Model</span>
                <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>
                    {models.map((model) => (
                        <option key={model.name} value={model.name}>
                            {model.displayName}
                        </option>
                    ))}
                </select>
            </label>
            <label className="field">
                <span>Temperature</span>
                <div className="range-field">
                    <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={temperature}
                        onChange={(event) => setTemperature(event.target.value)}
                    />
                    <input
                        type="number"
                        min="0"
                        max="2"
                        step="0.1"
                        value={temperature}
                        onChange={(event) => setTemperature(event.target.value)}
                    />
                </div>
            </label>
            <label className="field">
                <span>Response language</span>
                <select value={responseLanguage} onChange={(event) => setResponseLanguage(event.target.value)}>
                    <option value="Korean">Korean</option>
                    <option value="English">English</option>
                </select>
            </label>
            <button className="primary-button" type="submit" disabled={!selectedModel}>
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
