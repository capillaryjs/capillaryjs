import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild} from '../component.js'
import {
    classNames,
    componentClass,
    controlId,
    createValueEmitter,
    invoke,
} from '../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../controlUtils.js'
import {
    findFrayStylesheetOption,
    frayColorOptions,
    frayThemeOptions,
    replaceFrayStylesheet,
} from '../../styling/theme.js'
import type {
    FrayStylesheetKind,
    FrayStylesheetOption,
} from '../../styling/theme.js'

export interface StylesheetPickerProps extends ValueControlProps<string> {
    id?: string | number | null
    label?: FrayChild
    ariaLabel?: string
    disabled?: boolean
    options?: readonly FrayStylesheetOption[]
    targetDocument?: Document
    onChange?: (value: string, option: FrayStylesheetOption, event: Event) => void
}

abstract class StylesheetPicker extends Component<StylesheetPickerProps> {
    readonly valueEmitter: ValueEmitter<string>
    readonly inputId: string
    private readonly kind: FrayStylesheetKind
    private readonly defaults: readonly FrayStylesheetOption[]

    constructor(
        props: StylesheetPickerProps,
        kind: FrayStylesheetKind,
        defaults: readonly FrayStylesheetOption[],
    ) {
        super(props)
        const options = props.options ?? defaults
        validateOptions(options)
        const fallback = options[0]?.value
        if (fallback == null) throw new TypeError(`${kind} picker requires at least one option`)
        this.kind = kind
        this.defaults = defaults
        this.inputId = controlId(`${kind}-picker`, props.id)
        this.valueEmitter = createValueEmitter(this, props, fallback, `${kind} selection`)
        findFrayStylesheetOption(options, this.valueEmitter.get())
    }

    initialize(): void {
        this.watch(this.valueEmitter)
    }

    render(): FrayChild {
        const options = this.options
        const selected = findFrayStylesheetOption(options, this.valueEmitter.get())
        const {label, ariaLabel, disabled = false, onChange} = this.props
        const Host = this.Host
        return <Host
            className={classNames('selectshell', componentClass(this.props))}
            data-kind={this.kind}
            data-disabled={disabled ? '' : null}
        >
            {label == null ? null : <label htmlFor={this.inputId}>{label}</label>}
            <select
                id={this.inputId}
                value={selected.value}
                disabled={disabled}
                aria-label={label == null ? ariaLabel : null}
                onChange={(event: Event) => {
                    const value = selectedValue(event)
                    const option = findFrayStylesheetOption(options, value)
                    this.valueEmitter.set(value, `${this.kind} selected`)
                    invoke(onChange, value, option, event)
                }}
            >
                {options.map((option) => <option
                    key={option.value}
                    value={option.value}
                    selected={option.value === selected.value}
                >{option.label}</option>)}
            </select>
        </Host>
    }

    afterMount(): void {
        this.applySelection()
    }

    afterUpdate(): void {
        this.applySelection()
    }

    protected get options(): readonly FrayStylesheetOption[] {
        const options = this.props.options ?? this.defaults
        validateOptions(options)
        return options
    }

    private applySelection(): void {
        const targetDocument = this.props.targetDocument
            ?? (typeof document === 'undefined' ? null : document)
        if (targetDocument == null) return
        replaceFrayStylesheet(
            this.kind,
            findFrayStylesheetOption(this.options, this.valueEmitter.get()),
            targetDocument,
        )
    }

    static baseStyles = [
        ['&', ['labeledinput', 'inputline']],
        ['& > select', ['input', 'inputline']],
    ]

    static css = css`
        & {
            position: relative;
        }

        & > select {
            min-width: 8rem;
        }
    `
}

export class ThemePicker extends StylesheetPicker {
    constructor(props: StylesheetPickerProps = {}) {
        super(props, 'theme', frayThemeOptions)
    }

    static override hostName = 'theme-picker'
    static override standaloneHostName = 'theme-picker'
}

export class ColorPicker extends StylesheetPicker {
    constructor(props: StylesheetPickerProps = {}) {
        super(props, 'colors', frayColorOptions)
    }

    static override hostName = 'color-picker'
    static override standaloneHostName = 'color-picker'
}

function validateOptions(
    options: readonly FrayStylesheetOption[],
): asserts options is readonly FrayStylesheetOption[] {
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

function selectedValue(event: Event): string {
    const value = event.currentTarget == null
        ? null
        : Reflect.get(event.currentTarget, 'value')
    if (typeof value !== 'string') {
        throw new TypeError('Stylesheet picker change requires a select element')
    }
    return value
}
