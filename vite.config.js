import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        port: 3000,
        open: true,
        host: 'localhost'
    },
    build: {
        outDir: './build',
        emptyOutDir: true,
        rollupOptions: {
            input: 'index.html'
        }
    },
    resolve: {
        alias: {
            '@': './src'
        }
    },
    optimizeDeps: {
        include: ['lit']
    }
});
