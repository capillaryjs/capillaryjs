import {spawn, spawnSync} from 'node:child_process'
import {createServer} from 'node:net'
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
const capillary = findPackage('@capillaryjs/capillary')
const capillaryUi = findPackage('@capillaryjs/capillary-ui')
const visualization = findPackage('@capillaryjs/capillary-viz')
const devtools = findPackage('@capillaryjs/capillary-devtools')
const capillaryTarball = join(artifactRoot, 'packages', capillary.filename)
const capillaryUiTarball = join(artifactRoot, 'packages', capillaryUi.filename)
const visualizationTarball = join(artifactRoot, 'packages', visualization.filename)
const devtoolsTarball = join(artifactRoot, 'packages', devtools.filename)
const fixtureRoot = mkdtempSync(join(tmpdir(), 'capillaryjs-consumer-'))

let completed = false
try {
    writeConsumerManifest(false)
    installFixture()
    assertInstalledPackage('@capillaryjs/capillary', capillary.version)

    writeConsumerManifest(true)
    installFixture()
    assertInstalledPackage('@capillaryjs/capillary', capillary.version)
    assertInstalledPackage('@capillaryjs/capillary-ui', capillaryUi.version)
    assertInstalledPackage('@capillaryjs/capillary-viz', visualization.version)
    assertInstalledPackage('@capillaryjs/capillary-devtools', devtools.version)
    assertSingleCapillaryInstall()

    writeFixtureSources()
    run('pnpm', ['typecheck'], fixtureRoot)
    run('pnpm', ['build'], fixtureRoot)
    assertSafeBundle()
    await verifyBrowserRuntime()
    completed = true
    console.log('[consumer] ESM, automatic JSX, h(), CSS, peer identity, visualization, build, and browser smoke passed')
} finally {
    rmSync(fixtureRoot, {recursive: true, force: true})
    if (!completed) console.error('[consumer] failed fixture removed')
}

function writeConsumerManifest(includeCapillaryUi) {
    const typescript = installedToolVersion('typescript')
    const vite = installedToolVersion('vite')
    const dependencies = {
        '@capillaryjs/capillary': `file:${capillaryTarball}`,
    }
    if (includeCapillaryUi) dependencies['@capillaryjs/capillary-ui'] = `file:${capillaryUiTarball}`
    if (includeCapillaryUi) {
        dependencies['@capillaryjs/capillary-viz'] = `file:${visualizationTarball}`
        dependencies['@capillaryjs/capillary-devtools'] = `file:${devtoolsTarball}`
    }

    writeJson('package.json', {
        name: 'capillaryjs-tarball-consumer',
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
        '--no-frozen-lockfile',
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
            jsxImportSource: '@capillaryjs/capillary-ui',
            noEmit: true,
        },
        include: ['src/**/*.ts', 'src/**/*.tsx'],
    })
    writeFileSync(join(fixtureRoot, 'index.html'), `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Capillary Capillary UI smoke</title></head>
<body><div id="app"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
`)
    mkdirSync(join(fixtureRoot, 'src'), {recursive: true})
    writeFileSync(join(fixtureRoot, 'src', 'main.tsx'), `import {DerivedEndpoint, Emitter, RestEndpoint} from '@capillaryjs/capillary'
import type {LiveResult} from '@capillaryjs/capillary'
import {
    Button,
    Component,
    Panel,
    Textbox,
    createCapillaryUiRuntime,
    createServiceScope,
    defineService,
    h,
    provideService,
} from '@capillaryjs/capillary-ui'
import {
    BlockGraph,
    createBlockSelection,
    createSplitSelection,
    staticCriterion,
} from '@capillaryjs/capillary-viz'
import '@capillaryjs/capillary-ui/styles/structural.css'
import '@capillaryjs/capillary-viz/styles/structural.css'
import {TraceRecorder, TraceSelection, TracePlayback, traceRoots, devtoolsDiagnosticScope} from '@capillaryjs/capillary-devtools/model'
import {TraceInspector} from '@capillaryjs/capillary-devtools/views/TraceInspector'
import '@capillaryjs/capillary-devtools/styles/structural.css'
import '@capillaryjs/capillary-ui/themes/base.css'
import '@capillaryjs/capillary-ui/colors/iceblue/colors.css'
import '@capillaryjs/capillary-ui/themes/minimal/theme.css'

const recorder = new TraceRecorder().start({fromStart: true})
const selection = new TraceSelection()
const playback = new TracePlayback()
const greetingService = defineService<{prefix: string}>('greeting')
type RecordRow = {id: string; state: 'open' | 'closed'}
const rows = new Emitter<readonly RecordRow[]>([
    {id: 'one', state: 'open'},
    {id: 'two', state: 'closed'},
])
const stateCriterion = staticCriterion<RecordRow>({
    key: 'state',
    label: 'State',
    categories: [
        {key: 'open', label: 'Open', colors: ['#dff', '#399', '#155'], predicate: row => row.state === 'open'},
        {key: 'closed', label: 'Closed', colors: ['#fdd', '#c66', '#622'], predicate: row => row.state === 'closed'},
    ],
})
const splitSelection = createSplitSelection([stateCriterion])
const blockSelection = createBlockSelection(rows, splitSelection.activeSplits$)

class App extends Component {
    readonly count = new Emitter(0, {purpose: 'counter'})
    readonly offset = new Emitter(1)
    readonly name = new Emitter('Ada')
    readonly textbox = new Textbox({label: 'Name', valueEmitter: this.name})
    readonly totalEndpoint = new DerivedEndpoint<number, {offset: number}, number>({
        apply: (count, {offset}) => count + offset,
    })
    readonly total: LiveResult<number> = this.totalEndpoint.open({
        source: this.count,
        args: {offset: this.offset},
    })
    readonly recordsEndpoint = new RestEndpoint<Record<string, never>, {id: string}>({
        url: 'https://example.test/records',
        fetch: async () => ({ok: true, json: () => ({id: 'record-1'})}),
        parseResult: (value) => value as {id: string},
    })
    private greeting = ''

    initialize(): void {
        this.greeting = this.requireService(greetingService).prefix
        this.watch(this.count, this.name, this.total)
    }

    render() {
        const peerIdentity = this.textbox.valueEmitter === this.name
            && this.textbox.valueEmitter instanceof Emitter
        return <main
            data-peer-identity={String(peerIdentity)}
            data-service={this.greeting}
        >
            <Panel header="Tarball consumer">
                {this.textbox}
                <Button
                    label={\`Count: \${this.count.get()}\`}
                    onClick={() => this.count.set(this.count.get() + 1)}
                />
                {h('p', {id: 'h-output'}, \`Hello, \${this.name.get()}.\`)}
                {h('p', {id: 'endpoint-output'}, \`Derived total: \${this.total.get()}\`)}
                <BlockGraph model={blockSelection} label="Record mosaic" />
            </Panel>
        </main>
    }

    onDestroy(): void {
        this.count.dispose()
        this.total.dispose()
        this.offset.dispose()
        this.name.dispose()
    }

    static dependencies = [BlockGraph, Button, Panel, Textbox]
    static requiredServices = [greetingService]
}

const services = createServiceScope([
    provideService(greetingService, () => ({prefix: 'scope-ready'})),
])
const runtime = createCapillaryUiRuntime({services})
runtime.registerStyles(App).injectStyles(document)
const app = runtime.create(App)
runtime.mount(app, document.querySelector('#app')!)
const inspector = new TraceInspector({recording: recorder, selection, playback})
runtime.registerStyles(TraceInspector).injectStyles(document)
runtime.mount(inspector, document.querySelector('#app')!)
recorder.revision.subscribe(() => {
    const root = traceRoots(recorder.snapshot()).findLast((event) => event.kind === 'interaction')
    if (root && selection.state.get().rootId !== root.id) selection.selectRoot(root.id)
}, {emitCurrent: false, diagnosticScope: devtoolsDiagnosticScope})
Reflect.set(window, 'consumerTrace', () => ({events: recorder.snapshot().events.length, count: app.count.get(),
    origins: recorder.snapshot().events.filter((event) => event.kind === 'interaction').length}))
`)
}

async function verifyBrowserRuntime() {
    const port = await availablePort()
    const address = `http://127.0.0.1:${port}`
    const server = spawn(
        'pnpm',
        ['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
        {cwd: fixtureRoot, stdio: ['ignore', 'pipe', 'pipe']},
    )
    let output = ''
    server.stdout.on('data', (chunk) => { output += chunk.toString() })
    server.stderr.on('data', (chunk) => { output += chunk.toString() })

    try {
        await waitForServer(server, () => output, address)
        const browser = await chromium.launch({headless: true})
        try {
            const page = await browser.newPage()
            const pageErrors = []
            page.on('pageerror', (error) => pageErrors.push(error))
            await page.goto(address, {waitUntil: 'networkidle'})
            const counter = page.getByRole('button', {name: 'Count: 0'})
            assert(await counter.textContent() === 'Count: 0', 'Counter button did not initialize')
            await counter.click()
            const updatedCounter = page.getByRole('button', {name: 'Count: 1'})
            assert(await updatedCounter.textContent() === 'Count: 1', 'Counter button did not update')
            const beforeReplay = await page.evaluate(() => Reflect.get(window, 'consumerTrace')())
            assert(beforeReplay.origins > 0, 'Packed DevTools did not capture the native interaction')
            await page.getByRole('button', {name: 'First step', exact: true}).click()
            await page.getByRole('button', {name: 'Next step', exact: true}).click()
            const afterReplay = await page.evaluate(() => Reflect.get(window, 'consumerTrace')())
            assert(JSON.stringify(beforeReplay) === JSON.stringify(afterReplay), 'Packed replay changed the application or captured itself')
            await expectText(page, '#h-output', 'Hello, Ada.')
            await expectText(page, '#endpoint-output', 'Derived total: 2')
            const peerIdentity = await page.locator('main').getAttribute('data-peer-identity')
            assert(peerIdentity === 'true', 'Capillary UI did not resolve the consumer Capillary instance')
            const service = await page.locator('main').getAttribute('data-service')
            assert(service === 'scope-ready', 'Capillary UI did not resolve the consumer service scope')
            const visualizationCount = await page.getByRole('treeitem', {name: /1 item/}).count()
            assert(visualizationCount === 2, 'Visualization package did not render both partitions')
            assert(pageErrors.length === 0, `Browser emitted page errors: ${pageErrors.join(', ')}`)
        } finally {
            await browser.close()
        }
    } finally {
        await stopServer(server)
    }
}

async function waitForServer(server, readOutput, address) {
    const deadline = Date.now() + 20_000
    while (Date.now() < deadline) {
        if (server.exitCode != null) {
            throw new Error(`Consumer preview exited early\n${readOutput()}`)
        }
        try {
            const response = await fetch(address)
            if (response.ok) return
        } catch {}
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
    }
    throw new Error(`Timed out waiting for consumer preview\n${readOutput()}`)
}

async function availablePort() {
    return await new Promise((resolvePromise, reject) => {
        const probe = createServer()
        probe.once('error', reject)
        probe.listen(0, '127.0.0.1', () => {
            const address = probe.address()
            if (address == null || typeof address === 'string') {
                probe.close(() => reject(new Error('Could not allocate a TCP port')))
                return
            }
            probe.close((error) => {
                if (error != null) reject(error)
                else resolvePromise(address.port)
            })
        })
    })
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

function assertSingleCapillaryInstall() {
    const packagePath = realpathSync(join(
        fixtureRoot,
        'node_modules',
        '@capillaryjs',
        'capillary',
        'package.json',
    ))
    const listedPaths = run(
        'pnpm',
        ['list', '@capillaryjs/capillary', '--depth', 'Infinity', '--parseable', '--ignore-workspace'],
        fixtureRoot,
    ).split('\n').filter(Boolean)
    const capillaryPaths = listedPaths.filter((path) => {
        try {
            return JSON.parse(readFileSync(join(path, 'package.json'))).name
                === '@capillaryjs/capillary'
        } catch {
            return false
        }
    })
    const resolvedPaths = new Set(capillaryPaths.map((path) => realpathSync(path)))
    assert(
        resolvedPaths.size === 1,
        `Consumer resolved ${resolvedPaths.size} Capillary instances: ${[...resolvedPaths].join(', ')}`,
    )
    assert(!packagePath.includes(workspaceRoot), 'Consumer resolved Capillary from the workspace')
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
        vite: join(workspaceRoot, 'packages', 'capillary-ui', 'node_modules', 'vite', 'package.json'),
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
