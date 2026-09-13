import {FetchState} from '@capillaryjs/capillary'
import type {ReadableEmitter} from '@capillaryjs/capillary'
import {
    Checkbox,
    OptionsBox,
    css,
} from '@capillaryjs/capillary-ui'
import type {CapillaryUiChild, GroupBoxBaseProps} from '@capillaryjs/capillary-ui'

import {CollapsibleOptionGroup} from './CollapsibleOptionGroup.js'

import type {CategoryVisibility} from '../grouping.js'
import {categoryColorVariables, GroupingCriterion} from '../grouping.js'

const visibilitySymbols = [
    ['☐', 'hidden'],
    ['✓', 'visible'],
] as const

export interface CategoryHidePanelProps<TItem> extends GroupBoxBaseProps {
    readonly items$: ReadableEmitter<readonly TItem[]>
    readonly criteria: readonly GroupingCriterion<TItem>[]
    readonly label?: string
    readonly description?: string
}

/** Show/hide controls with live counts against the unfiltered item source. */
export class CategoryHidePanel<TItem = unknown>
extends OptionsBox<CategoryHidePanelProps<TItem>> {
    static override liveProps: readonly string[] = []
    render(): CapillaryUiChild {
        const {
            criteria,
            label = 'Show or hide categories',
            description = '',
        } = this.props
        const itemSnapshot = this.snapshot(this.props.items$)
        const items = Array.isArray(itemSnapshot.value) ? itemSnapshot.value : []
        return this.renderGroupBox(label,
            <cap-categoryhidecontent>
                <p>{description}</p>
                {itemSnapshot.fetchState === FetchState.Error
                    ? <p role="alert">Category counts are unavailable.</p>
                    : null}
                <cap-criteriongroups>{criteria.map((criterion) => {
                    const categorySnapshot = this.snapshot(criterion.categories$)
                    const categories = Array.isArray(categorySnapshot.value)
                        ? categorySnapshot.value
                        : []
                    return <CollapsibleOptionGroup
                        key={criterion.key}
                        label={criterion.label}
                    >
                        {categorySnapshot.fetchState === FetchState.Error
                            ? <p role="alert">{criterion.label} categories are unavailable.</p>
                            : null}
                        {categorySnapshot.fetchState !== FetchState.Ready
                            ? <p role="status" aria-live="polite">Loading {criterion.label}…</p>
                            : null}
                        <cap-categories>{categories.map((category) => {
                            const count = countMatches(items, category.predicate)
                            return <cap-categoryoption
                                key={category.key}
                                style={{...categoryColorVariables(category.colors)}}
                            >
                                <cap-categoryswatch aria-hidden="true" />
                                <Checkbox<CategoryVisibility>
                                    symbols={visibilitySymbols}
                                    label={`${category.label} (${count})`}
                                    valueEmitter={criterion.visibility(category.key)}
                                />
                            </cap-categoryoption>
                        })}</cap-categories>
                    </CollapsibleOptionGroup>
                })}</cap-criteriongroups>
            </cap-categoryhidecontent>,
        )
    }

    static override hostName = 'category-hide-panel'
    static dependencies = [Checkbox, CollapsibleOptionGroup]

    static css = css`
        & {
            flex: 0 0 auto;
            min-width: 0;
            user-select: none;
        }

        & > cap-content > cap-categoryhidecontent {
            display: grid;
            align-content: start;
            gap: var(--viz-space, 0.6rem);
            min-width: 0;
        }

        & > cap-content > cap-categoryhidecontent > p {
            margin: 0;
            color: var(--viz-muted-color, var(--ui-muted-text-color, currentColor));
            font-size: 0.875em;
        }

        & > cap-content > cap-categoryhidecontent > cap-criteriongroups {
            display: grid;
            gap: 1em;
            min-width: 0;
        }

        & cap-collapsible-option-group > fieldset > legend small {
            white-space: nowrap;
        }

        & cap-categories {
            display: flex;
            box-sizing: border-box;
            gap: .31em;
            min-width: 0;
            flex-flow: column;
            padding: 0;
            overflow: visible;
        }

        & cap-categoryoption {
            display: flex;
            flex-flow: row nowrap;
            align-items: center;
            gap: 0.45rem;
            min-width: 0;
            max-height: 1em;
        }

        & cap-categoryswatch {
            display: block;
            width: 1rem;
            height: 1rem;
            border: 1px solid var(--c1);
            border-radius: 0.2rem;
            background: linear-gradient(15deg, var(--c1) 0%, var(--c2) 65%, var(--c2) 65%, var(--c3) 100%);
        }

        & cap-categoryoption:has(input:not(:checked)) > cap-categoryswatch {
            opacity: 0.22;
        }

        & cap-categoryoption > cap-checkbox,
        & cap-categoryoption > cap-checkbox > label {
            min-width: 0;
            width: 100%;
            height: unset;
        }

        & cap-categoryoption > cap-checkbox > label {
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
