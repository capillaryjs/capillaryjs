import {fileURLToPath} from 'node:url'
import {defineConfig} from 'vite'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
    resolve: {
        alias: {
            '@capillaryjs/capillary-ui/jsx-runtime':
                `${repoRoot}/packages/capillary-ui/src/jsx-runtime.ts`,
            '@capillaryjs/capillary-ui/jsx-dev-runtime':
                `${repoRoot}/packages/capillary-ui/src/jsx-dev-runtime.ts`,
            '@capillaryjs/capillary-ui': `${repoRoot}/packages/capillary-ui/src/index.ts`,
            '@capillaryjs/capillary': `${repoRoot}/packages/capillary/src/index.ts`,
        },
    },
    build: {
        assetsInlineLimit: 0,
        outDir: 'dist',
    },
    server: {
        port: 3003,
    },
    preview: {
        port: 4175,
    },
})
