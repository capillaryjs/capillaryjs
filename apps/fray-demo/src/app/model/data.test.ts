import assert from 'node:assert/strict'
import {test} from 'node:test'

import type {BlockNode} from '@sylwellsoftware/fray-visualization'
import {FilterMode} from '@sylwellsoftware/fray'

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

    assert.equal(model.scopedChanges.get().length, 144)
    assert.equal(model.registerChanges.get().length, 144)
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

test('Meridian keeps persistent, Portfolio, Register, and Analysis policy separate', () => {
    const model = new MeridianModel()
    const selected = model.selectedChange.get()

    model.registerSearch.set('Emergency lighting renewal')
    assert.equal(model.registerChanges.get().length, 1)
    assert.equal(model.scopedChanges.get().length, 144)
    assert.equal(model.visualizationChanges.get().length, 144)
    assert.ok(model.attentionChanges.get().length > 1)

    model.registerCompletedFocus.set(FilterMode.Require)
    assert.equal(model.registerChanges.get().length, 0)
    assert.equal(model.selectedChange.get(), selected)

    model.registerSearch.set('')
    assert.ok(model.registerChanges.get().length > 0)
    assert.ok(model.registerChanges.get().every(({statusFocus}) => statusFocus === 'completed'))

    const attentionBefore = model.attentionChanges.get().length
    model.attentionSafetyFocus.set(FilterMode.Require)
    assert.ok(model.attentionChanges.get().length < attentionBefore)
    assert.ok(model.attentionChanges.get().every(({safetyImpact}) => safetyImpact))
    assert.equal(model.scopedChanges.get().length, 144)

    model.selectedScope.set('warehouse')
    assert.ok(model.scopedChanges.get().length < 144)
    assert.equal(model.selectedChange.get(), selected)

    model.dispose()
})

test('Register semantic criteria filter and rank only Register records', () => {
    const model = new MeridianModel()

    model.registerApprovalFocus.set(FilterMode.Require)
    assert.ok(model.registerChanges.get().length > 0)
    assert.ok(model.registerChanges.get().every(({status}) =>
        status === 'Awaiting approval' || status === 'Drafting scope'))

    model.registerApprovalFocus.set(FilterMode.Neutral)
    model.registerHighRiskFocus.set(FilterMode.Require)
    assert.ok(model.registerChanges.get().every(({risk}) =>
        risk === 'Critical' || risk === 'High'))

    model.registerHighRiskFocus.set(FilterMode.Neutral)
    model.registerSupplierFocus.set(FilterMode.Prefer)
    const register = model.registerChanges.get()
    const firstInternal = register.findIndex(({supplierInvolvement}) => !supplierInvolvement)
    const lastSupplier = register.findLastIndex(({supplierInvolvement}) => supplierInvolvement)
    assert.ok(lastSupplier < firstInternal)
    assert.equal(model.scopedChanges.get().length, 144)

    model.clearRegisterFilters()
    assert.equal(model.registerChanges.get().length, 144)

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
