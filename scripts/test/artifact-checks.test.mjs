import assert from 'node:assert/strict'
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {gzipSync} from 'node:zlib'

import {archiveSha256, npmTarStreamSha256} from '../artifact-checks.mjs'

test('npm tar stream identity ignores gzip wrapper metadata', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'artifact-checks-'))
    try {
        const first = path.join(directory, 'first.tgz')
        const second = path.join(directory, 'second.tgz')
        const archive = gzipSync(Buffer.from('deterministic npm tar stream'))
        const alternateWrapper = Buffer.from(archive)
        alternateWrapper[9] = alternateWrapper[9] === 3 ? 0 : 3
        writeFileSync(first, archive)
        writeFileSync(second, alternateWrapper)

        assert.notEqual(archiveSha256(first), archiveSha256(second))
        assert.equal(npmTarStreamSha256(first), npmTarStreamSha256(second))
    } finally {
        rmSync(directory, {recursive: true, force: true})
    }
})
