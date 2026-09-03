import {Button} from '../menu/button.js'
import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild, Ref} from '../component.js'
import {
    componentClass,
    controlId,
    createValueEmitter,
    invoke,
} from '../controlUtils.js'
import type {ValueControlProps, ValueEmitter} from '../controlUtils.js'

export interface DialogProps extends ValueControlProps<boolean> {
    id?: string | number | null
    title: FrayChild
    description?: FrayChild
    actions?: FrayChild
    closeLabel?: string
    showCloseButton?: boolean
    initialFocusRef?: Ref<HTMLElement>
    onClose?: () => void
}

/** Controlled modal built on the native dialog element. */
export class Dialog extends Component<DialogProps> {
    readonly openEmitter: ValueEmitter<boolean>
    readonly dialogId: string
    readonly titleId: string
    readonly descriptionId: string
    private dialogElement: HTMLDialogElement | null = null
    private restoreFocusTo: HTMLElement | null = null
    private synchronizedOpen = false

    constructor(props: DialogProps) {
        super(props)
        this.openEmitter = createValueEmitter(this, props, false, 'dialog open state')
        this.dialogId = controlId('dialog', props.id)
        this.titleId = `${this.dialogId}-title`
        this.descriptionId = `${this.dialogId}-description`
    }

    initialize(): void {
        this.watch(this.openEmitter)
    }

    render(): FrayChild {
        const {
            title,
            description,
            actions,
            closeLabel = 'Close',
            showCloseButton = true,
            children = [],
        } = this.props
        return <dialog
            id={this.dialogId}
            className={componentClass(this.props) || undefined}
            data-fray-component="dialog"
            aria-labelledby={this.titleId}
            aria-describedby={description == null ? null : this.descriptionId}
            aria-modal="true"
            ref={(element: HTMLDialogElement | null) => this.dialogElement = element}
        >
            <header data-part="header">
                <h2 id={this.titleId}>{title}</h2>
            </header>
            {description == null ? null : <p id={this.descriptionId} data-part="description">
                {description}
            </p>}
            <div data-part="content">{children}</div>
            {actions == null && !showCloseButton ? null : <footer data-part="actions">
                {actions}
                {showCloseButton ? <Button
                    label={closeLabel}
                    onClick={() => this.requestClose()}
                /> : null}
            </footer>}
        </dialog>
    }

    afterMount(): void {
        const dialog = this.dialogElement
        if (dialog == null) return
        this.listen(dialog, 'cancel', (event: Event) => {
            event.preventDefault()
            this.requestClose()
        })
        this.listen(dialog, 'close', () => {
            if (this.openEmitter.get()) this.openEmitter.set(false, 'native dialog closed')
            this.finishClose()
        })
        this.syncOpenState()
    }

    afterUpdate(): void {
        this.syncOpenState()
    }

    close(): void {
        this.requestClose()
    }

    onDestroy(): void {
        const dialog = this.dialogElement
        if (dialog?.open === true && typeof dialog.close === 'function') dialog.close()
        this.finishClose()
        this.dialogElement = null
    }

    static dependencies = [Button]

    static css = css`
        dialog[data-fray-component="dialog"] {
            width: min(38rem, calc(100vw - 2rem));
            max-height: min(42rem, calc(100dvh - 2rem));
            padding: 0;
            color: var(--fray-panel-color, var(--ui-text-color));
            background: var(--fray-panel-background, var(--panel-bg));
            border: var(--fray-panel-border, var(--panel-border));
            border-radius: var(--fray-panel-radius, var(--panel-radius));
            box-shadow: var(--fray-dialog-shadow, var(--fray-panel-shadow));
        }

        dialog[data-fray-component="dialog"]::backdrop {
            background: var(--fray-dialog-backdrop-background);
        }

        dialog[data-fray-component="dialog"] > [data-part] {
            padding: var(--panel-padding, 0.75rem);
        }

        dialog[data-fray-component="dialog"] > [data-part="header"] {
            color: var(
                --fray-dialog-header-color,
                var(--fray-section-header-color, var(--fray-header-color))
            );
            background: var(
                --fray-dialog-header-background,
                var(--fray-section-header-background, var(--fray-header-background))
            );
            border-block-end: var(
                --fray-section-header-border,
                var(--fray-header-border)
            );
        }

        dialog[data-fray-component="dialog"] > [data-part="header"] h2,
        dialog[data-fray-component="dialog"] > [data-part="description"] {
            margin: 0;
        }

        dialog[data-fray-component="dialog"] > [data-part="content"] {
            overflow: auto;
        }

        dialog[data-fray-component="dialog"] > [data-part="actions"] {
            display: flex;
            justify-content: flex-end;
            gap: var(--spacing-small, 0.5rem);
            border-block-start: 1px solid var(--ui-border-color);
        }

        @media (prefers-reduced-motion: no-preference) {
            dialog[data-fray-component="dialog"][open] {
                animation: fray-dialog-enter 120ms ease-out;
            }
        }

        @keyframes fray-dialog-enter {
            from {
                transform: translateY(0.4rem);
            }
        }

        @media (forced-colors: active) {
            dialog[data-fray-component="dialog"] {
                border: 2px solid CanvasText;
            }
        }
    `

    private requestClose(): void {
        if (!this.openEmitter.get()) return
        this.openEmitter.set(false, 'dialog close requested')
    }

    private syncOpenState(): void {
        const dialog = this.dialogElement
        if (dialog == null) return
        const shouldOpen = this.openEmitter.get()
        if (shouldOpen && !this.synchronizedOpen) {
            const active = document.activeElement
            this.restoreFocusTo = active instanceof HTMLElement ? active : null
            showModal(dialog)
            this.synchronizedOpen = true
            focusInitial(dialog, this.props.initialFocusRef)
            return
        }
        if (!shouldOpen && this.synchronizedOpen) {
            if (dialog.open && typeof dialog.close === 'function') dialog.close()
            else dialog.removeAttribute('open')
            this.finishClose()
        }
    }

    private finishClose(): void {
        if (!this.synchronizedOpen && this.restoreFocusTo == null) return
        this.synchronizedOpen = false
        const restore = this.restoreFocusTo
        this.restoreFocusTo = null
        if (restore?.isConnected === true) restore.focus()
        invoke(this.props.onClose)
    }
}

function showModal(dialog: HTMLDialogElement): void {
    if (dialog.open) return
    if (typeof dialog.showModal === 'function') {
        dialog.showModal()
        return
    }
    dialog.setAttribute('open', '')
}

function focusInitial(dialog: HTMLDialogElement, ref: Ref<HTMLElement> | undefined): void {
    const referenced = ref == null
        ? null
        : typeof ref === 'function' ? null : ref.current
    const target = referenced ?? dialog.querySelector<HTMLElement>(
        '[autofocus], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    target?.focus()
}
