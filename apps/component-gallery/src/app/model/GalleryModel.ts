import {DerivedEmitter, Emitter, FetchState} from '@sylwellsoftware/glue'
import type {FetchStateValue} from '@sylwellsoftware/glue'
import {createQueryTableDataSource} from '@sylwellsoftware/fray'
import type {Key, TableDataSource} from '@sylwellsoftware/fray'

export type LayoutVariant = 'shell' | 'website'

export interface GalleryDataItem {
    [field: string]: unknown
    id: string
    name: string
    label: string
    team: string
    status: string
    children?: readonly GalleryDataItem[]
}

const galleryData = Object.freeze<readonly GalleryDataItem[]>([
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
        team: 'Fray',
        status: 'Active',
        children: [
            {id: 'inputs', name: 'Line inputs', label: 'Line inputs', team: 'Fray', status: 'Active'},
            {id: 'data', name: 'Data views', label: 'Data views', team: 'Fray', status: 'Active'},
        ],
    },
    {id: 'visuals', name: 'Visualization', label: 'Visualization', team: 'Fray', status: 'Stable'},
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
    readonly dataState = new Emitter<FetchStateValue>(FetchState.Ready, {
        owner: this,
        purpose: 'gallery data state',
    })
    /** Shared rows used by the data-component page, including retained refresh values. */
    readonly dataItems = new Emitter<readonly GalleryDataItem[], Error>(galleryData, {
        owner: this,
        purpose: 'gallery data-component items',
    })
    readonly tableDataSource: TableDataSource<GalleryDataItem>
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
    readonly componentBusy = new Emitter(false, {
        owner: this,
        purpose: 'component busy state',
    })
    readonly componentErrorFlag = new Emitter(false, {
        owner: this,
        purpose: 'component error flag',
    })
    readonly componentError: DerivedEmitter<string | null, readonly [
        typeof this.componentErrorFlag,
    ]>

    constructor() {
        this.componentError = new DerivedEmitter(
            [this.componentErrorFlag] as const,
            ([flag]): string | null => flag ? 'Validation failed' : null,
            {owner: this, purpose: 'component error'},
        )
        this.dataStateUnsubscribe = this.dataState.subscribe(({value: state}) => {
            if (state === FetchState.Initial) {
                this.dataItems.setWithState([], FetchState.Initial)
            } else if (state === FetchState.Loading) {
                this.dataItems.setWithState(this.dataItems.get(), FetchState.Loading)
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

    dispose(): void {
        const emitters = [
            this.layoutVariant,
            this.activePage,
            this.themeSelection,
            this.colorSelection,
            this.lastAction,
            this.dataState,
            this.dataItems,
            this.componentDisabled,
            this.componentRequired,
            this.componentReadOnly,
            this.componentBusy,
            this.componentErrorFlag,
            this.componentError,
        ]
        this.dataStateUnsubscribe()
        this.tableDataSource.dispose()
        for (const emitter of emitters) emitter.dispose()
    }
}
