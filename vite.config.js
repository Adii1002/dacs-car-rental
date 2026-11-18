import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API = `http://localhost:${process.env.API_PORT || 5050}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': API,
      '/uploads': API,
    },
  },
})
