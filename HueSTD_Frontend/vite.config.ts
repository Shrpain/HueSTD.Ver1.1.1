import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        // Local dev: forward /api/* to backend to avoid CORS
        proxy: {
          '/api': {
            target: 'http://localhost:5136',
            changeOrigin: true,
          },
          '/hubs': {
            target: 'http://localhost:5136',
            changeOrigin: true,
            ws: true,
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || 'https://oubkbvypiabgfulnhsnd.supabase.co'),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91YmtidnlwaWFiZ2Z1bG5oc25kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MDMwMzYsImV4cCI6MjA4NTE3OTAzNn0.iibCCC5PfRnNAuYGsh2s5O-V5vbfFpAB-QCBo1E0-s0'),
        // Backend dùng [Route("api/[controller]")]; baseURL phải kết thúc bằng /api
        // Dev: /api → Vite proxy → http://localhost:5136/api/...
        'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL || '/api'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
