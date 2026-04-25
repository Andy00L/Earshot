import { defineConfig, loadEnv } from 'vite';

// SECURITY WARNING: ELEVENLABS_API_KEY is exposed in the client bundle via the
// define below. This is acceptable for a hackathon demo ONLY. For production,
// proxy TTS calls through a server-side endpoint and never ship the key to the
// browser. Rotate this key after the hackathon.

export default defineConfig(({ mode }) => {
  // loadEnv reads .env files relative to root (resolved by Vite)
  const env = loadEnv(mode, '.', '');
  return {
    publicDir: 'assets',
    server: {
      port: 5173,
      open: false,
    },
    build: {
      target: 'es2020',
      outDir: 'dist',
    },
    define: {
      '__ELEVENLABS_API_KEY__': JSON.stringify(env.ELEVENLABS_API_KEY || ''),
    },
  };
});
