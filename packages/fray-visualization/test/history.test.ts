import assert from 'node:assert/strict'
import {describe, test} from 'node:test'

import {
    SeriesBuilder,
    addCivilDays,
    areaPath,
    buildIntegerTicks,
    buildLineChartModel,
    civilDateToDay,
    dayToCivilDate,
    linePath,
    valueAtDate,
} from '../src/index.js'
import type {HistoryShape} from '../src/index.js'

const categories = [
    {key: 'open', label: 'Open', color: 'var(--open)'},
    {key: 'closed', label: 'Closed', color: 'var(--closed)'},
] as const

describe('civil dates and history series', () => {
    test('uses strict date-only UTC-day arithmetic across DST boundaries', () => {
        const day = civilDateToDay('2026-03-29')
        assert.equal(dayToCivilDate(day + 1), '2026-03-30')
        assert.equal(addCivilDays('2026-10-25', 1), '2026-10-26')
        assert.throws(() => civilDateToDay('2026-02-29'), /Invalid civil date/)
        assert.throws(() => civilDateToDay('2026-1-2'), /expected YYYY-MM-DD/)
    })

    test('builds ordinary deltas and cumulative shapes with a zero anchor', () => {
        const builder = new SeriesBuilder(categories)
            .addOne('2026-01-02', 'open')
            .addOne('2026-01-03', 'open')
            .removeOne('2026-01-04', 'open')
            .addOne('2026-01-03', 'closed')

        const ordinary = builder.build()
        assert.deepEqual(ordinary[0]?.values, {
            '2026-01-02': 1,
            '2026-01-03': 1,
            '2026-01-04': -1,
        })
        assert.equal(ordinary[0]?.carryForward, false)

        const cumulative = builder.buildCumulative()
        assert.deepEqual(cumulative[0]?.values, {
            '2026-01-01': 0,
            '2026-01-02': 1,
            '2026-01-03': 2,
            '2026-01-04': 1,
        })
        assert.deepEqual(cumulative[1]?.values, {
            '2026-01-01': 0,
            '2026-01-02': 0,
            '2026-01-03': 1,
            '2026-01-04': 1,
        })
        assert.equal(valueAtDate(cumulative[0]!, '2026-01-08'), 1)
    })
})

describe('line chart calculations', () => {
    test('anchors pre-range cumulative values and stacks deterministic series', () => {
        const shapes = new SeriesBuilder(categories)
            .addOne('2026-01-01', 'open')
            .addOne('2026-01-03', 'open')
            .addOne('2026-01-02', 'closed')
            .buildCumulative()
        const model = buildLineChartModel(shapes, {
            stacked: true,
            range: {minX: '2026-01-02', maxX: '2026-01-05'},
            today: '2026-01-05',
        })

        assert.equal(model.minDate, '2026-01-02')
        assert.equal(model.maxDate, '2026-01-05')
        assert.equal(model.series[0]?.points[0]?.value, 1)
        assert.equal(model.series[1]?.points[0]?.baseValue, 1)
        assert.equal(model.series[1]?.points[0]?.displayValue, 2)
        assert.ok(model.maxY > 2)
        assert.ok(model.valueTicks.every(({value}) => Number.isInteger(value)))
    })

    test('supports negative values, integer ticks, step paths, and smooth paths', () => {
        const shape: HistoryShape = {
            key: 'delta',
            label: 'Delta',
            color: '#c00',
            values: {'2026-01-01': -2, '2026-01-02': 3},
        }
        const model = buildLineChartModel([shape], {
            range: {minX: '2026-01-01', maxX: '2026-01-02'},
            today: '2026-01-02',
        })
        const points = model.series[0]!.points

        assert.ok(model.minY <= -2)
        assert.match(linePath(points, false), / H .* V /)
        assert.match(linePath(points, true), / C /)
        assert.match(areaPath(points, true), / Z$/)
        assert.deepEqual(buildIntegerTicks(0, 10, 6), [0, 2, 4, 6, 8, 10])
    })

    test('rejects reversed ranges and non-finite values', () => {
        assert.throws(() => buildLineChartModel([], {
            range: {minX: '2026-02-01', maxX: '2026-01-01'},
        }), /minX/)
        assert.throws(() => buildLineChartModel([{
            key: 'bad', label: 'Bad', color: '#000', values: {'2026-01-01': Infinity},
        }]), /finite/)
    })
})
