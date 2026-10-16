import type {ReadableEmitter} from '@capillaryjs/capillary'
import type {Component} from '../component.js'
import type {CommandSource} from '../commandSupport.js'

/** Internal presentation context; never a form-value store or application service. */
export interface FormFeedback {
    readonly settings: ReadableEmitter<{
        readonly source: CommandSource
        readonly disabled: boolean
        readonly guardRunning: boolean
        readonly errorsInline: boolean
    }>
    readonly submitter: ReadableEmitter<HTMLElement | null>
    readonly invocationError: ReadableEmitter<unknown>
    readonly errorId: string
}
const forms = new WeakMap<Component, FormFeedback>()
export function registerFormFeedback(owner: Component, feedback: FormFeedback): void { forms.set(owner, feedback) }
export function removeFormFeedback(owner: Component): void { forms.delete(owner) }
export function findFormFeedback(owner: Component): FormFeedback | null {
    let ancestor = owner._parentComponent
    while (ancestor) {
        const feedback = forms.get(ancestor)
        if (feedback) return feedback
        ancestor = ancestor._parentComponent
    }
    return null
}
