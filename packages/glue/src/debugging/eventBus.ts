import type {EventBubble} from './eventBubble.js'

export type EventListener = (event: EventBubble<unknown>) => void

export interface BubbleGraph {
    addBubble(event: EventBubble<unknown>): void
}

const listeners = new Set<EventListener>()

function subscribe(listener: EventListener): () => void {
    if (typeof listener !== 'function') {
        throw new TypeError('EventBus.subscribe requires a function')
    }

    listeners.add(listener)
    let active = true
    return () => {
        if (!active) return
        active = false
        listeners.delete(listener)
    }
}

function emit(event: EventBubble<unknown>): void {
    for (const listener of [...listeners]) listener(event)
}

/** Process-local diagnostic observer that retains no event history. */
export const EventBus = Object.freeze({
    subscribe,
    emit,
    emitBubble: emit,
    registerBubbleGraph(graph: BubbleGraph): () => void {
        if (graph == null || typeof graph.addBubble !== 'function') {
            throw new TypeError('registerBubbleGraph requires an addBubble() method')
        }
        return subscribe((event) => graph.addBubble(event))
    },
    get hasSubscribers(): boolean {
        return listeners.size > 0
    },
    get subscriberCount(): number {
        return listeners.size
    },
})
