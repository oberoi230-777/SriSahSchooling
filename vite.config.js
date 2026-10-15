import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // The Capacitor (Play Store) build writes to its own directory so packaging the
    // Android app never overwrites the browser build in web/dist.
    ...(process.env.BUILD_TARGET === 'android' ? { outDir: 'dist-android', copyPublicDir: true } : {}),
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true } },
  },
});
