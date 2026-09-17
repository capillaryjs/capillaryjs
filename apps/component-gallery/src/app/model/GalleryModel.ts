import {DerivedEmitter, Emitter, FetchState} from '@capillaryjs/capillary'
import type {FetchStateValue} from '@capillaryjs/capillary'
import {createQueryTableDataSource} from '@capillaryjs/capillary-ui'
import type {Key, TableDataSource} from '@capillaryjs/capillary-ui'
import {createBlockSelection, createSplitSelection, staticCriterion} from '@capillaryjs/capillary-viz'

export type LayoutVariant = 'shell' | 'website'
/** The gallery distinguishes a refresh from a load that replaces visible data. */
export type GalleryDataState = FetchStateValue | 'loading-replace'

export interface GalleryDataItem {
    [field: string]: unknown
    id: string
    name: string
    label: string
    team: string
    status: string
    children?: readonly GalleryDataItem[]
}

export const galleryData = Object.freeze<readonly GalleryDataItem[]>([
    {
        id: 'runtime',
        name: 'Runtime',
        label: 'Runtime',
        team: 'Platform',
        status: 'Stable',
        children: [
            {id: 'rendering', name: 'Rendering', label: 'Rendering', team: 'Platform', status: 'Stable'},
            {id: 'routing', name: 'Routing', label: 'Routing', team: 'Platform', status: 'Review'},
        ],
    },
    {
        id: 'controls',
        name: 'Controls',
        label: 'Controls',
        team: 'Capillary UI',
        status: 'Active',
        children: [
            {id: 'inputs', name: 'Line inputs', label: 'Line inputs', team: 'Capillary UI', status: 'Active'},
            {id: 'data', name: 'Data views', label: 'Data views', team: 'Capillary UI', status: 'Active'},
        ],
    },
    {id: 'visuals', name: 'Visualization', label: 'Visualization', team: 'Capillary UI', status: 'Stable'},
    {id: 'forms', name: 'Forms', label: 'Forms', team: 'Capillary UI', status: 'Review'},
    {id: 'navigation', name: 'Navigation', label: 'Navigation', team: 'Platform', status: 'Stable'},
    {id: 'data-services', name: 'Data services', label: 'Data services', team: 'Platform', status: 'Active'},
    {id: 'themes', name: 'Themes', label: 'Themes', team: 'Capillary UI', status: 'Review'},
    {id: 'diagnostics', name: 'Diagnostics', label: 'Diagnostics', team: 'Platform', status: 'Active'},
    {id: 'charts', name: 'Charts', label: 'Charts', team: 'Capillary UI', status: 'Stable'},
    {id: 'localization', name: 'Localization', label: 'Localization', team: 'Capillary UI', status: 'Review'},
    {id: 'commands', name: 'Commands', label: 'Commands', team: 'Platform', status: 'Active'},
])

/**
 * Central reactive model for the component gallery shell. Gallery pages read
 * the shared data-state and component-state emitters so the toolbar controls
 * apply to every showcased component at once.
 */
export class GalleryModel {
    readonly layoutVariant = new Emitter<LayoutVariant>('shell', {
        owner: this,
        purpose: 'layout variant',
    })
    readonly activePage = new Emitter<Key | null>('line-inputs', {
        owner: this,
        purpose: 'active gallery page',
    })
    readonly themeSelection = new Emitter('shiny', {
        owner: this,
        purpose: 'theme selection',
    })
    readonly colorSelection = new Emitter('iceblue', {
        owner: this,
        purpose: 'color selection',
    })
    readonly lastAction = new Emitter('Gallery ready', {
        owner: this,
        purpose: 'status message',
    })

    /** Selected fetch state applied to the shared gallery data emitter. */
    readonly dataState = new Emitter<GalleryDataState>(FetchState.Ready, {
        owner: this,
        purpose: 'gallery data state',
    })
    /** Shared rows used by the data-component page, including retained refresh values. */
    readonly dataItems = new Emitter<readonly GalleryDataItem[] | undefined, Error>(galleryData, {
        owner: this,
        purpose: 'gallery data-component items',
    })
    /** Block selection needs an array value, while collection views accept an absent loading value. */
    readonly blockItems = new DerivedEmitter(
        [this.dataItems] as const,
        ([items]): readonly GalleryDataItem[] => items ?? [],
        {owner: this, purpose: 'gallery block items'},
    )
    readonly tableDataSource: TableDataSource<GalleryDataItem>
    readonly blockCriteria = (['team', 'status'] as const).map((field) =>
        staticCriterion<GalleryDataItem>({
            key: field,
            label: field === 'team' ? 'Team' : 'Status',
            categories: [...new Set(galleryData.map((item) => item[field]))].map((value) => ({
                key: value,
                label: value,
                predicate: (item: GalleryDataItem) => item[field] === value,
                colors: ['var(--colored-dark)', 'var(--colored-base)', 'var(--colored-light)'],
            })),
        }))
    readonly blockSplits = createSplitSelection(this.blockCriteria)
    readonly blockSelection = createBlockSelection(this.blockItems, this.blockSplits.activeSplits$)
    private readonly dataStateUnsubscribe: () => void

    // Component-state flags applied to showcased controls.
    readonly componentDisabled = new Emitter(false, {
        owner: this,
        purpose: 'component disabled state',
    })
    readonly componentRequired = new Emitter(false, {
        owner: this,
        purpose: 'component required state',
    })
    readonly componentReadOnly = new Emitter(false, {
        owner: this,
        purpose: 'component read-only state',
    })
    readonly componentBusyFlag = new Emitter(false, {
        owner: this,
        purpose: 'component busy override',
    })
    readonly componentErrorFlag = new Emitter(false, {
        owner: this,
        purpose: 'component error override',
    })
    readonly componentBusy: DerivedEmitter<boolean, readonly [
        typeof this.componentBusyFlag,
        typeof this.dataItems,
    ]>
    readonly componentError: DerivedEmitter<string | null, readonly [
        typeof this.componentErrorFlag,
        typeof this.dataItems,
    ]>

    constructor() {
        this.componentBusy = new DerivedEmitter(
            [this.componentBusyFlag, this.dataItems] as const,
            ([override]): boolean => override
                || this.dataItems.getFetchState() === FetchState.Loading,
            {owner: this, purpose: 'component busy state'},
        )
        this.componentError = new DerivedEmitter(
            [this.componentErrorFlag, this.dataItems] as const,
            ([override]): string | null => {
                if (override) return 'Validation failed'
                if (this.dataItems.getFetchState() !== FetchState.Error) return null
                const error = this.dataItems.getError()
                return error instanceof Error
                    ? error.message
                    : (error == null ? 'Data service failure' : String(error))
            },
            {owner: this, purpose: 'component error'},
        )
        this.dataStateUnsubscribe = this.dataState.subscribe(({value: state}) => {
            if (state === FetchState.Initial) {
                this.dataItems.setWithState(undefined, FetchState.Initial)
            } else if (state === FetchState.Loading) {
                // Replacement loading clears the displayed value. Returning to
                // refresh restores the gallery's retained result so this mode
                // continues to demonstrate busy-but-visible collections.
                this.dataItems.setWithState(this.dataItems.get() ?? galleryData, FetchState.Loading)
            } else if (state === 'loading-replace') {
                this.dataItems.setWithState(undefined, FetchState.Loading)
            } else if (state === FetchState.Error) {
                this.dataItems.setWithState(
                    this.dataItems.get(),
                    FetchState.Error,
                    new Error('Simulated data service failure'),
                )
            } else {
                this.dataItems.setWithState(galleryData, FetchState.Ready)
            }
        })
        const retryableQuery = Object.assign(this.dataItems, {
            retry: (cause?: unknown) => {
                this.dataState.set(FetchState.Loading, cause)
                queueMicrotask(() => this.dataState.set(FetchState.Ready, 'gallery retry complete'))
            },
        })
        this.tableDataSource = createQueryTableDataSource({query: retryableQuery, owner: this})
    }

    resetTableState(): void {
        this.tableDataSource.sortEmitter.set(null, 'gallery table state reset')
        this.tableDataSource.filtersEmitter.set({}, 'gallery table state reset')
    }

    dispose(): void {
        const emitters = [
            this.layoutVariant,
            this.activePage,
            this.themeSelection,
            this.colorSelection,
            this.lastAction,
            this.dataState,
            this.dataItems,
            this.blockItems,
            this.componentDisabled,
            this.componentRequired,
            this.componentReadOnly,
            this.componentBusyFlag,
            this.componentErrorFlag,
            this.componentBusy,
            this.componentError,
        ]
        this.dataStateUnsubscribe()
        this.tableDataSource.dispose()
        this.blockSelection.dispose()
        this.blockSplits.dispose()
        for (const criterion of this.blockCriteria) criterion.dispose()
        for (const emitter of emitters) emitter.dispose()
    }
}
