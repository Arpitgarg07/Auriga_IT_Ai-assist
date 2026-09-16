import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The optional Express API listens on PORT (default 4000). Proxying /api keeps
    // the frontend free of hard-coded hosts, and lets the app run with the API
    // absent: the request simply fails and the UI stays on local storage.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
