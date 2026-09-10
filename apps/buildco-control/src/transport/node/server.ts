import {readFile} from 'node:fs/promises'
import {createServer} from 'node:http'
import type {IncomingMessage, Server, ServerResponse} from 'node:http'
import {pathToFileURL} from 'node:url'

import type {
    DemoScenario,
    ScenarioRequest,
    ScenarioResponse,
} from '../contract.js'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 4176
const MAX_BODY_BYTES = 64 * 1024

export interface DummyServerOptions {
    scenario: DemoScenario
    host?: string
    port?: number
    html?: string
    htmlPath?: string
}

export interface RunningDummyServer {
    readonly host: string
    readonly port: number
    readonly origin: string
    close(): Promise<void>
}

export async function startDummyServer(
    options: DummyServerOptions,
): Promise<RunningDummyServer> {
    const host = options.host ?? DEFAULT_HOST
    const {scenario} = options
    validateScenario(scenario)
    const html = options.html ?? (
        options.htmlPath === undefined ? undefined : await readFile(options.htmlPath, 'utf8')
    )
    const server = createServer((request, response) => {
        void routeRequest(request, response, scenario, html)
    })

    await listen(server, options.port ?? DEFAULT_PORT, host)
    const address = server.address()
    if (address == null || typeof address === 'string') {
        await closeServer(server)
        throw new Error('Dummy server did not expose a TCP address')
    }
    return {
        host,
        port: address.port,
        origin: `http://${host}:${address.port}`,
        close: () => closeServer(server),
    }
}

async function routeRequest(
    request: IncomingMessage,
    response: ServerResponse,
    scenario: DemoScenario,
    html: string | undefined,
): Promise<void> {
    try {
        const requestUrl = request.url ?? '/'
        const url = new URL(requestUrl, 'http://dummy.local')
        if (!url.pathname.startsWith('/api/')) {
            if (html === undefined) {
                writeScenarioResponse(response, {
                    status: 404,
                    headers: {'content-type': 'application/json; charset=utf-8'},
                    body: {error: {code: 'not_found', message: 'Route not found'}},
                })
                return
            }
            serveHtml(request, response, html)
            return
        }

        const scenarioRequest: ScenarioRequest = {
            method: request.method ?? 'GET',
            url: requestUrl,
            ...(await readJsonBody(request)),
        }
        await delay(scenario.delayFor?.(scenarioRequest) ?? 0)
        writeScenarioResponse(response, await scenario.handle(scenarioRequest))
    } catch (error: unknown) {
        if (response.headersSent) {
            response.destroy(error instanceof Error ? error : undefined)
            return
        }
        const message = error instanceof Error ? error.message : 'Unknown server error'
        writeScenarioResponse(response, {
            status: message === 'Request body is too large' ? 413 : 400,
            headers: {'content-type': 'application/json; charset=utf-8'},
            body: {error: {code: 'invalid_request', message}},
        })
    }
}

function serveHtml(request: IncomingMessage, response: ServerResponse, html: string): void {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, {
            allow: 'GET, HEAD',
            'content-type': 'text/plain; charset=utf-8',
        })
        response.end('Method not allowed')
        return
    }
    response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': 'text/html; charset=utf-8',
    })
    response.end(request.method === 'HEAD' ? undefined : html)
}

async function readJsonBody(
    request: IncomingMessage,
): Promise<{body?: unknown}> {
    if (request.method === 'GET' || request.method === 'HEAD') return {}
    const chunks: Buffer[] = []
    let length = 0
    for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        length += buffer.length
        if (length > MAX_BODY_BYTES) throw new Error('Request body is too large')
        chunks.push(buffer)
    }
    if (length === 0) return {}
    const text = Buffer.concat(chunks).toString('utf8')
    try {
        return {body: JSON.parse(text) as unknown}
    } catch {
        return {body: text}
    }
}

function writeScenarioResponse(response: ServerResponse, result: ScenarioResponse): void {
    response.writeHead(result.status, result.headers)
    response.end(JSON.stringify(result.body))
}

function delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function listen(server: Server, port: number, host: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const onError = (error: Error) => {
            server.off('listening', onListening)
            reject(error)
        }
        const onListening = () => {
            server.off('error', onError)
            resolve()
        }
        server.once('error', onError)
        server.once('listening', onListening)
        server.listen(port, host)
    })
}

function closeServer(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error) => error == null ? resolve() : reject(error))
    })
}

interface CommandLineOptions {
    host: string
    port: number
    htmlPath?: string
    scenarioModule: string
}

function parseCommandLine(args: readonly string[]): CommandLineOptions {
    const values = new Map<string, string>()
    for (let index = 0; index < args.length; index += 2) {
        const key = args[index]
        const value = args[index + 1]
        if (key == null || !key.startsWith('--') || value == null) {
            throw new Error(
                'Expected --scenario-module, --host, --port, or --html followed by a value',
            )
        }
        values.set(key, value)
    }
    const scenarioModule = values.get('--scenario-module')
    if (scenarioModule === undefined) {
        throw new Error('The CLI requires an explicit --scenario-module path')
    }
    const port = Number(values.get('--port') ?? DEFAULT_PORT)
    if (!Number.isInteger(port) || port < 0 || port > 65_535) {
        throw new Error(`Invalid port: ${String(values.get('--port'))}`)
    }
    const htmlPath = values.get('--html')
    return {
        host: values.get('--host') ?? DEFAULT_HOST,
        port,
        ...(htmlPath === undefined ? {} : {htmlPath}),
        scenarioModule,
    }
}

interface ScenarioModule {
    createScenario?: () => DemoScenario | Promise<DemoScenario>
}

async function loadScenario(modulePath: string): Promise<DemoScenario> {
    const absoluteUrl = new URL(modulePath, pathToFileURL(`${process.cwd()}/`))
    const loaded = await import(absoluteUrl.href) as ScenarioModule
    if (typeof loaded.createScenario !== 'function') {
        throw new Error('Scenario module must export a createScenario() function')
    }
    const scenario = await loaded.createScenario()
    validateScenario(scenario)
    return scenario
}

function validateScenario(scenario: DemoScenario): void {
    if (typeof scenario?.id !== 'string' || scenario.id.length === 0) {
        throw new Error('Scenario must expose a non-empty id')
    }
    if (typeof scenario.reset !== 'function' || typeof scenario.handle !== 'function') {
        throw new Error('Scenario must implement reset() and handle()')
    }
}

function isMainModule(): boolean {
    const entry = process.argv[1]
    return entry != null && pathToFileURL(entry).href === import.meta.url
}

if (isMainModule()) {
    const options = parseCommandLine(process.argv.slice(2))
    const running = await startDummyServer({
        host: options.host,
        port: options.port,
        ...(options.htmlPath === undefined ? {} : {htmlPath: options.htmlPath}),
        scenario: await loadScenario(options.scenarioModule),
    })
    console.log(`Dummy server listening at ${running.origin}`)
}

export const createDummyServer = startDummyServer
