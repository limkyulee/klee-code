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

    test('includes project rules without a slash command', () => {
        const context = buildKleeContextFromFiles([
            { directory: 'rules', name: 'project', path: '.klee/rules/project.md', content: 'Rule text' },
            { directory: 'skills', name: 'foo', path: '.klee/skills/foo.md', content: 'Foo skill' },
        ]);

        assert.ok(context);
        assert.strictEqual(context.rules.length, 1);
        assert.strictEqual(context.rules[0].name, 'project');
        assert.strictEqual(context.skills.length, 0);
    });

    test('sorts .klee files by path before sending them to the backend', () => {
        const context = buildKleeContextFromFiles(
            [
                { directory: 'rules', name: 'z', path: '.klee/rules/z.md', content: 'Z rule' },
                { directory: 'rules', name: 'a', path: '.klee/rules/a.md', content: 'A rule' },
            ],
        );

        assert.ok(context);
        assert.deepStrictEqual(context.rules.map((rule) => rule.path), ['.klee/rules/a.md', '.klee/rules/z.md']);
    });
});
