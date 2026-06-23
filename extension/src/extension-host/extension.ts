/*
 * VS Code 확장 진입점.
 *
 * activate() 에서 Webview 기반 채팅 UI 와 커맨드를 등록한다.
 * HTTP 호출과 대화 상태 관리는 AssistantViewProvider 아래로 위임한다.
 *
 * ┌─ 사용자 흐름 ──────────────────────────────────────────────────┐
 * │  1. 에디터에서 코드 선택 (선택 없어도 동작)                       │
 * │  2. "Klee Code: Ask Assistant" 커맨드 실행                      │
 * │  3. 질문 입력창에 질문 입력                                       │
 * │  4. Klee Code 패널에서 백엔드 POST /chat 응답을 표시             │
 * │  "Klee Code: New Conversation" 으로 대화 컨텍스트를 초기화        │
 * └────────────────────────────────────────────────────────────────┘
 */

import * as vscode from 'vscode';
import { AssistantViewProvider } from './webview/AssistantViewProvider';

/**
 * 확장이 처음 활성화될 때 VS Code 가 호출한다.
 * 커맨드를 등록하고 구독 목록에 추가해 비활성화 시 정리되게 한다.
 */
export function activate(context: vscode.ExtensionContext): void {
    const assistantViewProvider = new AssistantViewProvider(context.extensionUri);
    const chatView = vscode.window.registerWebviewViewProvider(
        AssistantViewProvider.viewType,
        assistantViewProvider
    );

    /* ── 커맨드 1: Ask Assistant ── */
    const askCmd = vscode.commands.registerCommand('klee-code.askAssistant', async () => {
        await assistantViewProvider.askFromInputBox();
    });

    /* ── 커맨드 2: New Conversation ── */
    const newConvCmd = vscode.commands.registerCommand('klee-code.newConversation', async () => {
        await assistantViewProvider.resetConversation();
    });

    context.subscriptions.push(chatView, askCmd, newConvCmd);
}

/** 확장 비활성화 시 VS Code 가 호출한다. subscriptions 정리는 VS Code 가 자동으로 처리한다. */
export function deactivate(): void {}
