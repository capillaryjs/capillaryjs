import {spawn, spawnSync} from 'node:child_process'
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    realpathSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

import {chromium} from '@playwright/test'

const workspaceRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const artifactRoot = join(workspaceRoot, '.artifacts', 'release')
const report = JSON.parse(readFileSync(join(artifactRoot, 'package-artifacts.json'), 'utf8'))
const glue = findPackage('@sylwellsoftware/glue')
const fray = findPackage('@sylwellsoftware/fray')
const glueTarball = join(artifactRoot, 'packages', glue.filename)
const frayTarball = join(artifactRoot, 'packages', fray.filename)
const fixtureRoot = mkdtempSync(join(tmpdir(), 'gluefray-consumer-'))

let completed = false
try {
    writeConsumerManifest(false)
    installFixture()
    assertInstalledPackage('@sylwellsoftware/glue', glue.version)

    writeConsumerManifest(true)
    installFixture()
    assertInstalledPackage('@sylwellsoftware/glue', glue.version)
    assertInstalledPackage('@sylwellsoftware/fray', fray.version)
    assertSingleGlueInstall()

    writeFixtureSources()
    run('pnpm', ['typecheck'], fixtureRoot)
    run('pnpm', ['build'], fixtureRoot)
    assertSafeBundle()
    await verifyBrowserRuntime()
    completed = true
    console.log('[consumer] ESM, automatic JSX, h(), CSS, peer identity, build, and browser smoke passed')
} finally {
    rmSync(fixtureRoot, {recursive: true, force: true})
    if (!completed) console.error('[consumer] failed fixture removed')
}

function writeConsumerManifest(includeFray) {
    const typescript = installedToolVersion('typescript')
    const vite = installedToolVersion('vite')
    const dependencies = {
        '@sylwellsoftware/glue': `file:${glueTarball}`,
    }
    if (includeFray) dependencies['@sylwellsoftware/fray'] = `file:${frayTarball}`

    writeJson('package.json', {
        name: 'gluefray-tarball-consumer',
        version: '0.0.0',
        private: true,
        type: 'module',
        packageManager: 'pnpm@10.11.0',
        scripts: {
            typecheck: 'tsc -p tsconfig.json --noEmit',
            build: 'vite build',
        },
        dependencies,
        devDependencies: {typescript, vite},
    })
}

function installFixture() {
    run('pnpm', [
        'install',
        '--ignore-workspace',
        '--prefer-offline',
        '--config.confirmModulesPurge=false',
    ], fixtureRoot)
}

function writeFixtureSources() {
    writeJson('tsconfig.json', {
        compilerOptions: {
            target: 'ES2023',
            module: 'ESNext',
            moduleResolution: 'Bundler',
            strict: true,
            exactOptionalPropertyTypes: true,
            noUncheckedIndexedAccess: true,
            useUnknownInCatchVariables: true,
            isolatedModules: true,
            verbatimModuleSyntax: true,
            lib: ['ES2023', 'DOM', 'DOM.Iterable'],
            jsx: 'react-jsx',
            jsxImportSource: '@sylwellsoftware/fray',
            noEmit: true,
        },
        include: ['src/**/*.ts', 'src/**/*.tsx'],
    })
    writeFileSync(join(fixtureRoot, 'index.html'), `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Glue Fray smoke</title></head>
<body><div id="app"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
`)
    mkdirSync(join(fixtureRoot, 'src'), {recursive: true})
    writeFileSync(join(fixtureRoot, 'src', 'main.tsx'), `import {Emitter} from '@sylwellsoftware/glue'
import {Button, Component, Panel, Textbox, h, styleRegistry} from '@sylwellsoftware/fray'
import '@sylwellsoftware/fray/themes/light.css'

class App extends Component {
    readonly count = new Emitter(0)
    readonly name = new Emitter('Ada')
    readonly textbox = new Textbox({label: 'Name', valueEmitter: this.name})

    initialize(): void {
        this.watch(this.count, this.name)
    }

    render() {
        const peerIdentity = this.textbox.valueEmitter === this.name
            && this.textbox.valueEmitter instanceof Emitter
        return <main data-peer-identity={String(peerIdentity)}>
            <Panel header="Tarball consumer">
                {this.textbox}
                <Button
                    label={\`Count: \${this.count.get()}\`}
                    onClick={() => this.count.set(this.count.get() + 1)}
                />
                {h('p', {id: 'h-output'}, \`Hello, \${this.name.get()}.\`)}
            </Panel>
        </main>
    }

    onDestroy(): void {
        this.count.dispose()
        this.name.dispose()
    }

    static dependencies = [Button, Panel, Textbox]
}

App.registerStyles()
styleRegistry.injectAll(document)
App.new().attachTo(document.querySelector('#app')!)
`)
}

async function verifyBrowserRuntime() {
    const server = spawn(
        'pnpm',
        ['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', '4176', '--strictPort'],
        {cwd: fixtureRoot, stdio: ['ignore', 'pipe', 'pipe']},
    )
    let output = ''
    server.stdout.on('data', (chunk) => { output += chunk.toString() })
    server.stderr.on('data', (chunk) => { output += chunk.toString() })

    try {
        await waitForServer(server, () => output)
        const browser = await chromium.launch({headless: true})
        try {
            const page = await browser.newPage()
            const pageErrors = []
            page.on('pageerror', (error) => pageErrors.push(error))
            await page.goto('http://127.0.0.1:4176/', {waitUntil: 'networkidle'})
            await expectText(page, 'button', 'Count: 0')
            await page.getByRole('button', {name: 'Count: 0'}).click()
            await expectText(page, 'button', 'Count: 1')
            await expectText(page, '#h-output', 'Hello, Ada.')
            const peerIdentity = await page.locator('main').getAttribute('data-peer-identity')
            assert(peerIdentity === 'true', 'Fray did not resolve the consumer Glue instance')
            assert(pageErrors.length === 0, `Browser emitted page errors: ${pageErrors.join(', ')}`)
        } finally {
            await browser.close()
        }
    } finally {
        await stopServer(server)
    }
}

async function waitForServer(server, readOutput) {
    const deadline = Date.now() + 20_000
    while (Date.now() < deadline) {
        if (server.exitCode != null) {
            throw new Error(`Consumer preview exited early\n${readOutput()}`)
        }
        try {
            const response = await fetch('http://127.0.0.1:4176/')
            if (response.ok) return
        } catch {}
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
    }
    throw new Error(`Timed out waiting for consumer preview\n${readOutput()}`)
}

async function stopServer(server) {
    if (server.exitCode != null) return
    server.kill('SIGTERM')
    await Promise.race([
        new Promise((resolvePromise) => server.once('exit', resolvePromise)),
        new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000)),
    ])
    if (server.exitCode == null) server.kill('SIGKILL')
}

async function expectText(page, selector, expected) {
    const actual = await page.locator(selector).textContent()
    assert(actual === expected, `Expected ${selector} to contain ${expected}; received ${String(actual)}`)
}

function assertInstalledPackage(name, version) {
    const manifestPath = join(fixtureRoot, 'node_modules', ...name.split('/'), 'package.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    assert(manifest.version === version, `${name} installed version drifted`)
    assertNoLocalRanges(manifest, name)
}

function assertSingleGlueInstall() {
    const packagePath = realpathSync(join(
        fixtureRoot,
        'node_modules',
        '@sylwellsoftware',
        'glue',
        'package.json',
    ))
    const listedPaths = run(
        'pnpm',
        ['list', '@sylwellsoftware/glue', '--depth', 'Infinity', '--parseable', '--ignore-workspace'],
        fixtureRoot,
    ).split('\n').filter(Boolean)
    const gluePaths = listedPaths.filter((path) => {
        try {
            return JSON.parse(readFileSync(join(path, 'package.json'))).name
                === '@sylwellsoftware/glue'
        } catch {
            return false
        }
    })
    const resolvedPaths = new Set(gluePaths.map((path) => realpathSync(path)))
    assert(
        resolvedPaths.size === 1,
        `Consumer resolved ${resolvedPaths.size} Glue instances: ${[...resolvedPaths].join(', ')}`,
    )
    assert(!packagePath.includes(workspaceRoot), 'Consumer resolved Glue from the workspace')
}

function assertSafeBundle() {
    for (const path of listFiles(join(fixtureRoot, 'dist'))) {
        const contents = readFileSync(path, 'utf8')
        for (const marker of [
            workspaceRoot,
            ['@', 'corner/'].join(''),
            ['workspace', ':'].join(''),
            ['link', ':'].join(''),
            ['srvtest', '.net'].join(''),
        ]) {
            assert(!contents.includes(marker), `Consumer bundle contains forbidden marker ${marker}`)
        }
    }
}

function listFiles(directory) {
    return readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) return listFiles(path)
        return statSync(path).isFile() ? [path] : []
    })
}

function assertNoLocalRanges(manifest, name) {
    for (const group of ['dependencies', 'devDependencies', 'peerDependencies']) {
        for (const range of Object.values(manifest[group] ?? {})) {
            assert(
                typeof range === 'string' && !/^(?:file:|link:|workspace:)/.test(range),
                `${name} installed manifest contains local dependency range ${String(range)}`,
            )
        }
    }
}

function installedToolVersion(name) {
    const locations = {
        typescript: join(workspaceRoot, 'node_modules', 'typescript', 'package.json'),
        vite: join(workspaceRoot, 'packages', 'fray', 'node_modules', 'vite', 'package.json'),
    }
    const path = locations[name]
    assert(path != null, `Unknown consumer tool ${name}`)
    return JSON.parse(readFileSync(path)).version
}

function writeJson(path, value) {
    writeFileSync(join(fixtureRoot, path), `${JSON.stringify(value, null, 2)}\n`)
}

function findPackage(name) {
    const entry = report.packages.find((candidate) => candidate.name === name)
    assert(entry != null, `Artifact report does not contain ${name}`)
    return entry
}

function run(command, args, cwd) {
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

function assert(condition, message) {
    if (!condition) throw new Error(message)
}
