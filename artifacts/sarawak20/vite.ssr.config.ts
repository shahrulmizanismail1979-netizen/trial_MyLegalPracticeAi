import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE_PATH || '/sarawak20/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(import.meta.dirname, '..', '..', 'attached_assets'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    ssr: path.resolve(import.meta.dirname, 'src/entry-server.tsx'),
    outDir: path.resolve(import.meta.dirname, 'dist/server'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'entry-server.js',
      },
    },
  },
});