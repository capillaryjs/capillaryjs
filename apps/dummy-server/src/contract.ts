export interface ScenarioRequest {
    method: string
    url: string
    body?: unknown
}

export interface ScenarioResponse<TBody = unknown> {
    status: number
    headers: Readonly<Record<string, string>>
    body: TBody
}

/** Application-owned behavior injected into either transport adapter. */
export interface DemoScenario {
    readonly id: string
    reset(): void | Promise<void>
    delayFor?(request: ScenarioRequest): number
    handle(request: ScenarioRequest): ScenarioResponse | Promise<ScenarioResponse>
}

export interface ScenarioAbortSignal {
    readonly aborted: boolean
    addEventListener?(
        type: 'abort',
        listener: () => void,
        options?: {once?: boolean},
    ): void
    removeEventListener?(type: 'abort', listener: () => void): void
}

export interface ScenarioFetchInit {
    method?: string
    headers?: Readonly<Record<string, string>>
    body?: string
    signal?: ScenarioAbortSignal | null
}

export interface ScenarioFetchResponse {
    readonly ok: boolean
    readonly status: number
    readonly headers: Readonly<Record<string, string>>
    json(): Promise<unknown>
}

export type ScenarioFetch = (
    url: string,
    init?: ScenarioFetchInit,
) => Promise<ScenarioFetchResponse>
