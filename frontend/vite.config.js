import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/randevu/',
  plugins: [react()],
  define: {
    'process.env': {}
  },
  // 1. LOKAL GELİŞTİRME İÇİN (npm run dev)
  server: {
    host: true, 
    port: 5173,
    allowedHosts: 'all',
    proxy: {
      '/randevu/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/randevu/, ''),
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  // Üretim Apache dist klasörünü sunar. preview yalnızca yerel kontrol içindir.
  preview: {
    host: true,
    port: 5173,
    allowedHosts: 'all',
    proxy: {
      '/randevu/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/randevu/, ''),
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
