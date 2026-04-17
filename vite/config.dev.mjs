import { defineConfig } from 'vite';

export default defineConfig({
    base: '/hackathon-casino/',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
    },
    server: {
        port: 8080
    }
});
