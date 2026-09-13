import { defineConfig } from 'vite'
import {fileURLToPath, URL} from 'node:url'

export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      '@capillaryjs/capillary-ui/jsx-runtime': fileURLToPath(
        new URL('../../packages/capillary-ui/src/jsx-runtime.ts', import.meta.url),
      ),
      '@capillaryjs/capillary-ui/jsx-dev-runtime': fileURLToPath(
        new URL('../../packages/capillary-ui/src/jsx-dev-runtime.ts', import.meta.url),
      ),
      '@capillaryjs/capillary-ui': fileURLToPath(
        new URL('../../packages/capillary-ui/src/index.ts', import.meta.url),
      ),
      '@capillaryjs/capillary': fileURLToPath(
        new URL('../../packages/capillary/src/index.ts', import.meta.url),
      ),
      '@capillaryjs/capillary-viz': fileURLToPath(
        new URL('../../packages/capillary-viz/src/index.ts', import.meta.url),
      ),
    },
  },
  build: {
    assetsInlineLimit: 0,
    outDir: 'dist',
  },
  server: {
    port: 3000,
  },
})
