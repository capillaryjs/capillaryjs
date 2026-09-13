import {fileURLToPath} from 'node:url'

const sourcePath = (path) => fileURLToPath(new URL(path, import.meta.url))

export default {
    build: {
        lib: {
            entry: {index: sourcePath('./src/index.ts')},
            formats: ['es'],
            fileName: (_format, name) => `${name}.js`
        },
        sourcemap: true
    }
}
