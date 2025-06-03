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
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            input: 'index.html',
            output: {
                manualChunks: {
                    'vendor': ['lit', 'lit-element'],
                }
            }
        }
    },
    worker: {
        format: 'es'
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
