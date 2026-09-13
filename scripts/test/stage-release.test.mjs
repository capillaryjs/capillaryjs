import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import test from 'node:test'

const sourceRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))

test('validates an explicit two-package plan in dependency order', () => {
    const fixture = createFixture()
    const result = invoke(fixture, 'validate', ['capillary', 'capillaryUi'])
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /capillary@0\.1\.0-alpha\.2[\s\S]*capillary-ui@0\.1\.0-alpha\.2/)
    assert.match(result.stdout, /order: @capillaryjs\/capillary -> @capillaryjs\/capillary-ui/)
})

test('validates all three packages in dependency order', () => {
    const fixture = createFixture()
    const result = invoke(fixture, 'validate', ['capillary', 'capillaryUi', 'capillaryViz'])
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /order: @capillaryjs\/capillary -> @capillaryjs\/capillary-ui -> @capillaryjs\/capillary-viz/)
})

test('accepts the optional package-manager argument separator', () => {
    const fixture = createFixture()
    const result = invoke(fixture, 'validate', ['capillary', 'capillaryUi'], {}, {separator: true})
    assert.equal(result.status, 0, result.stderr)
})

test('refuses an already-public version before staging', () => {
    const fixture = createFixture({published: 'capillary'})
    const result = invoke(fixture, 'stage', ['capillary', 'capillaryUi'])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /capillary@0\.1\.0-alpha\.2 is already public/)
    assert.doesNotMatch(readFileSync(fixture.log, 'utf8'), /stage publish/)
})

test('stages Capillary before Capillary UI with no publish or approval command', () => {
    const fixture = createFixture()
    const result = invoke(fixture, 'stage', ['capillary', 'capillaryUi'], {
        GITHUB_ACTIONS: 'true',
        GITHUB_REF: 'refs/heads/main',
    })
    assert.equal(result.status, 0, result.stderr)
    const log = readFileSync(fixture.log, 'utf8')
    const capillary = log.indexOf(path.basename(fixture.capillaryTarball), log.indexOf('stage publish'))
    const capillaryUi = log.indexOf(path.basename(fixture.capillaryUiTarball), capillary + 1)
    assert.ok(capillary >= 0 && capillaryUi > capillary, log)
    assert.doesNotMatch(log, /stage approve|^publish .*\.tgz/m)
})

test('refuses a Capillary UI artifact with a stale Capillary peer range', () => {
    const fixture = createFixture({stalePeer: true})
    const result = invoke(fixture, 'validate', ['capillary', 'capillaryUi'])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /peer-depend on the current Capillary release line/)
})

test('refuses staging outside protected GitHub main or with a long-lived token', () => {
    const fixture = createFixture()
    let result = invoke(fixture, 'stage', ['capillary'], {GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/topic'})
    assert.equal(result.status, 1)
    assert.match(result.stderr, /only from main/)
    result = invoke(fixture, 'stage', ['capillary'], {GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main', NPM_TOKEN: 'fixture'})
    assert.equal(result.status, 1)
    assert.match(result.stderr, /long-lived npm tokens/)
})

test('release workflow has the protected stage-only trust boundary', () => {
    const workflow = readFileSync(path.join(sourceRoot, '.github/workflows/release.yml'), 'utf8')
    assert.match(workflow, /release_plan:/)
    assert.match(workflow, /environment: npm-release/)
    assert.match(workflow, /id-token: write/)
    assert.match(workflow, /node-version: 24/)
    assert.match(workflow, /npm@11\.19\.1/)
    assert.doesNotMatch(workflow, /pnpm release:validate --\s/)
    assert.match(workflow, /stage-release\.mjs stage/)
    assert.doesNotMatch(workflow, /NODE_AUTH_TOKEN|NPM_TOKEN|npm publish|stage approve/)
})

function createFixture({published, stalePeer = false} = {}) {
    const root = mkdtempSync(path.join(os.tmpdir(), 'stage-release-'))
    mkdirSync(path.join(root, 'scripts'), {recursive: true})
    mkdirSync(path.join(root, 'packages', 'capillary'), {recursive: true})
    mkdirSync(path.join(root, 'packages', 'capillary-ui'), {recursive: true})
    mkdirSync(path.join(root, 'packages', 'capillary-viz'), {recursive: true})
    mkdirSync(path.join(root, '.artifacts', 'release', 'packages'), {recursive: true})
    cpSync(path.join(sourceRoot, 'scripts', 'stage-release.mjs'), path.join(root, 'scripts', 'stage-release.mjs'))
    cpSync(path.join(sourceRoot, 'scripts', 'release-metadata.mjs'), path.join(root, 'scripts', 'release-metadata.mjs'))
    const entries = []
    for (const {directory, name} of [
        {directory: 'capillary', name: '@capillaryjs/capillary'},
        {directory: 'capillary-ui', name: '@capillaryjs/capillary-ui'},
        {directory: 'capillary-viz', name: '@capillaryjs/capillary-viz'},
    ]) {
        writeFileSync(path.join(root, 'packages', directory, 'package.json'), JSON.stringify({
            name,
            version: '0.1.0-alpha.2',
            private: false,
            publishConfig: {access: 'public'},
            ...(directory === 'capillary-ui' ? {
                peerDependencies: {
                    '@capillaryjs/capillary': stalePeer ? '^0.1.0-alpha.1' : '^0.1.0-alpha.2',
                },
            } : directory === 'capillary-viz' ? {
                peerDependencies: {
                    '@capillaryjs/capillary': '^0.1.0-alpha.2',
                    '@capillaryjs/capillary-ui': '^0.1.0-alpha.2',
                },
            } : {}),
        }))
        const filename = `capillaryjs-${directory}-0.1.0-alpha.2.tgz`
        const tarball = path.join(root, '.artifacts', 'release', 'packages', filename)
        writeFileSync(tarball, `${directory} artifact`)
        entries.push({
            name,
            version: '0.1.0-alpha.2',
            filename,
            bytes: Buffer.byteLength(`${directory} artifact`),
            sha256: createHash('sha256').update(`${directory} artifact`).digest('hex'),
        })
    }
    writeFileSync(path.join(root, '.artifacts', 'release', 'package-artifacts.json'), JSON.stringify({schemaVersion: 1, packages: entries}))
    const bin = path.join(root, 'bin')
    const log = path.join(root, 'npm.log')
    mkdirSync(bin)
    writeFileSync(log, '')
    writeFileSync(path.join(bin, 'npm'), `#!/bin/sh
printf '%s\\n' "$*" >> "${log}"
if [ "$1" = view ]; then
  case "$2" in
    *${published ?? 'never-match'}*) printf '"0.1.0-alpha.2"\\n'; exit 0 ;;
    *) printf 'npm ERR! code E404\\n' >&2; exit 1 ;;
  esac
fi
exit 0
`)
    chmodSync(path.join(bin, 'npm'), 0o755)
    return {
        root,
        log,
        capillaryTarball: path.join(root, '.artifacts', 'release', 'packages', entries[0].filename),
        capillaryUiTarball: path.join(root, '.artifacts', 'release', 'packages', entries[1].filename),
        visualizationTarball: path.join(
            root,
            '.artifacts',
            'release',
            'packages',
            entries[2].filename,
        ),
        path: `${bin}:${process.env.PATH}`,
    }
}

function invoke(fixture, command, keys, extraEnv = {}, {separator = false} = {}) {
    const separatorArgument = separator ? ['--'] : []
    const releasePlan = JSON.stringify({
        schemaVersion: 1,
        releaseDate: '2026-09-05',
        packages: keys.map((key) => ({key, version: '0.1.0-alpha.2', tag: 'next'})),
    })
    return spawnSync(process.execPath, [
        path.join(fixture.root, 'scripts', 'stage-release.mjs'),
        command, ...separatorArgument,
        '--release-plan', releasePlan,
    ], {
        cwd: fixture.root,
        encoding: 'utf8',
        env: {...process.env, PATH: fixture.path, ...extraEnv},
    })
}
