import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    loadEnv(mode, '.', '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      base: '/',
build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        minify: 'esbuild',
        rollupOptions: {
          output: {
            manualChunks: (id) => {
              if (id.includes('node_modules')) {
                // Split large vendor libraries into separate chunks
                if (id.includes('framer-motion')) return 'vendor-motion';
                if (id.includes('react')) return 'vendor-react';
                if (id.includes('react-dom')) return 'vendor-react-dom';
                if (id.includes('supabase')) return 'vendor-supabase';
                if (id.includes('@supabase')) return 'vendor-supabase';
                if (id.includes('date-fns')) return 'vendor-date-fns';
                if (id.includes('@stripe') || id.includes('stripe')) return 'vendor-stripe';
              }
            }
          }
        }
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
