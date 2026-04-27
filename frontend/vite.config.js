import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Дозволяє доступ ззовні контейнера (ОБОВ'ЯЗКОВО)
    port: 5173,
    watch: {
      usePolling: true // Допомагає Vite бачити зміни файлів у Windows
    }
  }
});