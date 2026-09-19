import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import test from 'node:test'

const sourceRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))

test('prepares independently versioned metadata and records an unstaged candidate tree', () => {
    const fixture = createFixture()
    const plan = releasePlan([
        {key: 'capillary', version: '0.5.1', tag: 'latest'},
        {key: 'capillaryUi', version: '0.6.0', tag: 'latest'},
    ])
    const result = invoke(fixture, plan)

    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.state, 'prepared')
    assert.match(report.treeFingerprint, /^[0-9a-f]{40}$/)
    assert.deepEqual(report.changedPaths, [
        'packages/capillary-ui/CHANGELOG.md',
        'packages/capillary-ui/package.json',
        'packages/capillary/CHANGELOG.md',
        'packages/capillary/package.json',
    ])
    const capillary = readJson(fixture, 'packages/capillary/package.json')
    const capillaryUi = readJson(fixture, 'packages/capillary-ui/package.json')
    assert.equal(capillary.version, '0.5.1')
    assert.equal(capillaryUi.version, '0.6.0')
    assert.equal(capillaryUi.peerDependencies['@capillaryjs/capillary'], '^0.5.1')
    assert.match(readFileSync(path.join(fixture, 'packages/capillary-ui/CHANGELOG.md'), 'utf8'), /## 0\.6\.0 - 2026-09-05/)
})

test('re-running an exact plan is safe and preserves the candidate fingerprint', () => {
    const fixture = createFixture()
    const plan = releasePlan([{key: 'capillary', version: '0.5.1', tag: 'latest'}])
    const first = JSON.parse(invoke(fixture, plan).stdout)
    const second = JSON.parse(invoke(fixture, plan).stdout)

    assert.equal(second.state, 'already-prepared')
    assert.equal(second.treeFingerprint, first.treeFingerprint)
})

test('refuses preparation when unrelated framework changes are present', () => {
    const fixture = createFixture()
    writeFileSync(path.join(fixture, 'unrelated.txt'), 'nope\n')
    const result = invoke(fixture, releasePlan([{key: 'capillary', version: '0.5.1', tag: 'latest'}]))

    assert.equal(result.status, 1)
    assert.match(result.stderr, /unrelated changes: unrelated\.txt/)
})

test('refuses a stale target heading instead of reusing it as current release notes', () => {
    const fixture = createFixture()
    const filename = path.join(fixture, 'packages/capillary/CHANGELOG.md')
    writeFileSync(filename, `# Changelog

## Unreleased

### Fixed

- Current release note.

## 0.5.1 - 2026-09-01

### Added

- Historical release note.
`)
    git(fixture, ['add', '.'])
    git(fixture, ['commit', '-m', 'historical target heading'])

    const result = invoke(fixture, releasePlan([{key: 'capillary', version: '0.5.1', tag: 'latest'}]))

    assert.equal(result.status, 1)
    assert.match(result.stderr, /already contains 0\.5\.1 while Unreleased has substantive notes/)
    assert.equal(readJson(fixture, 'packages/capillary/package.json').version, '0.5.0')
})

test('missing notes require an exact exception and remain valid on repeated preparation', () => {
    const fixture = createFixture()
    const filename = path.join(fixture, 'packages/capillary/CHANGELOG.md')
    const contents = '# Changelog\n\n## Unreleased\n\n### Added\n\n- TBD\n'
    writeFileSync(filename, contents)
    git(fixture, ['add', '.'])
    git(fixture, ['commit', '-m', 'empty notes'])
    const entry = {key: 'capillary', version: '0.5.1', tag: 'latest'}
    const refused = invoke(fixture, releasePlan([entry]))
    assert.equal(refused.status, 1)
    assert.match(refused.stderr, /explicit missing-notes approval required/)
    assert.equal(readJson(fixture, 'packages/capillary/package.json').version, '0.5.0')
    entry.missingNotesApproval = createHash('sha256').update(contents).digest('hex')
    const result = invoke(fixture, releasePlan([entry]))
    assert.equal(result.status, 0, result.stderr)
    assert.match(readFileSync(filename, 'utf8'), /## 0\.5\.1 - 2026-09-05\n\nRelease notes omitted with maintainer approval\./)
    const recovered = invoke(fixture, releasePlan([entry]))
    assert.equal(recovered.status, 0, recovered.stderr)
    assert.equal(JSON.parse(recovered.stdout).treeFingerprint, JSON.parse(result.stdout).treeFingerprint)
})

test('a stale missing-notes approval cannot prepare a changed changelog', () => {
    const fixture = createFixture()
    const filename = path.join(fixture, 'packages/capillary/CHANGELOG.md')
    writeFileSync(filename, '# Changelog\n\n## Unreleased\n')
    git(fixture, ['add', '.'])
    git(fixture, ['commit', '-m', 'empty notes'])
    const result = invoke(fixture, releasePlan([{key: 'capillary', version: '0.5.1', tag: 'latest', missingNotesApproval: '0'.repeat(64)}]))
    assert.equal(result.status, 1)
    assert.equal(readJson(fixture, 'packages/capillary/package.json').version, '0.5.0')
})

function createFixture() {
    const root = mkdtempSync(path.join(os.tmpdir(), 'prepare-release-'))
    mkdirSync(path.join(root, 'scripts'), {recursive: true})
    for (const {directory, name} of [
        {directory: 'capillary', name: '@capillaryjs/capillary'},
        {directory: 'capillary-ui', name: '@capillaryjs/capillary-ui'},
        {directory: 'capillary-viz', name: '@capillaryjs/capillary-viz'},
        {directory: 'capillary-devtools', name: '@capillaryjs/capillary-devtools'},
    ]) {
        mkdirSync(path.join(root, 'packages', directory), {recursive: true})
        writeFileSync(path.join(root, 'packages', directory, 'package.json'), JSON.stringify({
            name,
            version: '0.5.0',
            peerDependencies: directory === 'capillary-ui' ? {'@capillaryjs/capillary': '^0.5.0'}
                : directory === 'capillary-viz' || directory === 'capillary-devtools' ? {
                    '@capillaryjs/capillary': '^0.5.0', '@capillaryjs/capillary-ui': '^0.5.0',
                } : undefined,
        }, null, 2) + '\n')
        writeFileSync(path.join(root, 'packages', directory, 'CHANGELOG.md'),
            '# Changelog\n\n## Unreleased\n\n### Added\n\n- Fixture release note.\n')
    }
    cpSync(path.join(sourceRoot, 'scripts', 'prepare-release.mjs'), path.join(root, 'scripts', 'prepare-release.mjs'))
    cpSync(path.join(sourceRoot, 'scripts', 'release-metadata.mjs'), path.join(root, 'scripts', 'release-metadata.mjs'))
    git(root, ['init', '--initial-branch=main'])
    git(root, ['config', 'user.email', 'release-test@example.invalid'])
    git(root, ['config', 'user.name', 'Release Test'])
    git(root, ['add', '.'])
    git(root, ['commit', '-m', 'fixture'])
    return root
}

test('DevTools release requires its framework updates and prepares both peer ranges', () => {
    const fixture = createFixture()
    const alone = invoke(fixture, releasePlan([{key: 'capillaryDevtools', version: '1.0.0', tag: 'latest'}]))
    assert.equal(alone.status, 1)
    assert.match(alone.stderr, /requires Capillary 1.2 or later/)
    const result = invoke(fixture, releasePlan([
        {key: 'capillary', version: '1.2.0', tag: 'latest'},
        {key: 'capillaryUi', version: '1.2.0', tag: 'latest'},
        {key: 'capillaryDevtools', version: '1.0.0', tag: 'latest'},
    ]))
    assert.equal(result.status, 0, result.stderr)
    const manifest = readJson(fixture, 'packages/capillary-devtools/package.json')
    assert.deepEqual(manifest.peerDependencies, {'@capillaryjs/capillary': '^1.2.0', '@capillaryjs/capillary-ui': '^1.2.0'})
})

function releasePlan(packages) {
    return JSON.stringify({schemaVersion: 1, releaseDate: '2026-09-05', packages})
}

function invoke(root, plan) {
    return spawnSync(process.execPath, [
        path.join(root, 'scripts', 'prepare-release.mjs'), 'prepare', '--release-plan', plan,
    ], {cwd: root, encoding: 'utf8'})
}

test('read-only plan declares before and after images and check cannot rewrite drifted metadata', () => {
    const fixture = createFixture()
    const plan = releasePlan([{key: 'capillary', version: '0.5.1', tag: 'latest'}])
    const planned = spawnSync(process.execPath, [path.join(fixture, 'scripts/prepare-release.mjs'), 'plan', '--release-plan', plan], {cwd: fixture, encoding: 'utf8'})
    assert.equal(planned.status, 0, planned.stderr)
    const report = JSON.parse(planned.stdout)
    assert.equal(report.edits.length, 2)
    assert.equal(readJson(fixture, 'packages/capillary/package.json').version, '0.5.0')
    const checked = spawnSync(process.execPath, [path.join(fixture, 'scripts/prepare-release.mjs'), 'check', '--release-plan', plan], {cwd: fixture, encoding: 'utf8'})
    assert.equal(checked.status, 1)
    assert.equal(readJson(fixture, 'packages/capillary/package.json').version, '0.5.0')
    assert.equal(spawnSync('git', ['status', '--porcelain'], {cwd: fixture, encoding: 'utf8'}).stdout, '')
})

test('explicit corrections include dirty source in the fingerprint without staging it', () => {
    const fixture = createFixture()
    const plan = releasePlan([{key: 'capillary', version: '0.5.1', tag: 'latest'}])
    const prepared = invoke(fixture, plan)
    assert.equal(prepared.status, 0, prepared.stderr)
    writeFileSync(path.join(fixture, 'fix with spaces.txt'), 'source correction\n')
    const corrected = spawnSync(process.execPath, [path.join(fixture, 'scripts/prepare-release.mjs'), 'check', '--release-plan', plan, '--include-corrections'], {cwd: fixture, encoding: 'utf8'})
    assert.equal(corrected.status, 0, corrected.stderr)
    assert.notEqual(JSON.parse(corrected.stdout).treeFingerprint, JSON.parse(prepared.stdout).treeFingerprint)
    assert.ok(JSON.parse(corrected.stdout).changedPaths.includes('fix with spaces.txt'))
    assert.equal(spawnSync('git', ['diff', '--cached', '--name-only'], {cwd: fixture, encoding: 'utf8'}).stdout, '')
})

function readJson(root, relativePath) {
    return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'))
}

function git(root, args) {
    const result = spawnSync('git', args, {cwd: root, encoding: 'utf8'})
    assert.equal(result.status, 0, result.stderr)
}
