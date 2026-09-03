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
            external: ['@sylwellsoftware/fray', '@sylwellsoftware/glue'],
        },
    },
    esbuild: {
        jsx: 'automatic',
        jsxImportSource: '@sylwellsoftware/fray',
    },
    resolve: {
        alias: {
            '@sylwellsoftware/fray/jsx-runtime': sourcePath('../fray/src/jsx-runtime.ts'),
            '@sylwellsoftware/fray/jsx-dev-runtime': sourcePath('../fray/src/jsx-dev-runtime.ts'),
        },
    },
}
