import assert from 'node:assert/strict'
import {after, before, describe, test} from 'node:test'

import type {
    DemoScenario,
    ScenarioRequest,
    ScenarioResponse,
} from '../src/contract.js'
import {createScenarioFetch} from '../src/embedded/createScenarioFetch.js'
import {startDummyServer} from '../src/node/server.js'
import type {RunningDummyServer} from '../src/node/server.js'

class PublicFixtureScenario implements DemoScenario {
    readonly id = 'public-fixture'
    private count = 0

    reset(): void {
        this.count = 0
    }

    handle(request: ScenarioRequest): ScenarioResponse {
        if (request.method === 'POST' && request.url === '/api/increment') this.count += 1
        return {
            status: 200,
            headers: {'content-type': 'application/json; charset=utf-8'},
            body: {count: this.count, method: request.method, body: request.body ?? null},
        }
    }
}

describe('generic dummy-server adapters', () => {
    let server: RunningDummyServer
    let scenario: PublicFixtureScenario

    before(async () => {
        scenario = new PublicFixtureScenario()
        server = await startDummyServer({
            scenario,
            port: 0,
            html: '<!doctype html><title>public fixture</title>',
        })
    })

    after(async () => server.close())

    test('requires caller-owned scenario behavior', async () => {
        const embeddedScenario = new PublicFixtureScenario()
        const embedded = createScenarioFetch({scenario: embeddedScenario})
        const init = {method: 'POST', body: JSON.stringify({value: 1})}
        const embeddedResponse = await embedded('/api/increment', init)
        const httpResponse = await fetch(`${server.origin}/api/increment`, {
            ...init,
            headers: {'content-type': 'application/json'},
        })

        assert.equal(httpResponse.status, embeddedResponse.status)
        assert.deepEqual(await httpResponse.json(), await embeddedResponse.json())
    })

    test('serves only explicitly supplied application HTML', async () => {
        const response = await fetch(`${server.origin}/nested/path`)
        assert.equal(response.status, 200)
        assert.equal(await response.text(), '<!doctype html><title>public fixture</title>')
    })
})
