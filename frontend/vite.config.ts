import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base keeps the build working under a GitHub Pages project path.
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
})
