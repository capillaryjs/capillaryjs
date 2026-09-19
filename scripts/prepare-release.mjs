import {spawnSync} from 'node:child_process'
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import os from 'node:os'
import {fileURLToPath} from 'node:url'

import {
    assertDevtoolsPeerVersions,
    parseReleasePlan,
    promoteUnreleased,
    setManifestDependencyRange,
    setManifestVersion,
} from './release-metadata.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

try {
    const {command, releasePlan, corrections} = parseArguments(process.argv.slice(2))
    const plan = parseReleasePlan(releasePlan)
    assert(['prepare', 'plan', 'check'].includes(command), 'command must be prepare, plan or check')
    const result = prepare(plan, command, corrections)
    console.log(JSON.stringify(result))
} catch (error) {
    console.error(`[prepare-release] ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
}

function parseArguments(args) {
    const command = args.shift()
    let releasePlan
    let corrections = false
    while (args.length > 0) {
        const flag = args.shift()
        if (flag === '--include-corrections') { corrections = true; continue }
        assert(flag === '--release-plan', `unknown option: ${flag}`)
        releasePlan = args.shift()
        assert(releasePlan, '--release-plan requires a value')
    }
    return {command, releasePlan, corrections}
}

function prepare(plan, command, corrections) {
    const selectedByKey = new Map(plan.packages.map((entry) => [entry.key, entry]))
    const manifests = new Map(plan.packages.map((entry) => [entry.key, readManifest(entry)]))
    const allManifests = new Map(['capillary', 'capillaryUi', ...plan.packages.map(({key}) => key)].map((key) => {
        const selected = selectedByKey.get(key)
        return [key, selected ? manifests.get(key) : readManifestByKey(key)]
    }))
    const allowedPaths = plan.packages.flatMap(({directory, changelog}) => [
        `packages/${directory}/package.json`, changelog,
    ])
    const initialChanges = changedPaths()
    assert(corrections || initialChanges.every((path) => allowedPaths.includes(path)),
        `framework has unrelated changes: ${initialChanges.filter((path) => !allowedPaths.includes(path)).join(', ')}`)

    const desired = desiredMetadata(plan, allManifests)
    const edits = [...desired].filter(([path, after]) => readFile(path) !== after)
        .map(([path, after]) => ({path, before: readFile(path), after}))
    const alreadyPrepared = [...desired].every(([path, contents]) => readFile(path) === contents)
    if (command === 'plan') {
        assert(corrections || alreadyPrepared || initialChanges.length === 0,
            'framework has release metadata changes; choose the corrected-candidate flow to include them')
        return {schemaVersion: 1, edits, changedPaths: initialChanges}
    }
    assert(command !== 'check' || alreadyPrepared, 'release metadata changed; correct the candidate before continuing')
    if (!alreadyPrepared) {
        assert(corrections || initialChanges.length === 0,
            'framework has release metadata changes that do not match this release plan; reject or restore them before preparing')
        for (const [path, contents] of desired) writeFile(path, contents)
    }

    const changes = changedPaths()
    assert(corrections || changes.every((path) => allowedPaths.includes(path)),
        `release preparation encountered an unrelated framework change: ${changes.filter((path) => !allowedPaths.includes(path)).join(', ')}`)
    return {
        schemaVersion: 1,
        state: alreadyPrepared ? 'already-prepared' : 'prepared',
        releasePlan: plan,
        changedPaths: changes,
        treeFingerprint: candidateTree(corrections ? [...new Set([...allowedPaths, ...changes])] : allowedPaths),
        sourceSha: git(['rev-parse', 'HEAD']).trim(),
    }
}

function desiredMetadata(plan, manifests) {
    const target = new Map(plan.packages.map((entry) => [entry.key, entry.version]))
    const capillaryVersion = target.get('capillary') ?? manifests.get('capillary').version
    const capillaryUiVersion = target.get('capillaryUi') ?? manifests.get('capillaryUi').version
    if (target.has('capillaryDevtools')) assertDevtoolsPeerVersions(capillaryVersion, capillaryUiVersion)
    const expected = new Map()
    for (const entry of plan.packages) {
        const manifestPath = `packages/${entry.directory}/package.json`
        let manifest = setManifestVersion(readFile(manifestPath), entry.version)
        if (entry.key === 'capillaryUi') {
            manifest = setManifestDependencyRange(
                manifest, 'peerDependencies', '@capillaryjs/capillary', `^${capillaryVersion}`)
        }
        if (entry.key === 'capillaryViz' || entry.key === 'capillaryDevtools') {
            manifest = setManifestDependencyRange(
                manifest, 'peerDependencies', '@capillaryjs/capillary', `^${capillaryVersion}`)
            manifest = setManifestDependencyRange(
                manifest, 'peerDependencies', '@capillaryjs/capillary-ui', `^${capillaryUiVersion}`)
        }
        expected.set(manifestPath, manifest)
        expected.set(entry.changelog, promoteUnreleased(readFile(entry.changelog), entry.version, plan.releaseDate, entry.missingNotesApproval))
    }
    return expected
}

function candidateTree(paths) {
    const temporary = mkdtempSync(join(os.tmpdir(), 'capillaryjs-release-index-'))
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
    const directory = {
        capillary: 'capillary',
        capillaryUi: 'capillary-ui',
        capillaryViz: 'capillary-viz',
        capillaryDevtools: 'capillary-devtools',
    }[key]
    assert(directory, `unknown package key: ${key}`)
    return JSON.parse(readFile(`packages/${directory}/package.json`))
}

function changedPaths() {
    const entries = git(['status', '--porcelain', '-z', '--untracked-files=all']).split('\0').filter(Boolean)
    const paths = []
    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index]
        paths.push(entry.slice(3))
        if (/[RC]/.test(entry.slice(0, 2))) paths.push(entries[++index])
    }
    return [...new Set(paths)].sort()
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
