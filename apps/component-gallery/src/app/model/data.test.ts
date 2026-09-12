import assert from 'node:assert/strict'
import {test} from 'node:test'

import {serviceOwners, services} from './data.js'

test('service catalog is deterministic and well-formed', () => {
    assert.equal(services.length, 36)
    assert.deepEqual(services[0]?.id, 'SVC-001')
    assert.deepEqual(services[0]?.name, 'Atlas gateway')
    const ids = new Set(services.map((service) => service.id))
    assert.equal(ids.size, services.length)
    for (const service of services) {
        assert.ok(serviceOwners.includes(service.owner))
        assert.ok(service.uptime >= 90 && service.uptime <= 100)
        assert.ok(service.resolved > service.updated)
    }
})
