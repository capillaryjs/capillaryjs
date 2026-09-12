import {
    createBrowserRouter,
    createFrayRuntime,
    createHashNavigation,
} from '@sylwellsoftware/fray'
import baseStylesheet from '../../../packages/fray/themes/base.css?url&no-inline'
import colorsStylesheet from '../../../packages/fray/colors/iceblue/colors.css?url&no-inline'
import themeStylesheet from '../../../packages/fray/themes/shiny/theme.css?url&no-inline'
import {GalleryApp} from './app/GalleryApp.js'
import './gallery.css'

const root = document.querySelector('#app')
if (!(root instanceof HTMLElement)) {
    throw new Error('Component gallery requires #app')
}

void start(root)

async function start(target: HTMLElement): Promise<void> {
    await loadStylesheet('base', baseStylesheet)
    const router = createBrowserRouter({adapter: createHashNavigation(window)})
    const runtime = createFrayRuntime({router})
    runtime.registerStyles(GalleryApp).injectStyles(document)
    await loadStylesheet('colors', colorsStylesheet)
    await loadStylesheet('theme', themeStylesheet)
    const app = runtime.mount(runtime.create(GalleryApp), target)
    addEventListener('pagehide', () => {
        app.destroy()
        router.dispose()
    }, {once: true})
}

function loadStylesheet(kind: 'base' | 'colors' | 'theme', href: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = href
        link.dataset.frayStylesheet = kind
        link.addEventListener('load', () => resolve(), {once: true})
        link.addEventListener('error', () => reject(new Error(
            `Component gallery could not load ${kind} stylesheet: ${href}`,
        )), {once: true})
        document.head.append(link)
    })
}
