import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
    define: {
        'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
    },
    plugins: [react()],
    build: {
        cssCodeSplit: false,
        emptyOutDir: true,
        lib: {
            entry: resolve(__dirname, 'webview-ui/src/App.tsx'),
            formats: ['iife'],
            name: 'KleeCodeWebview',
            fileName: () => 'app.js',
            cssFileName: 'app',
        },
        minify: mode === 'production',
        outDir: 'dist/webview',
        rollupOptions: {
            output: {
                assetFileNames: 'app[extname]',
                entryFileNames: 'app.js',
            },
        },
        sourcemap: mode !== 'production',
    },
}));
