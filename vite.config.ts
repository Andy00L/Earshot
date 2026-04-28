import { defineConfig } from 'vite';
import { rmSync } from 'fs';
import { join } from 'path';

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
  plugins: [
    {
      name: 'strip-debug-assets',
      closeBundle() {
        // Remove _debug/ from dist -- pipeline debug overlays, not needed in production
        try { rmSync(join('dist', '_debug'), { recursive: true, force: true }); } catch {}
      },
    },
  ],
});
