import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {existsSync, readFileSync, mkdtempSync, readdirSync, rmSync} from 'node:fs'
import os from 'node:os'
import {basename, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

import {assertDevtoolsPeerVersions, parseReleasePlan} from './release-metadata.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
try {
    const {command, options} = parse(process.argv.slice(2))
    assert(command === 'validate' || command === 'stage', 'command must be validate or stage')
    assert(!options.recoverExisting || command === 'stage', 'existing-stage recovery is only available when staging exact retained artifacts')
    const plan = parseReleasePlan(options.releasePlan)
    const selected = plan.packages
    const artifacts = validateArtifacts(selected, options)
    if (!options.recoverExisting) assertVersionsAvailable(selected)
    printPlan(command, plan, artifacts)
    if (command === 'stage') stagePackages(selected, artifacts, options.recoverExisting)
} catch (error) {
    console.error(`[stage-release] ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
}

function parse(args) {
    const command = args.shift()
    if (args[0] === '--') args.shift()
    const options = {releasePlan: undefined, artifactRoot: '.artifacts/release'}
    for (let index = 0; index < args.length; index += 1) {
        const flag = args[index]
        if (flag === '--recover-existing') { options.recoverExisting = true; continue }
        assert(['--release-plan', '--artifact-root'].includes(flag), `unknown option: ${flag}`)
        const value = args[++index]
        assert(value, `${flag} requires a value`)
        const key = flag.replace(/^--/, '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
        options[key] = value
    }
    return {command, options}
}

function validateArtifacts(selected, options) {
    const artifactRoot = resolve(root, options.artifactRoot)
    const reportPath = join(artifactRoot, 'package-artifacts.json')
    assert(existsSync(reportPath), `artifact report is missing: ${reportPath}`)
    const report = JSON.parse(readFileSync(reportPath, 'utf8'))
    assert(report.schemaVersion === 1 && Array.isArray(report.packages), 'artifact report has an unsupported format')
    const entries = new Map(report.packages.map((entry) => [entry.name, entry]))

    const capillaryManifest = JSON.parse(readFileSync(join(root, 'packages/capillary/package.json'), 'utf8'))
    const capillaryUiManifest = JSON.parse(readFileSync(join(root, 'packages/capillary-ui/package.json'), 'utf8'))
    if (selected.some(({key}) => key === 'capillaryDevtools')) {
        assertDevtoolsPeerVersions(capillaryManifest.version, capillaryUiManifest.version)
    }
    return selected.map((definition) => {
        const manifest = JSON.parse(readFileSync(join(root, 'packages', definition.directory, 'package.json'), 'utf8'))
        assert(manifest.name === definition.name, `manifest identity drifted for ${definition.name}`)
        assert(manifest.version === definition.version, `${definition.name} manifest version is ${manifest.version}, expected ${definition.version}`)
        assert(manifest.private === false, `${definition.name} is private`)
        assert(manifest.publishConfig?.access === 'public', `${definition.name} is not configured for public access`)
        if (definition.key === 'capillaryUi') {
            assert(manifest.peerDependencies?.['@capillaryjs/capillary'] === `^${capillaryManifest.version}`,
                `${definition.name} must peer-depend on the current Capillary release line`)
        }
        if (definition.key === 'capillaryViz' || definition.key === 'capillaryDevtools') {
            assert(manifest.peerDependencies?.['@capillaryjs/capillary'] === `^${capillaryManifest.version}`,
                `${definition.name} must peer-depend on the current Capillary release line`)
            assert(manifest.peerDependencies?.['@capillaryjs/capillary-ui'] === `^${capillaryUiManifest.version}`,
                `${definition.name} must peer-depend on the current Capillary UI release line`)
        }
        const entry = entries.get(definition.name)
        assert(entry?.version === definition.version, `artifact report version drifted for ${definition.name}`)
        assert(basename(entry.filename ?? '') === entry.filename, `unsafe artifact filename for ${definition.name}`)
        const tarball = join(artifactRoot, 'packages', entry.filename)
        assert(existsSync(tarball), `tarball is missing for ${definition.name}`)
        const digest = createHash('sha256').update(readFileSync(tarball)).digest('hex')
        assert(readFileSync(tarball).length === entry.bytes, `tarball size drifted for ${definition.name}`)
        assert(digest === entry.sha256, `tarball checksum drifted for ${definition.name}`)
        return {...definition, tarball, sha256: digest, bytes: entry.bytes}
    })
}

function assertVersionsAvailable(selected) {
    for (const definition of selected) {
        const result = run('npm', ['view', `${definition.name}@${definition.version}`, 'version', '--json'])
        if (result.status === 0) throw new Error(`${definition.name}@${definition.version} is already public`)
        const output = `${result.stdout}\n${result.stderr}`
        assert(/E404|404 Not Found|is not in this registry/.test(output), `registry lookup failed for ${definition.name}@${definition.version}`)
    }
}

function printPlan(command, plan, artifacts) {
    console.log(`[stage-release] action: ${command === 'stage' ? 'stage for human review' : 'validate only'}`)
    console.log(`[stage-release] release date: ${plan.releaseDate}`)
    for (const artifact of artifacts) {
        console.log(`[stage-release] ${artifact.name}@${artifact.version} tag=${artifact.tag} bytes=${artifact.bytes} sha256=${artifact.sha256}`)
    }
    console.log('[stage-release] order: ' + artifacts.map(({name}) => name).join(' -> '))
}

function stagePackages(selected, artifacts, recoverExisting = false) {
    assert(process.env.GITHUB_ACTIONS === 'true', 'staging is allowed only in GitHub Actions')
    assert(process.env.GITHUB_REF === 'refs/heads/main', 'staging is allowed only from main')
    assert(!process.env.NODE_AUTH_TOKEN && !process.env.NPM_TOKEN, 'long-lived npm tokens must not be present')
    const stageable = selected.map((definition) => ({definition, exists: npmPackageExists(definition.name)}))
    const firstInitial = stageable.findIndex(({exists}) => !exists)
    assert(firstInitial < 0 || stageable.slice(firstInitial).every(({exists}) => !exists),
        'brand-new packages must form a trailing dependency suffix')
    for (let index = 0; index < selected.length; index += 1) {
        if (!stageable[index].exists) {
            console.log(`[stage-release] retaining ${artifacts[index].name}@${artifacts[index].version} for initial publication; npm cannot stage a package that does not yet exist`)
            continue
        }
        if (recoverExisting && reconcileExisting(selected[index], artifacts[index])) continue
        if (index > 0) assertVersionsAvailable([selected[index]])
        const artifact = artifacts[index]
        const result = run('npm', ['stage', 'publish', artifact.tarball, '--access', 'public', '--tag', artifact.tag], {inherit: true})
        assert(result.status === 0, `staging failed for ${artifact.name}; inspect npm's staged packages before retrying`)
    }
    console.log('[stage-release] staged successfully; CI cannot approve these packages')
}

/** Retry only the missing package. Existing immutable bytes must match the retained archive. */
function reconcileExisting(definition, artifact) {
    const publicVersion = run('npm', ['view', `${definition.name}@${definition.version}`, 'version', '--json'])
    if (publicVersion.status === 0) {
        verifyDownloaded(['pack', `${definition.name}@${definition.version}`, '--ignore-scripts', '--json'], artifact)
        console.log(`[stage-release] ${definition.name}@${definition.version} already public with exact bytes; skipping`)
        return true
    }
    assert(/E404|404 Not Found|is not in this registry/.test(`${publicVersion.stdout}\n${publicVersion.stderr}`),
        `cannot reconcile registry for ${definition.name}`)
    const stages = run('npm', ['stage', 'list', definition.name, '--json'])
    assert(stages.status === 0, `cannot inspect stages for ${definition.name}: ${stages.stderr}`)
    const matches = new Map()
    function inspect(value) {
        if (!value || typeof value !== 'object') return
        const id = value.id ?? value.stageId ?? value.stage_id
        const name = value.name ?? value.packageName ?? value.package ?? definition.name
        if (id && name === definition.name && value.version === definition.version) {
            const tag = value.tag ?? value.distTag ?? value.dist_tag
            assert(tag == null || tag === definition.tag, `existing stage tag differs for ${definition.name}`)
            matches.set(id, value)
        }
        for (const child of Object.values(value)) inspect(child)
    }
    inspect(JSON.parse(stages.stdout))
    assert(matches.size <= 1, `multiple stages exist for ${definition.name}; reconcile before retry`)
    if (matches.size === 0) return false
    const [id] = matches.keys()
    verifyDownloaded(['stage', 'download', String(id)], artifact)
    console.log(`[stage-release] exact stage ${id} retained for ${definition.name}; skipping`)
    return true
}

function verifyDownloaded(arguments_, artifact) {
    const directory = mkdtempSync(join(os.tmpdir(), 'capillary-stage-recovery-'))
    try {
        const result = spawnSync('npm', arguments_, {cwd: directory, encoding: 'utf8', env: process.env})
        assert(result.status === 0, `cannot download existing ${artifact.name}: ${result.stderr}`)
        const files = readdirSync(directory, {recursive: true}).filter((name) => name.endsWith('.tgz'))
        assert(files.length === 1, `expected one retained tarball for ${artifact.name}`)
        const bytes = readFileSync(join(directory, files[0]))
        assert(bytes.length === artifact.bytes && createHash('sha256').update(bytes).digest('hex') === artifact.sha256,
            `existing artifact differs for ${artifact.name}; refusing replacement or duplicate stage`)
    } finally { rmSync(directory, {recursive: true, force: true}) }
}

function npmPackageExists(packageName) {
    const result = run('npm', ['view', packageName, 'name', '--json'])
    if (result.status === 0) return true
    const output = `${result.stdout}\n${result.stderr}`
    assert(/E404|404 Not Found|is not in this registry/.test(output),
        `could not determine whether ${packageName} exists on npm`)
    return false
}

function run(command, args, {inherit = false} = {}) {
    return spawnSync(command, args, {
        cwd: root,
        encoding: inherit ? undefined : 'utf8',
        stdio: inherit ? 'inherit' : 'pipe',
        env: process.env,
    })
}

function assert(condition, message) {
    if (!condition) throw new Error(message)
}
