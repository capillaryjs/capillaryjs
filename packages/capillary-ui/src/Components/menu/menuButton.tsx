import {Component, css} from '../component.js'
import type {CapillaryUiChild, Key, LivePropContract, Ref} from '../component.js'
import {componentClass, controlId, createValueEmitter} from '../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../controlUtils.js'
import {Button} from './button.js'
import {Icon} from './icon.js'
import type {IconName} from './icon.js'
import {DropdownMenu} from './dropdownMenu.js'
import type {MenuAction, MenuEntry} from './dropdownMenu.js'
import {commandSource} from '../commandSupport.js'

export interface MenuButtonProps extends ValueControlProps<boolean>, LivePropContract<'disabled' | 'busy' | 'error'> {
    id?: string
    label?: string
    icon?: IconName
    ariaLabel?: string
    appearance?: 'standard' | 'subtle'
    disabled?: boolean
    busy?: boolean
    error?: unknown
    buttonRef?: Ref<HTMLButtonElement>
    ariaDescribedBy?: string
    title?: string
    items: readonly MenuEntry[]
}

/** Named action trigger plus menu; the invoked command retains feedback when closed. */
export class MenuButton extends Component<MenuButtonProps> {
    static override hostName = 'menubutton'
    static override liveProps = ['disabled', 'busy', 'error'] as const
    static override dependencies = [Button, Icon, DropdownMenu]
    readonly openEmitter: ValueEmitter<boolean>
    readonly menuId: string
    private anchor: HTMLElement | null = null
    private initialFocus: 'first' | 'last' = 'first'
    private readonly invokedActions = new Map<Key, MenuAction>()
    private invocationError: unknown = null

    constructor(props: MenuButtonProps) {
        super(props)
        if (!(props.ariaLabel ?? props.label)?.trim()) throw new TypeError('MenuButton requires an accessible name')
        this.openEmitter = createValueEmitter(this, props, false, 'action menu open')
        this.menuId = `${controlId('menu-button', props.id)}-menu`
    }
    initialize(): void { this.watch(this.openEmitter) }
    render(): CapillaryUiChild {
        const {label, ariaLabel, icon, appearance, disabled, items, id} = this.props
        let running = this.props.busy === true, commandError: unknown = null
        for (const [key, action] of this.invokedActions) {
            const command = commandSource(action.command)
            if (command == null) { this.invokedActions.delete(key); continue }
            const active = this.read(command.isRunning), failure = this.snapshot(command).error
            running = running || active
            commandError ??= failure
        }
        const error = this.props.error ?? this.invocationError ?? commandError
        const open = this.openEmitter.get(), Host = this.Host
        return <Host className={componentClass(this.props) || null}
            onKeyDown={(event: KeyboardEvent) => {
                if (event.target !== this.anchor && !(event.target instanceof HTMLElement && event.target.closest('cap-button'))) return
                if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !disabled) {
                    event.preventDefault(); this.show(event.target as HTMLElement, event.key === 'ArrowUp' ? 'last' : 'first')
                }
            }}>
            <Button {...(id ? {id} : {})} {...(label ? {label} : {})} {...(icon ? {icon} : {})}
                {...(ariaLabel ? {ariaLabel} : {})} {...(appearance ? {appearance} : {})}
                {...(this.props.buttonRef ? {buttonRef: this.props.buttonRef} : {})}
                {...(this.props.ariaDescribedBy ? {ariaDescribedBy: this.props.ariaDescribedBy} : {})}
                {...(this.props.title != null ? {title: this.props.title} : {})}
                disabled={disabled ?? false} busy={running} error={error} disableWhileRunning={false}
                ariaControls={this.menuId} ariaExpanded={open} ariaHasPopup="menu"
                onClick={event => {
                    if (open) this.openEmitter.set(false, 'action menu toggle')
                    else this.show(event.currentTarget as HTMLElement, 'first')
                }}>{label ? <>{label}<Icon name="next" style={{transform: 'rotate(90deg)'}}/></> : null}</Button>
            <DropdownMenu id={this.menuId} label={ariaLabel ?? label!} anchor={this.anchor}
                valueEmitter={this.openEmitter} initialFocus={this.initialFocus} items={items}
                onAction={item => {
                    for (const [key, previous] of this.invokedActions) {
                        const source = commandSource(previous.command)
                        if (source == null || !source.isRunning.get() && source.getError() == null) this.invokedActions.delete(key)
                    }
                    this.invokedActions.set(item.id, item); this.invocationError = null; this.update()
                }}
                onActionError={failure => { this.invocationError = failure; this.update() }}/>
        </Host>
    }
    private show(anchor: HTMLElement, focus: 'first' | 'last'): void {
        this.anchor = anchor; this.initialFocus = focus
        this.openEmitter.set(true, 'action menu opened')
    }
    override afterMount(): void { this.syncAnchor() }
    override afterUpdate(): void { this.syncAnchor() }
    private syncAnchor(): void {
        const anchor = (this.dom as HTMLElement | null)?.querySelector<HTMLElement>(':scope > cap-button > button') ?? null
        const changed = anchor !== this.anchor
        this.anchor = anchor
        if (this.props.disabled && this.openEmitter.get()) this.openEmitter.set(false, 'action menu disabled')
        else if (changed && this.openEmitter.get()) this.update()
    }
    static override css = css`& { display: inline-flex; }`
}
