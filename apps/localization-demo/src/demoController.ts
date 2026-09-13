import {createFrayRuntime} from '@sylwellsoftware/fray'
import type {Component} from '@sylwellsoftware/fray'

import {LocalizationDemoApp} from './app/LocalizationDemoApp.js'
import type {DemoLocale} from './locales.js'
import {getDemoLocale} from './locales.js'

export interface LocalizationDemoController {
    readonly locale: DemoLocale
    setLocale(locale: DemoLocale): void
    destroy(): void
}

/**
 * Owns language policy outside Fray. Changing language remounts the demo with
 * a newly initialized runtime because one runtime's localization is immutable.
 */
export function mountLocalizationDemo(
    target: HTMLElement,
    initialLocale: DemoLocale = 'en-GB',
): LocalizationDemoController {
    const targetDocument = target.ownerDocument
    const previousLanguage = targetDocument.documentElement.lang
    const previousTitle = targetDocument.title
    let activeLocale = initialLocale
    let app: Component | null = null
    let structuralStyle: HTMLStyleElement | null = null
    let pendingLocale: DemoLocale | null = null
    let switchQueued = false
    let destroyed = false

    const mount = (locale: DemoLocale): void => {
        if (destroyed) return
        const definition = getDemoLocale(locale)
        app?.destroy()
        structuralStyle?.remove()
        target.replaceChildren()

        const runtime = createFrayRuntime({
            localization: {
                locale: definition.locale,
                messages: definition.frayMessages,
            },
        })
        structuralStyle = runtime.registerStyles(LocalizationDemoApp)
            .injectStyles(targetDocument)
        activeLocale = locale
        target.dataset.locale = locale
        targetDocument.documentElement.lang = locale
        targetDocument.title = definition.copy.documentTitle
        app = runtime.mount(runtime.create(LocalizationDemoApp, {
            definition,
            onLocaleChange: requestLocale,
        }), target)
    }

    const requestLocale = (locale: DemoLocale): void => {
        pendingLocale = locale
        if (switchQueued || destroyed) return
        switchQueued = true
        queueMicrotask(() => {
            switchQueued = false
            const nextLocale = pendingLocale
            pendingLocale = null
            if (nextLocale != null && nextLocale !== activeLocale) mount(nextLocale)
        })
    }

    const controller: LocalizationDemoController = {
        get locale() {
            return activeLocale
        },
        setLocale: requestLocale,
        destroy() {
            if (destroyed) return
            destroyed = true
            pendingLocale = null
            app?.destroy()
            app = null
            structuralStyle?.remove()
            structuralStyle = null
            target.replaceChildren()
            delete target.dataset.locale
            targetDocument.documentElement.lang = previousLanguage
            targetDocument.title = previousTitle
        },
    }

    mount(initialLocale)
    return controller
}
