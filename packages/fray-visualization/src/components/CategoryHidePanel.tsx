import {FetchState} from '@sylwellsoftware/glue'
import type {ReadableEmitter} from '@sylwellsoftware/glue'
import {
    Checkbox,
    Component,
    css,
    h,
} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'

import type {CategoryVisibility} from '../grouping.js'
import {categoryColorVariables, GroupingCriterion} from '../grouping.js'

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
    static override liveProps: readonly string[] = []
    render(): FrayChild {
        const {
            criteria,
            label = 'Show or hide categories',
            description = 'Hidden categories are excluded from every connected visualization.',
            initiallyOpen = () => true,
        } = this.props
        const itemSnapshot = this.snapshot(this.props.items$)
        const items = Array.isArray(itemSnapshot.value) ? itemSnapshot.value : []
        const Host = this.Host
        return <Host
            className={(this.props.className ?? this.props.class ?? '') || null}
            aria-label={label}
        >
            <header>
                <h2>{label}</h2>
                <p>{description}</p>
            </header>
            {itemSnapshot.fetchState === FetchState.Error
                ? <p role="alert">Category counts are unavailable.</p>
                : null}
            {h('fray-criteriongroups', null, criteria.map((criterion) => {
                const categorySnapshot = this.snapshot(criterion.categories$)
                const hidden = this.read(criterion.hidden$)
                const categories = Array.isArray(categorySnapshot.value)
                    ? categorySnapshot.value
                    : []
                const visibleCount = categories.filter(({key}) => !hidden.has(key)).length
                return <details
                    key={criterion.key}
                    open={initiallyOpen(criterion)}
                >
                    <summary>
                        <span>{criterion.label}</span>
                        <small>{visibleCount}/{categories.length} visible</small>
                    </summary>
                    {categorySnapshot.fetchState === FetchState.Error
                        ? <p role="alert">{criterion.label} categories are unavailable.</p>
                        : null}
                    {categorySnapshot.fetchState !== FetchState.Ready
                        ? <p role="status" aria-live="polite">Loading {criterion.label}…</p>
                        : null}
                    {h('fray-categories', null, categories.map((category) => {
                        const count = countMatches(items, category.predicate)
                        return h('fray-categoryoption', {
                            key: category.key,
                            style: categoryColorVariables(category.colors),
                        },
                        h('fray-categoryswatch', {'aria-hidden': 'true'}),
                        <Checkbox<CategoryVisibility>
                            symbols={visibilitySymbols}
                            label={`${category.label} (${count})`}
                            valueEmitter={criterion.visibility(category.key)}
                        />)
                    }))}
                </details>
            }))}
        </Host>
    }

    static override hostName = 'category-hide-panel'
    static dependencies = [Checkbox]

    static css = css`
        & {
            display: grid;
            align-content: start;
            box-sizing: border-box;
            flex: 0 0 auto;
            gap: var(--viz-space, 0.6rem);
            min-width: 0;
        }

        & h2,
        & p {
            margin: 0;
        }

        & header > p {
            color: var(--viz-muted-color, var(--ui-muted-text-color, currentColor));
            font-size: 0.875em;
        }

        & > fray-criteriongroups {
            display: grid;
            gap: 0.4rem;
            min-width: 0;
        }

        & details {
            min-width: 0;
            overflow: hidden;
            border: 1px solid var(--ui-border-color);
            border-radius: var(--ui-border-radius);
        }

        & summary {
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-sizing: border-box;
            gap: 0.5rem;
            min-width: 0;
            min-height: 2rem;
            padding: 0.5rem;
            cursor: pointer;
            font-weight: 650;
        }

        & summary small {
            font-weight: 400;
            white-space: nowrap;
        }

        & fray-categories {
            display: grid;
            box-sizing: border-box;
            gap: 0.25rem;
            min-width: 0;
            max-height: var(--viz-category-max-height, 16rem);
            padding: 0.45rem 0.5rem;
            overflow: auto;
        }

        & fray-categoryoption {
            display: grid;
            grid-template-columns: 0.9rem minmax(0, 1fr);
            align-items: center;
            gap: 0.45rem;
            min-width: 0;
        }

        & fray-categoryswatch {
            display: block;
            width: 0.9rem;
            height: 1.35rem;
            border: 1px solid var(--c1);
            border-radius: 0.2rem;
            background: linear-gradient(15deg, var(--c1) 0%, var(--c2) 65%, var(--c2) 65%, var(--c3) 100%);
        }

        & fray-categoryoption:has(input:not(:checked)) > fray-categoryswatch {
            opacity: 0.42;
            filter: saturate(0.45);
        }

        & fray-categoryoption > fray-checkbox,
        & fray-categoryoption > fray-checkbox > label {
            min-width: 0;
            width: 100%;
        }

        & fray-categoryoption > fray-checkbox > label {
            justify-content: flex-start;
            text-align: start;
            white-space: nowrap;
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
