import * as assert from 'assert';
import { buildKleeContextFromFiles } from '../extension-host/chat/kleeContext';

suite('klee context', () => {
    test('includes rules hooks and only the matching custom skill', () => {
        const context = buildKleeContextFromFiles(
            [
                { directory: 'rules', name: 'project', path: '.klee/rules/project.md', content: 'Rule text' },
                { directory: 'skills', name: 'foo', path: '.klee/skills/foo.md', content: 'Foo skill' },
                { directory: 'skills', name: 'bar', path: '.klee/skills/bar.md', content: 'Bar skill' },
                { directory: 'hooks', name: 'before_chat', path: '.klee/hooks/before_chat.md', content: 'Hook text' },
            ],
            'foo',
        );

        assert.ok(context);
        assert.strictEqual(context.rules.length, 1);
        assert.strictEqual(context.skills.length, 1);
        assert.strictEqual(context.skills[0].name, 'foo');
        assert.strictEqual(context.hooks.length, 1);
    });

    test('does not treat .skill as a supported custom skill folder', () => {
        const context = buildKleeContextFromFiles(
            [
                { directory: '.skill', name: 'foo', path: '.skill/foo.md', content: 'Legacy skill' },
            ],
            'foo',
        );

        assert.strictEqual(context, undefined);
    });

    test('does not include custom skills without a slash command', () => {
        const context = buildKleeContextFromFiles([
            { directory: 'skills', name: 'foo', path: '.klee/skills/foo.md', content: 'Foo skill' },
        ]);

        assert.strictEqual(context, undefined);
    });
});
