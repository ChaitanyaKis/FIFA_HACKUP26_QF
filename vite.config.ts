import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// NOTE: `base` must match the GitHub Pages repo name for production builds.
// REPLACE '/REPO_NAME/' with '/<your-repo-name>/' before deploying.
export default defineConfig({
  base: '/FIFA_HACKUP26_QF/',
  plugins: [react()],
})
