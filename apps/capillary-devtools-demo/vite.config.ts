import {defineConfig} from 'vite'
import {fileURLToPath} from 'node:url'

export default defineConfig({
    build: {manifest: true, rollupOptions: {input: {
        workbench: fileURLToPath(new URL('./index.html', import.meta.url)),
        compact: fileURLToPath(new URL('./compact.html', import.meta.url)),
    }}},
})
