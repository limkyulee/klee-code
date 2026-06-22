import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { sendChatMessage } from '../chat/chatClient';
import { getBackendUrl } from '../config/settings';

type ChatViewMessage =
    | { type: 'ready' }
    | { type: 'ask'; question: string }
    | { type: 'newConversation' };

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'klee-code.chatView';

    private view?: vscode.WebviewView;
    private conversationId = randomUUID();

    async askFromInputBox(): Promise<void> {
        await vscode.commands.executeCommand(`${ChatViewProvider.viewType}.focus`);

        const question = await vscode.window.showInputBox({
            prompt: 'Ask Klee Code...',
            placeHolder: 'e.g. What does this code do?',
        });

        if (!question) {
            return;
        }

        const trimmedQuestion = question.trim();

        if (!trimmedQuestion) {
            return;
        }

        await this.postMessage({ type: 'externalQuestion', question: trimmedQuestion });
        await this.ask(trimmedQuestion);
    }

    async resetConversation(): Promise<void> {
        await vscode.commands.executeCommand(`${ChatViewProvider.viewType}.focus`);
        this.conversationId = randomUUID();
        await this.postMessage({ type: 'conversationReset' });
        vscode.window.showInformationMessage('Klee Code: New conversation started.');
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
        };

        webviewView.webview.html = this.getHtml(webviewView.webview);
        webviewView.webview.onDidReceiveMessage((message: ChatViewMessage) => {
            void this.handleMessage(message);
        });
    }

    private async handleMessage(message: ChatViewMessage): Promise<void> {
        switch (message.type) {
            case 'ready':
                await this.postBackendStatus();
                return;
            case 'newConversation':
                this.conversationId = randomUUID();
                await this.postMessage({ type: 'conversationReset' });
                return;
            case 'ask':
                await this.ask(message.question);
                return;
        }
    }

    private async ask(question: string): Promise<void> {
        const trimmedQuestion = question.trim();

        if (!trimmedQuestion) {
            return;
        }

        await this.postMessage({ type: 'requestStarted' });

        try {
            const editor = vscode.window.activeTextEditor;
            const code = editor?.document.getText(editor.selection) ?? '';
            const response = await sendChatMessage({
                conversationId: this.conversationId,
                code,
                question: trimmedQuestion,
            });

            await this.postMessage({ type: 'response', answer: response.answer });
        } catch (err) {
            await this.postMessage({
                type: 'error',
                message: err instanceof Error ? err.message : String(err),
            });
        }
    }

    private async postBackendStatus(): Promise<void> {
        await this.postMessage({ type: 'status', backendUrl: getBackendUrl() });
    }

    private async postMessage(message: Record<string, unknown>): Promise<void> {
        await this.view?.webview.postMessage(message);
    }

    private getHtml(webview: vscode.Webview): string {
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Klee Code</title>
    <style>
        :root {
            color-scheme: light dark;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            color: var(--vscode-foreground);
            background: var(--vscode-sideBar-background);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }

        .shell {
            display: grid;
            grid-template-rows: auto 1fr auto;
            height: 100vh;
            min-height: 0;
        }

        .toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 10px 10px 8px;
            border-bottom: 1px solid var(--vscode-sideBar-border);
        }

        .title {
            min-width: 0;
            font-weight: 600;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .icon-button {
            display: inline-grid;
            place-items: center;
            width: 28px;
            height: 28px;
            border: 1px solid var(--vscode-button-border, transparent);
            border-radius: 4px;
            color: var(--vscode-button-foreground);
            background: var(--vscode-button-background);
            cursor: pointer;
        }

        .icon-button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .status {
            padding: 6px 10px;
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            border-bottom: 1px solid var(--vscode-sideBar-border);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .messages {
            display: flex;
            flex-direction: column;
            gap: 10px;
            min-height: 0;
            overflow-y: auto;
            padding: 12px 10px;
        }

        .empty {
            margin: auto 0;
            color: var(--vscode-descriptionForeground);
            line-height: 1.5;
        }

        .message {
            display: grid;
            gap: 5px;
        }

        .role {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .bubble {
            width: 100%;
            padding: 9px 10px;
            border: 1px solid var(--vscode-input-border, var(--vscode-sideBar-border));
            border-radius: 6px;
            line-height: 1.45;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }

        .message.user .bubble {
            background: var(--vscode-input-background);
        }

        .message.assistant .bubble {
            background: var(--vscode-editor-background);
        }

        .message.error .bubble {
            color: var(--vscode-errorForeground);
            border-color: var(--vscode-inputValidation-errorBorder);
            background: var(--vscode-inputValidation-errorBackground);
        }

        .composer {
            display: grid;
            gap: 8px;
            padding: 10px;
            border-top: 1px solid var(--vscode-sideBar-border);
        }

        textarea {
            width: 100%;
            min-height: 78px;
            max-height: 160px;
            resize: vertical;
            padding: 8px;
            color: var(--vscode-input-foreground);
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border, transparent);
            border-radius: 4px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            line-height: 1.4;
        }

        textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }

        .actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
        }

        .send {
            min-width: 76px;
            height: 30px;
            padding: 0 12px;
            border: 1px solid var(--vscode-button-border, transparent);
            border-radius: 4px;
            color: var(--vscode-button-foreground);
            background: var(--vscode-button-background);
            cursor: pointer;
            font-weight: 600;
        }

        .send:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .send:disabled,
        textarea:disabled {
            opacity: 0.65;
            cursor: not-allowed;
        }
    </style>
</head>
<body>
    <div class="shell">
        <header>
            <div class="toolbar">
                <div class="title">Klee Code</div>
                <button class="icon-button" id="newConversation" type="button" title="New conversation" aria-label="New conversation">+</button>
            </div>
            <div class="status" id="status">Connecting...</div>
        </header>

        <main class="messages" id="messages">
            <div class="empty" id="empty">Ask about the selected code or the current workspace.</div>
        </main>

        <form class="composer" id="form">
            <textarea id="question" placeholder="Ask Klee Code..." rows="4"></textarea>
            <div class="actions">
                <button class="send" id="send" type="submit">Send</button>
            </div>
        </form>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const messages = document.getElementById('messages');
        const empty = document.getElementById('empty');
        const form = document.getElementById('form');
        const question = document.getElementById('question');
        const send = document.getElementById('send');
        const status = document.getElementById('status');
        const newConversation = document.getElementById('newConversation');

        let pending = false;

        function setPending(value) {
            pending = value;
            question.disabled = value;
            send.disabled = value;
            send.textContent = value ? 'Sending' : 'Send';
        }

        function addMessage(role, text, variant) {
            empty.hidden = true;

            const item = document.createElement('article');
            item.className = 'message ' + (variant || role.toLowerCase());

            const label = document.createElement('div');
            label.className = 'role';
            label.textContent = role;

            const bubble = document.createElement('div');
            bubble.className = 'bubble';
            bubble.textContent = text;

            item.append(label, bubble);
            messages.append(item);
            messages.scrollTop = messages.scrollHeight;
        }

        form.addEventListener('submit', (event) => {
            event.preventDefault();

            const text = question.value.trim();
            if (!text || pending) {
                return;
            }

            addMessage('You', text, 'user');
            question.value = '';
            vscode.postMessage({ type: 'ask', question: text });
        });

        question.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                form.requestSubmit();
            }
        });

        newConversation.addEventListener('click', () => {
            vscode.postMessage({ type: 'newConversation' });
        });

        window.addEventListener('message', (event) => {
            const message = event.data;

            if (message.type === 'status') {
                status.textContent = 'Backend: ' + message.backendUrl;
            }

            if (message.type === 'requestStarted') {
                setPending(true);
            }

            if (message.type === 'externalQuestion') {
                addMessage('You', message.question, 'user');
            }

            if (message.type === 'response') {
                setPending(false);
                addMessage('Assistant', message.answer, 'assistant');
            }

            if (message.type === 'error') {
                setPending(false);
                addMessage('Error', message.message, 'error');
            }

            if (message.type === 'conversationReset') {
                messages.querySelectorAll('.message').forEach((node) => node.remove());
                empty.hidden = false;
                status.textContent = 'New conversation';
            }
        });

        vscode.postMessage({ type: 'ready' });
    </script>
</body>
</html>`;
    }
}

function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';

    for (let i = 0; i < 32; i += 1) {
        nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return nonce;
}
