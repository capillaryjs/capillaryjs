import {Emitter, FetchState} from '@capillaryjs/capillary'
import type {ReadableEmitter} from '@capillaryjs/capillary'
import type {CapillaryUiChild, LivePropContract} from '../component.js'
import {
    assertOptions,
    componentClass,
    controlId,
    createValueEmitter,
    invoke,
} from '../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../controlUtils.js'
import {ErrorMessage} from '../status/statusPresentation.js'
import {SelectControl} from './SelectControl.js'

export type DropdownValue = string | number

export interface DropdownOption<TValue extends DropdownValue = string> {
    value: TValue
    label?: CapillaryUiChild
    disabled?: boolean
}

const dropdownLiveProps = ['disabled', 'required', 'busy', 'error'] as const

export interface DropdownProps<TValue extends DropdownValue = string>
    extends ValueControlProps<TValue>, LivePropContract<(typeof dropdownLiveProps)[number]> {
    id?: string | number | null
    options?: readonly DropdownOption<TValue>[]
        | ReadableEmitter<readonly DropdownOption<TValue>[], unknown>
    label?: CapillaryUiChild
    name?: string
    disabled?: boolean
    required?: boolean
    busy?: boolean
    error?: unknown
    placeholder?: CapillaryUiChild
    ariaLabel?: string
    onChange?: (value: TValue, event: Event) => void
}

export class Dropdown<TValue extends DropdownValue = string>
    extends SelectControl<DropdownProps<TValue>> {
    static override liveProps = dropdownLiveProps
    static override dependencies = [ErrorMessage]
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

    render(): CapillaryUiChild {
        const {
            label,
            name,
            disabled = false,
            required = false,
            busy = false,
            error = null,
            placeholder = this.capillaryUiMessage('dropdownPlaceholder'),
            ariaLabel,
        } = this.props
        const options = this.optionsEmitter.get() ?? []
        assertOptions<DropdownOption<TValue>>(options)
        const currentValue = this.valueEmitter.get()
        const optionsState = this.optionsEmitter.getFetchState()
        const sourceBusy = !this.ownsOptionsEmitter
            && (optionsState === FetchState.Initial || optionsState === FetchState.Loading)
        const hasSourceError = !this.ownsOptionsEmitter && optionsState === FetchState.Error
        const sourceError = hasSourceError
            ? this.optionsEmitter.getError()
            : null
        const displayedError = error ?? (hasSourceError
            ? sourceError ?? this.capillaryUiMessage('dropdownLoadError')
            : null)
        const isBusy = busy || sourceBusy

        const Host = this.Host
        return <Host
            className={this.hostClass()}
        >
            {label == null ? null : <label htmlFor={this.inputId}>{label}</label>}
            <cap-selectshell>
                <select
                    id={this.inputId}
                    name={name}
                    value={currentValue == null ? '' : String(currentValue)}
                    disabled={disabled}
                    required={required}
                    aria-label={label == null ? ariaLabel : null}
                    aria-busy={isBusy ? 'true' : null}
                    aria-invalid={displayedError == null ? null : 'true'}
                    aria-describedby={displayedError == null ? null : this.errorId}
                    onChange={(event: Event) => this.selectOption(event)}
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
                        >{this.optionLabel(option)}</option>
                    })}
                </select>
            </cap-selectshell>
            {displayedError == null ? null
                : <ErrorMessage id={this.errorId} error={displayedError} />}
        </Host>
    }

    /** Host class list. Subclasses may prepend a stable marker class. */
    protected hostClass(): string {
        return componentClass(this.props)
    }

    /** Resolve the rendered label for one option. */
    protected optionLabel(option: DropdownOption<TValue>): CapillaryUiChild {
        return option.label ?? String(option.value)
    }

    /** Handle a native select change: resolve the option, update the value, emit. */
    protected selectOption(event: Event): void {
        const raw = eventValue(event, 'dropdown change')
        const options = this.optionsEmitter.get() ?? []
        const option = options.find(({value}) => String(value) === raw)
        // A declared option restores TValue; raw is the fallback for
        // JavaScript callers that mutate the select outside that list.
        const nextValue = option?.value ?? raw as TValue
        this.valueEmitter.set(nextValue, 'dropdown selection')
        this.emitChange(nextValue, option, event)
    }

    /** Emit the public change callback. Subclasses may forward extra detail. */
    protected emitChange(
        value: TValue,
        _option: DropdownOption<TValue> | undefined,
        event: Event,
    ): void {
        invoke(this.props.onChange, value, event)
    }

    static override hostName = 'dropdown'

    static override css = ''
}

function isReadableEmitter<TValue>(value: unknown): value is ReadableEmitter<TValue, unknown> {
    return value != null
        && (typeof value === 'object' || typeof value === 'function')
        && typeof Reflect.get(value, 'get') === 'function'
        && typeof Reflect.get(value, 'subscribe') === 'function'
        && typeof Reflect.get(value, 'getFetchState') === 'function'
        && typeof Reflect.get(value, 'getError') === 'function'
}

function eventValue(event: Event, purpose: string): string {
    const target = event.currentTarget
    if (target == null || typeof Reflect.get(target, 'value') !== 'string') {
        throw new TypeError(`${purpose} requires a value-bearing event target`)
    }
    return Reflect.get(target, 'value') as string
}
