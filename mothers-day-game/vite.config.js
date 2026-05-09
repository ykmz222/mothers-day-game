import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 'base: ./' = relative paths so it works at any URL (GitHub Pages, Netlify, etc.)
export default defineConfig({
  plugins: [react()],
  base: './',
})
