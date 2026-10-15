import type {CapillaryUiChild, LivePropContract} from '../component.js'
import {css} from '../component.js'
import {AsyncCommand, bindCommand} from '@capillaryjs/capillary'
import {Button} from '../menu/button.js'
import {
    classNames,
    invoke,
} from '../controlUtils.js'
import type {ValueControlProps} from '../controlUtils.js'
import {Dropdown} from '../lineinputs/dropdown.js'
import type {DropdownOption} from '../lineinputs/dropdown.js'
import {
    findCapillaryUiStylesheetOption,
    capillaryUiColorOptions,
    capillaryUiThemeOptions,
    replaceCapillaryUiStylesheet,
} from '../../styling/theme.js'
import type {
    CapillaryUiStylesheetKind,
    CapillaryUiStylesheetOption,
} from '../../styling/theme.js'

export interface StylesheetPickerProps extends ValueControlProps<string>,
    LivePropContract<'disabled' | 'readOnly' | 'busy' | 'error'> {
    id?: string | number | null
    label?: CapillaryUiChild
    ariaLabel?: string
    disabled?: boolean
    readOnly?: boolean
    busy?: boolean
    error?: unknown
    options?: readonly CapillaryUiStylesheetOption[]
    targetDocument?: Document
    onChange?: (value: string, option: CapillaryUiStylesheetOption, event: Event) => void
}

/**
 * A {@link Dropdown} that applies a Capillary UI stylesheet (theme or color set) when
 * the selection changes. Renders as a regular `cap-dropdown` host carrying a
 * `cap-<kind>-picker` class, so it inherits all standard dropdown styling and
 * behavior while adding stylesheet resolution and localized option labels.
 */
abstract class StylesheetPicker extends Dropdown<string> {
    static override dependencies = [...Dropdown.dependencies, Button]
    private readonly kind: CapillaryUiStylesheetKind
    private readonly stylesheetOptions: readonly CapillaryUiStylesheetOption[]
    private readonly customOptions: boolean
    private readonly targetDocument: Document | undefined
    private readonly changeHandler?: StylesheetPickerProps['onChange']
    private lastSelection: {selection: CapillaryUiStylesheetOption; targetDocument: Document} | null = null
    private readonly loading = new AsyncCommand<{
        selection: CapillaryUiStylesheetOption
        targetDocument: Document
        force?: boolean
    }, void>({
        owner: this,
        purpose: 'stylesheet loading',
        concurrency: 'replace',
        execute: ({selection, targetDocument, force}, {signal}) => loadStylesheet(
            this.kind, selection, targetDocument, signal as AbortSignal, force ?? false,
            () => this.loading.abort(), this.capillaryUiMessage('stylesheetLoadError'),
        ),
    })
    private readonly retryAction = bindCommand(this.loading, () => {
        if (!this.lastSelection) throw new Error('No stylesheet selection to retry')
        return {...this.lastSelection, force: true}
    })

    constructor(
        props: StylesheetPickerProps,
        kind: CapillaryUiStylesheetKind,
        defaults: readonly CapillaryUiStylesheetOption[],
    ) {
        const stylesheetOptions = props.options ?? defaults
        validateOptions(stylesheetOptions)
        const {options: _options, targetDocument, onChange, ...dropdownProps} = props
        super({
            ...dropdownProps,
            options: stylesheetOptions,
        })
        this.kind = kind
        this.stylesheetOptions = stylesheetOptions
        this.customOptions = props.options != null
        this.targetDocument = targetDocument
        this.changeHandler = onChange
        findCapillaryUiStylesheetOption(stylesheetOptions, this.valueEmitter.get())
    }

    protected override hostClass(): string {
        return classNames(`cap-${this.kind}-picker`, super.hostClass())
    }

    protected override get additionalBusy(): boolean { return this.read(this.loading.isRunning) }
    protected override get additionalError(): unknown { return this.snapshot(this.loading).error }
    protected override get additionalContent(): CapillaryUiChild {
        return this.snapshot(this.loading).error == null ? null : <Button
            icon="refresh" appearance="subtle" ariaLabel={this.capillaryUiMessage('stylesheetRetryLabel')}
            command={this.retryAction} />
    }

    override onDestroy(): void {
        this.loading.dispose()
        this.lastSelection = null
        super.onDestroy()
    }

    static override css = css`
        &.cap-theme-picker > cap-selectshell > cap-button,
        &.cap-colors-picker > cap-selectshell > cap-button {
            flex: 0 0 2em;
            inline-size: 2em;
            min-height: 0;
            padding-block: 0;
            align-self: stretch;
        }
        &.cap-theme-picker > cap-selectshell > cap-button > button,
        &.cap-colors-picker > cap-selectshell > cap-button > button { inline-size: 100%; }
        &.cap-theme-picker > cap-selectshell:has(> cap-button) > select,
        &.cap-colors-picker > cap-selectshell:has(> cap-button) > select { min-inline-size: 0; flex: 1 1 auto; }
        &.cap-theme-picker > cap-selectshell:has(> cap-button)::before,
        &.cap-colors-picker > cap-selectshell:has(> cap-button)::before { inset-inline-end: 2em; }
    `

    protected override optionLabel(option: DropdownOption<string>): CapillaryUiChild {
        if (this.customOptions) return super.optionLabel(option)
        switch (`${this.kind}:${option.value}`) {
            case 'theme:capillary': return this.capillaryUiMessage('themeOptionCapillaryLabel')
            case 'theme:minimal': return this.capillaryUiMessage('themeOptionMinimalLabel')
            case 'theme:shiny': return this.capillaryUiMessage('themeOptionShinyLabel')
            case 'colors:gray': return this.capillaryUiMessage('colorOptionGrayLabel')
            case 'colors:green': return this.capillaryUiMessage('colorOptionGreenLabel')
            case 'colors:iceblue': return this.capillaryUiMessage('colorOptionIceBlueLabel')
            case 'colors:ocean': return this.capillaryUiMessage('colorOptionOceanLabel')
            case 'colors:orange': return this.capillaryUiMessage('colorOptionOrangeLabel')
            case 'colors:purple': return this.capillaryUiMessage('colorOptionPurpleLabel')
            case 'colors:red': return this.capillaryUiMessage('colorOptionRedLabel')
            case 'colors:yellow': return this.capillaryUiMessage('colorOptionYellowLabel')
            default: return super.optionLabel(option)
        }
    }

    protected override emitChange(
        value: string,
        _option: DropdownOption<string> | undefined,
        event: Event,
    ): void {
        invoke(this.changeHandler, value,
            findCapillaryUiStylesheetOption(this.stylesheetOptions, value), event)
    }

    override afterMount(dom: ChildNode | null): void {
        super.afterMount(dom)
        this.applySelection()
    }

    override afterUpdate(dom: ChildNode | null): void {
        super.afterUpdate(dom)
        this.applySelection()
    }

    private applySelection(): void {
        const targetDocument = this.targetDocument
            ?? (typeof document === 'undefined' ? null : document)
        if (targetDocument == null) return
        const selection = findCapillaryUiStylesheetOption(this.stylesheetOptions, this.valueEmitter.get())
        if (this.lastSelection?.targetDocument === targetDocument
            && this.lastSelection.selection.href === selection.href) return
        this.lastSelection = {selection, targetDocument}
        // Preserve the synchronous selection/link contract; the command owns
        // only completion of the browser's asynchronous resource retrieval.
        replaceCapillaryUiStylesheet(this.kind, selection, targetDocument)
        void this.loading.run(this.lastSelection)
    }
}

const failedLinks = new WeakSet<HTMLLinkElement>()

function loadStylesheet(
    kind: CapillaryUiStylesheetKind, selection: CapillaryUiStylesheetOption,
    targetDocument: Document, signal: AbortSignal, force: boolean,
    superseded: () => void, errorMessage: string,
): Promise<void> {
    if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
    const selector = `link[data-cap-stylesheet="${kind}"]`
    const previous = targetDocument.head.querySelector<HTMLLinkElement>(selector)
    if (force) previous?.remove()
    const link = replaceCapillaryUiStylesheet(kind, selection, targetDocument)
    if (!force && previous === link && link.sheet != null && !failedLinks.has(link)) return Promise.resolve()
    if (failedLinks.has(link)) return Promise.reject(new Error(errorMessage))
    return new Promise<void>((resolve, reject) => {
        let settled = false
        const finish = (error?: unknown) => {
            if (settled) return
            settled = true
            link.removeEventListener('load', loaded)
            link.removeEventListener('error', failed)
            signal.removeEventListener('abort', aborted)
            observer?.disconnect()
            if (error == null) resolve()
            else reject(error)
        }
        const loaded = () => { failedLinks.delete(link); finish() }
        const failed = () => { failedLinks.add(link); finish(new Error(errorMessage)) }
        const aborted = () => finish(new DOMException('Aborted', 'AbortError'))
        const Observer = targetDocument.defaultView?.MutationObserver
        const observer = Observer ? new Observer(() => {
            if (!settled && !signal.aborted && (!link.isConnected || link.getAttribute('href') !== selection.href)) superseded()
        }) : null
        link.addEventListener('load', loaded)
        link.addEventListener('error', failed)
        signal.addEventListener('abort', aborted, {once: true})
        observer?.observe(targetDocument.head, {childList: true, subtree: true, attributes: true, attributeFilter: ['href']})
        if (signal.aborted) aborted()
    })
}

export class ThemePicker extends StylesheetPicker {
    constructor(props: StylesheetPickerProps = {}) {
        super(props, 'theme', capillaryUiThemeOptions)
    }
}

export class ColorPicker extends StylesheetPicker {
    constructor(props: StylesheetPickerProps = {}) {
        super(props, 'colors', capillaryUiColorOptions)
    }
}

function validateOptions(
    options: readonly CapillaryUiStylesheetOption[],
): asserts options is readonly CapillaryUiStylesheetOption[] {
    if (!Array.isArray(options) || options.length === 0) {
        throw new TypeError('Stylesheet picker options must be a non-empty array')
    }
    const values = new Set<string>()
    for (const option of options) {
        if (option == null || typeof option !== 'object') {
            throw new TypeError('Stylesheet picker options must be objects')
        }
        for (const field of ['value', 'label', 'href'] as const) {
            if (typeof option[field] !== 'string' || option[field].length === 0) {
                throw new TypeError(`Stylesheet picker option ${field} must be a string`)
            }
        }
        if (values.has(option.value)) {
            throw new Error(`Duplicate stylesheet picker value: ${option.value}`)
        }
        values.add(option.value)
    }
}
