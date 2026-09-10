import assert from 'node:assert/strict'
import {after, afterEach, before, describe, test} from 'node:test'
import {Window} from 'happy-dom'

import {Emitter} from '@sylwellsoftware/glue'
import {
    Component,
    DatePicker,
    DateTimePicker,
    TimePicker,
    h,
    live,
} from '../src/index.js'
import type {DateTimeValue} from '../src/index.js'
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
        assert.deepEqual(parseTime('14:05'), {hours: 14, minutes: 5})
    })

    test('rejects invalid time strings', () => {
        assert.equal(isTimeString('25:00'), false)
        assert.equal(isTimeString('12:60'), false)
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

describe('DatePicker', () => {
    test('renders a host, label, input, and trigger', () => {
        DatePicker.new({label: 'Start', defaultValue: '2026-09-10'}).attachTo(document.body)
        const host = requiredQuery<HTMLElement>('fray-datepicker')
        assert.equal(host.dataset.frayComponent, 'datepicker')
        assert.equal(requiredQuery<HTMLLabelElement>('label', host).htmlFor,
            requiredQuery<HTMLInputElement>('input', host).id)
        assert.equal(requiredQuery<HTMLInputElement>('input', host).value, '2026-09-10')
        assert.equal(host.querySelector('dialog[open]'), null)
    })

    test('opens the calendar popup and selects a date', () => {
        const changes: (string | null)[] = []
        const picker = DatePicker.new({
            label: 'Start',
            onChange: (value) => changes.push(value),
        }).attachTo(document.body)

        const input = requiredQuery<HTMLInputElement>('input')
        input.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}))

        const dialog = requiredQuery<HTMLDialogElement>('dialog')
        assert.equal(dialog.open, true)
        const selectedDay = dialog.querySelector<HTMLButtonElement>('button[data-focused="true"]')
        assert.notEqual(selectedDay, null)
        selectedDay!.dispatchEvent(new MouseEvent('click', {bubbles: true}))

        assert.equal(document.querySelector('dialog[open]'), null)
        assert.equal(changes.length, 1)
        assert.equal(isCivilDate(changes[0]!), true)
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

    test('disables days outside min and max', () => {
        DatePicker.new({
            defaultValue: '2026-09-10',
            min: '2026-09-08',
            max: '2026-09-12',
        }).attachTo(document.body)

        const input = requiredQuery<HTMLInputElement>('input')
        input.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}))

        const dialog = requiredQuery<HTMLElement>('dialog')
        const disabledDays = [...dialog.querySelectorAll<HTMLButtonElement>('button[aria-disabled="true"]')]
        const dayNumbers = disabledDays.map((button) => Number(button.textContent))
        assert.ok(dayNumbers.includes(7))
        assert.ok(dayNumbers.includes(13))
    })

    test('closes popup on mousedown outside the control', () => {
        DatePicker.new({label: 'Start'}).attachTo(document.body)

        const input = requiredQuery<HTMLInputElement>('input')
        input.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}))
        assert.notEqual(document.querySelector('dialog[open]'), null)

        document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))

        assert.equal(document.querySelector('dialog[open]'), null)
    })

    test('input click does not open the popup', () => {
        DatePicker.new({label: 'Start'}).attachTo(document.body)

        const input = requiredQuery<HTMLInputElement>('input')
        input.dispatchEvent(new MouseEvent('click', {bubbles: true}))

        assert.equal(document.querySelector('dialog[open]'), null)
    })

    test('clamps focused day when paging to a shorter month', () => {
        DatePicker.new({defaultValue: '2026-01-31'}).attachTo(document.body)

        const input = requiredQuery<HTMLInputElement>('input')
        input.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}))

        const dialog = requiredQuery<HTMLDialogElement>('dialog')
        const focusedDay = dialog.querySelector<HTMLButtonElement>('button[data-focused="true"]')
        assert.notEqual(focusedDay, null)
        assert.equal(focusedDay!.textContent, '31')

        focusedDay!.dispatchEvent(new KeyboardEvent('keydown', {key: 'PageDown', bubbles: true}))

        const nextFocusedDay = dialog.querySelector<HTMLButtonElement>('button[data-focused="true"]')
        assert.notEqual(nextFocusedDay, null)
        assert.equal(nextFocusedDay!.textContent, '28')
    })

    test('fires onInput while typing and onChange on blur', () => {
        const inputs: (string | null)[] = []
        const changes: (string | null)[] = []
        DatePicker.new({
            label: 'Start',
            onInput: (value) => inputs.push(value),
            onChange: (value) => changes.push(value),
        }).attachTo(document.body)

        const input = requiredQuery<HTMLInputElement>('input')
        input.value = '2026-09-15'
        input.dispatchEvent(new Event('input', {bubbles: true}))

        assert.deepEqual(inputs, ['2026-09-15'])
        assert.deepEqual(changes, [])

        input.dispatchEvent(new Event('change', {bubbles: true}))

        assert.deepEqual(inputs, ['2026-09-15'])
        assert.deepEqual(changes, ['2026-09-15'])
    })

    test('live disabled, required, and error update without parent rerender', () => {
        const disabled = new Emitter(false)
        const required = new Emitter(false)
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
                    error: live(error),
                })
            }
        }

        Owner.new().attachTo(document.body)
        const input = requiredQuery<HTMLInputElement>('input')

        assert.equal(ownerRenders, 1)
        assert.equal(input.disabled, false)
        assert.equal(input.required, false)
        assert.equal(input.getAttribute('aria-invalid'), null)

        disabled.set(true)
        required.set(true)
        error.set('Choose a date')

        assert.equal(ownerRenders, 1)
        assert.equal(input.disabled, true)
        assert.equal(input.required, true)
        assert.equal(input.getAttribute('aria-invalid'), 'true')
        assert.equal(requiredQuery<HTMLElement>('[role="alert"]', input.closest('fray-datepicker')!).textContent,
            'Choose a date')
    })
})

describe('TimePicker', () => {
    test('renders a host, label, and select with stepped options', () => {
        TimePicker.new({
            label: 'Start time',
            step: 60,
            defaultValue: '10:00',
        }).attachTo(document.body)

        const host = requiredQuery<HTMLElement>('fray-timepicker')
        assert.equal(host.dataset.frayComponent, 'timepicker')
        const select = requiredQuery<HTMLSelectElement>('select', host)
        assert.equal(select.value, '10:00')
        assert.equal([...select.options].some((option) => option.value === '09:00'), true)
        assert.equal([...select.options].some((option) => option.value === '23:00'), true)
    })

    test('updates an external emitter and calls onChange', () => {
        const value = new Emitter<string | null>('09:00')
        const changes: (string | null)[] = []
        TimePicker.new({
            valueEmitter: value,
            onChange: (next) => changes.push(next),
        }).attachTo(document.body)

        const select = requiredQuery<HTMLSelectElement>('select')
        select.value = '14:00'
        select.dispatchEvent(new Event('change', {bubbles: true}))

        assert.equal(value.get(), '14:00')
        assert.deepEqual(changes, ['14:00'])
    })

    test('clamps to first option when required becomes true via live prop', () => {
        const required = new Emitter(false)

        class Owner extends Component {
            render() {
                return h(TimePicker, {
                    label: 'Start time',
                    required: live(required),
                })
            }
        }

        Owner.new().attachTo(document.body)
        const select = requiredQuery<HTMLSelectElement>('select')
        assert.equal(select.options[0]?.textContent, 'Select time…')

        required.set(true)
        assert.equal(select.value, '00:00')
    })
})

describe('DateTimePicker', () => {
    test('renders a group with date and time pickers', () => {
        DateTimePicker.new({
            label: 'Start',
            defaultValue: {date: '2026-09-10', time: '10:00'},
        }).attachTo(document.body)

        const host = requiredQuery<HTMLElement>('fray-datetimepicker')
        assert.equal(host.dataset.frayComponent, 'datetimepicker')
        const fieldset = requiredQuery<HTMLFieldSetElement>('fieldset', host)
        assert.equal(requiredQuery<HTMLLegendElement>('legend', fieldset).textContent, 'Start')
        assert.equal(requiredQuery<HTMLInputElement>('input', host).value, '2026-09-10')
        assert.equal(requiredQuery<HTMLSelectElement>('select', host).value, '10:00')
    })

    test('combines date and time into a single value emitter', () => {
        const value = new Emitter<DateTimeValue | null>({date: '2026-09-10', time: '10:00'})
        const changes: (DateTimeValue | null)[] = []

        DateTimePicker.new({
            valueEmitter: value,
            onChange: (next) => changes.push(next),
        }).attachTo(document.body)

        const input = requiredQuery<HTMLInputElement>('input')
        input.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}))

        const dialog = requiredQuery<HTMLDialogElement>('dialog')
        const day = [...dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])')]
            .find((button) => button.textContent === '15')
        assert.notEqual(day, null)
        day!.dispatchEvent(new MouseEvent('click', {bubbles: true}))

        assert.equal(value.get()?.date, '2026-09-15')
        assert.equal(changes.length, 1)
        assert.equal(changes[0]?.date, '2026-09-15')

        const select = requiredQuery<HTMLSelectElement>('select')
        select.value = '14:00'
        select.dispatchEvent(new Event('change', {bubbles: true}))

        assert.equal(value.get()?.time, '14:00')
        assert.equal(changes.length, 2)
        assert.equal(changes[1]?.time, '14:00')
    })

    test('follows an external combined emitter', () => {
        const value = new Emitter<DateTimeValue | null>({date: '2026-09-10', time: '10:00'})
        DateTimePicker.new({valueEmitter: value}).attachTo(document.body)

        value.set({date: '2026-09-11', time: '11:00'})
        assert.equal(requiredQuery<HTMLInputElement>('input').value, '2026-09-11')
        assert.equal(requiredQuery<HTMLSelectElement>('select').value, '11:00')
    })

    test('cleans up all subscriptions on destroy', () => {
        const value = new Emitter<DateTimeValue | null>({date: '2026-09-10', time: '10:00'})
        const picker = DateTimePicker.new({valueEmitter: value}).attachTo(document.body)
        picker.destroy()
        assert.equal(value.subscriberCount, 0)
    })
})
