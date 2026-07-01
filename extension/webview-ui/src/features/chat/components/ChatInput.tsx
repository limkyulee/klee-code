import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { AvailableModel, PermissionMode } from '../api/webviewProtocol';

interface ChatInputProps {
    models: AvailableModel[];
    selectedModel: string;
    pending: boolean;
    disabled?: boolean;
    disabledReason?: string;
    onModelChange(modelName: string): void;
    onNewConversation(): void;
    onSend(text: string, permissionMode: PermissionMode): void;
    onStop(): void;
}

const approvalModes = [
    {
        id: 'ask',
        title: 'Ask for approval',
        description: 'Always ask to edit external files and use the internet',
    },
    {
        id: 'approve',
        title: 'Approve for me',
        description: 'Only ask for actions detected as potentially unsafe',
    },
    {
        id: 'full',
        title: 'Full access',
        description: 'Unrestricted access to the internet and any file on your computer',
    },
] as const;

export function ChatInput({
    models,
    selectedModel,
    pending,
    disabled = false,
    disabledReason = 'Chat is unavailable',
    onModelChange,
    onNewConversation,
    onSend,
    onStop,
}: ChatInputProps) {
    const [text, setText] = useState('');
    const [modeOpen, setModeOpen] = useState(false);
    const [selectedModeId, setSelectedModeId] = useState<PermissionMode>('ask');
    const menuRef = useRef<HTMLDivElement>(null);
    const selectedMode = approvalModes.find((mode) => mode.id === selectedModeId) ?? approvalModes[0];
    const selectedModelLabel = useMemo(
        () => models.find((model) => model.name === selectedModel)?.displayName || selectedModel || 'AI Model',
        [models, selectedModel],
    );

    useEffect(() => {
        function handlePointerDown(event: PointerEvent) {
            if (!menuRef.current?.contains(event.target as Node)) {
                setModeOpen(false);
            }
        }

        function handleKeyDown(event: globalThis.KeyboardEvent) {
            if (event.key === 'Escape') {
                setModeOpen(false);
            }
        }

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    function submit(event?: FormEvent<HTMLFormElement>) {
        event?.preventDefault();

        const trimmedText = text.trim();

        if (!trimmedText || pending || disabled) {
            return;
        }

        onSend(trimmedText, selectedModeId);
        setText('');
    }

    function shouldSubmitFromKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.nativeEvent.isComposing) {
            return false;
        }

        return event.key === 'Enter' && !event.shiftKey;
    }

    function handleTextAreaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (shouldSubmitFromKeyDown(event)) {
            event.preventDefault();
            submit();
        }
    }

    return (
        <form className="composer" onSubmit={submit}>
            <textarea
                onChange={(event) => setText(event.target.value)}
                onKeyDown={handleTextAreaKeyDown}
                placeholder={disabled ? disabledReason : 'Do anything'}
                readOnly={pending || disabled}
                rows={3}
                value={text}
            />
            <div className="composer-bar">
                <div className="composer-left">
                    <button
                        aria-label="New conversation"
                        className="tool-button icon-only"
                        onClick={onNewConversation}
                        title="New conversation"
                        type="button"
                    >
                        <span aria-hidden="true" className="icon icon-plus" />
                    </button>
                    <div className="mode-menu" ref={menuRef}>
                        <button
                            aria-expanded={modeOpen}
                            className="tool-button mode-trigger"
                            onClick={() => setModeOpen((open) => !open)}
                            type="button"
                        >
                            <span aria-hidden="true" className={`mode-icon mode-icon-${selectedMode.id}`} />
                            <span className="mode-label">{selectedMode.title}</span>
                            <span aria-hidden="true" className="icon icon-chevron" />
                        </button>
                        {modeOpen ? (
                            <div className="mode-popover" role="menu">
                                <div className="mode-popover-header">
                                    <span>How should Klee Code actions be approved?</span>
                                    <button className="learn-more" type="button">
                                        Learn more
                                    </button>
                                </div>
                                <div className="mode-options">
                                    {approvalModes.map((mode) => (
                                        <button
                                            aria-checked={mode.id === selectedModeId}
                                            className="mode-option"
                                            key={mode.id}
                                            onClick={() => {
                                                setSelectedModeId(mode.id);
                                                setModeOpen(false);
                                            }}
                                            role="menuitemradio"
                                            type="button"
                                        >
                                            <span aria-hidden="true" className={`mode-icon mode-icon-${mode.id}`} />
                                            <span className="mode-option-copy">
                                                <span className="mode-option-title">{mode.title}</span>
                                                <span className="mode-option-description">{mode.description}</span>
                                            </span>
                                            <span
                                                aria-hidden="true"
                                                className={`mode-check${mode.id === selectedModeId ? ' selected' : ''}`}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className="composer-right">
                    <label className="model-select" title={selectedModelLabel}>
                        <span className="sr-only">Model</span>
                        <select
                            aria-label="Model"
                            disabled={disabled || models.length === 0}
                            onChange={(event) => onModelChange(event.target.value)}
                            value={selectedModel}
                        >
                            {models.length === 0 ? (
                                <option value="">AI Model</option>
                            ) : (
                                models.map((model) => (
                                    <option key={model.name} value={model.name}>
                                        {model.displayName}
                                    </option>
                                ))
                            )}
                        </select>
                    </label>
                    <button
                        aria-label={pending ? 'Stop response' : 'Send message'}
                        className={`send icon-only${pending ? ' stop' : ''}`}
                        disabled={!pending && (disabled || text.trim().length === 0)}
                        onClick={pending ? onStop : undefined}
                        title={pending ? 'Stop response' : 'Send message'}
                        type={pending ? 'button' : 'submit'}
                    >
                        <span aria-hidden="true" className={`icon ${pending ? 'icon-stop' : 'icon-send'}`} />
                    </button>
                </div>
            </div>
        </form>
    );
}
