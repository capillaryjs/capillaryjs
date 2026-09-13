import {
    createBrowserRouter,
    createCapillaryUiRuntime,
    createHashNavigation,
} from '@capillaryjs/capillary-ui'
import baseStylesheet from '../../../packages/capillary-ui/themes/base.css?url&no-inline'
import colorsStylesheet from '../../../packages/capillary-ui/colors/iceblue/colors.css?url&no-inline'
import themeStylesheet from '../../../packages/capillary-ui/themes/shiny/theme.css?url&no-inline'
import {MeridianApp} from './app/MeridianApp.js'
import './style-lab.css'

const root = document.querySelector('#app')
if (!(root instanceof HTMLElement)) throw new Error('Capillary UI style lab requires #app')

void start(root)

async function start(target: HTMLElement): Promise<void> {
    await loadStylesheet('base', baseStylesheet)
    const router = createBrowserRouter({adapter: createHashNavigation(window)})
    const runtime = createCapillaryUiRuntime({router})
    runtime.registerStyles(MeridianApp).injectStyles(document)
    await loadStylesheet('colors', colorsStylesheet)
    await loadStylesheet('theme', themeStylesheet)
    const app = runtime.mount(runtime.create(MeridianApp), target)
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
        link.dataset.capStylesheet = kind
        link.addEventListener('load', () => resolve(), {once: true})
        link.addEventListener('error', () => reject(new Error(
            `Capillary UI style lab could not load ${kind} stylesheet: ${href}`,
        )), {once: true})
        document.head.append(link)
    })
}
