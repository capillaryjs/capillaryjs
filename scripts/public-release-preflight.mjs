import {spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const expectedRepository = 'git+https://github.com/sylwellsoftware/gluefrayjs.git'
const expectedOrigin = 'https://github.com/sylwellsoftware/gluefrayjs'
const packages = [
    ['packages/glue/package.json', '@sylwellsoftware/glue', 'packages/glue'],
    ['packages/fray/package.json', '@sylwellsoftware/fray', 'packages/fray'],
]

const workspace = readJson('package.json')
assert(workspace.private === true, 'workspace root must remain private')
assert(workspace.license === 'Apache-2.0', 'workspace license must be Apache-2.0')

for (const [manifestPath, name, directory] of packages) {
    const manifest = readJson(manifestPath)
    assert(manifest.name === name, `${name}: package name mismatch`)
    assert(manifest.version === '0.1.0-alpha.1', `${name}: candidate version mismatch`)
    assert(manifest.private === false, `${name}: package must be publishable`)
    assert(manifest.license === 'Apache-2.0', `${name}: license mismatch`)
    assert(manifest.author?.name === 'Sylwell Software', `${name}: author name mismatch`)
    assert(manifest.author?.email === 'npm@sylwellsoftware.com', `${name}: npm author email mismatch`)
    assert(manifest.author?.url === 'https://sylwellsoftware.com', `${name}: author URL mismatch`)
    assert(manifest.repository?.url === expectedRepository, `${name}: repository mismatch`)
    assert(manifest.repository?.directory === directory, `${name}: repository directory mismatch`)
    assert(manifest.publishConfig?.access === 'public', `${name}: public access is required`)
}

const dummyServer = readJson('apps/dummy-server/package.json')
assert(dummyServer.private === true, 'dummy server must not be publishable')
assert(dummyServer.name === '@sylwellsoftware/dummy-server', 'dummy server name mismatch')

if (gitSucceeds('rev-parse', '--verify', 'HEAD')) {
    assert(git('show', '-s', '--format=%an', 'HEAD') === 'Sylwell Software', 'commit author name mismatch')
    assert(
        git('show', '-s', '--format=%ae', 'HEAD') === 'github@sylwellsoftware.com',
        'commit author email mismatch',
    )
} else {
    assert(git('config', '--local', 'user.name') === 'Sylwell Software', 'local Git user.name mismatch')
    assert(
        git('config', '--local', 'user.email') === 'github@sylwellsoftware.com',
        'local Git user.email mismatch',
    )
}
assert(
    git('remote', 'get-url', 'origin').replace(/\.git$/, '') === expectedOrigin,
    'origin URL mismatch',
)
assert(git('branch', '--show-current') === 'main', 'public candidate must be on main')

console.log('[release-preflight] public metadata, remote, branch, and local Git identity: valid')

function readJson(relativePath) {
    return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'))
}

function git(...args) {
    const result = spawnSync('git', args, {cwd: root, encoding: 'utf8'})
    if (result.status !== 0) fail(`git ${args.join(' ')} failed`)
    return result.stdout.trim()
}

function gitSucceeds(...args) {
    return spawnSync('git', args, {cwd: root, encoding: 'utf8'}).status === 0
}

function assert(condition, message) {
    if (!condition) fail(message)
}

function fail(message) {
    console.error(`[release-preflight] ${message}`)
    process.exit(1)
}
