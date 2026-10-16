import {Component, css} from '../component.js'
import type {CapillaryUiChild, ComponentProps, LivePropContract} from '../component.js'
import {componentClass} from '../controlUtils.js'
import {formatErrorMessage} from '../status/statusPresentation.js'

export interface FormFieldControlProps {
    readonly id: string
    readonly ariaDescribedBy?: string
    readonly ariaInvalid: boolean
    readonly required: boolean
}
export interface FormFieldProps extends ComponentProps, LivePropContract<'error' | 'required'> {
    controlId: string
    label: CapillaryUiChild
    help?: CapillaryUiChild
    error?: unknown
    required?: boolean
    /** Pass these associations to one native-labelled control; values stay app-owned. */
    control: (props: FormFieldControlProps) => CapillaryUiChild
    children?: never
}
export class FormField extends Component<FormFieldProps> {
    static override hostName = 'formfield'
    static override liveProps = ['error', 'required'] as const
    render(): CapillaryUiChild {
        const {controlId, label, help, error, required = false, control} = this.props
        if (!controlId?.trim() || typeof control !== 'function') throw new TypeError('FormField requires controlId and control')
        const description = [help == null ? null : `${controlId}-help`, error == null ? null : `${controlId}-field-error`].filter(Boolean).join(' ') || undefined
        const Host = this.Host
        return <Host className={componentClass(this.props) || null}>
            <label htmlFor={controlId}>{label}</label>
            <div className="cap-field-control">{control({id: controlId, ...(description ? {ariaDescribedBy: description} : {}), ariaInvalid: error != null, required})}</div>
            {help == null ? null : <div id={`${controlId}-help`} className="cap-field-help">{help}</div>}
            {error == null ? null : <div id={`${controlId}-field-error`} className="cap-field-error" role="alert">{formatErrorMessage(error, '')}</div>}
        </Host>
    }
    static override css = css`
        & { display: grid; grid-template-columns: minmax(0, 1fr); gap: .25rem .75rem; min-inline-size: 0; }
        & > label { align-self: center; overflow-wrap: anywhere; }
        & .cap-field-control { min-inline-size: 0; --input-width: 100%; --input-min-width: 0px; }
        & .cap-field-control > * { inline-size: 100%; }
        & .cap-field-help { font-size: .9em; overflow-wrap: anywhere; }
        & .cap-field-error { color: var(--error-color); white-space: pre-wrap; overflow-wrap: anywhere; }
    `
}

export interface FormLayoutProps extends ComponentProps {}
/** Responsive aligned fields; no form values, validation or submission policy. */
export class FormLayout extends Component<FormLayoutProps> {
    static override hostName = 'formlayout'
    static override dependencies = [FormField]
    render(): CapillaryUiChild {
        const Host = this.Host
        return <Host className={componentClass(this.props) || null}><div>{this.props.children}</div></Host>
    }
    static override css = css`
        & { display: block; container-type: inline-size; min-inline-size: 0; }
        & > div { display: grid; grid-template-columns: fit-content(40%) minmax(0, 1fr); gap: .5rem .75rem; }
        & > div > * { grid-column: 1 / -1; }
        & > div > cap-formfield { grid-template-columns: subgrid; }
        & > div > cap-formfield > :is(.cap-field-help, .cap-field-error) { grid-column: 2; }
        @container (max-width: 30rem) {
            & > div { grid-template-columns: minmax(0, 1fr); }
            & > div > cap-formfield > :is(.cap-field-help, .cap-field-error) { grid-column: 1; }
        }
    `
}
