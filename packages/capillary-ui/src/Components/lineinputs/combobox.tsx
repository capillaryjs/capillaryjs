import {Emitter, FetchState} from '@capillaryjs/capillary'
import type {ReadableEmitter} from '@capillaryjs/capillary'
import {css} from '../component.js'
import type {CapillaryUiChild, LivePropContract, Ref} from '../component.js'
import {assertEmitter, componentClass, controlId, createValueEmitter, invoke} from '../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../controlUtils.js'
import {LabeledInputControl} from './LabeledInputControl.js'
import {inputDescription} from './inputDescription.js'
import type {InputDescriptionProps} from './inputDescription.js'
import {Popover} from '../dialog/popover.js'
import type {PopoverProps} from '../dialog/popover.js'
import {Button} from '../menu/button.js'
import {ErrorMessage} from '../status/statusPresentation.js'
import {CommandInvocationPresentation, commandSource, validateCommandInteractionOptions} from '../commandSupport.js'
import type {CommandAction, CommandInteractionOptions} from '../commandSupport.js'

export type ComboBoxValue = string | number
export interface ComboBoxOption<TValue extends ComboBoxValue = string> {
    value: TValue
    label?: string
    disabled?: boolean
}
const comboBoxLiveProps = ['disabled', 'readOnly', 'required', 'busy', 'error'] as const
interface ComboBoxCommonProps<TValue extends ComboBoxValue> extends ValueControlProps<TValue | null>,
    InputDescriptionProps, LivePropContract<(typeof comboBoxLiveProps)[number]>, CommandInteractionOptions {
    id?: string
    label?: CapillaryUiChild
    ariaLabel?: string
    optionsLabel?: string
    name?: string
    options: readonly ComboBoxOption<TValue>[] | ReadableEmitter<readonly ComboBoxOption<TValue>[] | undefined, unknown>
    searchEmitter?: ValueEmitter<string>
    /** Local filtering is synchronous. `none` trusts app-supplied query results. */
    filter?: 'local' | 'none'
    placeholder?: string
    disabled?: boolean
    readOnly?: boolean
    required?: boolean
    busy?: boolean
    error?: unknown
    disableWhileRunning?: boolean
    inputRef?: Ref<HTMLInputElement>
}
export type ComboBoxProps<TValue extends ComboBoxValue = string> = ComboBoxCommonProps<TValue>
& ({allowCustomValue?: false} | (string extends TValue ? [TValue] extends [string] ? {allowCustomValue: true} : never : never))
& (
    | {changeCommand: CommandAction<TValue | null>; onChange?: never}
    | {changeCommand?: never; onChange?: (value: TValue | null, event: Event) => void}
)

interface ChoiceSurfaceProps extends PopoverProps {boundary: HTMLElement | null; busy: boolean}
class ChoiceSurface extends Popover<ChoiceSurfaceProps> {
    static override hostName = 'comboboxoptions'
    protected override get surfaceRole(): 'listbox' { return 'listbox' }
    protected override get restoreFocusOnClose(): boolean { return false }
    protected override get surfaceBusy(): boolean { return this.props.busy }
    protected override focusOnOpen(): void { /* The editable combobox retains DOM focus. */ }
    protected override containsTrigger(target: Node | null): boolean { return this.props.boundary?.contains(target) ?? false }
    protected override position(): void {
        if (this.panel && this.props.anchor) {
            const width = this.panel.ownerDocument.defaultView?.innerWidth ?? 0
            this.panel.style.minInlineSize = `${Math.max(0, Math.min(this.props.anchor.getBoundingClientRect().width, width - 16))}px`
        }
        super.position()
    }
    static override css = css`
        & > [popover] { min-inline-size: min(16rem, calc(100vw - 1rem)); min-block-size: 2rem; padding: .25rem; }
        & [role="option"] { padding: .35em .6em; border-radius: var(--ui-border-radius); cursor: default; }
        & [role="option"][data-active] { background: var(--selection-background, Highlight); color: var(--selection-color, HighlightText); }
        & [role="option"][aria-disabled="true"] { color: var(--input-color-disabled); }
        & .cap-combo-empty { color: var(--ui-muted-text-color, inherit); }
        & [data-cap-busy-visible] { background-image: var(--working-background-image); background-size: 2rem 2rem; animation: cap-working-progress .55s linear infinite; }
        @media (prefers-reduced-motion: reduce) { & [data-cap-busy-visible] { animation: none; } }
    `
}

/** Search text is a presentation buffer; only committed choices change value. */
export class ComboBox<TValue extends ComboBoxValue = string> extends LabeledInputControl<ComboBoxProps<TValue>> {
    static override hostName = 'combobox'
    static override liveProps = comboBoxLiveProps
    static override dependencies = [Button, ChoiceSurface, ErrorMessage]
    readonly valueEmitter: ValueEmitter<TValue | null>
    readonly searchEmitter: ValueEmitter<string>
    readonly openEmitter = new Emitter(false, {owner: this, purpose: 'combobox popup'})
    readonly inputId: string
    readonly errorId: string
    readonly optionsId: string
    private input: HTMLInputElement | null = null
    private editing = false
    private activeValue: TValue | null = null
    private previousValue: TValue | null
    private previousLabel = ''
    private origin: 'input' | 'toggle' = 'input'
    private readonly ownsSearch: boolean
    private readonly commandPresentation = new CommandInvocationPresentation(() => this.update())

    constructor(props: ComboBoxProps<TValue>) {
        super(props)
        if (props.changeCommand != null && props.onChange != null) throw new TypeError('ComboBox changeCommand and onChange are mutually exclusive')
        validateCommandInteractionOptions(props)
        if (props.searchEmitter != null) assertEmitter<string>(props.searchEmitter, 'searchEmitter')
        this.valueEmitter = createValueEmitter(this, props, null, 'combobox selection')
        this.searchEmitter = props.searchEmitter ?? new Emitter('', {owner: this, purpose: 'combobox search'})
        this.ownsSearch = props.searchEmitter == null
        this.previousValue = this.valueEmitter.get()
        this.inputId = controlId('combobox', props.id); this.errorId = `${this.inputId}-error`; this.optionsId = `${this.inputId}-options`
    }
    initialize(): void { this.watch(this.valueEmitter, this.searchEmitter, this.openEmitter) }

    private choices(): {items: readonly ComboBoxOption<TValue>[]; busy: boolean; error: unknown} {
        const options = this.props.options
        if (Array.isArray(options)) return {items: options as readonly ComboBoxOption<TValue>[], busy: false, error: null}
        const source = options as ReadableEmitter<readonly ComboBoxOption<TValue>[] | undefined, unknown>
        if (source == null || typeof source.get !== 'function' || typeof source.subscribe !== 'function'
            || typeof source.getFetchState !== 'function' || typeof source.getError !== 'function') throw new TypeError('ComboBox options must be an array or readable emitter')
        const snapshot = this.snapshot(source)
        return {items: snapshot.value ?? [], busy: snapshot.fetchState === FetchState.Initial || snapshot.fetchState === FetchState.Loading,
            error: snapshot.error ?? (snapshot.fetchState === FetchState.Error ? this.capillaryUiMessage('dropdownLoadError') : null)}
    }
    private validate(items: readonly ComboBoxOption<TValue>[]): void {
        const seen = new Set<TValue>()
        for (const option of items) {
            if (!option || typeof option.value !== 'string' && typeof option.value !== 'number'
                || typeof option.value === 'number' && !Number.isFinite(option.value)) throw new TypeError('ComboBox option values must be strings or finite numbers')
            if (this.props.allowCustomValue && typeof option.value !== 'string') throw new TypeError('Custom ComboBox values require string options')
            if (seen.has(option.value)) throw new TypeError('ComboBox option values must be unique')
            if (option.label != null && typeof option.label !== 'string') throw new TypeError('ComboBox option labels must be strings')
            if (!this.label(option).trim()) throw new TypeError('ComboBox options require nonempty labels')
            seen.add(option.value)
        }
        if (this.props.filter != null && this.props.filter !== 'local' && this.props.filter !== 'none') throw new TypeError('Unknown ComboBox filter mode')
    }
    private label(option: ComboBoxOption<TValue>): string { return option.label ?? String(option.value) }
    private filtered(items: readonly ComboBoxOption<TValue>[]): readonly ComboBoxOption<TValue>[] {
        const locale = this._runtime.localization.locale
        const query = this.editing ? this.searchEmitter.get().toLocaleLowerCase(locale) : ''
        return this.props.filter === 'none' || !query ? items : items.filter(option => this.label(option).toLocaleLowerCase(locale).includes(query))
    }
    private optionId(value: TValue): string { return `${this.inputId}-option-${typeof value}-${encodeURIComponent(String(value))}` }
    private get unavailable(): boolean {
        return this.props.disabled === true || this.props.readOnly === true
            || this.props.disableWhileRunning !== false && commandSource(this.props.changeCommand)?.isRunning.get() === true
    }

    render(): CapillaryUiChild {
        const source = this.choices(); this.validate(source.items)
        const value = this.valueEmitter.get(), option = source.items.find(item => item.value === value)
        if (value !== this.previousValue) { this.editing = false; this.previousValue = value; this.previousLabel = '' }
        if (option) this.previousLabel = this.label(option)
        const display = this.editing ? this.searchEmitter.get() : this.previousLabel || (value == null ? '' : String(value))
        const visible = this.filtered(source.items), active = visible.find(item => item.value === this.activeValue && !item.disabled)
        if (!active) this.activeValue = null
        const open = this.openEmitter.get(), command = commandSource(this.props.changeCommand)
        this.commandPresentation.reconcile(this.props.changeCommand)
        const running = command == null ? false : this.read(command.isRunning)
        const error = this.props.error ?? this.commandPresentation.error(this.props.commandErrors ?? 'inline')
            ?? (command == null || this.props.commandErrors === 'external' ? null : this.snapshot(command).error) ?? source.error
        const optionsBusy = this.props.busy === true || source.busy
        const toggleBusy = optionsBusy && open && this.origin === 'toggle'
        const inputBusy = running || optionsBusy && !toggleBusy
        const visibleInputBusy = this.presentBusy(inputBusy && error == null, 'input', running ? command : this.searchEmitter.get())
        const visibleOptionsBusy = this.presentBusy(optionsBusy && error == null, 'options', this.searchEmitter.get())
        const Host = this.Host, inputRef = this.props.inputRef
        return <Host className={componentClass(this.props) || null}>
            {this.props.label == null ? null : <label htmlFor={this.inputId}>{this.props.label}</label>}
            <div className="cap-combo-shell">
                <input id={this.inputId} role="combobox" type="text" autoComplete="off" value={display}
                    disabled={this.props.disabled ?? false} readOnly={this.props.readOnly === true || running && this.props.disableWhileRunning !== false}
                    aria-label={this.props.label == null ? this.props.ariaLabel : null} placeholder={this.props.placeholder}
                    aria-required={this.props.required ? 'true' : null} aria-expanded={String(open)} aria-controls={this.optionsId}
                    aria-autocomplete="list" aria-activedescendant={open && this.activeValue != null ? this.optionId(this.activeValue) : null}
                    aria-busy={inputBusy ? 'true' : null} data-cap-busy-visible={visibleInputBusy ? '' : null}
                    {...inputDescription(this.props, error, this.errorId)}
                    ref={(input: HTMLInputElement | null) => {
                        this.input = input
                        const ref = inputRef
                        if (typeof ref === 'function') ref(input)
                        else if (ref) ref.current = input
                    }}
                    onInput={(event: Event) => {
                        if (this.unavailable) { (event.currentTarget as HTMLInputElement).value = display; return }
                        this.origin = 'input'; this.editing = true; this.activeValue = null
                        this.searchEmitter.set((event.currentTarget as HTMLInputElement).value, 'combobox search')
                        this.openEmitter.set(true, 'combobox search opened'); this.update()
                    }}
                    onKeyDown={(event: KeyboardEvent) => this.keyDown(event)}
                    onBlur={(event: FocusEvent) => queueMicrotask(() => {
                        const host = this.dom as HTMLElement | null
                        if (host?.isConnected && !host.contains(host.ownerDocument.activeElement)) this.finishEditing(event)
                    })}/>
                <Button icon="next" ariaLabel={this.capillaryUiMessage('comboBoxOpenLabel')} appearance="subtle" tabIndex={-1}
                    disabled={this.unavailable} busy={toggleBusy} disableWhileRunning={false}
                    ariaHasPopup="listbox" ariaExpanded={open} ariaControls={this.optionsId}
                    onClick={() => {
                        if (open) this.cancelSearch()
                        else { this.origin = 'toggle'; this.show() }
                        this.input?.focus({preventScroll: true})
                    }}/>
            </div>
            {this.props.name ? <input type="hidden" name={this.props.name} disabled={this.props.disabled ?? false} value={value == null ? '' : String(value)}/> : null}
            <ChoiceSurface id={this.optionsId} label={this.props.optionsLabel ?? (typeof this.props.label === 'string' ? this.props.label : this.props.ariaLabel) ?? this.capillaryUiMessage('comboBoxOptionsLabel')}
                anchor={this.input} boundary={this.dom as HTMLElement | null} busy={optionsBusy} valueEmitter={this.openEmitter}
                onClose={() => { if (this.editing) { this.editing = false; this.update() } }}>
                {visible.map(item => <div key={`${typeof item.value}:${item.value}`} id={this.optionId(item.value)} role="option"
                    aria-selected={String(item.value === value)} aria-disabled={item.disabled ? 'true' : null}
                    data-active={item.value === this.activeValue ? '' : null}
                    onPointerDown={(event: PointerEvent) => event.preventDefault()}
                    onMouseMove={() => { if (!item.disabled && this.activeValue !== item.value) { this.activeValue = item.value; this.update() } }}
                    onClick={(event: MouseEvent) => { if (!this.unavailable && !item.disabled) this.accept(item.value, event) }}>{this.label(item)}</div>)}
                {!visible.length && (!optionsBusy || visibleOptionsBusy) ? <div role="option" aria-disabled="true" className="cap-combo-empty"
                    data-cap-busy-visible={visibleOptionsBusy ? '' : null}>{optionsBusy ? this.capillaryUiMessage('comboBoxLoading') : this.capillaryUiMessage('comboBoxEmpty')}</div> : null}
            </ChoiceSurface>
            {error == null ? null : <ErrorMessage id={this.errorId} error={error}/>}
        </Host>
    }
    private show(last = false): void {
        if (this.unavailable) return
        if (!this.editing) this.searchEmitter.set('', 'combobox search reset')
        const items = this.filtered(this.choices().items).filter(option => !option.disabled)
        this.activeValue = (last ? items.at(-1) : items.find(item => item.value === this.valueEmitter.get()) ?? items[0])?.value ?? null
        this.openEmitter.set(true, 'combobox opened'); this.update()
    }
    private cancelSearch(): void {
        this.editing = false; this.activeValue = null; this.openEmitter.set(false, 'combobox search cancelled'); this.update()
    }
    private finishEditing(event: Event): void {
        if (this.editing && !this.unavailable && (this.props.allowCustomValue || this.searchEmitter.get() === '')) {
            this.accept(this.searchEmitter.get() === '' ? null : this.searchEmitter.get() as TValue, event)
        } else this.cancelSearch()
    }
    private accept(value: TValue | null, event: Event): void {
        const {changeCommand: action, onChange, commandErrors = 'inline', onCommandInvocationError} = this.props
        const changed = this.valueEmitter.get() !== value
        this.editing = false; this.activeValue = null; this.openEmitter.set(false, 'combobox choice accepted')
        this.valueEmitter.set(value, 'combobox selection'); this.update()
        if (changed && this.valueEmitter.get() === value) {
            invoke(onChange, value, event)
            if (action != null) this.commandPresentation.invoke(action, value, event, {
                commandErrors,
                ...(onCommandInvocationError ? {onCommandInvocationError} : {}),
            })
        }
    }
    private keyDown(event: KeyboardEvent): void {
        if (this.unavailable || event.isComposing) return
        if (event.key === 'Escape' && this.openEmitter.get()) { event.preventDefault(); this.cancelSearch(); return }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); this.origin = 'input'
            if (!this.openEmitter.get()) { this.show(event.key === 'ArrowUp'); return }
            const choices = this.filtered(this.choices().items).filter(option => !option.disabled)
            const index = choices.findIndex(option => option.value === this.activeValue)
            const next = index < 0 ? event.key === 'ArrowDown' ? 0 : choices.length - 1
                : (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length
            this.activeValue = choices[next]?.value ?? null
            this.update()
        } else if (event.key === 'Enter' && this.openEmitter.get()) {
            event.preventDefault()
            if (this.editing && this.searchEmitter.get() === '') this.accept(null, event)
            else if (this.activeValue != null) this.accept(this.activeValue, event)
            else if (this.props.allowCustomValue && this.editing) this.accept(this.searchEmitter.get() as TValue, event)
            else if (this.editing) {
                const exact = this.choices().items.filter(item => !item.disabled && this.label(item) === this.searchEmitter.get())
                if (exact.length === 1) this.accept(exact[0]!.value, event)
            }
        }
    }
    override afterMount(): void { this.syncValidity() }
    override afterUpdate(): void {
        this.syncValidity()
        if (this.unavailable && this.openEmitter.get()) this.cancelSearch()
    }
    private syncValidity(): void {
        const value = this.valueEmitter.get()
        this.input?.setCustomValidity(this.props.required && (value == null || value === '') ? this.capillaryUiMessage('comboBoxRequired') : '')
    }
    override onDestroy(): void {
        this.openEmitter.dispose(); if (this.ownsSearch) (this.searchEmitter as Emitter<string>).dispose(); this.input = null
    }
    static override css = css`
        & { display: grid; grid-template-columns: minmax(0, 1fr); min-inline-size: 0; }
        &:has(> label) { grid-template-columns: max-content minmax(0, 1fr); }
        & .cap-combo-shell { display: flex; min-inline-size: 0; inline-size: var(--input-width, 15rem); max-inline-size: 100%; }
        & .cap-combo-shell > input {
            inline-size: 100%; min-inline-size: 0; padding: var(--ui-control-padding); box-sizing: border-box;
            font: inherit; color: var(--input-color); background: var(--input-background);
            border: var(--input-border); border-radius: var(--ui-border-radius); box-shadow: var(--input-shadow); user-select: text;
        }
        & .cap-combo-shell > cap-button cap-icon { transform: rotate(90deg); }
        & .cap-combo-shell > input:focus-visible { outline: 2px solid transparent; box-shadow: var(--focus-ring); }
        & .cap-combo-shell > input:disabled { color: var(--input-color-disabled); background: var(--input-background-disabled); }
        & .cap-combo-shell > input[readonly]:not(:disabled) { color: var(--input-color-readonly); background: var(--input-background-readonly); }
        & .cap-combo-shell > input[aria-invalid="true"] { border-color: var(--error-control-border); box-shadow: var(--error-control-shadow); }
        & .cap-combo-shell > input[data-cap-busy-visible]:not([aria-invalid="true"]) {
            background-image: var(--working-background-image); background-size: 2rem 2rem; animation: cap-working-progress .55s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) { & input[data-cap-busy-visible] { animation: none; } }
    `
}
