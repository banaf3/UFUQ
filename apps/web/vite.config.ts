import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The browser talks to the API through a same-origin /api proxy (dev and preview).
// UFUQ_API_PORT lets the e2e runner use its own API port beside a running preview.
const apiPort = globalThis.process?.env.UFUQ_API_PORT ?? '4174';
const api = { '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: false } };

export default defineConfig({
  plugins: [react()],
  server: { proxy: api },
  preview: { proxy: api },
});
