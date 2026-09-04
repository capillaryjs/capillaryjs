import {Button, Checkbox, Component, css} from '@sylwellsoftware/fray'
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
}

/** Ordered enablement, presets, pointer reordering, and keyboard reordering. */
export class SplitSelectionPanel<TItem = unknown>
extends Component<SplitSelectionPanelProps<TItem>> {
    private draggingKey: string | null = null
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
            description = 'Enabled criteria recursively split each block in this order.',
        } = this.props
        const order = this.read(model.order$)
        const active = this.read(model.activeSplits$)
        const activeKeys = new Set(active.map(({key}) => key))
        const activePreset = this.read(model.activePreset$)
        return <section
            className={`datacomponentlike ${this.props.className ?? this.props.class ?? ''}`.trim()}
            data-fray-visualization="split-selection-panel"
            aria-label={label}
        >
            <header>
                <h2>{label}</h2>
                <p>{description}</p>
            </header>
            {model.presets.length === 0 ? null : <div data-part="presets">
                {model.presets.map((preset) => <Button
                    key={preset.key}
                    label={preset.label}
                    pressed={activePreset === preset.key}
                    onClick={() => {
                        model.applyPreset(preset.key)
                        this.announce(`${preset.label} split preset applied`)
                    }}
                />)}
            </div>}
            <ol>{order.map((criterion, index) => <li
                key={criterion.key}
                className="datacomponentshell"
                data-split-key={criterion.key}
                data-active={activeKeys.has(criterion.key) ? '' : null}
                data-dragging={this.draggingKey === criterion.key ? '' : null}
            >
                <button
                    type="button"
                    data-part="drag-handle"
                    aria-label={`Reorder ${criterion.label}`}
                    title="Drag to reorder; use Alt+Arrow keys from the keyboard"
                    onPointerDown={(event: PointerEvent) => {
                        event.preventDefault()
                        this.draggingKey = criterion.key
                        this.update()
                    }}
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
                ><span aria-hidden="true">↕</span></button>
                <span data-part="position" aria-hidden="true">{index + 1}</span>
                <Checkbox<CategoryVisibility>
                    symbols={activeSymbols}
                    label={criterion.label}
                    valueEmitter={model.activeState(criterion.key)}
                />
            </li>)}</ol>
            <p role="status" aria-live="polite" aria-atomic="true">
                {this.announcement}
            </p>
        </section>
    }

    static dependencies = [Button, Checkbox]

    static css = css`
        section[data-fray-visualization="split-selection-panel"] {
            display: grid;
            align-content: start;
            gap: var(--viz-space, 0.6rem);
            min-width: 0;
        }

        section[data-fray-visualization="split-selection-panel"] h2,
        section[data-fray-visualization="split-selection-panel"] p,
        section[data-fray-visualization="split-selection-panel"] ol {
            margin: 0;
        }

        section[data-fray-visualization="split-selection-panel"] header > p {
            color: var(--viz-muted-color, var(--ui-muted-text-color, currentColor));
            font-size: 0.875em;
        }

        section[data-fray-visualization="split-selection-panel"] [data-part="presets"] {
            display: flex;
            flex-wrap: wrap;
            gap: 0.35rem;
        }

        section[data-fray-visualization="split-selection-panel"] ol {
            display: grid;
            gap: 0.25rem;
            padding: 0;
            list-style: none;
        }

        section[data-fray-visualization="split-selection-panel"] li {
            display: grid;
            grid-template-columns: auto 1.6rem minmax(0, 1fr);
            align-items: center;
            gap: 0.35rem;
            min-width: 0;
            min-height: 2.25rem;
            padding: 0.25rem;
        }

        section[data-fray-visualization="split-selection-panel"] li:not([data-active]) {
            color: var(--viz-muted-color, var(--ui-muted-text-color, currentColor));
        }

        section[data-fray-visualization="split-selection-panel"] li[data-dragging] {
            outline: 2px solid var(--focus-color, var(--ui-accent-color));
        }

        section[data-fray-visualization="split-selection-panel"] [data-part="drag-handle"] {
            width: 2rem;
            min-height: 2rem;
            border: 1px solid var(--viz-border-color, var(--ui-border-color));
            border-radius: var(--viz-radius, var(--ui-border-radius));
            color: inherit;
            background: transparent;
            cursor: grab;
            touch-action: none;
        }

        section[data-fray-visualization="split-selection-panel"] [data-part="position"] {
            display: inline-grid;
            place-items: center;
            font-variant-numeric: tabular-nums;
        }

        section[data-fray-visualization="split-selection-panel"]
        li > :has(> [role="checkbox"]),
        section[data-fray-visualization="split-selection-panel"]
        [role="checkbox"] {
            width: 100%;
            justify-content: flex-start;
        }

        section[data-fray-visualization="split-selection-panel"]
        > p[role="status"][aria-live="polite"][aria-atomic="true"] {
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
        if (this.draggingKey == null) return
        const key = this.draggingKey
        this.draggingKey = null
        this.update()
        queueMicrotask(() => this.focusHandle(key))
    }

    private announce(message: string): void {
        this.announcement = message
        this.update()
    }

    private focusHandle(criterionKey: string): void {
        const handles = this.dom instanceof Element
            ? this.dom.querySelectorAll<HTMLElement>('[data-split-key] [data-part="drag-handle"]')
            : []
        for (const handle of handles) {
            if (handle.closest<HTMLElement>('[data-split-key]')?.dataset.splitKey === criterionKey) {
                handle.focus()
                return
            }
        }
    }
}
