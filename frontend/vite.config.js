import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // Same-origin in dev => cookies work without CORS headaches
        '/api': { target: env.VITE_PROXY_TARGET || 'http://localhost:5001', changeOrigin: true },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test-setup.js',
      css: false,
    },
  };
});
