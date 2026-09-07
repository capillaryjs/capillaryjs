import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild} from '../component.js'
import {componentClass, controlId} from '../controlUtils.js'

export interface OptionGroupBaseProps extends ComponentProps {
    id?: string | number | null
    label?: FrayChild
    ariaLabel?: string
    headerEnd?: FrayChild
    disabled?: boolean
    required?: boolean
    error?: unknown
}

/** Labeled fieldset section for use inside an OptionsPanel or standalone. */
export class OptionGroup<TProps extends OptionGroupBaseProps = OptionGroupBaseProps>
    extends Component<TProps> {
    static override liveProps: readonly string[] = []
    readonly groupId: string
    readonly errorId: string

    constructor(props: TProps) {
        super(props)
        this.groupId = controlId('option-group', props.id)
        this.errorId = `${this.groupId}-error`
    }

    render(): FrayChild {
        return this.renderOptionGroup(this.props.children ?? [])
    }

    protected renderOptionGroup(content: FrayChild): FrayChild {
        const Host = this.Host
        const {
            label,
            ariaLabel,
            headerEnd = null,
            disabled = false,
            required = false,
            error = null,
        } = this.props
        return <Host className={componentClass(this.props) || null}>
            <fieldset
                id={this.groupId}
                disabled={disabled}
                aria-label={label == null ? ariaLabel : null}
                aria-required={required ? 'true' : null}
                aria-invalid={error == null ? null : 'true'}
                aria-describedby={error == null ? null : this.errorId}
            >
                {label != null || headerEnd != null ? <legend>
                    {label != null ? <span>{label}</span> : null}
                    {headerEnd}
                </legend> : null}
                {content}
            </fieldset>
            {error == null ? null : <p
                id={this.errorId}
                role="alert"
            >{String(error)}</p>}
        </Host>
    }

    static override hostName = 'option-group'

    static css = css`
        & {
            display: block;
            min-width: 0;
        }

        & > fieldset {
            margin: 0;
            padding: 0;
            min-inline-size: 0;
            border: 0;
            width: 100%;
        }

        & > fieldset > legend {
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-sizing: border-box;
            gap: 0.5rem;
            width: 100%;
            padding: 0 0 0.25em;
            margin-bottom: 0.5em;
            border-bottom: 1px solid var(--ui-border-color);
            font: inherit;
        }

        & > fieldset > legend > span {
            flex: 1;
            min-width: 0;
        }

        & > p[role="alert"] {
            margin: 0.25em 0 0;
        }
    `
}
