import * as assert from 'assert';
import { buildChatRequest, type TextEditorLike } from '../chat/context';

function createEditor(overrides: Partial<TextEditorLike> = {}): TextEditorLike {
    const document: TextEditorLike['document'] = overrides.document ?? {
        uri: { fsPath: '/workspace/src/example.ts' },
        languageId: 'typescript',
        lineCount: 5,
        lineAt(line: number) {
            return { text: `line-${line}` };
        },
        getText(range) {
            if (!range) {
                return 'selected code';
            }

            return range.start.line === range.end.line && range.start.character === range.end.character
                ? ''
                : 'selected code';
        },
    };

    const selection: TextEditorLike['selection'] = overrides.selection ?? {
        start: { line: 1, character: 2 },
        end: { line: 2, character: 4 },
        isEmpty: false,
    };

    return {
        document,
        selection,
    };
}

suite('chat context', () => {
    test('builds context payload when text is selected', () => {
        const request = buildChatRequest(createEditor(), 'conversation-1', 'Explain this');

        assert.strictEqual(request.code, 'selected code');
        assert.ok(request.context);
        assert.strictEqual(request.context?.filePath, '/workspace/src/example.ts');
        assert.strictEqual(request.context?.languageId, 'typescript');
        assert.strictEqual(request.context?.selectionRange.startLine, 1);
        assert.strictEqual(request.context?.selectionRange.endLine, 2);
        assert.ok(request.context?.surroundingSnippet.includes('line-0'));
    });

    test('keeps metadata but omits code payload when selection is empty', () => {
        const request = buildChatRequest(
            createEditor({
                selection: {
                    start: { line: 2, character: 3 },
                    end: { line: 2, character: 3 },
                    isEmpty: true,
                },
            }),
            'conversation-2',
            'Explain this',
        );

        assert.strictEqual(request.code, '');
        assert.ok(request.context);
        assert.strictEqual(request.context?.selectedText, '');
        assert.strictEqual(request.context?.surroundingSnippet, '');
        assert.strictEqual(request.context?.selectionRange.startLine, 2);
    });
});
