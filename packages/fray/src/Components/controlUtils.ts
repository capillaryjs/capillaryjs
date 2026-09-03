import {Emitter} from '@sylwellsoftware/glue'
import type {EmitterOptions, ReadableEmitter} from '@sylwellsoftware/glue'

import type {Component, ComponentProps} from './component.js'
import {isFilterMode} from '../util/filterMode.js'

export interface ValueEmitter<TValue> extends ReadableEmitter<TValue, unknown> {
    set(value: TValue, eventOrCause?: unknown): boolean
}

export interface ValueControlProps<TValue> extends ComponentProps {
    valueEmitter?: ValueEmitter<TValue>
    value?: TValue
    defaultValue?: TValue
    initialValue?: TValue
}

let nextControlId = 1

export function controlId(prefix: string, provided?: string | number | null): string {
    if (provided != null && String(provided).length > 0) return String(provided)
    return `fray-${prefix}-${nextControlId++}`
}

export function createValueEmitter<TValue>(
    component: Component,
    props: ValueControlProps<TValue>,
    fallback: TValue,
    purpose: string,
): ValueEmitter<TValue> {
    if (props.valueEmitter != null) {
        assertEmitter<TValue>(props.valueEmitter, 'valueEmitter')
        return props.valueEmitter
    }
    const initialValue = props.defaultValue
        ?? props.value
        ?? props.initialValue
        ?? fallback
    const options: EmitterOptions<TValue> = {owner: component, purpose}
    return new Emitter(initialValue, options)
}

export function assertEmitter<TValue = unknown>(
    value: unknown,
    name = 'emitter',
): asserts value is ValueEmitter<TValue> {
    if (value == null
        || (typeof value !== 'object' && typeof value !== 'function')
        || typeof Reflect.get(value, 'get') !== 'function'
        || typeof Reflect.get(value, 'set') !== 'function'
        || typeof Reflect.get(value, 'subscribe') !== 'function') {
        throw new TypeError(`${name} must be an emitter`)
    }
}

export function classNames(...values: unknown[]): string {
    return values
        .flatMap((value) => typeof value === 'string' ? value.split(/\s+/) : [])
        .filter(Boolean)
        .join(' ')
}

export function componentClass(props: Pick<ComponentProps, 'class' | 'className'>): string {
    return props.className ?? props.class ?? ''
}

export function invoke<TArguments extends unknown[]>(
    callback: ((...args: TArguments) => void) | null | undefined,
    ...args: TArguments
): void {
    if (callback == null) return
    if (typeof callback !== 'function') throw new TypeError('Control callback must be a function')
    callback(...args)
}

export function assertOptions<TOption>(
    options: unknown,
    name = 'options',
): asserts options is TOption[] {
    if (!Array.isArray(options)) throw new TypeError(`${name} must be an array`)
}

export function describeState(value: unknown): string {
    if (isFilterMode(value)) return value
    return String(value)
}
