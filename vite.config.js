import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        publico: resolve(__dirname, 'index.html'),
        auth: resolve(__dirname, 'auth.html'),
        gestor: resolve(__dirname, 'gestor.html'),
      },
    },
  },
});
