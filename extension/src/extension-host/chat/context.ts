/*
 * 에디터 선택 영역과 주변 컨텍스트를 채팅 요청 형태로 변환한다.
 *
 * 이 모듈은 순수 함수 중심으로 구성해 테스트하기 쉽게 유지한다.
 */

export interface PositionLike {
    line: number;
    character: number;
}

export interface RangeLike {
    start: PositionLike;
    end: PositionLike;
}

export interface SelectionLike extends RangeLike {
    isEmpty: boolean;
}

export interface TextLineLike {
    text: string;
}

export interface TextDocumentLike {
    uri: { fsPath: string };
    languageId: string;
    lineCount: number;
    lineAt(line: number): TextLineLike;
    getText(range?: RangeLike): string;
}

export interface TextEditorLike {
    document: TextDocumentLike;
    selection: SelectionLike;
}

export interface SelectionRange {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
}

export interface CodeContext {
    filePath: string;
    languageId: string;
    selectionRange: SelectionRange;
    selectedText: string;
    surroundingSnippet: string;
}

export interface ChatRequestContext {
    conversationId: string;
    code: string;
    question: string;
    context?: CodeContext;
    skillCommand?: { name: string };
    kleeContext?: {
        rules: Array<{ name: string; path: string; content: string }>;
        skills: Array<{ name: string; path: string; content: string }>;
        hooks: Array<{ name: string; path: string; content: string }>;
    };
}

const CONTEXT_RADIUS_LINES = 10;

export function buildChatRequest(
    editor: TextEditorLike | undefined,
    conversationId: string,
    question: string,
    options: Pick<ChatRequestContext, 'skillCommand' | 'kleeContext'> = {},
): ChatRequestContext {
    const context = buildCodeContext(editor);

    return {
        conversationId,
        code: context?.selectedText ?? '',
        question,
        context,
        skillCommand: options.skillCommand,
        kleeContext: options.kleeContext,
    };
}

function buildCodeContext(editor: TextEditorLike | undefined): CodeContext | undefined {
    if (!editor) {
        return undefined;
    }

    const selectionRange = toSelectionRange(editor.selection);
    const selectedText = editor.selection.isEmpty ? '' : editor.document.getText(editor.selection);
    const surroundingSnippet = editor.selection.isEmpty
        ? ''
        : buildSurroundingSnippet(editor.document, selectionRange);

    return {
        filePath: editor.document.uri.fsPath,
        languageId: editor.document.languageId,
        selectionRange,
        selectedText,
        surroundingSnippet,
    };
}

function toSelectionRange(selection: SelectionLike): SelectionRange {
    return {
        startLine: selection.start.line,
        startCharacter: selection.start.character,
        endLine: selection.end.line,
        endCharacter: selection.end.character,
    };
}

function buildSurroundingSnippet(document: TextDocumentLike, selectionRange: SelectionRange): string {
    const startLine = Math.max(0, selectionRange.startLine - CONTEXT_RADIUS_LINES);
    const endLine = Math.min(document.lineCount - 1, selectionRange.endLine + CONTEXT_RADIUS_LINES);
    const lines: string[] = [];

    for (let line = startLine; line <= endLine; line += 1) {
        lines.push(document.lineAt(line).text);
    }

    return lines.join('\n');
}
