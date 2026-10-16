import {Component, css} from '../component.js'
import type {CapillaryUiChild, ComponentProps, Key} from '../component.js'
import {Popover} from '../dialog/popover.js'
import type {PopoverProps} from '../dialog/popover.js'
import {Icon} from './icon.js'
import type {IconName} from './icon.js'
import {ErrorMessage} from '../status/statusPresentation.js'
import {CommandInvocationPresentation, commandSource} from '../commandSupport.js'
import type {CommandAction} from '../commandSupport.js'

interface MenuActionCommon {
    id: Key
    label: string
    icon?: IconName
    disabled?: boolean
}

/** A command action, not a selected value or arbitrary interactive popup content. */
export type MenuAction = MenuActionCommon & (
    | {command: CommandAction<void>; onSelect?: never}
    | {command?: never; onSelect: (event: MouseEvent) => void}
)
export type MenuEntry = MenuAction
    | {kind: 'separator'; id: Key}
    | {kind: 'group'; id: Key; label: string; items: readonly MenuAction[]}

export interface DropdownMenuProps extends PopoverProps {
    children?: never
    initialFocusRef?: never
    items: readonly MenuEntry[]
    initialFocus?: 'first' | 'last'
    /** Notification before invocation; does not extend completion. */
    onAction?: (item: MenuAction) => void
    /** Invocation/handler failures; command execution failures remain in the command. */
    onActionError?: (error: unknown) => void
}

interface MenuActionRowProps extends ComponentProps {
    item: MenuAction
    invocationError: unknown
    activate: (item: MenuAction, event: MouseEvent) => void
}

/** An item owns its timer/subscriptions, including removal from a live menu. */
class MenuActionRow extends Component<MenuActionRowProps> {
    static override hostName = null
    static override dependencies = [Icon, ErrorMessage]
    render(): CapillaryUiChild {
        const {item, invocationError, activate} = this.props
        const command = commandSource(item.command)
        const running = command == null ? false : this.read(command.isRunning)
        const error = command == null ? null : this.snapshot(command).error
        const displayedError = invocationError ?? error
        const visible = this.presentBusy(running && displayedError == null, 'action', item.command)
        return <div className="cap-menu-entry">
            <button type="button" role="menuitem" tabIndex={-1} aria-disabled={item.disabled || running ? 'true' : null}
                aria-busy={running ? 'true' : null} data-cap-busy-visible={visible ? '' : null}
                aria-invalid={displayedError == null ? null : 'true'}
                onClick={(event: MouseEvent) => activate(item, event)}>
                {item.icon ? <Icon name={item.icon}/> : null}<span>{item.label}</span>
            </button>
            {displayedError == null ? null : <ErrorMessage error={displayedError}/>}
        </div>
    }
}

/** Native top-layer action menu with a complete composite-widget keyboard model. */
export class DropdownMenu extends Popover<DropdownMenuProps> {
    static override hostName = 'dropdownmenu'
    static override dependencies = [MenuActionRow]
    private readonly invocation = new CommandInvocationPresentation(() => this.update())
    private invokedId: Key | null = null
    private search = ''
    private searchTimer: ReturnType<typeof setTimeout> | null = null

    protected override get surfaceRole(): 'menu' { return 'menu' }

    protected override renderSurfaceContent(): CapillaryUiChild {
        if (!Array.isArray(this.props.items)) throw new TypeError('Menu items must be an array')
        const ids = new Set<Key>()
        for (const item of this.props.items) {
            if ('kind' in item && item.kind !== 'separator' && item.kind !== 'group') throw new TypeError('Unknown menu entry kind')
            for (const entry of [item, ...('kind' in item && item.kind === 'group' ? item.items : [])]) {
                if (typeof entry.id !== 'string' && typeof entry.id !== 'number'
                    || typeof entry.id === 'number' && !Number.isFinite(entry.id)) throw new TypeError('Menu entry id must be a string or finite number')
                if (ids.has(entry.id)) throw new TypeError('Menu entries require unique ids')
                ids.add(entry.id)
                if (!('kind' in entry) || entry.kind === 'group') {
                    if (!entry.label?.trim()) throw new TypeError('Menu entries require labels')
                }
                if (!('kind' in entry)) {
                    if ((entry.command != null) === (entry.onSelect != null)) throw new TypeError('Menu action requires exactly one command or onSelect')
                    if (entry.onSelect != null && typeof entry.onSelect !== 'function') throw new TypeError('Menu onSelect must be a function')
                }
            }
        }
        return this.props.items.map((item: MenuEntry) => 'kind' in item
            ? item.kind === 'separator' ? <div key={item.id} role="separator"/>
                : <div key={item.id} role="group" aria-label={item.label}>
                    <div className="cap-menu-group-label" aria-hidden="true">{item.label}</div>
                    {item.items.map(action => this.renderAction(action))}
                </div>
            : this.renderAction(item))
    }

    private renderAction(item: MenuAction): CapillaryUiChild {
        const invocationError = this.invokedId === item.id ? this.invocation.error() : null
        return <MenuActionRow key={item.id} item={item} invocationError={invocationError}
            activate={(action, event) => this.activate(action, event)}/>
    }

    private activate(item: MenuAction, event: MouseEvent): void {
        if (item.disabled || commandSource(item.command)?.isRunning.get()) return
        this.invokedId = item.id
        this.invocation.reconcile(item.command)
        // Close and return focus before an action opens its own dialog or removes
        // the trigger. Otherwise menu dismissal could steal the new focus.
        this.close()
        try { this.props.onAction?.(item) } catch (error) { this.reportActionError(error) }
        try {
            if (item.command != null) this.invocation.invoke(item.command, undefined, event, {
                onCommandInvocationError: error => this.reportActionError(error),
            })
            else item.onSelect(event)
        } catch (error) {
            this.reportActionError(error)
        }
    }

    private reportActionError(error: unknown): void {
        if (this.props.onActionError) {
            try { this.props.onActionError(error); return } catch (failure) { error = failure }
        }
        if (typeof globalThis.reportError === 'function') globalThis.reportError(error)
        else console.error(error)
    }

    override afterUpdate(): void {
        super.afterUpdate()
        const panel = this.panel
        if (this.openEmitter.get() && panel?.isConnected
            && (!panel.contains(panel.ownerDocument.activeElement) || panel.ownerDocument.activeElement === panel && this.buttons.length)) {
            this.focusOnOpen(panel)
        }
    }

    override close(): void { this.clearSearch(); super.close() }

    private get buttons(): HTMLButtonElement[] {
        return [...(this.panel?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
    }
    protected override focusOnOpen(panel: HTMLElement): void {
        this.clearSearch()
        const buttons = this.buttons
        ;((this.props.initialFocus === 'last' ? buttons.at(-1) : buttons[0]) ?? panel).focus({preventScroll: true})
    }
    protected override onSurfaceKeyDown(event: KeyboardEvent): void {
        super.onSurfaceKeyDown(event)
        if (event.defaultPrevented) return
        if (event.key === 'Tab') { this.close(); return }
        const buttons = this.buttons, index = buttons.indexOf(event.target as HTMLButtonElement)
        if (!buttons.length) return
        let next: number | null = null
        if (event.key === 'ArrowDown') next = (index + 1) % buttons.length
        else if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length
        else if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = buttons.length - 1
        else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
            this.search += event.key.toLocaleLowerCase()
            if (this.searchTimer != null) clearTimeout(this.searchTimer)
            this.searchTimer = setTimeout(() => this.clearSearch(), 500)
            const prefix = [...this.search].every(key => key === this.search[0]) ? this.search[0]! : this.search
            for (let offset = 1; offset <= buttons.length; offset++) {
                const candidate = (index + offset) % buttons.length
                if (buttons[candidate]!.textContent?.trim().toLocaleLowerCase().startsWith(prefix)) { next = candidate; break }
            }
        }
        if (next != null) { event.preventDefault(); buttons[next]!.focus({preventScroll: true}) }
        // Enter/Space use native button activation, including keyboard-generated
        // clicks. Disabled menu items remain focusable but activation is guarded.
    }
    private clearSearch(): void {
        if (this.searchTimer != null) clearTimeout(this.searchTimer)
        this.searchTimer = null; this.search = ''
    }
    override onDestroy(): void { this.clearSearch(); super.onDestroy() }

    static override css = css`
        & > [popover] { min-inline-size: 12rem; padding: .25rem; }
        & .cap-menu-entry { position: relative; }
        & [role="menuitem"] {
            display: flex; align-items: center; gap: .5em; inline-size: 100%;
            min-block-size: var(--control-min-height, 2em); box-sizing: border-box;
            padding: .35em .6em; border: 0; border-radius: var(--ui-border-radius);
            font: inherit; color: inherit; background: transparent; text-align: start;
        }
        & [role="menuitem"]:hover, & [role="menuitem"]:focus-visible {
            background: var(--button-background-hover); outline: 2px solid transparent;
        }
        & [role="menuitem"]:focus-visible { box-shadow: inset 0 0 0 2px var(--ui-focus-color, Highlight); }
        & [role="menuitem"][aria-disabled="true"] { color: var(--input-color-disabled); }
        & [role="menuitem"][data-cap-busy-visible] {
            background-image: var(--working-background-image); background-size: 2rem 2rem;
            animation: cap-working-progress .55s linear infinite;
        }
        & [role="separator"] { block-size: 1px; margin: .25rem; background: var(--ui-border-color, GrayText); }
        & .cap-menu-group-label { padding: .35em .6em; font-size: .85em; font-weight: 600; }
        @media (prefers-reduced-motion: reduce) { & [data-cap-busy-visible] { animation: none; } }
    `
}
