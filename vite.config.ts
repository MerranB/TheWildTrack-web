import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
    resolve: {
    dedupe: ['react', 'react-dom'],
  },
  // maplibre-gl ships its own ES module Web Worker. Vite's dependency pre-bundling
  // rewrites it into .vite/deps/ and serves it with an empty MIME type, which the
  // browser refuses to execute — the map then renders the basemap but can never
  // process any source data, because all geometry parsing happens in that worker.
  // The package is already ESM, so there is nothing to gain from pre-bundling it.
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  worker: {
    format: 'es',
  },
  base: '/',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
