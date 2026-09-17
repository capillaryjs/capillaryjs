import type {ValueSnapshot} from './types.js'

/** Copies descriptors into a bounded immutable tree; never retains the source. */
export function captureValueSnapshot(value: unknown, limits: {depth: number; entries: number; text: number}): ValueSnapshot {
    let remaining = limits.entries
    const ancestors = new WeakSet<object>()
    const node = (type: string, text: string, extra: Partial<ValueSnapshot> = {}): ValueSnapshot =>
        Object.freeze({type, text: text.slice(0, limits.text),
            ...(text.length > limits.text ? {truncated: true} : {}), ...extra})
    const visit = (current: unknown, depth: number): ValueSnapshot => {
        if (current === null) return node('null', 'null')
        if (typeof current !== 'object') {
            return node(typeof current, typeof current === 'string' ? JSON.stringify(current)
                : typeof current === 'function' ? '[function]' : String(current))
        }
        if (ancestors.has(current)) return node('reference', '[Circular reference]')
        try {
            const array = Array.isArray(current)
            const type = array ? 'array' : 'object'
            const length = array ? Object.getOwnPropertyDescriptor(current, 'length')?.value : undefined
            const summary = array ? `Array(${typeof length === 'number' ? length : '?'})` : 'Object'
            if (depth >= limits.depth) return node(type, `${summary} [depth limit]`, {truncated: true})
            if (remaining === 0) return node(type, `${summary} [entry limit]`, {truncated: true})
            ancestors.add(current)
            try {
                const keys = Reflect.ownKeys(current).filter((key) => !array || key !== 'length')
                const entries: Array<{readonly key: string; readonly value: ValueSnapshot}> = []
                for (const key of keys) {
                    if (remaining === 0) break
                    remaining -= 1
                    let child: ValueSnapshot
                    try {
                        const descriptor = Object.getOwnPropertyDescriptor(current, key)
                        child = !descriptor ? node('unavailable', '[Property unavailable]')
                            : 'value' in descriptor ? visit(descriptor.value, depth + 1)
                                : node('accessor', '[Accessor not invoked]')
                    } catch { child = node('unavailable', '[Capture failed]') }
                    const name = String(key)
                    entries.push(Object.freeze({key: name.length > limits.text ? `${name.slice(0, limits.text - 1)}…` : name, value: child}))
                }
                return node(type, summary, {entries: Object.freeze(entries),
                    ...(entries.length < keys.length ? {truncated: true} : {})})
            } finally { ancestors.delete(current) }
        } catch { return node('unavailable', '[Capture failed]') }
    }
    return visit(value, 0)
}
