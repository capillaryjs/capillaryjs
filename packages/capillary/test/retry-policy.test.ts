import assert from 'node:assert/strict'
import {describe, test} from 'node:test'

import {computeRetryDelay, resolveRetryPolicy} from '../src/index.js'
import type {ResolvedRetryPolicy, RetryScheduler} from '../src/index.js'

describe('RetryPolicy delay calculation', () => {
    test('resolves documented defaults and caps built-in exponential backoff', () => {
        const scheduler = immediateScheduler()
        const defaults = requiredPolicy(resolveRetryPolicy({scheduler}))
        assert.equal(defaults.maxAttempts, 3)
        assert.equal(defaults.delayMs, 500)
        assert.equal(defaults.backoff, 'exponential')
        assert.equal(defaults.maxDelayMs, 30_000)
        assert.equal(defaults.jitter, true)
        assert.equal(defaults.scheduler, scheduler)

        const capped = requiredPolicy(resolveRetryPolicy({
            delayMs: 500,
            maxDelayMs: 750,
            jitter: false,
            scheduler,
        }))
        assert.equal(computeRetryDelay(capped, 1, new Error('first')), 500)
        assert.equal(computeRetryDelay(capped, 2, new Error('second')), 750)
    })

    test('passes failed attempt and error to custom backoff without applying the built-in cap', () => {
        const scheduler = immediateScheduler()
        const error = new Error('rate limited')
        let receivedAttempt: number | undefined
        let receivedError: unknown
        const policy = requiredPolicy(resolveRetryPolicy({
            maxDelayMs: 1,
            jitter: false,
            backoff(attempt, received) {
                receivedAttempt = attempt
                receivedError = received
                return 5_000
            },
            scheduler,
        }))

        assert.equal(computeRetryDelay(policy, 2, error), 5_000)
        assert.equal(receivedAttempt, 2)
        assert.equal(receivedError, error)
    })

    test('keeps jitter within the computed delay bounds', () => {
        const policy = requiredPolicy(resolveRetryPolicy({
            delayMs: 100,
            backoff: 'fixed',
            jitter: true,
            scheduler: immediateScheduler(),
        }))

        const delay = computeRetryDelay(policy, 1, new Error('transient'))
        assert.ok(delay >= 0)
        assert.ok(delay <= 100)
    })

    test('rejects invalid custom-backoff results', () => {
        const policy = requiredPolicy(resolveRetryPolicy({
            backoff: () => -1,
            scheduler: immediateScheduler(),
        }))

        assert.throws(
            () => computeRetryDelay(policy, 1, new Error('transient')),
            /finite non-negative delay/,
        )
    })
})

function requiredPolicy(value: ResolvedRetryPolicy | null): ResolvedRetryPolicy {
    assert.notEqual(value, null)
    return value as ResolvedRetryPolicy
}

function immediateScheduler(): RetryScheduler {
    return {
        schedule() {
            return null
        },
        cancel() {},
    }
}
