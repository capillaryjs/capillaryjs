import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {
    copyFileSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs'
import {basename, dirname, isAbsolute, join, relative, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const workspaceRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const artifactRoot = join(workspaceRoot, '.artifacts', 'release')
const npmCache = join(artifactRoot, 'npm-cache')
const packageOutput = join(artifactRoot, 'packages')

const definitions = [
    {
        directory: join(workspaceRoot, 'packages', 'glue'),
        name: '@sylwellsoftware/glue',
        allow(path) {
            return path === 'EXPERIMENTAL.md'
                || path === 'LICENSE'
                || path === 'NOTICE'
                || path === 'README.md'
                || path === 'package.json'
                || isDistributionFile(path)
        },
    },
    {
        directory: join(workspaceRoot, 'packages', 'fray'),
        name: '@sylwellsoftware/fray',
        allow(path) {
            return path === 'EXPERIMENTAL.md'
                || path === 'LICENSE'
                || path === 'NOTICE'
                || path === 'README.md'
                || path === 'package.json'
                || isDistributionFile(path)
                || /^themes\/(?:README\.md|light\.css|dark\.css)$/.test(path)
        },
    },
]

resetArtifactDirectory()

const packageReports = []
for (const definition of definitions) {
    const sourceManifest = readJson(join(definition.directory, 'package.json'))
    assert(sourceManifest.private === false, `${definition.name} must be publishable`)
    assert(sourceManifest.name === definition.name, `${definition.name} manifest name drifted`)

    run('pnpm', ['prepack'], {cwd: definition.directory})
    const dryRun = npmDryRun(definition.directory)
    assert(dryRun.name === definition.name, `${definition.name} npm dry-run name drifted`)
    assert(dryRun.version === sourceManifest.version, `${definition.name} version drifted`)
    validateAllowedFiles(definition, dryRun.files.map(({path}) => path))

    const firstPackDirectory = join(artifactRoot, `pack-a-${basename(definition.directory)}`)
    const secondPackDirectory = join(artifactRoot, `pack-b-${basename(definition.directory)}`)
    const firstTarball = createPack(definition.directory, firstPackDirectory)
    const secondTarball = createPack(definition.directory, secondPackDirectory)
    const firstChecksum = sha256(firstTarball)
    const secondChecksum = sha256(secondTarball)
    assert(
        firstChecksum === secondChecksum,
        `${definition.name} tarball is not byte-for-byte deterministic`,
    )

    const finalTarball = join(packageOutput, basename(firstTarball))
    copyFileSync(firstTarball, finalTarball)
    const tarFiles = tarInventory(finalTarball)
    const dryRunFiles = dryRun.files.map(({path}) => path).sort()
    assertArraysEqual(
        tarFiles.map((path) => path.slice('package/'.length)),
        dryRunFiles,
        `${definition.name} npm dry-run and real tarball inventories differ`,
    )
    validateAllowedFiles(
        definition,
        tarFiles.map((path) => path.slice('package/'.length)),
    )
    validateTarball(definition, finalTarball, tarFiles, sourceManifest.version)

    packageReports.push({
        name: definition.name,
        version: sourceManifest.version,
        filename: basename(finalTarball),
        bytes: statSync(finalTarball).size,
        sha256: firstChecksum,
        dryRun: {
            entryCount: dryRun.entryCount,
            unpackedBytes: dryRun.unpackedSize,
            files: dryRun.files
                .map(({path, size}) => ({path, bytes: size}))
                .sort((left, right) => left.path.localeCompare(right.path)),
        },
        tarFiles,
    })

    rmSync(firstPackDirectory, {recursive: true, force: true})
    rmSync(secondPackDirectory, {recursive: true, force: true})
}

const reportPath = join(artifactRoot, 'package-artifacts.json')
writeFileSync(reportPath, `${JSON.stringify({schemaVersion: 1, packages: packageReports}, null, 2)}\n`)

for (const report of packageReports) {
    console.log(
        `[pack] ${report.name}@${report.version}: ${report.tarFiles.length} files, `
        + `${report.bytes} bytes, sha256 ${report.sha256}`,
    )
}
console.log(`[pack] report: ${relative(workspaceRoot, reportPath)}`)

function npmDryRun(directory) {
    const output = run('npm', [
        'pack',
        '--dry-run',
        '--json',
        '--ignore-scripts',
        '--cache',
        npmCache,
    ], {cwd: directory})
    const parsed = JSON.parse(output)
    assert(Array.isArray(parsed) && parsed.length === 1, 'npm pack returned an invalid report')
    return parsed[0]
}

function createPack(directory, destination) {
    mkdirSync(destination, {recursive: true})
    run('pnpm', ['pack', '--pack-destination', destination], {cwd: directory})
    const archives = readdirSync(destination)
        .filter((name) => name.endsWith('.tgz'))
        .map((name) => join(destination, name))
    assert(archives.length === 1, `Expected one tarball in ${destination}`)
    return archives[0]
}

function tarInventory(tarball) {
    return run('tar', ['-tzf', tarball])
        .split('\n')
        .map((path) => path.replace(/^\.\//, ''))
        .filter((path) => path.length > 0 && !path.endsWith('/'))
        .sort()
}

function validateAllowedFiles(definition, paths) {
    for (const path of paths) {
        assert(!isAbsolute(path), `${definition.name} contains absolute path ${path}`)
        assert(!path.split('/').includes('..'), `${definition.name} contains unsafe path ${path}`)
        assert(definition.allow(path), `${definition.name} contains unexpected file ${path}`)
    }
    assert(paths.includes('README.md'), `${definition.name} tarball omits README.md`)
    assert(paths.includes('LICENSE'), `${definition.name} tarball omits LICENSE`)
    assert(paths.includes('NOTICE'), `${definition.name} tarball omits NOTICE`)
    assert(paths.includes('package.json'), `${definition.name} tarball omits package.json`)
    assert(paths.some((path) => path === 'dist/index.js'), `${definition.name} omits ESM root`)
    assert(paths.some((path) => path === 'dist/index.d.ts'), `${definition.name} omits root types`)
}

function validateTarball(definition, tarball, tarFiles, expectedVersion) {
    for (const path of tarFiles) {
        assert(path.startsWith('package/'), `${definition.name} contains non-package path ${path}`)
    }

    const manifest = JSON.parse(readTarFile(tarball, 'package/package.json'))
    assert(manifest.name === definition.name, `${definition.name} packed name drifted`)
    assert(manifest.version === expectedVersion, `${definition.name} packed version drifted`)
    assert(manifest.private === false, `${definition.name} tarball is not publishable`)
    assert(manifest.license === 'Apache-2.0', `${definition.name} license drifted`)
    assert(
        manifest.author?.name === 'Sylwell Software'
            && manifest.author?.email === 'npm@sylwellsoftware.com',
        `${definition.name} author metadata drifted`,
    )
    assert(
        manifest.repository?.url === 'git+https://github.com/sylwellsoftware/gluefrayjs.git',
        `${definition.name} repository metadata drifted`,
    )
    assert(manifest.publishConfig?.access === 'public', `${definition.name} access drifted`)
    assert(manifest.type === 'module', `${definition.name} must remain ESM-only`)
    assert(manifest.engines?.node === '>=22', `${definition.name} packed Node engine drifted`)
    assertNoLocalDependencyRanges(manifest, definition.name)
    validateExportTargets(manifest, tarFiles, definition.name)

    if (definition.name === '@sylwellsoftware/fray') {
        const gluePeer = manifest.peerDependencies?.['@sylwellsoftware/glue']
        assert(
            typeof gluePeer === 'string'
                && gluePeer.length > 0
                && !/^(?:file:|link:|workspace:)/.test(gluePeer),
            'Fray packed Glue peer range is missing or local-only',
        )
        assert(
            !Object.hasOwn(manifest.dependencies ?? {}, '@sylwellsoftware/glue'),
            'Fray must not bundle Glue as a runtime dependency',
        )
    }

    for (const path of tarFiles.filter(isTextTarPath)) {
        const contents = readTarFile(tarball, path)
        assertSafeText(contents, `${definition.name}:${path}`)
        if (path.endsWith('.map')) validateSourceMap(contents, `${definition.name}:${path}`)
    }
}

function validateExportTargets(manifest, tarFiles, packageName) {
    const targets = collectExportTargets(manifest.exports)
    for (const target of targets) {
        assert(target.startsWith('./'), `${packageName} export must be relative: ${target}`)
        const tarPath = `package/${target.slice(2)}`
        assert(tarFiles.includes(tarPath), `${packageName} export target is missing: ${target}`)
    }
}

function collectExportTargets(value) {
    if (typeof value === 'string') return [value]
    if (value == null || typeof value !== 'object') return []
    return Object.values(value).flatMap(collectExportTargets)
}

function assertNoLocalDependencyRanges(manifest, packageName) {
    const groups = [
        'dependencies',
        'devDependencies',
        'optionalDependencies',
        'peerDependencies',
    ]
    for (const group of groups) {
        for (const [name, range] of Object.entries(manifest[group] ?? {})) {
            assert(
                typeof range === 'string'
                    && !/^(?:file:|link:|workspace:)/.test(range),
                `${packageName} packed ${group}.${name} uses local range ${String(range)}`,
            )
        }
    }
}

function validateSourceMap(contents, label) {
    const map = JSON.parse(contents)
    assert(Array.isArray(map.sources), `${label} has no source list`)
    for (const source of map.sources) {
        assert(typeof source === 'string', `${label} has a non-string source path`)
        assert(!isAbsolute(source), `${label} discloses absolute source path ${source}`)
        assert(!/^[A-Za-z]:[\\/]/.test(source), `${label} discloses Windows path ${source}`)
        assert(!source.startsWith('file:'), `${label} discloses file URI ${source}`)
        assert(!source.includes('node_modules/'), `${label} embeds dependency source ${source}`)
    }
}

function assertSafeText(contents, label) {
    const forbiddenMarkers = [
        workspaceRoot,
        ['/Users', '/'].join(''),
        ['/home', '/'].join(''),
        ['srvtest', '.net'].join(''),
        ['/bank', '2/'].join(''),
        ['APP', '_CONFIG'].join(''),
        ['@', 'corner/'].join(''),
        ['link', ':'].join(''),
        ['workspace', ':'].join(''),
    ]
    for (const marker of forbiddenMarkers) {
        assert(!contents.includes(marker), `${label} contains forbidden marker ${marker}`)
    }
    const secretPatterns = [
        /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
        /\bAKIA[0-9A-Z]{16}\b/,
        /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
        /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
        /\bnpm_[A-Za-z0-9]{20,}\b/,
        /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
    ]
    for (const pattern of secretPatterns) {
        assert(!pattern.test(contents), `${label} matches secret pattern ${pattern}`)
    }
}

function readTarFile(tarball, path) {
    return run('tar', ['-xOf', tarball, path])
}

function isDistributionFile(path) {
    return path.startsWith('dist/')
        && /\.(?:d\.ts|d\.ts\.map|js|js\.map)$/.test(path)
}

function isTextTarPath(path) {
    return /(?:^|\/)(?:LICENSE|NOTICE)$/.test(path)
        || /\.(?:css|js|json|map|md|ts)$/.test(path)
}

function sha256(path) {
    return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'))
}

function run(command, args, {cwd = workspaceRoot} = {}) {
    const result = spawnSync(command, args, {
        cwd,
        encoding: 'utf8',
        env: process.env,
        maxBuffer: 64 * 1024 * 1024,
    })
    if (result.status !== 0) {
        const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
        throw new Error(`${command} ${args.join(' ')} failed${details ? `\n${details}` : ''}`)
    }
    return result.stdout.trim()
}

function resetArtifactDirectory() {
    assert(dirname(artifactRoot) === join(workspaceRoot, '.artifacts'), 'Unsafe artifact root')
    assert(basename(artifactRoot) === 'release', 'Unsafe artifact directory name')
    rmSync(artifactRoot, {recursive: true, force: true})
    mkdirSync(npmCache, {recursive: true})
    mkdirSync(packageOutput, {recursive: true})
}

function assertArraysEqual(actual, expected, message) {
    assert(
        actual.length === expected.length
            && actual.every((value, index) => value === expected[index]),
        `${message}\nactual: ${actual.join(', ')}\nexpected: ${expected.join(', ')}`,
    )
}

function assert(condition, message) {
    if (!condition) throw new Error(message)
}
