import assert from 'node:assert/strict'
import {chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {publicGates, publicReceiptsValid, readReceipts, runGates, saveReceipts, verificationInput, verificationOutputs} from '../verification-gates.mjs'

test('real fingerprints bind source, modes, environment, configuration, tool links, history and outputs', () => {
    const temporary = mkdtempSync(path.join(os.tmpdir(), 'release-digests-')), root = path.join(temporary, 'workspace')
    mkdirSync(root)
    const git = (...args) => {
        const result = spawnSync('git', args, {cwd: root, encoding: 'utf8'})
        assert.equal(result.status, 0, result.stderr)
    }
    try {
        git('init', '-b', 'main')
        git('config', 'user.name', 'Fixture')
        git('config', 'user.email', 'fixture@example.invalid')
        writeFileSync(path.join(root, '.gitignore'), 'node_modules/\n.npmrc\npackages/*/dist/\n')
        const source = path.join(root, 'source.txt')
        writeFileSync(source, 'original\n')
        git('add', '.')
        git('commit', '-m', 'baseline')
        const baseline = verificationInput(root, 'build')
        writeFileSync(source, 'corrected\n')
        assert.notEqual(verificationInput(root, 'build'), baseline)
        writeFileSync(source, 'original\n')
        chmodSync(source, 0o755)
        assert.notEqual(verificationInput(root, 'build'), baseline)
        chmodSync(source, 0o644)
        assert.notEqual(verificationInput(root, 'build', {...process.env, RELEASE_FIXTURE_OPTION: 'changed'}), baseline)
        writeFileSync(path.join(root, '.npmrc'), 'ignore-scripts=true\n')
        const configuration = verificationInput(root, 'build')
        assert.notEqual(configuration, baseline)
        mkdirSync(path.join(root, 'node_modules'))
        writeFileSync(path.join(root, 'node_modules/.modules.yaml'), 'changed installation\n')
        assert.notEqual(verificationInput(root, 'build'), configuration)
        const treeInput = verificationInput(root, 'build'), historyInput = verificationInput(root, 'scan:public')
        git('commit', '--allow-empty', '-m', 'history-only')
        assert.equal(verificationInput(root, 'build'), treeInput)
        assert.notEqual(verificationInput(root, 'scan:public'), historyInput)
        const filename = path.join(temporary, 'receipts.json')
        saveReceipts(filename, publicGates.map((id) => ({id, state: 'PASSED', inputDigest: verificationInput(root, id), outputDigest: verificationOutputs(root, id)})))
        assert.equal(publicReceiptsValid(root, filename), true)
        const dist = path.join(root, 'packages/example/dist')
        mkdirSync(dist, {recursive: true})
        writeFileSync(path.join(dist, 'index.js'), 'changed artifact\n')
        assert.equal(publicReceiptsValid(root, filename), false)
        writeFileSync(filename, '{corrupt')
        assert.equal(publicReceiptsValid(root, filename), false)
    } finally { rmSync(temporary, {recursive: true, force: true}) }
})

test('a late failure retries only failed gates when proven inputs and outputs still match', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'release-receipts-'))
    try {
        const filename = path.join(root, 'receipts.json'), calls = []
        let failBrowser = true
        const options = {root, filename, gates: ['build', 'unit', 'browser'], input: () => 'same-source', output: () => 'same-output',
            execute: (gate) => { calls.push(gate); return gate !== 'browser' || !failBrowser }}
        assert.equal(runGates(options).passed, false)
        failBrowser = false
        assert.equal(runGates(options).passed, true)
        assert.deepEqual(calls, ['build', 'unit', 'browser', 'browser'])
        assert.equal(readReceipts(filename).filter((entry) => entry.state === 'RUNNING').length, 0)
    } finally { rmSync(root, {recursive: true, force: true}) }
})

test('changed source or missing output invalidates a successful receipt', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'release-receipts-'))
    try {
        let source = 'one', output = 'built', calls = 0
        const options = {root, filename: path.join(root, 'receipts.json'), gates: ['build'], input: () => source,
            output: () => output, execute: () => { calls++; output = 'built'; return true }}
        runGates(options)
        source = 'two'
        runGates(options)
        output = 'missing'
        runGates(options)
        assert.equal(calls, 3)
    } finally { rmSync(root, {recursive: true, force: true}) }
})

test('a source change during verification cannot receive a passing receipt', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'release-receipts-'))
    try {
        let source = 'before'
        const result = runGates({root, filename: path.join(root, 'receipts.json'), gates: ['unit'], input: () => source,
            output: () => 'none', execute: () => { source = 'after'; return true }})
        assert.equal(result.passed, false)
        assert.equal(result.receipts[0].state, 'FAILED')
    } finally { rmSync(root, {recursive: true, force: true}) }
})

test('a crash retains a running intent which is rerun after restart', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'release-receipts-'))
    try {
        const options = {root, filename: path.join(root, 'receipts.json'), gates: ['unit'], input: () => 'same', output: () => 'none'}
        assert.throws(() => runGates({...options, execute: () => { throw new Error('interrupted') }}), /interrupted/)
        assert.equal(readReceipts(options.filename)[0].state, 'RUNNING')
        assert.equal(runGates({...options, execute: () => true}).passed, true)
        writeFileSync(options.filename, '{broken')
        assert.equal(runGates({...options, execute: () => true}).passed, true)
        const preserved = readdirSync(root).find((name) => name.includes('.unusable-'))
        assert.equal(readFileSync(path.join(root, preserved), 'utf8'), '{broken')
    } finally { rmSync(root, {recursive: true, force: true}) }
})
