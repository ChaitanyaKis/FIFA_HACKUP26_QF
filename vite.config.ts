import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// NOTE: `base` must match the GitHub Pages repo name for production builds.
export default defineConfig({
  base: '/FIFA-HACKUP-Morocco/',
  plugins: [react()],
})
