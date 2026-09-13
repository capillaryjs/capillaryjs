import {fileURLToPath} from 'node:url'

const sourcePath = (path) => fileURLToPath(new URL(path, import.meta.url))

export default {
    build: {
        lib: {
            entry: {index: sourcePath('./src/index.ts')},
            formats: ['es'],
            fileName: (_format, name) => `${name}.js`,
        },
        sourcemap: true,
        rollupOptions: {
            external: ['@capillaryjs/capillary-ui', '@capillaryjs/capillary'],
        },
    },
    esbuild: {
        jsx: 'automatic',
        jsxImportSource: '@capillaryjs/capillary-ui',
    },
    resolve: {
        alias: {
            '@capillaryjs/capillary-ui/jsx-runtime': sourcePath('../capillary-ui/src/jsx-runtime.ts'),
            '@capillaryjs/capillary-ui/jsx-dev-runtime': sourcePath('../capillary-ui/src/jsx-dev-runtime.ts'),
        },
    },
}
