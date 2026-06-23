import * as assert from 'assert';
import { sendChatMessageStream } from '../extension-host/services/chatApiClient';

suite('chat API client', () => {
    const originalFetch = globalThis.fetch;

    teardown(() => {
        globalThis.fetch = originalFetch;
    });

    test('preserves leading whitespace in streamed token data', async () => {
        globalThis.fetch = async () =>
            new Response(
                new ReadableStream({
                    start(controller) {
                        const encoder = new TextEncoder();
                        controller.enqueue(encoder.encode('event: token\ndata:  Hello\n\n'));
                        controller.enqueue(encoder.encode('event: token\ndata:  world\n\n'));
                        controller.enqueue(encoder.encode('event: done\ndata: \n\n'));
                        controller.close();
                    },
                }),
                { status: 200, statusText: 'OK' },
            );

        const chunks: string[] = [];

        await sendChatMessageStream(
            {
                conversationId: 'conversation-1',
                code: '',
                question: 'Greet me',
            },
            {
                onAnswerDelta(text) {
                    chunks.push(text);
                },
            },
        );

        assert.deepStrictEqual(chunks, [' Hello', ' world']);
    });
});
