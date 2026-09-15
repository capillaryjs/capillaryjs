import assert from 'node:assert/strict'
import {test} from 'node:test'
import {TraceRecorder, traceAttempts} from '@capillaryjs/capillary-devtools/model'
import {FlowScenario, ScenarioClock} from './scenario.js'

test('the demo handler deterministically retries, supersedes, aborts and completes commands', async () => {
    const clock = new ScenarioClock()
    const recorder = new TraceRecorder({clock: clock.now}).start({fromStart: true})
    const model = new FlowScenario(clock)
    model.retry(); await model.query._activeRequest
    assert.equal(model.requests, 2)
    assert.deepEqual(traceAttempts(recorder.snapshot().events).map((attempt) => attempt.status), ['failed', 'succeeded'])
    model.startPending(); await Promise.resolve(); model.supersede(); await model.query._activeRequest
    assert(traceAttempts(recorder.snapshot().events).some((attempt) => attempt.status === 'superseded'))
    model.startPending(); await Promise.resolve(); model.abort()
    assert(traceAttempts(recorder.snapshot().events).some((attempt) => attempt.status === 'aborted'))
    model.runCommand(); await Promise.resolve(); model.completeCommand(); await model.command._activeRequest
    assert(model.command.get()?.startsWith('Saved'))
    model.dispose(); recorder.dispose()
})
