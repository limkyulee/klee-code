import * as vscode from 'vscode';
import { getWebviewHtml } from './getWebviewHtml';
import { ChatWebviewMessageHandler, type WebviewMessage } from './ChatWebviewMessageHandler';

export class AssistantViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'klee-code.chatView';

    private messageHandler?: ChatWebviewMessageHandler;

    constructor(private readonly extensionUri: vscode.Uri) {}

    async askFromInputBox(): Promise<void> {
        await vscode.commands.executeCommand(`${AssistantViewProvider.viewType}.focus`);

        const question = await vscode.window.showInputBox({
            prompt: 'Ask Klee Code...',
            placeHolder: 'e.g. What does this code do?',
        });

        const trimmedQuestion = question?.trim();

        if (!trimmedQuestion) {
            return;
        }

        await this.messageHandler?.askExternal(trimmedQuestion);
    }

    async resetConversation(): Promise<void> {
        await vscode.commands.executeCommand(`${AssistantViewProvider.viewType}.focus`);
        await this.messageHandler?.resetConversation();
        vscode.window.showInformationMessage('Klee Code: New conversation started.');
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.messageHandler = new ChatWebviewMessageHandler((message) => webviewView.webview.postMessage(message));

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview')],
        };

        webviewView.webview.html = getWebviewHtml(webviewView.webview, this.extensionUri);
        webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
            void this.messageHandler?.handle(message);
        });
    }
}
