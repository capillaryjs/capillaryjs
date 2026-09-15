import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const root = new URL('../dist/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('.vite/manifest.json', root), 'utf8'))
const visited = new Set()
function reachable(key) {
    if (visited.has(key)) return ''
    visited.add(key)
    const entry = manifest[key]
    assert(entry, `Missing manifest entry: ${key}`)
    return readFileSync(new URL(entry.file, root), 'utf8')
        + (entry.imports ?? []).map(reachable).join('\n')
}
const compact = reachable('compact.html')
for (const marker of ['traceinspector', 'causaltrace', 'chronologicaltrace', 'tracetimeline', 'traceactivity']) {
    assert(!compact.includes(marker), `Compact entry unexpectedly includes ${marker}`)
}
assert(compact.includes('traceflow'), 'Compact graph is missing')
console.log('[bundle] Compact composition excludes inspector, outline, chronology, timeline, and activity modules')
