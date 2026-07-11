import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps the build relocatable so it works on GitHub Pages
// (project subpath) and any other static host without configuration.
export default defineConfig({
  base: './',
  plugins: [react()],
})
