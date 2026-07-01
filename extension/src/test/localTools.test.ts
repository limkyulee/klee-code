import * as assert from 'assert';
import { getLocalTool } from '../extension-host/chat/localToolRegistry';
import { executeLocalTool } from '../extension-host/chat/localTools';

suite('local tools', () => {
    test('keeps read-only local tool executors registered', () => {
        assert.strictEqual(typeof getLocalTool('read_file')?.execute, 'function');
        assert.strictEqual(typeof getLocalTool('search_files')?.execute, 'function');
    });

    test('keeps tool result status wire values stable', async () => {
        const result = await executeLocalTool({
            runId: 'run-1',
            toolCallId: 'tool-call-1',
            toolName: 'unsupported_tool',
            arguments: {},
        });

        assert.strictEqual(result.status, 'FAILED');
    });
});
