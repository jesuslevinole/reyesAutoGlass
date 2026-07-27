import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Alias '@' -> 'src': evita imports relativos frágiles ('../../..').
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/mygrant-soap': {
        target: 'https://webservice.mygrantglass.com',
        changeOrigin: true,
        secure: true,
        // Eliminamos rastros del navegador que activan Cloudflare
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
            proxyReq.removeHeader('user-agent');
            // Añadimos un user-agent de servidor común para que no sospeche
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
          });
        },
        rewrite: (path) => path.replace(/^\/mygrant-soap/, ''),
      },
    },
  },
});
