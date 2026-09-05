import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {existsSync, readFileSync} from 'node:fs'
import {basename, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

import {parseReleasePlan} from './release-metadata.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
try {
    const {command, options} = parse(process.argv.slice(2))
    assert(command === 'validate' || command === 'stage', 'command must be validate or stage')
    const plan = parseReleasePlan(options.releasePlan)
    const selected = plan.packages
    const artifacts = validateArtifacts(selected, options)
    assertVersionsAvailable(selected)
    printPlan(command, plan, artifacts)
    if (command === 'stage') stagePackages(selected, artifacts)
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

    const glueManifest = JSON.parse(readFileSync(join(root, 'packages/glue/package.json'), 'utf8'))
    const frayManifest = JSON.parse(readFileSync(join(root, 'packages/fray/package.json'), 'utf8'))
    return selected.map((definition) => {
        const manifest = JSON.parse(readFileSync(join(root, 'packages', definition.directory, 'package.json'), 'utf8'))
        assert(manifest.name === definition.name, `manifest identity drifted for ${definition.name}`)
        assert(manifest.version === definition.version, `${definition.name} manifest version is ${manifest.version}, expected ${definition.version}`)
        assert(manifest.private === false, `${definition.name} is private`)
        assert(manifest.publishConfig?.access === 'public', `${definition.name} is not configured for public access`)
        if (definition.key === 'fray') {
            assert(manifest.peerDependencies?.['@sylwellsoftware/glue'] === `^${glueManifest.version}`,
                `${definition.name} must peer-depend on the current Glue release line`)
        }
        if (definition.key === 'fray-visualization') {
            assert(manifest.peerDependencies?.['@sylwellsoftware/glue'] === `^${glueManifest.version}`,
                `${definition.name} must peer-depend on the current Glue release line`)
            assert(manifest.peerDependencies?.['@sylwellsoftware/fray'] === `^${frayManifest.version}`,
                `${definition.name} must peer-depend on the current Fray release line`)
        }
        const entry = entries.get(definition.name)
        assert(entry?.version === definition.version, `artifact report version drifted for ${definition.name}`)
        assert(basename(entry.filename ?? '') === entry.filename, `unsafe artifact filename for ${definition.name}`)
        const tarball = join(artifactRoot, 'packages', entry.filename)
        assert(existsSync(tarball), `tarball is missing for ${definition.name}`)
        const digest = createHash('sha256').update(readFileSync(tarball)).digest('hex')
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

function stagePackages(selected, artifacts) {
    assert(process.env.GITHUB_ACTIONS === 'true', 'staging is allowed only in GitHub Actions')
    assert(process.env.GITHUB_REF === 'refs/heads/main', 'staging is allowed only from main')
    assert(!process.env.NODE_AUTH_TOKEN && !process.env.NPM_TOKEN, 'long-lived npm tokens must not be present')
    for (let index = 0; index < selected.length; index += 1) {
        if (index > 0) assertVersionsAvailable([selected[index]])
        const artifact = artifacts[index]
        const result = run('npm', ['stage', 'publish', artifact.tarball, '--access', 'public', '--tag', artifact.tag], {inherit: true})
        assert(result.status === 0, `staging failed for ${artifact.name}; inspect npm's staged packages before retrying`)
    }
    console.log('[stage-release] staged successfully; CI cannot approve these packages')
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
