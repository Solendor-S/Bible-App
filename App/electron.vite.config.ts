import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Content-Security-Policy for the packaged renderer only — Vite's dev server needs inline scripts.
// connect-src: Ollama (AI Scholar), Gemini, Crossway ESV. img-src: OpenStreetMap tiles.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://tile.openstreetmap.org",
  "font-src 'self' data:",
  "connect-src 'self' http://localhost:11434 http://127.0.0.1:11434 https://generativelanguage.googleapis.com https://api.esv.org",
].join('; ')
const cspPlugin = {
  name: 'inject-csp',
  apply: 'build' as const,
  transformIndexHtml: (html: string) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
}

// Single source of truth for building main / preload / renderer.
// Replaces the old forge vite plugin + three vite.*.config.ts files.
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      rollupOptions: { input: { index: resolve(__dirname, 'electron/main.ts') } },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: { input: { index: resolve(__dirname, 'electron/preload.ts') } },
    },
  },
  renderer: {
    root: '.',
    plugins: [react(), cspPlugin],
    resolve: { alias: { '@renderer': resolve(__dirname, 'src') } },
    optimizeDeps: { include: ['leaflet'] },
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: { index: resolve(__dirname, 'index.html') } },
    },
  },
})
