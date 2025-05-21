import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3008,
  },
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
  }
})
