import assert from 'node:assert/strict'
import {test} from 'node:test'

import type {BlockNode} from '@sylwellsoftware/fray-visualization'

import {changes} from './data.js'
import {MeridianModel} from './MeridianModel.js'

test('Meridian scenario crosses the table and analytical volume boundaries', () => {
    assert.equal(changes.length, 144)
    assert.equal(new Set(changes.map(({site}) => site)).size, 3)
    assert.equal(new Set(changes.map(({risk}) => risk)).size, 4)
    assert.equal(new Set(changes.map(({statusFocus}) => statusFocus)).size, 3)
    assert.ok(new Set(changes.map(({status}) => status)).size >= 12)
    assert.ok(new Set(changes.map(({owner}) => owner)).size >= 12)
    assert.ok(new Set(changes.map(({type}) => type)).size >= 8)
    assert.deepEqual(new Set(changes.map(({supplierInvolvement}) => supplierInvolvement)),
        new Set([false, true]))
    assert.deepEqual(new Set(changes.map(({safetyImpact}) => safetyImpact)),
        new Set([false, true]))
    assert.ok(new Set(changes.map(({progress}) => progress)).size >= 30)
    assert.ok(new Set(changes.map(({plannedStart}) => plannedStart)).size >= 80)
})

test('Meridian visualization models expose varied partitions and dense history', () => {
    const model = new MeridianModel()

    assert.equal(model.visibleChanges.get().length, 144)
    assert.equal(model.visualizationChanges.get().length, 144)
    assert.equal(model.groupingCriteria.length, 6)
    assert.deepEqual(model.splitSelection.activeSplits$.get().map(({key}) => key),
        ['risk', 'lifecycle', 'site'])
    const layout = model.blockSelection.layout$.get()
    assert.equal(layout.valid, true)
    assert.equal(layout.root.count, 144)
    assert.ok(model.groupingCriteria.every((criterion) =>
        criterion.categories$.get().every(({colors}) =>
            colors.length === 3 && colors.every((color) => color.startsWith('#')))))
    assert.ok(flatten(layout.root.children).every(({colors}) =>
        colors != null && colors[0] !== colors[1] && colors[1] !== colors[2]))

    const shapes = model.historyShapes.get()
    assert.equal(shapes.length, 4)
    assert.ok(shapes.reduce((total, shape) => total + Object.keys(shape.values).length, 0) >= 300)

    const lowRisk = model.groupingCriteria[0]!
    lowRisk.visibility('low').set('hidden')
    assert.ok(model.visualizationChanges.get().length < 144)
    assert.equal(model.visualizationChanges.get().some(({risk}) => risk === 'Low'), false)

    model.splitSelection.applyPreset('site-type')
    assert.deepEqual(model.splitSelection.activeSplits$.get().map(({key}) => key), ['site', 'type'])
    assert.equal(model.blockSelection.layout$.get().valid, true)

    model.dispose()
})

function flatten<TItem>(nodes: readonly BlockNode<TItem>[]): BlockNode<TItem>[] {
    const result: BlockNode<TItem>[] = []
    for (const node of nodes) {
        result.push(node)
        result.push(...flatten(node.children))
    }
    return result
}
