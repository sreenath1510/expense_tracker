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
  build: {
    rollupOptions: {
      output: {
        // Split the charting stack into its own chunk. It changes far less
        // often than app code, so it stays cached across deploys — and it keeps
        // its weight visible in the build output instead of buried in the app
        // bundle.
        manualChunks: (id) =>
          /node_modules[\\/](d3-|internmap)/.test(id) ? 'charts' : undefined,
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
