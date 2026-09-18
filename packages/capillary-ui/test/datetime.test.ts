import assert from 'node:assert/strict'
import {after, afterEach, before, describe, test} from 'node:test'
import {Window} from 'happy-dom'

import {Emitter} from '@capillaryjs/capillary'
import {
    Component,
    DatePicker,
    DateTimePicker,
    TimePicker,
    h,
    live,
} from '../src/index.js'
import {
    addCivilDays,
    addMonths,
    civilDateToDay,
    compareCivilDates,
    dayToCivilDate,
    daysInMonth,
    formatCivilDate,
    isCivilDate,
    parseCivilDate,
    todayCivilDate,
} from '../src/Components/lineinputs/datetime/civilDate.js'
import {
    formatTime,
    isTimeString,
    minutesToTime,
    parseTime,
    timeStepOptions,
    timeToMinutes,
} from '../src/Components/lineinputs/datetime/timeString.js'
import {
    combineLocalDateTime,
    compareLocalDateTimes,
    dateToLocalDateTime,
    formatLocalDateTime,
    isLocalDateTime,
    localDateTimeToDate,
    nowLocalDateTime,
    parseLocalDateTime,
    splitLocalDateTime,
} from '../src/Components/lineinputs/datetime/localDateTime.js'
import {requiredQuery} from './testUtils.js'

let window: Window

before(() => {
    window = new Window({url: 'https://example.test/'})
    Object.assign(globalThis, {
        window,
        document: window.document,
        Node: window.Node,
        Element: window.Element,
        HTMLElement: window.HTMLElement,
        EventTarget: window.EventTarget,
        Event: window.Event,
        MouseEvent: window.MouseEvent,
        KeyboardEvent: window.KeyboardEvent,
        DocumentFragment: window.DocumentFragment,
    })
})

afterEach(() => {
    document.body.replaceChildren()
    document.head.replaceChildren()
})

after(() => window.close())

describe('civil date utilities', () => {
    test('parse and format round-trip', () => {
        const original = '2026-09-10' as const
        const parts = parseCivilDate(original)
        assert.notEqual(parts, null)
        assert.deepEqual(parts, {year: 2026, month: 9, day: 10})
        assert.equal(formatCivilDate(parts!), original)
    })

    test('rejects invalid civil dates', () => {
        assert.equal(isCivilDate('2024-02-29'), true)
        assert.equal(isCivilDate('2025-02-29'), false)
        assert.equal(isCivilDate('2026-13-01'), false)
        assert.equal(isCivilDate('not-a-date'), false)
        assert.equal(parseCivilDate('2026-04-31'), null)
    })

    test('day arithmetic is UTC and consistent', () => {
        const start = '2026-01-01' as const
        assert.equal(addCivilDays(start, 0), start)
        assert.equal(addCivilDays(start, 365), '2027-01-01')
        assert.equal(addCivilDays(start, -1), '2025-12-31')
        assert.equal(compareCivilDates('2026-09-10', '2026-09-09'), 1)
        assert.equal(civilDateToDay(dayToCivilDate(1_000_000)), 1_000_000)
    })

    test('month arithmetic clamps across year and day boundaries', () => {
        assert.deepEqual(addMonths(2026, 1, -1), {year: 2025, month: 12})
        assert.deepEqual(addMonths(2026, 12, 1), {year: 2027, month: 1})
        assert.deepEqual(addMonths(2024, 2, 1), {year: 2024, month: 3})
        assert.equal(daysInMonth(2024, 2), 29)
        assert.equal(daysInMonth(2025, 2), 28)
    })

    test('today produces a valid civil date', () => {
        const today = todayCivilDate()
        assert.equal(isCivilDate(today), true)
    })
})

describe('time string utilities', () => {
    test('parse and format round-trip', () => {
        assert.equal(formatTime({hours: 14, minutes: 5}), '14:05')
        assert.deepEqual(parseTime('14:05'),
            {hours: 14, minutes: 5, seconds: 0, milliseconds: 0})
    })

    test('parses and formats optional seconds and milliseconds', () => {
        assert.deepEqual(parseTime('14:05:30'),
            {hours: 14, minutes: 5, seconds: 30, milliseconds: 0})
        assert.deepEqual(parseTime('14:05:30.5'),
            {hours: 14, minutes: 5, seconds: 30, milliseconds: 500})
        assert.equal(formatTime({hours: 14, minutes: 5, seconds: 30}), '14:05:30')
        assert.equal(formatTime({hours: 14, minutes: 5, milliseconds: 250}), '14:05:00.250')
        assert.equal(formatTime({hours: 14, minutes: 5, seconds: 30, milliseconds: 250}),
            '14:05:30.250')
    })

    test('rejects invalid time strings', () => {
        assert.equal(isTimeString('25:00'), false)
        assert.equal(isTimeString('12:60'), false)
        assert.equal(isTimeString('14:05:99'), false)
        assert.equal(isTimeString('noon'), false)
    })

    test('time step options respect min, max, and step', () => {
        const options = timeStepOptions('09:00', '11:00', 30)
        assert.deepEqual(options.map(({value}) => value), [
            '09:00', '09:30', '10:00', '10:30', '11:00',
        ])
    })

    test('minutes conversion', () => {
        assert.equal(timeToMinutes('14:30'), 870)
        assert.equal(minutesToTime(870), '14:30')
    })
})

describe('local date-time utilities', () => {
    test('parse and format round-trip', () => {
        const original = '2026-09-10T14:05' as const
        const parts = parseLocalDateTime(original)
        assert.deepEqual(parts, {
            year: 2026, month: 9, day: 10,
            hours: 14, minutes: 5, seconds: 0, milliseconds: 0,
        })
        assert.equal(formatLocalDateTime(parts!), original)
    })

    test('parses and formats optional seconds and milliseconds', () => {
        assert.deepEqual(parseLocalDateTime('2026-09-10T14:05:30.25'), {
            year: 2026, month: 9, day: 10,
            hours: 14, minutes: 5, seconds: 30, milliseconds: 250,
        })
        assert.equal(formatLocalDateTime({
            year: 2026, month: 9, day: 10,
            hours: 14, minutes: 5, seconds: 30, milliseconds: 250,
        }), '2026-09-10T14:05:30.250')
    })

    test('rejects invalid local date-times', () => {
        assert.equal(isLocalDateTime('2026-09-10T14:05'), true)
        assert.equal(isLocalDateTime('2026-09-10'), false)
        assert.equal(isLocalDateTime('2026-09-10 14:05'), false)
        assert.equal(isLocalDateTime('2025-02-29T14:05'), false)
        assert.equal(isLocalDateTime('2026-09-10T25:05'), false)
        assert.equal(isLocalDateTime('not-a-date-time'), false)
    })

    test('splits and combines date and time parts', () => {
        assert.deepEqual(splitLocalDateTime('2026-09-10T14:05'),
            {date: '2026-09-10', time: '14:05'})
        assert.equal(splitLocalDateTime('not-a-date-time'), null)
        assert.equal(combineLocalDateTime('2026-09-10', '14:05'), '2026-09-10T14:05')
        assert.equal(combineLocalDateTime('2026-09-10', null), '2026-09-10T00:00')
        assert.equal(combineLocalDateTime(null, '14:05'), null)
        assert.equal(combineLocalDateTime('2026-09-10', 'noon'), null)
    })

    test('compares local date-times chronologically', () => {
        assert.equal(compareLocalDateTimes('2026-09-10T14:05', '2026-09-10T14:05'), 0)
        assert.ok(compareLocalDateTimes('2026-09-10T14:06', '2026-09-10T14:05') > 0)
        assert.ok(compareLocalDateTimes('2026-09-09T23:59', '2026-09-10T00:00') < 0)
        assert.ok(compareLocalDateTimes('2026-09-10T14:05:01', '2026-09-10T14:05') > 0)
        assert.throws(() => compareLocalDateTimes('bad', '2026-09-10T14:05'), TypeError)
    })

    test('converts to and from Date in the local timezone', () => {
        const date = localDateTimeToDate('2026-09-10T14:05:30.250')
        assert.equal(date.getFullYear(), 2026)
        assert.equal(date.getMonth(), 8)
        assert.equal(date.getDate(), 10)
        assert.equal(date.getHours(), 14)
        assert.equal(date.getMinutes(), 5)
        assert.equal(date.getSeconds(), 30)
        assert.equal(date.getMilliseconds(), 250)
        assert.equal(dateToLocalDateTime(date), '2026-09-10T14:05:30.250')
        assert.equal(dateToLocalDateTime(new Date(2026, 8, 10, 14, 5)), '2026-09-10T14:05')
        assert.throws(() => localDateTimeToDate('bad'), TypeError)
    })

    test('now produces a valid local date-time', () => {
        assert.equal(isLocalDateTime(nowLocalDateTime()), true)
        assert.equal(nowLocalDateTime(new Date(2026, 8, 10, 14, 5)), '2026-09-10T14:05')
    })
})

describe('DatePicker', () => {
    test('renders a labeled native date input', () => {
        DatePicker.new({
            label: 'Start',
            defaultValue: '2026-09-10',
            min: '2026-01-01',
            max: '2026-12-31',
        }).attachTo(document.body)

        const host = requiredQuery<HTMLElement>('cap-datepicker')
        assert.equal(host.dataset.capComponent, 'datepicker')
        const input = requiredQuery<HTMLInputElement>('input', host)
        assert.equal(input.type, 'date')
        assert.equal(input.value, '2026-09-10')
        assert.equal(input.getAttribute('min'), '2026-01-01')
        assert.equal(input.getAttribute('max'), '2026-12-31')
        assert.equal(requiredQuery<HTMLLabelElement>('label', host).htmlFor, input.id)
    })

    test('emits CivilDate values and null for empty or invalid input', () => {
        const inputs: (string | null)[] = []
        const changes: (string | null)[] = []
        const picker = DatePicker.new({
            label: 'Start',
            onInput: (value) => inputs.push(value),
            onChange: (value) => changes.push(value),
        }).attachTo(document.body)

        const input = requiredQuery<HTMLInputElement>('input')
        input.value = '2026-09-15'
        input.dispatchEvent(new Event('input', {bubbles: true}))
        assert.deepEqual(inputs, ['2026-09-15'])
        assert.equal(picker.valueEmitter.get(), '2026-09-15')
        assert.deepEqual(changes, [])

        input.dispatchEvent(new Event('change', {bubbles: true}))
        assert.deepEqual(changes, ['2026-09-15'])

        input.value = ''
        input.dispatchEvent(new Event('input', {bubbles: true}))
        assert.equal(picker.valueEmitter.get(), null)
        assert.deepEqual(inputs, ['2026-09-15', null])

        input.value = 'not-a-date'
        input.dispatchEvent(new Event('input', {bubbles: true}))
        assert.equal(picker.valueEmitter.get(), null)
        assert.deepEqual(inputs, ['2026-09-15', null, null])
    })

    test('follows an external emitter and cleans up on destroy', () => {
        const value = new Emitter<string | null>('2026-09-10')
        const picker = DatePicker.new({valueEmitter: value}).attachTo(document.body)
        const input = requiredQuery<HTMLInputElement>('input')
        assert.equal(input.value, '2026-09-10')

        value.set('2026-09-11')
        assert.equal(input.value, '2026-09-11')
        assert.equal(value.subscriberCount, 1)

        picker.destroy()
        assert.equal(value.subscriberCount, 0)
    })

    test('live disabled, required, readOnly, busy, and error update without parent rerender', () => {
        const disabled = new Emitter(false)
        const required = new Emitter(false)
        const readOnly = new Emitter(false)
        const busy = new Emitter(false)
        const error = new Emitter<unknown>(null)
        let ownerRenders = 0

        class Owner extends Component {
            render() {
                ownerRenders += 1
                return h(DatePicker, {
                    label: 'Start',
                    defaultValue: '2026-09-10',
                    disabled: live(disabled),
                    required: live(required),
                    readOnly: live(readOnly),
                    busy: live(busy),
                    error: live(error),
                })
            }
        }

        Owner.new().attachTo(document.body)
        const input = requiredQuery<HTMLInputElement>('input')

        assert.equal(ownerRenders, 1)
        assert.equal(input.disabled, false)
        assert.equal(input.required, false)
        assert.equal(input.readOnly, false)
        assert.equal(input.getAttribute('aria-invalid'), null)

        disabled.set(true)
        required.set(true)
        readOnly.set(true)
        busy.set(true)
        error.set('Choose a date')

        assert.equal(ownerRenders, 1)
        assert.equal(input.disabled, true)
        assert.equal(input.required, true)
        assert.equal(input.readOnly, true)
        assert.equal(input.getAttribute('aria-busy'), 'true')
        assert.equal(input.getAttribute('aria-invalid'), 'true')
        assert.equal(requiredQuery<HTMLElement>('[role="alert"]', input.closest('cap-datepicker')!).textContent,
            'Choose a date')
    })

    test('readOnly preserves the date value while retaining a focusable native input', () => {
        const value = new Emitter<string | null>('2026-09-10')
        const inputs: (string | null)[] = []
        DatePicker.new({
            valueEmitter: value,
            readOnly: true,
            onInput: (next) => inputs.push(next),
        }).attachTo(document.body)
        const input = requiredQuery<HTMLInputElement>('input')

        assert.equal(input.disabled, false)
        assert.equal(input.readOnly, true)
        input.value = '2026-09-15'
        input.dispatchEvent(new Event('input', {bubbles: true}))
        assert.equal(input.value, '2026-09-10')
        assert.equal(value.get(), '2026-09-10')
        assert.deepEqual(inputs, [])
    })
})

describe('TimePicker', () => {
    test('renders a labeled native time input', () => {
        TimePicker.new({
            label: 'Start time',
            defaultValue: '10:00',
            step: 900,
            busy: true,
            error: 'Time service delayed',
        }).attachTo(document.body)

        const host = requiredQuery<HTMLElement>('cap-timepicker')
        assert.equal(host.dataset.capComponent, 'timepicker')
        const input = requiredQuery<HTMLInputElement>('input', host)
        assert.equal(input.type, 'time')
        assert.equal(input.value, '10:00')
        assert.equal(input.getAttribute('step'), '900')
        assert.equal(input.getAttribute('aria-busy'), 'true')
        assert.equal(input.getAttribute('aria-invalid'), 'true')
        assert.equal(requiredQuery('cap-error[role="alert"]', host).textContent,
            'Time service delayed')
    })

    test('emits TimeString values including seconds', () => {
        const value = new Emitter<string | null>('09:00')
        const changes: (string | null)[] = []
        TimePicker.new({
            valueEmitter: value,
            onChange: (next) => changes.push(next),
        }).attachTo(document.body)

        const input = requiredQuery<HTMLInputElement>('input')
        input.value = '14:30:15'
        input.dispatchEvent(new Event('change', {bubbles: true}))

        assert.equal(value.get(), '14:30:15')
        assert.deepEqual(changes, ['14:30:15'])
    })
})

describe('DateTimePicker', () => {
    test('renders a labeled native datetime-local input', () => {
        DateTimePicker.new({
            label: 'Schedule',
            defaultValue: '2026-09-10T10:00',
            min: '2026-01-01T00:00',
            max: '2026-12-31T23:59',
            busy: true,
            error: 'Start is unavailable',
        }).attachTo(document.body)

        const host = requiredQuery<HTMLElement>('cap-datetimepicker')
        assert.equal(host.dataset.capComponent, 'datetimepicker')
        const input = requiredQuery<HTMLInputElement>('input', host)
        assert.equal(input.type, 'datetime-local')
        assert.equal(input.value, '2026-09-10T10:00')
        assert.equal(input.getAttribute('min'), '2026-01-01T00:00')
        assert.equal(input.getAttribute('max'), '2026-12-31T23:59')
        assert.equal(input.getAttribute('aria-busy'), 'true')
        assert.equal(input.getAttribute('aria-invalid'), 'true')
        assert.equal(requiredQuery<HTMLLabelElement>('label', host).htmlFor, input.id)
        assert.equal(requiredQuery('cap-error[role="alert"]', host).textContent,
            'Start is unavailable')
    })

    test('emits LocalDateTime values and follows an external emitter', () => {
        const value = new Emitter<string | null>('2026-09-10T10:00')
        const changes: (string | null)[] = []
        const picker = DateTimePicker.new({
            valueEmitter: value,
            onChange: (next) => changes.push(next),
        }).attachTo(document.body)

        const input = requiredQuery<HTMLInputElement>('input')
        input.value = '2026-09-15T14:30'
        input.dispatchEvent(new Event('input', {bubbles: true}))
        assert.equal(value.get(), '2026-09-15T14:30')

        input.dispatchEvent(new Event('change', {bubbles: true}))
        assert.deepEqual(changes, ['2026-09-15T14:30'])

        value.set('2026-09-11T11:00')
        assert.equal(input.value, '2026-09-11T11:00')

        picker.destroy()
        assert.equal(value.subscriberCount, 0)
    })
})
