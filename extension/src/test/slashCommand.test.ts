import * as assert from 'assert';
import { isClearCommand, parseSlashSkillCommand } from '../extension-host/chat/slashCommand';

suite('slash skill command', () => {
    test('parses the first slash token as a skill command', () => {
        const parsed = parseSlashSkillCommand('/review explain this');

        assert.deepStrictEqual(parsed.skillCommand, { name: 'review' });
        assert.strictEqual(parsed.question, 'explain this');
    });

    test('keeps slash text in the middle as a normal question', () => {
        const parsed = parseSlashSkillCommand('please /review this');

        assert.strictEqual(parsed.skillCommand, undefined);
        assert.strictEqual(parsed.question, 'please /review this');
    });

    test('normalizes skill command names', () => {
        const parsed = parseSlashSkillCommand('/Review-API run checks');

        assert.deepStrictEqual(parsed.skillCommand, { name: 'review-api' });
        assert.strictEqual(parsed.question, 'run checks');
    });

    test('detects clear as a local reset command', () => {
        assert.strictEqual(isClearCommand('/clear'), true);
        assert.strictEqual(isClearCommand('/CLEAR now'), true);
        assert.strictEqual(isClearCommand('please /clear'), false);
    });
});
