import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'assets',
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
