import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron', 'sql.js', 'path', 'fs', 'url', 'os', 'crypto']
    }
  }
})
