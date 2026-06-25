import * as assert from 'assert';
import {
    deleteConversation,
    getChatHistory,
    getConversation,
    sendChatMessageStream,
} from '../extension-host/services/chatApiClient';

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

    test('uses conversations endpoints with authorization headers', async () => {
        const requests: Array<{ input: Parameters<typeof fetch>[0]; init?: Parameters<typeof fetch>[1] }> = [];
        globalThis.fetch = async (input, init) => {
            requests.push({ input, init });

            if (String(input).endsWith('/conversations/conversation-1') && init?.method === 'DELETE') {
                return new Response(null, { status: 204, statusText: 'No Content' });
            }

            if (String(input).endsWith('/conversations/conversation-1')) {
                return Response.json({ conversationId: 'conversation-1', messages: [] });
            }

            return Response.json([]);
        };

        await getChatHistory({ accessToken: 'access-token' });
        await getConversation('conversation-1', { accessToken: 'access-token' });
        await deleteConversation('conversation-1', { accessToken: 'access-token' });

        assert.ok(String(requests[0].input).endsWith('/conversations'));
        assert.ok(String(requests[1].input).endsWith('/conversations/conversation-1'));
        assert.ok(String(requests[2].input).endsWith('/conversations/conversation-1'));
        assert.strictEqual(requests[2].init?.method, 'DELETE');
        for (const request of requests) {
            const headers = request.init?.headers as Record<string, string> | undefined;
            assert.strictEqual(headers?.Authorization, 'Bearer access-token');
        }
    });
});
