import {DerivedEmitter, Emitter, FetchState} from '@sylwellsoftware/glue'
import type {FetchStateValue} from '@sylwellsoftware/glue'
import type {Key} from '@sylwellsoftware/fray'

export type LayoutVariant = 'shell' | 'website'

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
    /**
     * Shared data emitter whose fetch state mirrors `dataState`. Selecting the
     * error state raises a simulated load error on the derived value.
     */
    readonly dataSource: DerivedEmitter<string, readonly [typeof this.dataState]>

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
    readonly componentErrorFlag = new Emitter(false, {
        owner: this,
        purpose: 'component error flag',
    })
    readonly componentError: DerivedEmitter<string | null, readonly [
        typeof this.componentErrorFlag,
    ]>

    constructor() {
        this.dataSource = new DerivedEmitter(
            [this.dataState] as const,
            ([state]): string => {
                if (state === FetchState.Error) {
                    throw new Error('Simulated gallery data error')
                }
                return `Gallery data (${state})`
            },
            {
                computeFetchState: (states) => states[0] ?? FetchState.Ready,
                owner: this,
                purpose: 'gallery data',
            },
        )
        this.componentError = new DerivedEmitter(
            [this.componentErrorFlag] as const,
            ([flag]): string | null => flag ? 'Validation failed' : null,
            {owner: this, purpose: 'component error'},
        )
    }

    dispose(): void {
        const emitters = [
            this.layoutVariant,
            this.activePage,
            this.themeSelection,
            this.colorSelection,
            this.lastAction,
            this.dataState,
            this.dataSource,
            this.componentDisabled,
            this.componentRequired,
            this.componentReadOnly,
            this.componentErrorFlag,
            this.componentError,
        ]
        for (const emitter of emitters) emitter.dispose()
    }
}
