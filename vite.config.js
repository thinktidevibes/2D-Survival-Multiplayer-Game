import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 3008,
    },
    root: 'client',
    publicDir: 'public',
    build: {
        outDir: '../dist',
        assetsDir: 'assets',
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'client/index.html'),
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './client/src'),
        },
    },
});
