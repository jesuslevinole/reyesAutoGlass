import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Forma de función: compatible con los tipos de Vite 5 y 6 por igual,
        // y captura también los paquetes con scope (@firebase/*)
        manualChunks(id: string) {
          if (id.includes('node_modules/exceljs')) return 'exceljs';
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase';
        },
      },
    },
  },
});
