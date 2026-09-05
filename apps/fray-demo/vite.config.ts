import { defineConfig } from 'vite'
import {fileURLToPath, URL} from 'node:url'

export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      '@sylwellsoftware/fray/jsx-runtime': fileURLToPath(
        new URL('../../packages/fray/src/jsx-runtime.ts', import.meta.url),
      ),
      '@sylwellsoftware/fray/jsx-dev-runtime': fileURLToPath(
        new URL('../../packages/fray/src/jsx-dev-runtime.ts', import.meta.url),
      ),
      '@sylwellsoftware/fray': fileURLToPath(
        new URL('../../packages/fray/src/index.ts', import.meta.url),
      ),
      '@sylwellsoftware/glue': fileURLToPath(
        new URL('../../packages/glue/src/index.ts', import.meta.url),
      ),
    },
  },
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
  },
})
