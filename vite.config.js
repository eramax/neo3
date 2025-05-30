import { defineConfig } from 'vite';

export default defineConfig({
    root: './src',
    server: {
        port: 3000,
        open: true,
        host: 'localhost'
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: 'index.html'
        }
    },
    resolve: {
        alias: {
            '@': '.'
        }
    },
    optimizeDeps: {
        include: ['lit']
    }
});
