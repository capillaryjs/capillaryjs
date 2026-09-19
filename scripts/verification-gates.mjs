import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, readlinkSync, renameSync, writeFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

export const publicGates = ['format', 'lint', 'test:tooling', 'build', 'typecheck', 'test', 'test:types']
export const releaseGates = [...publicGates, 'test:browser', 'pack:check', 'scan:public', 'release-preflight']

const hash = (value) => createHash('sha256').update(value).digest('hex')

function capture(root, command, args) {
    const result = spawnSync(command, args, {cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024})
    if (result.status !== 0) throw new Error(result.stderr || `${command} failed`)
    return result.stdout
}

/** Includes dirty tracked/untracked source, file modes, symlinks and declared tool/config inputs. */
export function verificationInput(root, gate, environment = process.env) {
    const paths = [...new Set(capture(root, 'git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean))].sort()
    const digest = createHash('sha256')
    for (const name of paths) {
        digest.update(name + '\0')
        const file = path.join(root, name)
        if (!existsSync(file)) { digest.update('missing\0'); continue }
        const stat = lstatSync(file)
        digest.update(`${stat.mode}\0`)
        if (stat.isSymbolicLink()) digest.update(readlinkSync(file))
        else if (stat.isFile()) digest.update(readFileSync(file))
        else if (existsSync(path.join(file, '.git'))) digest.update(verificationInput(file, gate, environment))
    }
    for (const file of ['.npmrc', '.env', 'node_modules/.modules.yaml']) {
        const filename = path.join(root, file)
        digest.update(file + '\0' + (existsSync(filename) ? hash(readFileSync(filename)) : 'absent'))
    }
    // Hash values, never persist secrets. Exclude only invocation-specific noise.
    const env = Object.entries(environment).filter(([key]) => !['PWD', 'OLDPWD', 'SHLVL', '_'].includes(key)).sort(([a], [b]) => a.localeCompare(b))
    digest.update(JSON.stringify(env))
    digest.update(`${gate}\0${process.version}\0${process.platform}\0${process.arch}\0`)
    digest.update(capture(root, 'pnpm', ['--version']))
    if (gate === 'scan:public' || gate === 'release-preflight') digest.update(capture(root, 'git', ['rev-list', 'HEAD']))
    return digest.digest('hex')
}

export function verificationOutputs(root, gate) {
    if (['format', 'lint', 'test:tooling'].includes(gate)) return 'source-only'
    const digest = createHash('sha256')
    function visit(directory, prefix = '') {
        if (!existsSync(directory)) { digest.update(prefix + ':missing'); return }
        for (const name of readdirSync(directory).sort()) {
            const file = path.join(directory, name), relative = `${prefix}/${name}`, stat = lstatSync(file)
            if (stat.isSymbolicLink()) digest.update(relative + readlinkSync(file))
            else if (stat.isDirectory()) visit(file, relative)
            else { digest.update(relative); digest.update(readFileSync(file)) }
        }
    }
    for (const base of ['packages', 'apps']) {
        if (!existsSync(path.join(root, base))) continue
        for (const name of readdirSync(path.join(root, base)).sort()) visit(path.join(root, base, name, 'dist'), `${base}/${name}/dist`)
    }
    if (['pack:check', 'scan:public', 'release-preflight'].includes(gate)) visit(path.join(root, '.artifacts/release'), '.artifacts/release')
    return digest.digest('hex')
}

export function saveReceipts(filename, receipts) {
    mkdirSync(path.dirname(filename), {recursive: true})
    const temporary = `${filename}.${process.pid}.tmp`
    writeFileSync(temporary, JSON.stringify({schemaVersion: 1, receipts}, null, 2) + '\n')
    const fd = openSync(temporary, 'r')
    try { fsyncSync(fd) } finally { closeSync(fd) }
    renameSync(temporary, filename)
}

export function readReceipts(filename) {
    if (!existsSync(filename)) return []
    const value = JSON.parse(readFileSync(filename, 'utf8'))
    if (value.schemaVersion !== 1 || !Array.isArray(value.receipts)) throw new Error('Unsupported verification receipts; preserve them and start a new verification record')
    return value.receipts
}

export function runGates({root, filename, gates = releaseGates,
    input = (gate) => verificationInput(root, gate), output = (gate) => verificationOutputs(root, gate),
    execute = (gate) => spawnSync(gate === 'release-preflight' ? process.execPath : 'pnpm',
        gate === 'release-preflight' ? ['scripts/public-release-preflight.mjs'] : [gate],
        {cwd: root, stdio: ['ignore', 2, 2]}).status === 0}) {
    let receipts
    try { receipts = readReceipts(filename) }
    catch (error) {
        // Receipts are disposable evidence, not run ownership. Preserve damaged evidence and
        // perform the gates again instead of making the operator hand-edit a cache.
        renameSync(filename, `${filename}.unusable-${Date.now()}`)
        console.error(`[verification] Preserved unusable receipts; all gates will run: ${error.message}`)
        receipts = []
    }
    for (const gate of gates) {
        const inputDigest = input(gate), outputDigest = output(gate)
        const previous = receipts.findLast((entry) => entry.id === gate)
        if (previous?.state === 'PASSED' && previous.inputDigest === inputDigest && previous.outputDigest === outputDigest) {
            console.error(`[verification] Reusing ${gate}: inputs and retained outputs match`)
            continue
        }
        const record = {id: gate, title: gate, command: gate === 'release-preflight' ? ['node', 'scripts/public-release-preflight.mjs'] : ['pnpm', gate],
            state: 'RUNNING', inputDigest, startedAt: new Date().toISOString()}
        receipts.push(record)
        saveReceipts(filename, receipts)
        console.error(`[verification] Running ${gate}`)
        const success = execute(gate)
        record.completedAt = new Date().toISOString()
        record.durationMillis = Date.parse(record.completedAt) - Date.parse(record.startedAt)
        record.state = success && input(gate) === inputDigest ? 'PASSED' : 'FAILED'
        record.outputDigest = output(gate)
        saveReceipts(filename, receipts)
        if (record.state !== 'PASSED') return {passed: false, receipts}
        // A producing gate changes outputs consumed by later gates. Do not mutate earlier receipts
        // to assert they saw outputs they never verified; subsequent retries remain conservative.
    }
    return {passed: true, receipts}
}

export function publicReceiptsValid(root, filename) {
    let receipts
    try { receipts = readReceipts(filename) } catch { return false }
    return publicGates.every((gate) => {
        const receipt = receipts.findLast((entry) => entry.id === gate)
        return receipt?.state === 'PASSED' && receipt.inputDigest === verificationInput(root, gate)
            && receipt.outputDigest === verificationOutputs(root, gate)
    })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
        const filename = process.argv[2]
        if (!filename || !path.isAbsolute(filename)) throw new Error('Absolute receipt path required')
        const result = runGates({root, filename})
        console.log(JSON.stringify(result))
        if (!result.passed) process.exitCode = 1
    } catch (error) { console.error(error.message); process.exitCode = 1 }
}
