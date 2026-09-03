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
    const result = invoke(fixture, 'validate', 'glue-and-fray')
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /glue@0\.1\.0-alpha\.2[\s\S]*fray@0\.1\.0-alpha\.2/)
    assert.match(result.stdout, /order: @sylwellsoftware\/glue -> @sylwellsoftware\/fray/)
})

test('accepts the optional package-manager argument separator', () => {
    const fixture = createFixture()
    const result = invoke(fixture, 'validate', 'glue-and-fray', {}, {separator: true})
    assert.equal(result.status, 0, result.stderr)
})

test('refuses an already-public version before staging', () => {
    const fixture = createFixture({published: 'glue'})
    const result = invoke(fixture, 'stage', 'glue-and-fray')
    assert.equal(result.status, 1)
    assert.match(result.stderr, /glue@0\.1\.0-alpha\.2 is already public/)
    assert.doesNotMatch(readFileSync(fixture.log, 'utf8'), /stage publish/)
})

test('stages Glue before Fray with no publish or approval command', () => {
    const fixture = createFixture()
    const result = invoke(fixture, 'stage', 'glue-and-fray', {
        GITHUB_ACTIONS: 'true',
        GITHUB_REF: 'refs/heads/main',
    })
    assert.equal(result.status, 0, result.stderr)
    const log = readFileSync(fixture.log, 'utf8')
    const glue = log.indexOf(path.basename(fixture.glueTarball), log.indexOf('stage publish'))
    const fray = log.indexOf(path.basename(fixture.frayTarball), glue + 1)
    assert.ok(glue >= 0 && fray > glue, log)
    assert.doesNotMatch(log, /stage approve|^publish .*\.tgz/m)
})

test('refuses a Fray artifact with a stale Glue peer range', () => {
    const fixture = createFixture({stalePeer: true})
    const result = invoke(fixture, 'validate', 'glue-and-fray')
    assert.equal(result.status, 1)
    assert.match(result.stderr, /peer-depend on the current Glue release line/)
})

test('refuses staging outside protected GitHub main or with a long-lived token', () => {
    const fixture = createFixture()
    let result = invoke(fixture, 'stage', 'glue', {GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/topic'})
    assert.equal(result.status, 1)
    assert.match(result.stderr, /only from main/)
    result = invoke(fixture, 'stage', 'glue', {GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main', NPM_TOKEN: 'fixture'})
    assert.equal(result.status, 1)
    assert.match(result.stderr, /long-lived npm tokens/)
})

test('release workflow has the protected stage-only trust boundary', () => {
    const workflow = readFileSync(path.join(sourceRoot, '.github/workflows/release.yml'), 'utf8')
    assert.match(workflow,
        /run-name: Stage \$\{\{ inputs\.release_set }} \$\{\{ inputs\.version }} with \$\{\{ inputs\.tag }}/)
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
    mkdirSync(path.join(root, 'packages', 'glue'), {recursive: true})
    mkdirSync(path.join(root, 'packages', 'fray'), {recursive: true})
    mkdirSync(path.join(root, '.artifacts', 'release', 'packages'), {recursive: true})
    cpSync(path.join(sourceRoot, 'scripts', 'stage-release.mjs'), path.join(root, 'scripts', 'stage-release.mjs'))
    cpSync(path.join(sourceRoot, 'scripts', 'release-metadata.mjs'), path.join(root, 'scripts', 'release-metadata.mjs'))
    const entries = []
    for (const name of ['glue', 'fray']) {
        writeFileSync(path.join(root, 'packages', name, 'package.json'), JSON.stringify({
            name: `@sylwellsoftware/${name}`,
            version: '0.1.0-alpha.2',
            private: false,
            publishConfig: {access: 'public'},
            ...(name === 'fray' ? {
                peerDependencies: {
                    '@sylwellsoftware/glue': stalePeer ? '^0.1.0-alpha.1' : '^0.1.0-alpha.2',
                },
            } : {}),
        }))
        const filename = `sylwellsoftware-${name}-0.1.0-alpha.2.tgz`
        const tarball = path.join(root, '.artifacts', 'release', 'packages', filename)
        writeFileSync(tarball, `${name} artifact`)
        entries.push({
            name: `@sylwellsoftware/${name}`,
            version: '0.1.0-alpha.2',
            filename,
            bytes: Buffer.byteLength(`${name} artifact`),
            sha256: createHash('sha256').update(`${name} artifact`).digest('hex'),
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
        glueTarball: path.join(root, '.artifacts', 'release', 'packages', entries[0].filename),
        frayTarball: path.join(root, '.artifacts', 'release', 'packages', entries[1].filename),
        path: `${bin}:${process.env.PATH}`,
    }
}

function invoke(fixture, command, releaseSet, extraEnv = {}, {separator = false} = {}) {
    const separatorArgument = separator ? ['--'] : []
    return spawnSync(process.execPath, [
        path.join(fixture.root, 'scripts', 'stage-release.mjs'),
        command, ...separatorArgument,
        '--version', '0.1.0-alpha.2',
        '--tag', 'next',
        '--release-set', releaseSet,
    ], {
        cwd: fixture.root,
        encoding: 'utf8',
        env: {...process.env, PATH: fixture.path, ...extraEnv},
    })
}
