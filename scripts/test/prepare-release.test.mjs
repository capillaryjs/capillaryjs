import assert from 'node:assert/strict'
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

function readJson(root, relativePath) {
    return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'))
}

function git(root, args) {
    const result = spawnSync('git', args, {cwd: root, encoding: 'utf8'})
    assert.equal(result.status, 0, result.stderr)
}
