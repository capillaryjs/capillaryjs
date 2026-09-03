import {Emitter, FetchState} from '@sylwellsoftware/glue'
import type {ReadableEmitter} from '@sylwellsoftware/glue'
import {Component, css} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'

import {civilDateToDay, dayToCivilDate} from '../dates.js'
import type {CivilDate} from '../dates.js'
import {
    areaPath,
    buildLineChartModel,
    linePath,
    valueAtDate,
} from '../lineChart.js'
import type {LineChartModel, LineGraphRange} from '../lineChart.js'
import type {HistoryShape} from '../series.js'

export interface LineGraphProps extends ComponentProps {
    readonly shapes$: ReadableEmitter<readonly HistoryShape[]>
    readonly stacked$: ReadableEmitter<boolean>
    readonly smooth$: ReadableEmitter<boolean>
    readonly range$: ReadableEmitter<LineGraphRange>
    readonly label?: string
    readonly emptyMessage?: string
    readonly formatDate?: (date: CivilDate) => string
    readonly formatValue?: (value: number) => string
}

/** Responsive SVG history line/area chart with pointer and keyboard readout. */
export class LineGraph extends Component<LineGraphProps> {
    private readonly cursorDate$ = new Emitter<CivilDate | null>(null, {
        owner: this,
        purpose: 'line graph cursor date',
    })
    private chartHost: HTMLDivElement | null = null
    private observedWidth = 960
    private currentModel: LineChartModel | null = null
    private resizeObserver: ResizeObserver | null = null

    render(): FrayChild {
        const shapes = this.snapshot(this.props.shapes$)
        const stacked = this.snapshot(this.props.stacked$)
        const smooth = this.snapshot(this.props.smooth$)
        const range = this.snapshot(this.props.range$)
        const cursorDate = this.read(this.cursorDate$)
        const label = this.props.label ?? 'History chart'
        const state = [shapes, stacked, smooth, range].some(({fetchState}) =>
            fetchState === FetchState.Error)
            ? FetchState.Error
            : [shapes, stacked, smooth, range].some(({fetchState}) =>
                fetchState !== FetchState.Ready)
                ? FetchState.Loading
                : FetchState.Ready
        let calculationError: unknown = null
        this.currentModel = null
        if (state === FetchState.Ready) {
            try {
                this.currentModel = buildLineChartModel(shapes.value, {
                    stacked: stacked.value,
                    range: range.value,
                    width: Math.max(480, this.observedWidth),
                    maxDateMarks: this.observedWidth < 640 ? 5 : 9,
                })
            } catch (error) {
                calculationError = error
            }
        }
        const model = this.currentModel
        const activeDate = model == null
            ? null
            : cursorDate ?? model.maxDate
        const formatDate = this.props.formatDate ?? ((date: CivilDate) => date)
        const formatValue = this.props.formatValue ?? ((value: number) => String(value))
        return <section
            data-fray-visualization="line-graph"
            aria-label={label}
            aria-busy={state !== FetchState.Ready ? 'true' : null}
        >
            <header>
                <h2>{label}</h2>
                <p>{stacked.value ? 'Stacked area' : 'Individual line'} chart;{' '}
                    {smooth.value ? 'smooth' : 'step'} rendering.</p>
            </header>
            {state === FetchState.Error || calculationError != null
                ? <p role="alert">The history chart could not be calculated.</p>
                : state !== FetchState.Ready
                    ? <p role="status" aria-live="polite">Loading history chart…</p>
                    : shapes.value.length === 0
                        ? <p role="status">{this.props.emptyMessage ?? 'No history values are available.'}</p>
                        : <div
                            data-part="chart"
                            tabIndex={0}
                            role="group"
                            aria-label={`${label}. Use Left and Right Arrow to move by day; hold Shift to move by week.`}
                            onPointerMove={(event: PointerEvent) => this.pointerMove(event)}
                            onKeyDown={(event: KeyboardEvent) => this.cursorKeyDown(event)}
                            ref={(element: HTMLDivElement | null) => this.chartHost = element}
                        />}
            {model == null || activeDate == null ? null : <div data-part="readout">
                <p aria-live="polite"><strong>{formatDate(activeDate)}</strong></p>
                <ul>{model.series.map(({shape}) => <li key={shape.key}>
                    <span
                        data-part="swatch"
                        data-color-key={shape.colorKey}
                        style={{background: shape.color}}
                        aria-hidden="true"
                    />
                    <span>{shape.label}</span>
                    <strong>{formatValue(valueAtDate(shape, activeDate))}</strong>
                </li>)}</ul>
            </div>}
        </section>
    }

    afterMount(): void {
        this.observeSize()
        this.drawChart()
    }

    afterUpdate(): void {
        this.drawChart()
    }

    onDestroy(): void {
        this.resizeObserver?.disconnect()
        this.resizeObserver = null
        this.chartHost = null
        this.cursorDate$.dispose()
    }

    static css = css`
        section[data-fray-visualization="line-graph"] {
            display: flex;
            min-width: 0;
            min-height: var(--fray-viz-line-graph-min-height, 24rem);
            flex-direction: column;
            padding: var(--fray-viz-space, 0.7rem);
            color: var(--fray-viz-color, var(--fray-ui-color, var(--ui-text-color)));
            background: var(--fray-viz-panel-background, var(--panel-bg));
        }

        section[data-fray-visualization="line-graph"] h2,
        section[data-fray-visualization="line-graph"] p,
        section[data-fray-visualization="line-graph"] ul {
            margin: 0;
        }

        section[data-fray-visualization="line-graph"] [data-part="chart"] {
            flex: 1;
            min-height: 20rem;
            margin-block: 0.6rem;
            overflow: auto;
            border: 1px solid var(--fray-viz-border-color, var(--ui-border-color));
            border-radius: var(--fray-viz-radius, var(--ui-border-radius));
            background: var(--fray-viz-chart-background, var(--panel-bg));
        }

        section[data-fray-visualization="line-graph"] svg {
            display: block;
            width: 100%;
            min-width: 30rem;
            height: auto;
        }

        section[data-fray-visualization="line-graph"] [data-part="grid"] {
            stroke: var(--fray-viz-grid-color, var(--ui-border-color));
            stroke-width: 1;
            vector-effect: non-scaling-stroke;
        }

        section[data-fray-visualization="line-graph"] [data-part="axis-label"] {
            fill: var(--fray-viz-color, var(--ui-text-color));
            font: 12px system-ui, sans-serif;
        }

        section[data-fray-visualization="line-graph"] [data-part="series-line"] {
            fill: none;
            stroke-width: 3;
            stroke-linecap: round;
            stroke-linejoin: round;
            vector-effect: non-scaling-stroke;
        }

        section[data-fray-visualization="line-graph"] [data-part="series-area"] {
            opacity: var(--fray-viz-area-opacity, 0.25);
        }

        section[data-fray-visualization="line-graph"] [data-part="cursor"] {
            stroke: var(--fray-viz-cursor-color, var(--ui-text-color));
            stroke-width: 2;
            stroke-dasharray: 4 3;
            vector-effect: non-scaling-stroke;
        }

        section[data-fray-visualization="line-graph"] [data-part="readout"] {
            padding-block-start: 0.4rem;
            border-block-start: 1px solid var(--fray-viz-border-color, var(--ui-border-color));
        }

        section[data-fray-visualization="line-graph"] [data-part="readout"] ul {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem 1rem;
            padding: 0;
            list-style: none;
        }

        section[data-fray-visualization="line-graph"] [data-part="readout"] li {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
        }

        section[data-fray-visualization="line-graph"] [data-part="swatch"] {
            width: 0.8rem;
            height: 0.8rem;
            border: 1px solid var(--fray-viz-border-color, var(--ui-border-color));
            border-radius: 50%;
        }

        @media (forced-colors: active) {
            section[data-fray-visualization="line-graph"] [data-part="series-line"],
            section[data-fray-visualization="line-graph"] [data-part="cursor"],
            section[data-fray-visualization="line-graph"] [data-part="grid"] {
                stroke: CanvasText;
                forced-color-adjust: auto;
            }

            section[data-fray-visualization="line-graph"] [data-part="series-area"] {
                fill: Canvas;
                stroke: CanvasText;
            }
        }
    `

    private observeSize(): void {
        if (this.chartHost == null || typeof globalThis.ResizeObserver !== 'function') return
        this.resizeObserver = new ResizeObserver((entries) => {
            const width = entries[0]?.contentRect.width
            if (width == null || width <= 0 || Math.abs(width - this.observedWidth) < 1) return
            this.observedWidth = width
            this.update()
        })
        this.resizeObserver.observe(this.chartHost)
    }

    private pointerMove(event: PointerEvent): void {
        const model = this.currentModel
        const host = this.chartHost
        if (model == null || host == null) return
        const bounds = host.getBoundingClientRect()
        if (bounds.width <= 0) return
        const svgX = (event.clientX - bounds.left) / bounds.width * model.width
        const ratio = Math.max(0, Math.min(1, (svgX - model.plotLeft) / model.plotWidth))
        const day = Math.round(model.minDay + ratio * (model.maxDay - model.minDay))
        this.cursorDate$.set(dayToCivilDate(day), 'line graph pointer moved')
    }

    private cursorKeyDown(event: KeyboardEvent): void {
        const model = this.currentModel
        if (model == null) return
        let day = civilDateToDay(this.cursorDate$.get() ?? model.maxDate)
        if (event.key === 'ArrowLeft') day -= event.shiftKey ? 7 : 1
        else if (event.key === 'ArrowRight') day += event.shiftKey ? 7 : 1
        else if (event.key === 'Home') day = model.minDay
        else if (event.key === 'End') day = model.maxDay
        else if (event.key === 'Escape') {
            event.preventDefault()
            this.cursorDate$.set(null, 'line graph cursor cleared')
            return
        } else return
        event.preventDefault()
        const date = dayToCivilDate(Math.max(model.minDay, Math.min(model.maxDay, day)))
        this.cursorDate$.set(date, 'line graph cursor moved by keyboard')
    }

    private drawChart(): void {
        const host = this.chartHost
        const model = this.currentModel
        if (host == null || model == null) return
        const smooth = this.props.smooth$.get()
        const svg = createSvg('svg')
        svg.setAttribute('viewBox', `0 0 ${model.width} ${model.height}`)
        svg.setAttribute('role', 'img')
        svg.setAttribute('aria-label', this.props.label ?? 'History chart')

        for (const tick of model.valueTicks) {
            const line = createSvg('line')
            line.dataset.part = 'grid'
            setAttributes(line, {
                x1: model.plotLeft,
                x2: model.plotLeft + model.plotWidth,
                y1: tick.y,
                y2: tick.y,
            })
            svg.append(line)
            const label = createSvg('text')
            label.dataset.part = 'axis-label'
            setAttributes(label, {x: model.plotLeft - 8, y: tick.y + 4, 'text-anchor': 'end'})
            label.textContent = String(tick.value)
            svg.append(label)
        }
        for (const mark of model.dateMarks) {
            const line = createSvg('line')
            line.dataset.part = 'grid'
            setAttributes(line, {
                x1: mark.x,
                x2: mark.x,
                y1: model.plotTop,
                y2: model.plotTop + model.plotHeight,
            })
            svg.append(line)
            const label = createSvg('text')
            label.dataset.part = 'axis-label'
            setAttributes(label, {
                x: mark.x,
                y: model.plotTop + model.plotHeight + 22,
                'text-anchor': 'middle',
            })
            label.textContent = mark.date
            svg.append(label)
        }
        for (const series of model.series) {
            if (model.stacked) {
                const area = createSvg('path')
                area.dataset.part = 'series-area'
                area.dataset.colorKey = series.colorKey ?? ''
                area.setAttribute('fill', series.color)
                area.setAttribute('d', areaPath(series.points, smooth))
                svg.append(area)
            }
            const path = createSvg('path')
            path.dataset.part = 'series-line'
            path.dataset.colorKey = series.colorKey ?? ''
            path.setAttribute('stroke', series.color)
            path.setAttribute('d', linePath(series.points, smooth))
            svg.append(path)
        }
        const cursor = this.cursorDate$.get()
        if (cursor != null) {
            const day = civilDateToDay(cursor)
            const x = model.plotLeft
                + (day - model.minDay) / Math.max(1, model.maxDay - model.minDay)
                * model.plotWidth
            const line = createSvg('line')
            line.dataset.part = 'cursor'
            setAttributes(line, {
                x1: x,
                x2: x,
                y1: model.plotTop,
                y2: model.plotTop + model.plotHeight,
            })
            svg.append(line)
        }
        host.replaceChildren(svg)
    }
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

function createSvg<TName extends keyof SVGElementTagNameMap>(
    name: TName,
): SVGElementTagNameMap[TName] {
    return document.createElementNS(SVG_NAMESPACE, name)
}

function setAttributes(element: Element, attributes: Readonly<Record<string, string | number>>): void {
    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, String(value))
    }
}
