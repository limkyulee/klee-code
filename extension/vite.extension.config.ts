import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const nodeBuiltins = [...builtinModules, ...builtinModules.map((mod) => `node:${mod}`)];

export default defineConfig(({ mode }) => ({
    build: {
        emptyOutDir: false,
        lib: {
            entry: resolve(__dirname, 'src/extension-host/extension.ts'),
            formats: ['cjs'],
            fileName: () => 'extension.js',
        },
        minify: mode === 'production',
        outDir: 'dist',
        rollupOptions: {
            external: ['vscode', ...nodeBuiltins],
            output: {
                entryFileNames: 'extension.js',
            },
        },
        sourcemap: mode !== 'production',
    },
}));
