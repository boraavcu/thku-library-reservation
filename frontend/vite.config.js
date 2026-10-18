import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {}
  },
  server: {
    host: true, // Test sunucusu IP'si veya domaini üzerinden erişime izin verir
    port: 5173,
    allowedHosts: true, // Test sunucusu domain adını (örn: test.library.thk.edu.tr) engellemez
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})