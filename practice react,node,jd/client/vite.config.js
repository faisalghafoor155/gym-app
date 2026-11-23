import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    // /api/... wali requests Node server (port 5050) pe chali jayengi
    proxy: {
      '/api': 'http://localhost:5050',
    },
  },
})
