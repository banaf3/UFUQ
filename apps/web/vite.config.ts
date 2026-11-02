import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The browser talks to the API through a same-origin /api proxy (dev and preview).
const api = { '/api': { target: 'http://127.0.0.1:4174', changeOrigin: false } };

export default defineConfig({
  plugins: [react()],
  server: { proxy: api },
  preview: { proxy: api },
});
