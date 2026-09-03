import {fileURLToPath} from 'node:url'

const sourcePath = (path) => fileURLToPath(new URL(path, import.meta.url))

export default {
    build: {
        lib: {
            entry: {
                index: sourcePath('./src/index.ts'),
                'jsx-runtime': sourcePath('./src/jsx-runtime.ts'),
                'jsx-dev-runtime': sourcePath('./src/jsx-dev-runtime.ts')
            },
            formats: ['es'],
            fileName: (_format, name) => `${name}.js`
        },
        sourcemap: true,
        rollupOptions: {
            external: ['@sylwellsoftware/glue']
        }
    },
    esbuild: {
        jsx: 'automatic',
        jsxImportSource: '@sylwellsoftware/fray'
    },
    resolve: {
        alias: {
            '@sylwellsoftware/fray/jsx-runtime': sourcePath('./src/jsx-runtime.ts'),
            '@sylwellsoftware/fray/jsx-dev-runtime': sourcePath('./src/jsx-dev-runtime.ts')
        }
    }
}
