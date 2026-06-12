import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Use the modern Sass compiler API (the legacy JS API is deprecated
        // and slated for removal in Dart Sass 2.0). Each SCSS file explicitly
        // @uses the abstracts barrel — we avoid additionalData injection
        // because explicit @use rules resolve unambiguously and dedupe.
        api: 'modern-compiler',
      },
    },
  },
  server: {
    port: 5173,
    // During local dev, proxy API calls to the FastAPI backend so the
    // frontend can call "/api/..." without CORS headaches.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
