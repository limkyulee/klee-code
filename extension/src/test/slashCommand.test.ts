import * as assert from 'assert';
import { LOCAL_SLASH_COMMANDS, parseSlashCommand } from '../extension-host/chat/slashCommand';

suite('slash skill command', () => {
    test('parses the first slash token as a skill command', () => {
        const parsed = parseSlashCommand('/review explain this');

        if (parsed.type !== 'promptSkill') {
            assert.fail(`Expected promptSkill, got ${parsed.type}`);
        }
        assert.deepStrictEqual(parsed.skillCommand, { name: 'review' });
        assert.strictEqual(parsed.question, 'explain this');
    });

    test('keeps slash text in the middle as a normal question', () => {
        const parsed = parseSlashCommand('please /review this');

        assert.strictEqual(parsed.type, 'text');
        assert.strictEqual(parsed.question, 'please /review this');
    });

    test('normalizes skill command names', () => {
        const parsed = parseSlashCommand('/Review-API run checks');

        if (parsed.type !== 'promptSkill') {
            assert.fail(`Expected promptSkill, got ${parsed.type}`);
        }
        assert.deepStrictEqual(parsed.skillCommand, { name: 'review-api' });
        assert.strictEqual(parsed.question, 'run checks');
    });

    test('detects local commands from the local command registry', () => {
        assert.ok(LOCAL_SLASH_COMMANDS.some((command) => command.name === 'clear'));
        assert.ok(LOCAL_SLASH_COMMANDS.some((command) => command.name === 'help'));
        assert.ok(LOCAL_SLASH_COMMANDS.some((command) => command.name === 'status'));

        assert.deepStrictEqual(parseSlashCommand('/clear'), { type: 'local', name: 'clear', args: '' });
        assert.deepStrictEqual(parseSlashCommand('/CLEAR now'), { type: 'local', name: 'clear', args: 'now' });
        assert.deepStrictEqual(parseSlashCommand('please /clear'), { type: 'text', question: 'please /clear' });
        assert.deepStrictEqual(parseSlashCommand('/help'), { type: 'local', name: 'help', args: '' });
        assert.deepStrictEqual(parseSlashCommand('/status'), { type: 'local', name: 'status', args: '' });
    });
});
