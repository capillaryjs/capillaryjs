/** Timer seam used to delay retry attempts; mirrors the polling scheduler shape. */
export interface RetryScheduler {
    schedule(callback: () => void, delayMs: number): unknown
    cancel(handle: unknown): void
}

/**
 * Delay strategy between attempts: a fixed interval, a doubling exponential,
 * or a custom function receiving the 1-based failed attempt and its error.
 * Custom results are used as-is so Retry-After-style delays stay expressible.
 */
export type RetryBackoff =
    | 'fixed'
    | 'exponential'
    | ((attempt: number, error: unknown) => number)

/**
 * Opt-in retry behavior for live queries and commands. The policy's presence
 * is the opt-in; absent means a single attempt. A `null` value where the
 * option is accepted explicitly disables an inherited endpoint default.
 */
export interface RetryPolicy {
    /** Total attempts including the first. Default 3. */
    maxAttempts?: number
    /** Base delay between attempts in milliseconds. Default 500. */
    delayMs?: number
    /** Delay strategy. Default 'exponential'. */
    backoff?: RetryBackoff
    /** Cap applied to built-in backoff results. Default 30_000. */
    maxDelayMs?: number
    /** Full jitter applied to the computed delay. Default true. */
    jitter?: boolean
    /** Decides whether a failed attempt is retried. Default retries any non-abort error. */
    shouldRetry?: (error: unknown, attempt: number) => boolean
    /** Injectable timer for deterministic tests. */
    scheduler?: RetryScheduler
}

export interface ResolvedRetryPolicy {
    maxAttempts: number
    delayMs: number
    backoff: RetryBackoff
    maxDelayMs: number
    jitter: boolean
    shouldRetry: (error: unknown, attempt: number) => boolean
    scheduler: RetryScheduler
}

export function resolveRetryPolicy(
    policy: RetryPolicy | null | undefined,
): ResolvedRetryPolicy | null {
    if (policy == null) return null
    assertRetryPolicy(policy)
    return {
        maxAttempts: policy.maxAttempts ?? 3,
        delayMs: policy.delayMs ?? 500,
        backoff: policy.backoff ?? 'exponential',
        maxDelayMs: policy.maxDelayMs ?? 30_000,
        jitter: policy.jitter ?? true,
        shouldRetry: policy.shouldRetry ?? ((error: unknown) => !isAbortError(error)),
        scheduler: policy.scheduler ?? defaultRetryScheduler,
    }
}

/** Computes the delay before the next attempt; `attempt` is the failed 1-based attempt. */
export function computeRetryDelay(
    policy: ResolvedRetryPolicy,
    attempt: number,
    error: unknown,
): number {
    let delay: number
    if (typeof policy.backoff === 'function') {
        delay = policy.backoff(attempt, error)
    } else {
        delay = policy.backoff === 'fixed'
            ? policy.delayMs
            : policy.delayMs * 2 ** (attempt - 1)
        delay = Math.min(delay, policy.maxDelayMs)
    }
    if (!Number.isFinite(delay) || delay < 0) {
        throw new RangeError('Retry backoff must produce a finite non-negative delay')
    }
    return policy.jitter ? Math.random() * delay : delay
}

export function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError'
}

const defaultRetryScheduler: RetryScheduler = {
    schedule(callback, delayMs) {
        const schedule = Reflect.get(globalThis, 'setTimeout')
        if (typeof schedule !== 'function') {
            throw new Error('Retry requires an injected scheduler in this runtime')
        }
        return Reflect.apply(schedule, globalThis, [callback, delayMs])
    },
    cancel(handle) {
        const cancel = Reflect.get(globalThis, 'clearTimeout')
        if (typeof cancel === 'function') Reflect.apply(cancel, globalThis, [handle])
    },
}

function assertRetryPolicy(policy: RetryPolicy): void {
    if (typeof policy !== 'object' || Array.isArray(policy)) {
        throw new TypeError('Retry policy must be an object')
    }
    if (policy.maxAttempts !== undefined
        && (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts < 1)) {
        throw new RangeError('Retry maxAttempts must be a positive integer')
    }
    if (policy.delayMs !== undefined
        && (!Number.isFinite(policy.delayMs) || policy.delayMs < 0)) {
        throw new RangeError('Retry delayMs must be a finite non-negative number')
    }
    if (policy.maxDelayMs !== undefined
        && (!Number.isFinite(policy.maxDelayMs) || policy.maxDelayMs < 0)) {
        throw new RangeError('Retry maxDelayMs must be a finite non-negative number')
    }
    if (policy.backoff !== undefined
        && policy.backoff !== 'fixed'
        && policy.backoff !== 'exponential'
        && typeof policy.backoff !== 'function') {
        throw new TypeError('Retry backoff must be fixed, exponential, or a function')
    }
    if (policy.jitter !== undefined && typeof policy.jitter !== 'boolean') {
        throw new TypeError('Retry jitter must be a boolean')
    }
    if (policy.shouldRetry !== undefined && typeof policy.shouldRetry !== 'function') {
        throw new TypeError('Retry shouldRetry must be a function')
    }
    if (policy.scheduler !== undefined
        && (policy.scheduler == null
            || typeof policy.scheduler.schedule !== 'function'
            || typeof policy.scheduler.cancel !== 'function')) {
        throw new TypeError('Retry scheduler must implement schedule() and cancel()')
    }
}
