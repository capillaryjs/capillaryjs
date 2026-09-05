import {spawnSync} from 'node:child_process'
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import os from 'node:os'
import {fileURLToPath} from 'node:url'

import {
    parseReleasePlan,
    promoteUnreleased,
    setManifestDependencyRange,
    setManifestVersion,
} from './release-metadata.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

try {
    const {command, releasePlan} = parseArguments(process.argv.slice(2))
    const plan = parseReleasePlan(releasePlan)
    assert(command === 'prepare', 'command must be prepare')
    const result = prepare(plan)
    console.log(JSON.stringify(result))
} catch (error) {
    console.error(`[prepare-release] ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
}

function parseArguments(args) {
    const command = args.shift()
    let releasePlan
    while (args.length > 0) {
        const flag = args.shift()
        assert(flag === '--release-plan', `unknown option: ${flag}`)
        releasePlan = args.shift()
        assert(releasePlan, '--release-plan requires a value')
    }
    return {command, releasePlan}
}

function prepare(plan) {
    const selectedByKey = new Map(plan.packages.map((entry) => [entry.key, entry]))
    const manifests = new Map(plan.packages.map((entry) => [entry.key, readManifest(entry)]))
    const allManifests = new Map(['glue', 'fray', 'fray-visualization'].map((key) => {
        const selected = selectedByKey.get(key)
        return [key, selected ? manifests.get(key) : readManifestByKey(key)]
    }))
    const allowedPaths = plan.packages.flatMap(({directory, changelog}) => [
        `packages/${directory}/package.json`, changelog,
    ])
    const initialChanges = changedPaths()
    assert(initialChanges.every((path) => allowedPaths.includes(path)),
        `framework has unrelated changes: ${initialChanges.filter((path) => !allowedPaths.includes(path)).join(', ')}`)

    const desired = desiredMetadata(plan, allManifests)
    const alreadyPrepared = [...desired].every(([path, contents]) => readFile(path) === contents)
    if (!alreadyPrepared) {
        assert(initialChanges.length === 0,
            'framework has release metadata changes that do not match this release plan; reject or restore them before preparing')
        for (const [path, contents] of desired) writeFile(path, contents)
    }

    const changes = changedPaths()
    assert(changes.every((path) => allowedPaths.includes(path)),
        `release preparation encountered an unrelated framework change: ${changes.filter((path) => !allowedPaths.includes(path)).join(', ')}`)
    return {
        schemaVersion: 1,
        state: alreadyPrepared ? 'already-prepared' : 'prepared',
        releasePlan: plan,
        changedPaths: changes,
        treeFingerprint: candidateTree(allowedPaths),
    }
}

function desiredMetadata(plan, manifests) {
    const target = new Map(plan.packages.map((entry) => [entry.key, entry.version]))
    const glueVersion = target.get('glue') ?? manifests.get('glue').version
    const frayVersion = target.get('fray') ?? manifests.get('fray').version
    const expected = new Map()
    for (const entry of plan.packages) {
        const manifestPath = `packages/${entry.directory}/package.json`
        let manifest = setManifestVersion(readFile(manifestPath), entry.version)
        if (entry.key === 'fray') {
            manifest = setManifestDependencyRange(
                manifest, 'peerDependencies', '@sylwellsoftware/glue', `^${glueVersion}`)
        }
        if (entry.key === 'fray-visualization') {
            manifest = setManifestDependencyRange(
                manifest, 'peerDependencies', '@sylwellsoftware/glue', `^${glueVersion}`)
            manifest = setManifestDependencyRange(
                manifest, 'peerDependencies', '@sylwellsoftware/fray', `^${frayVersion}`)
        }
        expected.set(manifestPath, manifest)
        expected.set(entry.changelog, promoteUnreleased(readFile(entry.changelog), entry.version, plan.releaseDate))
    }
    return expected
}

function candidateTree(paths) {
    const temporary = mkdtempSync(join(os.tmpdir(), 'gluefray-release-index-'))
    const index = join(temporary, 'index')
    const environment = {...process.env, GIT_INDEX_FILE: index}
    try {
        git(['read-tree', 'HEAD'], environment)
        git(['add', '--', ...paths], environment)
        return git(['write-tree'], environment).trim()
    } finally {
        rmSync(temporary, {recursive: true, force: true})
    }
}

function readManifest(entry) {
    return JSON.parse(readFile(`packages/${entry.directory}/package.json`))
}

function readManifestByKey(key) {
    const directory = key === 'fray-visualization' ? key : key
    return JSON.parse(readFile(`packages/${directory}/package.json`))
}

function changedPaths() {
    return git(['status', '--porcelain', '--untracked-files=all'])
        .split('\n')
        .filter(Boolean)
        .map((line) => line.slice(3).trim().replace(/^.* -> /, ''))
}

function readFile(path) {
    return readFileSync(join(root, path), 'utf8')
}

function writeFile(path, contents) {
    writeFileSync(join(root, path), contents)
}

function git(args, env = process.env) {
    const result = spawnSync('git', args, {cwd: root, encoding: 'utf8', env})
    if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`)
    return result.stdout
}

function assert(condition, message) {
    if (!condition) throw new Error(message)
}
