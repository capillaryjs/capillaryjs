import {FetchState} from '@sylwellsoftware/glue'
import type {ReadableEmitter} from '@sylwellsoftware/glue'
import {
    Button,
    Checkbox,
    Component,
    Toolbar,
    css,
} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'

import type {CategoryVisibility} from '../grouping.js'
import {GroupingCriterion} from '../grouping.js'

const visibilitySymbols = [
    ['☐', 'hidden'],
    ['✓', 'visible'],
] as const

export interface CategoryHidePanelProps<TItem> extends ComponentProps {
    readonly items$: ReadableEmitter<readonly TItem[]>
    readonly criteria: readonly GroupingCriterion<TItem>[]
    readonly label?: string
    readonly description?: string
    readonly initiallyOpen?: (criterion: GroupingCriterion<TItem>) => boolean
}

/** Show/hide controls with live counts against the unfiltered item source. */
export class CategoryHidePanel<TItem = unknown>
extends Component<CategoryHidePanelProps<TItem>> {
    render(): FrayChild {
        const {
            criteria,
            label = 'Show or hide categories',
            description = 'Hidden categories are excluded from every connected visualization.',
            initiallyOpen = () => true,
        } = this.props
        const itemSnapshot = this.snapshot(this.props.items$)
        const items = Array.isArray(itemSnapshot.value) ? itemSnapshot.value : []
        return <section data-fray-visualization="category-hide-panel" aria-label={label}>
            <header>
                <h2>{label}</h2>
                <p>{description}</p>
            </header>
            {itemSnapshot.fetchState === FetchState.Error
                ? <p role="alert">Category counts are unavailable.</p>
                : null}
            <div data-part="criterion-groups">{criteria.map((criterion) => {
                const categorySnapshot = this.snapshot(criterion.categories$)
                const hidden = this.read(criterion.hidden$)
                const categories = Array.isArray(categorySnapshot.value)
                    ? categorySnapshot.value
                    : []
                const visibleCount = categories.filter(({key}) => !hidden.has(key)).length
                return <details key={criterion.key} open={initiallyOpen(criterion)}>
                    <summary>
                        <span>{criterion.label}</span>
                        <small>{visibleCount}/{categories.length} visible</small>
                    </summary>
                    <Toolbar label={`${criterion.label} category actions`}>
                        <Button
                            label="Show all"
                            ariaLabel={`Show all ${criterion.label} categories`}
                            disabled={categories.length === visibleCount}
                            onClick={() => criterion.setAllVisible(true)}
                        />
                        <Button
                            label="Hide all"
                            ariaLabel={`Hide all ${criterion.label} categories`}
                            disabled={categories.length === 0 || visibleCount === 0}
                            onClick={() => criterion.setAllVisible(false)}
                        />
                    </Toolbar>
                    {categorySnapshot.fetchState === FetchState.Error
                        ? <p role="alert">{criterion.label} categories are unavailable.</p>
                        : null}
                    {categorySnapshot.fetchState !== FetchState.Ready
                        ? <p role="status" aria-live="polite">Loading {criterion.label}…</p>
                        : null}
                    <div data-part="categories">{categories.map((category) => {
                        const count = countMatches(items, category.predicate)
                        return <Checkbox<CategoryVisibility>
                            key={category.key}
                            className="fray-visualization-category-checkbox"
                            symbols={visibilitySymbols}
                            label={`${category.label} (${count})`}
                            valueEmitter={criterion.visibility(category.key)}
                        />
                    })}</div>
                </details>
            })}</div>
        </section>
    }

    static dependencies = [Button, Checkbox, Toolbar]

    static css = css`
        section[data-fray-visualization="category-hide-panel"] {
            display: grid;
            align-content: start;
            gap: var(--fray-viz-space, 0.6rem);
            min-width: 0;
            color: var(--fray-viz-color, var(--fray-ui-color, var(--ui-text-color)));
        }

        section[data-fray-visualization="category-hide-panel"] h2,
        section[data-fray-visualization="category-hide-panel"] p {
            margin: 0;
        }

        section[data-fray-visualization="category-hide-panel"] header > p {
            color: var(--fray-viz-muted-color, var(--ui-muted-text-color, currentColor));
            font-size: 0.875em;
        }

        section[data-fray-visualization="category-hide-panel"] [data-part="criterion-groups"] {
            display: grid;
            gap: 0.4rem;
        }

        section[data-fray-visualization="category-hide-panel"] details {
            min-width: 0;
            border: 1px solid var(--fray-viz-border-color, var(--ui-border-color));
            border-radius: var(--fray-viz-radius, var(--ui-border-radius));
        }

        section[data-fray-visualization="category-hide-panel"] summary {
            display: flex;
            justify-content: space-between;
            gap: 0.5rem;
            padding: 0.5rem;
            cursor: pointer;
            font-weight: 650;
        }

        section[data-fray-visualization="category-hide-panel"] summary small {
            font-weight: 400;
            white-space: nowrap;
        }

        section[data-fray-visualization="category-hide-panel"]
        [data-fray-component="toolbar"] {
            padding: 0.35rem 0.5rem;
            border-block: 1px solid var(--fray-viz-border-color, var(--ui-border-color));
            border-inline: 0;
        }

        section[data-fray-visualization="category-hide-panel"] [data-part="categories"] {
            display: grid;
            gap: 0.25rem;
            max-height: var(--fray-viz-category-max-height, 16rem);
            padding: 0.45rem 0.5rem;
            overflow: auto;
        }

        section[data-fray-visualization="category-hide-panel"]
        .fray-visualization-category-checkbox > [data-part="control"] {
            width: 100%;
            justify-content: flex-start;
            text-align: start;
            white-space: normal;
        }
    `
}

function countMatches<TItem>(
    items: readonly TItem[],
    predicate: (item: TItem) => boolean,
): number {
    let count = 0
    for (const item of items) {
        if (predicate(item)) count += 1
    }
    return count
}
