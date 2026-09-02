import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync, realpathSync, writeFileSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import test from 'node:test'

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const runner = path.join(root, 'scripts/run-public-command.mjs')

test('dry run validates but does not execute the child command', () => {
    const result = run(['--cwd', '.', '--dry-run', '--', 'definitely-not-a-command'])
    assert.equal(result.status, 0)
    assert.match(result.stdout, /dry run/)
})

test('refuses a missing working directory', () => {
    const result = run(['--cwd', 'missing-directory', '--', process.execPath, '--version'])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /working directory does not exist/)
})

test('refuses a directory that is not the public workspace', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'public-command-wrong-'))
    const result = run(['--cwd', directory, '--', process.execPath, '--version'])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /not the public workspace/)
})

test('reports a missing executable', () => {
    const result = run(['--cwd', '.', '--', 'definitely-not-a-command'])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /unable to start/)
})

test('propagates a failed child exit status', () => {
    const result = run(['--cwd', '.', '--', process.execPath, '-e', 'process.exit(7)'])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /exited with status 7/)
})

test('runs the child from the validated workspace directory', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'public-command-good-'))
    writeFileSync(path.join(directory, 'pnpm-workspace.yaml'), 'packages: []\n')
    const result = run([
        '--cwd', directory, '--', process.execPath, '-e',
        'process.stdout.write(process.cwd())',
    ])
    assert.equal(result.status, 0)
    assert.equal(result.stdout, realpathSync(directory))
})

function run(args) {
    return spawnSync(process.execPath, [runner, ...args], {
        cwd: root,
        encoding: 'utf8',
    })
}
