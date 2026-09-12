import {fileURLToPath} from 'node:url'
import {defineConfig} from 'vite'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
    resolve: {
        alias: {
            '@sylwellsoftware/fray/jsx-runtime':
                `${repoRoot}/packages/fray/src/jsx-runtime.ts`,
            '@sylwellsoftware/fray/jsx-dev-runtime':
                `${repoRoot}/packages/fray/src/jsx-dev-runtime.ts`,
            '@sylwellsoftware/fray-visualization':
                `${repoRoot}/packages/fray-visualization/src/index.ts`,
            '@sylwellsoftware/fray': `${repoRoot}/packages/fray/src/index.ts`,
            '@sylwellsoftware/glue': `${repoRoot}/packages/glue/src/index.ts`,
        },
    },
    build: {
        assetsInlineLimit: 0,
        outDir: 'dist',
    },
    server: {
        port: 3002,
    },
    preview: {
        port: 4174,
    },
})
