import baseStylesheet from '../../../packages/capillary-ui/themes/base.css?url&no-inline'
import colorsStylesheet from '../../../packages/capillary-ui/colors/iceblue/colors.css?url&no-inline'
import themeStylesheet from '../../../packages/capillary-ui/themes/shiny/theme.css?url&no-inline'

import {mountLocalizationDemo} from './demoController.js'
import {chooseDemoLocale} from './locales.js'
import './localization-demo.css'

const root = document.querySelector('#app')
if (!(root instanceof HTMLElement)) {
    throw new Error('Capillary UI localization demo requires #app')
}

void start(root)

async function start(target: HTMLElement): Promise<void> {
    await loadStylesheet('base', baseStylesheet)
    await loadStylesheet('colors', colorsStylesheet)
    await loadStylesheet('theme', themeStylesheet)

    const demo = mountLocalizationDemo(target, chooseDemoLocale(navigator.language))
    addEventListener('pagehide', () => demo.destroy(), {once: true})
}

function loadStylesheet(kind: 'base' | 'colors' | 'theme', href: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = href
        link.dataset.capStylesheet = kind
        link.addEventListener('load', () => resolve(), {once: true})
        link.addEventListener('error', () => reject(new Error(
            `Capillary UI localization demo could not load ${kind} stylesheet: ${href}`,
        )), {once: true})
        document.head.append(link)
    })
}
