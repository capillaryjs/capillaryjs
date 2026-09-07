import {FetchState} from '@sylwellsoftware/glue'
import type {ReadableEmitter} from '@sylwellsoftware/glue'
import {
    Checkbox,
    GroupPanel,
    css,
    h,
} from '@sylwellsoftware/fray'
import type {FrayChild, GroupPanelBaseProps} from '@sylwellsoftware/fray'

import type {CategoryVisibility} from '../grouping.js'
import {categoryColorVariables, GroupingCriterion} from '../grouping.js'

const visibilitySymbols = [
    ['☐', 'hidden'],
    ['✓', 'visible'],
] as const

export interface CategoryHidePanelProps<TItem> extends GroupPanelBaseProps {
    readonly items$: ReadableEmitter<readonly TItem[]>
    readonly criteria: readonly GroupingCriterion<TItem>[]
    readonly label?: string
    readonly description?: string
    readonly initiallyOpen?: (criterion: GroupingCriterion<TItem>) => boolean
}

/** Show/hide controls with live counts against the unfiltered item source. */
export class CategoryHidePanel<TItem = unknown>
extends GroupPanel<CategoryHidePanelProps<TItem>> {
    static override liveProps: readonly string[] = []
    render(): FrayChild {
        const {
            criteria,
            label = 'Show or hide categories',
            description = '',
            initiallyOpen = () => true,
        } = this.props
        const itemSnapshot = this.snapshot(this.props.items$)
        const items = Array.isArray(itemSnapshot.value) ? itemSnapshot.value : []
        return this.renderGroupPanel(label,
            h('fray-categoryhidecontent', null,
                <p>{description}</p>,
                itemSnapshot.fetchState === FetchState.Error
                    ? <p role="alert">Category counts are unavailable.</p>
                    : null,
                h('fray-criteriongroups', null, criteria.map((criterion) => {
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
                        {h('fray-categorygroupcontent', null,
                            categorySnapshot.fetchState === FetchState.Error
                                ? <p role="alert">{criterion.label} categories are unavailable.</p>
                                : null,
                            categorySnapshot.fetchState !== FetchState.Ready
                                ? <p role="status" aria-live="polite">Loading {criterion.label}…</p>
                                : null,
                            h('fray-categories', null, categories.map((category) => {
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
                            })),
                        )}
                    </details>
                })),
            ),
        )
    }

    static override hostName = 'category-hide-panel'
    static dependencies = [Checkbox]

    static css = css`
        & {
            flex: 0 0 auto;
            min-width: 0;
        }
        

        & > fray-content > fray-categoryhidecontent {
            display: grid;
            align-content: start;
            gap: var(--viz-space, 0.6rem);
            min-width: 0;
        }

        & > fray-content > fray-categoryhidecontent > p {
            margin: 0;
            color: var(--viz-muted-color, var(--ui-muted-text-color, currentColor));
            font-size: 0.875em;
        }

        & > fray-content > fray-categoryhidecontent > fray-criteriongroups {
            display: grid;
            gap: 1.5em;
            min-width: 0;
        }

        & details {
            min-width: 0;
        }

        & summary {
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-sizing: border-box;
            gap: 0.5rem;
            min-width: 0;
            margin-bottom: 0.5em;
            padding: 0 0 0.25em;
            cursor: pointer;
            border-bottom: 1px solid var(--ui-border-color);
            font-weight: 400;
            font-family: sans-serif;
            font-size: var(--font-size);
            color: var(--palette-neutral-950);
        }

        & summary small {
            font-weight: 400;
            white-space: nowrap;
        }

        & details > fray-categorygroupcontent {
            display: block;
            min-width: 0;
        }

        & details:not([open]) > fray-categorygroupcontent {
            display: none;
        }

        & fray-categories {
            display: flex;
            box-sizing: border-box;
            gap: .31em;
            min-width: 0;
            flex-flow: column;
            padding: 0;
            overflow: visible;
        }

        & fray-categoryoption {
            display: flex;
            flex-flow: row nowrap;
            align-items: center;
            gap: 0.45rem;
            min-width: 0;
            max-height: 1em;
        }

        & fray-categoryswatch {
            display: block;
            width: 0.9rem;
            height: 0.9rem;
            border: 1px solid var(--c1);
            border-radius: 0.2rem;
            background: linear-gradient(15deg, var(--c1) 0%, var(--c2) 65%, var(--c2) 65%, var(--c3) 100%);
        }

        & fray-categoryoption:has(input:not(:checked)) > fray-categoryswatch {
            opacity: 0.22;
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
