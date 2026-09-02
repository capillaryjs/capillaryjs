import type {
    ScenarioAbortSignal,
    DemoScenario,
    ScenarioFetch,
    ScenarioFetchInit,
    ScenarioFetchResponse,
    ScenarioRequest,
} from '../contract.js'

export interface ScenarioFetchOptions {
    scenario: DemoScenario
}

export function createScenarioFetch(options: ScenarioFetchOptions): ScenarioFetch {
    const {scenario} = options

    return async (url, init = {}) => {
        const request: ScenarioRequest = {
            method: init.method ?? 'GET',
            url,
            ...(init.body === undefined ? {} : {body: parseBody(init.body)}),
        }
        await abortableDelay(scenario.delayFor?.(request) ?? 0, init.signal)
        throwIfAborted(init.signal)
        const response = await scenario.handle(request)
        return createResponse(response.status, response.headers, response.body)
    }
}

function parseBody(body: string): unknown {
    if (body.length === 0) return undefined
    try {
        return JSON.parse(body) as unknown
    } catch {
        return body
    }
}

function createResponse(
    status: number,
    headers: Readonly<Record<string, string>>,
    body: unknown,
): ScenarioFetchResponse {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers,
        async json() {
            return structuredClone(body)
        },
    }
}

function abortableDelay(
    milliseconds: number,
    signal: ScenarioFetchInit['signal'],
): Promise<void> {
    throwIfAborted(signal)
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            signal?.removeEventListener?.('abort', onAbort)
            resolve()
        }, milliseconds)
        const onAbort = () => {
            clearTimeout(timer)
            signal?.removeEventListener?.('abort', onAbort)
            reject(createAbortError())
        }
        signal?.addEventListener?.('abort', onAbort, {once: true})
    })
}

function throwIfAborted(signal: ScenarioAbortSignal | null | undefined): void {
    if (signal?.aborted === true) throw createAbortError()
}

function createAbortError(): Error {
    const error = new Error('The request was aborted')
    error.name = 'AbortError'
    return error
}
