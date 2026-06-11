import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

// Separate app/URL from the main dashboard: dev server on :3001, proxying the
// shared backend API (/api) to the Express backend on :4000 during local dev.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': path.resolve(repoRoot, 'shared') },
  },
  // recharts is only imported by shared/ (outside this app's root), so Vite
  // won't auto-discover it — pre-bundle it explicitly so it resolves.
  optimizeDeps: { include: ['recharts'] },
  server: {
    port: 3001,
    fs: { allow: [repoRoot] }, // permit importing from ../shared
    proxy: { '/api': 'http://localhost:4000' },
  },
})
