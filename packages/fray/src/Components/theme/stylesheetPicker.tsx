import type {FrayChild, LivePropContract} from '../component.js'
import {
    classNames,
    invoke,
} from '../controlUtils.js'
import type {ValueControlProps} from '../controlUtils.js'
import {Dropdown} from '../lineinputs/dropdown.js'
import type {DropdownOption} from '../lineinputs/dropdown.js'
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

export interface StylesheetPickerProps extends ValueControlProps<string>,
    LivePropContract<'disabled'> {
    id?: string | number | null
    label?: FrayChild
    ariaLabel?: string
    disabled?: boolean
    options?: readonly FrayStylesheetOption[]
    targetDocument?: Document
    onChange?: (value: string, option: FrayStylesheetOption, event: Event) => void
}

/**
 * A {@link Dropdown} that applies a Fray stylesheet (theme or color set) when
 * the selection changes. Renders as a regular `fray-dropdown` host carrying a
 * `fray-<kind>-picker` class, so it inherits all standard dropdown styling and
 * behavior while adding stylesheet resolution and localized option labels.
 */
abstract class StylesheetPicker extends Dropdown<string> {
    private readonly kind: FrayStylesheetKind
    private readonly stylesheetOptions: readonly FrayStylesheetOption[]
    private readonly customOptions: boolean
    private readonly targetDocument: Document | undefined
    private readonly changeHandler?: StylesheetPickerProps['onChange']

    constructor(
        props: StylesheetPickerProps,
        kind: FrayStylesheetKind,
        defaults: readonly FrayStylesheetOption[],
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
        findFrayStylesheetOption(stylesheetOptions, this.valueEmitter.get())
    }

    protected override hostClass(): string {
        return classNames(`fray-${this.kind}-picker`, super.hostClass())
    }

    protected override optionLabel(option: DropdownOption<string>): FrayChild {
        if (this.customOptions) return super.optionLabel(option)
        switch (`${this.kind}:${option.value}`) {
            case 'theme:java': return this.frayMessage('themeOptionJavaLabel')
            case 'theme:minimal': return this.frayMessage('themeOptionMinimalLabel')
            case 'theme:shiny': return this.frayMessage('themeOptionShinyLabel')
            case 'colors:gray': return this.frayMessage('colorOptionGrayLabel')
            case 'colors:green': return this.frayMessage('colorOptionGreenLabel')
            case 'colors:iceblue': return this.frayMessage('colorOptionIceBlueLabel')
            case 'colors:ocean': return this.frayMessage('colorOptionOceanLabel')
            case 'colors:orange': return this.frayMessage('colorOptionOrangeLabel')
            case 'colors:purple': return this.frayMessage('colorOptionPurpleLabel')
            case 'colors:red': return this.frayMessage('colorOptionRedLabel')
            case 'colors:yellow': return this.frayMessage('colorOptionYellowLabel')
            default: return super.optionLabel(option)
        }
    }

    protected override emitChange(
        value: string,
        _option: DropdownOption<string> | undefined,
        event: Event,
    ): void {
        invoke(this.changeHandler, value,
            findFrayStylesheetOption(this.stylesheetOptions, value), event)
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
        replaceFrayStylesheet(
            this.kind,
            findFrayStylesheetOption(this.stylesheetOptions, this.valueEmitter.get()),
            targetDocument,
        )
    }
}

export class ThemePicker extends StylesheetPicker {
    constructor(props: StylesheetPickerProps = {}) {
        super(props, 'theme', frayThemeOptions)
    }
}

export class ColorPicker extends StylesheetPicker {
    constructor(props: StylesheetPickerProps = {}) {
        super(props, 'colors', frayColorOptions)
    }
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
