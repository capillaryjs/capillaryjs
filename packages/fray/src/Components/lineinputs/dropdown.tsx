import {Emitter} from '@sylwellsoftware/glue'
import type {ReadableEmitter} from '@sylwellsoftware/glue'
import {Component, css} from '../component.js'
import type {FrayChild, LivePropContract} from '../component.js'
import {
    assertOptions,
    classNames,
    componentClass,
    controlId,
    createValueEmitter,
    invoke,
} from '../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../controlUtils.js'

export type DropdownValue = string | number

export interface DropdownOption<TValue extends DropdownValue = string> {
    value: TValue
    label?: FrayChild
    disabled?: boolean
}

const dropdownLiveProps = ['disabled', 'required', 'error'] as const

export interface DropdownProps<TValue extends DropdownValue = string>
    extends ValueControlProps<TValue>, LivePropContract<(typeof dropdownLiveProps)[number]> {
    id?: string | number | null
    options?: readonly DropdownOption<TValue>[]
        | ReadableEmitter<readonly DropdownOption<TValue>[], unknown>
    label?: FrayChild
    name?: string
    disabled?: boolean
    required?: boolean
    error?: unknown
    placeholder?: FrayChild
    ariaLabel?: string
    onChange?: (value: TValue, event: Event) => void
}

export class Dropdown<TValue extends DropdownValue = string>
    extends Component<DropdownProps<TValue>> {
    static override liveProps = dropdownLiveProps
    readonly inputId: string
    readonly errorId: string
    readonly optionsEmitter: ReadableEmitter<readonly DropdownOption<TValue>[], unknown>
    readonly valueEmitter: ValueEmitter<TValue>
    private readonly ownsOptionsEmitter: boolean

    constructor(props: DropdownProps<TValue> = {}) {
        super(props)
        this.inputId = controlId('dropdown', props.id)
        this.errorId = `${this.inputId}-error`
        const suppliedOptions = props.options ?? []
        if (isReadableEmitter<readonly DropdownOption<TValue>[]>(suppliedOptions)) {
            this.optionsEmitter = suppliedOptions
            this.ownsOptionsEmitter = false
        } else {
            assertOptions<DropdownOption<TValue>>(suppliedOptions)
            this.optionsEmitter = new Emitter<readonly DropdownOption<TValue>[]>(suppliedOptions, {
                owner: this,
                purpose: 'dropdown options',
            })
            this.ownsOptionsEmitter = true
        }
        // The empty string is the DOM select's no-option sentinel. It is only
        // observed when no controlled/default value and no option are present.
        const firstValue = this.optionsEmitter.get()[0]?.value ?? '' as TValue
        this.valueEmitter = createValueEmitter<TValue>(this, props, firstValue, 'dropdown value')
    }

    initialize(): void {
        this.watch(this.valueEmitter, this.optionsEmitter)
    }

    render(): FrayChild {
        const {
            label,
            name,
            disabled = false,
            required = false,
            error = null,
            placeholder = 'Select…',
            ariaLabel,
            onChange,
        } = this.props
        const options = this.optionsEmitter.get() ?? []
        assertOptions<DropdownOption<TValue>>(options)
        const currentValue = this.valueEmitter.get()

        const Host = this.Host
        return <Host
            className={classNames('selectshell', componentClass(this.props))}
            data-disabled={disabled ? '' : null}
            data-required={required ? '' : null}
            data-error={error == null ? null : ''}
        >
            {label == null ? null : <label htmlFor={this.inputId}>{label}</label>}
            <select
                id={this.inputId}
                name={name}
                value={currentValue == null ? '' : String(currentValue)}
                disabled={disabled}
                required={required}
                aria-label={label == null ? ariaLabel : null}
                aria-invalid={error == null ? null : 'true'}
                aria-describedby={error == null ? null : this.errorId}
                onChange={(event: Event) => {
                    const raw = eventValue(event, 'dropdown change')
                    const option = options.find(({value}) => String(value) === raw)
                    // A declared option restores TValue; raw is the fallback for
                    // JavaScript callers that mutate the select outside that list.
                    const nextValue = option?.value ?? raw as TValue
                    this.valueEmitter.set(nextValue, 'dropdown selection')
                    invoke(onChange, nextValue, event)
                }}
            >
                {currentValue == null || currentValue === ''
                    ? <option value="" disabled={required} selected={true}>{placeholder}</option>
                    : null}
                {options.map((option) => {
                    if (option == null || !Object.hasOwn(option, 'value')) {
                        throw new TypeError('Dropdown options require value and label fields')
                    }
                    return <option
                        key={String(option.value)}
                        value={String(option.value)}
                        disabled={Boolean(option.disabled)}
                        selected={Object.is(currentValue, option.value)}
                    >{option.label ?? String(option.value)}</option>
                })}
            </select>
            {error == null ? null : <p
                id={this.errorId}
                role="alert"
            >{String(error)}</p>}
        </Host>
    }

    static override hostName = 'dropdown'
    static override standaloneHostName = 'drop-down'

    static baseStyles = [
        ['&', ['labeledinput', 'inputline']],
        ['& > select', ['input', 'inputline']],
    ]

    static css = css`
        & {
            position: relative;
        }
    `
}

function isReadableEmitter<TValue>(value: unknown): value is ReadableEmitter<TValue, unknown> {
    return value != null
        && (typeof value === 'object' || typeof value === 'function')
        && typeof Reflect.get(value, 'get') === 'function'
        && typeof Reflect.get(value, 'subscribe') === 'function'
}

function eventValue(event: Event, purpose: string): string {
    const target = event.currentTarget
    if (target == null || typeof Reflect.get(target, 'value') !== 'string') {
        throw new TypeError(`${purpose} requires a value-bearing event target`)
    }
    return Reflect.get(target, 'value') as string
}
