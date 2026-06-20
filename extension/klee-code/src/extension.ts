/*
 * VS Code 확장 진입점.
 *
 * activate() 에서 두 가지 커맨드를 등록하는 것 외에 비즈니스 로직을 두지 않는다.
 * HTTP 호출은 chat/chatClient.ts, 설정 접근은 config/settings.ts 에 위임한다.
 *
 * ┌─ 사용자 흐름 ──────────────────────────────────────────────────┐
 * │  1. 에디터에서 코드 선택 (선택 없어도 동작)                       │
 * │  2. "Klee Code: Ask Assistant" 커맨드 실행                      │
 * │  3. 질문 입력창에 질문 입력                                       │
 * │  4. 백엔드 POST /chat 호출 → LLM 응답을 출력 채널에 표시          │
 * │  "Klee Code: New Conversation" 으로 대화 컨텍스트를 초기화        │
 * └────────────────────────────────────────────────────────────────┘
 */

import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { sendChatMessage } from './chat/chatClient';
import { OUTPUT_CHANNEL_NAME, NEW_CONVERSATION_SEPARATOR } from './constants';

/*
 * conversationId: 현재 대화 세션 식별자.
 * MessageChatMemoryAdvisor 가 이 ID 로 MongoDB 에서 과거 대화를 찾는다.
 * "New Conversation" 커맨드가 이 값을 교체해 새 컨텍스트를 시작한다.
 */
let conversationId = randomUUID();

/* 출력 채널 — 확장 생명주기 동안 하나만 생성해 재사용한다 */
let outputChannel: vscode.OutputChannel;

/**
 * 확장이 처음 활성화될 때 VS Code 가 호출한다.
 * 커맨드를 등록하고 구독 목록에 추가해 비활성화 시 정리되게 한다.
 */
export function activate(context: vscode.ExtensionContext): void {
    outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);

    /* ── 커맨드 1: Ask Assistant ── */
    const askCmd = vscode.commands.registerCommand('klee-code.askAssistant', async () => {
        /* 에디터에서 선택된 코드를 가져온다. 선택이 없으면 빈 문자열 */
        const editor = vscode.window.activeTextEditor;
        const code = editor?.document.getText(editor.selection) ?? '';

        const question = await vscode.window.showInputBox({
            prompt: 'Ask the assistant...',
            placeHolder: 'e.g. What does this code do?',
        });

        /* 사용자가 입력창을 닫거나 빈 값을 제출하면 아무것도 하지 않는다 */
        if (!question) {
            return;
        }

        outputChannel.show(true);
        outputChannel.appendLine(`\n[You] ${question}`);

        try {
            const data = await sendChatMessage({ conversationId, code, question });
            outputChannel.appendLine(`[Assistant] ${data.answer}`);
        } catch (err) {
            /* 네트워크 오류 또는 HTTP 에러를 출력 채널에 표시한다 */
            outputChannel.appendLine(
                `[Error] ${err instanceof Error ? err.message : String(err)}`
            );
        }
    });

    /* ── 커맨드 2: New Conversation ── */
    const newConvCmd = vscode.commands.registerCommand('klee-code.newConversation', () => {
        /* UUID 를 교체하면 다음 요청부터 새 대화 이력으로 시작된다 */
        conversationId = randomUUID();
        outputChannel.appendLine(NEW_CONVERSATION_SEPARATOR);
        vscode.window.showInformationMessage('Klee Code: New conversation started.');
    });

    context.subscriptions.push(askCmd, newConvCmd, outputChannel);
}

/** 확장 비활성화 시 VS Code 가 호출한다. subscriptions 정리는 VS Code 가 자동으로 처리한다. */
export function deactivate(): void {}
