import type {CapillaryUiChild, LivePropContract} from '../component.js'
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
    LivePropContract<'disabled'> {
    id?: string | number | null
    label?: CapillaryUiChild
    ariaLabel?: string
    disabled?: boolean
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
    private readonly kind: CapillaryUiStylesheetKind
    private readonly stylesheetOptions: readonly CapillaryUiStylesheetOption[]
    private readonly customOptions: boolean
    private readonly targetDocument: Document | undefined
    private readonly changeHandler?: StylesheetPickerProps['onChange']

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

    protected override optionLabel(option: DropdownOption<string>): CapillaryUiChild {
        if (this.customOptions) return super.optionLabel(option)
        switch (`${this.kind}:${option.value}`) {
            case 'theme:java': return this.capillaryUiMessage('themeOptionJavaLabel')
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
        replaceCapillaryUiStylesheet(
            this.kind,
            findCapillaryUiStylesheetOption(this.stylesheetOptions, this.valueEmitter.get()),
            targetDocument,
        )
    }
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
