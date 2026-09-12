import {Button, Checkbox, Component, GroupPanel, css} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'

import type {CategoryVisibility} from '../grouping.js'
import {SplitSelectionModel} from '../splits.js'

const activeSymbols = [
    ['☐', 'hidden'],
    ['✓', 'visible'],
] as const

export interface SplitSelectionPanelProps<TItem> extends ComponentProps {
    readonly model: SplitSelectionModel<TItem>
    readonly label?: string
    readonly description?: string
    readonly presetsLabel?: string
}

/** Ordered enablement, presets, pointer reordering, and keyboard reordering. */
export class SplitSelectionPanel<TItem = unknown>
extends Component<SplitSelectionPanelProps<TItem>> {
    static override liveProps: readonly string[] = []
    private draggingKey: string | null = null
    private pendingDrag: {key: string; clientX: number; clientY: number} | null = null
    private suppressClick = false
    private suppressClickTimer: ReturnType<typeof setTimeout> | null = null
    private announcement = ''

    initialize(): void {
        this.listen<PointerEvent>(document, 'pointermove', (event) => this.pointerMove(event))
        this.listen<PointerEvent>(document, 'pointerup', () => this.stopDragging())
        this.listen<PointerEvent>(document, 'pointercancel', () => this.stopDragging())
    }

    render(): FrayChild {
        const {
            model,
            label = 'Select and order splits',
            description = '',
            presetsLabel = 'Split presets',
        } = this.props
        const order = this.read(model.order$)
        this.read(model.activeSplits$)
        const activePreset = this.read(model.activePreset$)
        const Host = this.Host
        return <Host>
            {model.presets.length === 0 ? null : <GroupPanel header={presetsLabel}>
                <fray-presets>
                    {model.presets.map((preset) => <Button
                        key={preset.key}
                        label={preset.label}
                        pressed={activePreset === preset.key}
                        onClick={() => {
                            model.applyPreset(preset.key)
                            this.announce(`${preset.label} split preset applied`)
                        }}
                    />)}
                </fray-presets>
            </GroupPanel>}
            <GroupPanel header={label}>
                <p>{description}</p>
                <ol>{order.map((criterion) => <li
                    key={criterion.key}
                    className={this.draggingKey === criterion.key ? 'dragging' : undefined}
                    data-split-key={criterion.key}
                    onPointerDown={(event: PointerEvent) => this.startDragging(criterion.key, event)}
                    onClick={(event: MouseEvent) => this.suppressDraggedClick(event)}
                >
                    <Checkbox<CategoryVisibility>
                        symbols={activeSymbols}
                        label={criterion.label}
                        valueEmitter={model.activeState(criterion.key)}
                    />
                    <fray-draghandle
                        role="button"
                        tabIndex={0}
                        aria-label={`Reorder ${criterion.label}`}
                        title="Drag to reorder; use Alt+Arrow keys from the keyboard"
                        onKeyDown={(event: KeyboardEvent) => {
                            if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) {
                                return
                            }
                            event.preventDefault()
                            const offset = event.key === 'ArrowUp' ? -1 : 1
                            if (model.moveBy(criterion.key, offset, 'split reordered by keyboard')) {
                                const position = model.order$.get().findIndex(({key}) =>
                                    key === criterion.key) + 1
                                this.announce(`${criterion.label} moved to position ${position}`)
                                queueMicrotask(() => this.focusHandle(criterion.key))
                            }
                        }}
                    />
                </li>)}</ol>
                <p role="status" aria-live="polite" aria-atomic="true">
                    {this.announcement}
                </p>
            </GroupPanel>
        </Host>
    }

    static override hostName = 'split-selection-panel'
    static dependencies = [Button, Checkbox, GroupPanel]

    static css = css`
        & {
            display: grid;
            gap: var(--viz-space, 0.6rem);
            min-width: 0;
            user-select: none;
        }

        & > fray-grouppanel {
            min-width: 0;
        }

        & > fray-grouppanel > fray-content {
            display: flex;
            flex-flow: column;
            padding: .25em;
            flex: 1 1 0;
        }

        & > fray-grouppanel > fray-content > p,
        & > fray-grouppanel > fray-content > ol {
            margin: 0;
        }

        & > fray-grouppanel > fray-content > p:first-child {
            color: var(--viz-muted-color, var(--ui-muted-text-color, currentColor));
            font-size: 0.875em;
        }

        & > fray-grouppanel > fray-content > fray-presets {
            display: grid;
            gap: 0.35rem;
            align-content: stretch;
            justify-content: stretch;
        }

        & > fray-grouppanel > fray-content > fray-presets > fray-button {
            display: flex;
            flex-flow: column;
            align-content: stretch;
        }

        & ol {
            display: grid;
            gap: 0.25rem;
            padding: 0;
            list-style: none;
        }

        & li {
            display: flex;
            flex-flow: row nowrap;
            align-items: center;
            justify-content: space-between;
            gap: 0.35rem;
            min-width: 0;
            padding: 0 .35rem;
            border-radius: var(--ui-border-radius);
            box-shadow: var(--box-shadow);
        }

        & li:has(input[type="checkbox"]:not(:checked)) {
            color: var(--viz-muted-color, var(--ui-muted-text-color, currentColor));
        }

        & li.dragging {
            outline: 2px solid var(--focus-color, var(--ui-accent-color));
        }

        & fray-draghandle {
            display: block;
            width: 1.1rem;
            height: .9rem;
            min-height: .9rem;
            padding: 0;
            border: 0;
            border-radius: 0;
            color: inherit;
            background-color: transparent;
            background-image: radial-gradient(currentColor 0.75px, transparent 0.9px);
            background-position: center;
            background-size: 3px 3px;
            cursor: grab;
            touch-action: none;
        }

        & fray-draghandle:focus-visible {
            outline: 2px solid var(--focus-color, var(--ui-accent-color));
            outline-offset: 1px;
        }

        & li > :has(> [role="checkbox"]),
        & [role="checkbox"] {

            justify-content: center;
            align-items: center;
            justify-items: center;
            align-content: center;
        }

        & > fray-grouppanel > fray-content > p[role="status"][aria-live="polite"][aria-atomic="true"] {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
        }
    `

    private pointerMove(event: PointerEvent): void {
        if (this.draggingKey == null && this.pendingDrag != null) {
            const {clientX, clientY, key} = this.pendingDrag
            if (Math.hypot(event.clientX - clientX, event.clientY - clientY) < 4) return
            this.draggingKey = key
            this.pendingDrag = null
            this.update()
        }
        if (this.draggingKey == null || typeof document.elementFromPoint !== 'function') return
        const target = document.elementFromPoint(event.clientX, event.clientY)
            ?.closest<HTMLElement>('[data-split-key]')
        if (target == null) return
        const targetKey = target.dataset.splitKey
        if (targetKey == null) return
        const targetIndex = this.props.model.order$.get().findIndex(({key}) => key === targetKey)
        if (targetIndex < 0 || !this.props.model.move(
            this.draggingKey,
            targetIndex,
            'split reordered by pointer',
        )) return
        const criterion = this.props.model.criteria.find(({key}) => key === this.draggingKey)
        this.announce(`${criterion?.label ?? this.draggingKey} moved to position ${targetIndex + 1}`)
    }

    private stopDragging(): void {
        if (this.draggingKey == null && this.pendingDrag == null) return
        const key = this.draggingKey
        const dragged = key != null
        this.draggingKey = null
        this.pendingDrag = null
        if (!dragged) return
        this.suppressClick = true
        if (this.suppressClickTimer != null) clearTimeout(this.suppressClickTimer)
        this.suppressClickTimer = setTimeout(() => {
            this.suppressClick = false
            this.suppressClickTimer = null
        }, 0)
        this.update()
        queueMicrotask(() => this.focusHandle(key))
    }

    private startDragging(key: string, event: PointerEvent): void {
        if (event.button !== 0) return
        this.pendingDrag = {key, clientX: event.clientX, clientY: event.clientY}
    }

    private suppressDraggedClick(event: MouseEvent): void {
        if (!this.suppressClick) return
        this.suppressClick = false
        if (this.suppressClickTimer != null) clearTimeout(this.suppressClickTimer)
        this.suppressClickTimer = null
        event.preventDefault()
        event.stopPropagation()
    }

    private announce(message: string): void {
        this.announcement = message
        this.update()
    }

    private focusHandle(criterionKey: string): void {
        const handles = this.dom instanceof Element
            ? this.dom.querySelectorAll<HTMLElement>('[data-split-key] fray-draghandle')
            : []
        for (const handle of handles) {
            if (handle.closest<HTMLElement>('[data-split-key]')?.dataset.splitKey === criterionKey) {
                handle.focus()
                return
            }
        }
    }
}
