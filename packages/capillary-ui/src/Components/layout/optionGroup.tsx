import {Component, css} from '../component.js'
import type {ComponentProps, CapillaryUiChild, LivePropContract} from '../component.js'
import {componentClass, controlId} from '../controlUtils.js'
import {ErrorMessage} from '../status/statusPresentation.js'
import {DeclarativeRegion, readDeclarativeRegions} from './declarativeRegion.js'

/** Trailing content rendered in an OptionGroup legend. */
export class OptionGroupHeaderEnd extends DeclarativeRegion {}

const optionGroupLiveProps = ['disabled', 'required', 'busy', 'error'] as const

export interface OptionGroupBaseProps extends ComponentProps,
    LivePropContract<(typeof optionGroupLiveProps)[number]> {
    id?: string | number | null
    label?: CapillaryUiChild
    ariaLabel?: string
    /** @deprecated Supply `<OptionGroupHeaderEnd>` as a direct child. */
    headerEnd?: never
    disabled?: boolean
    required?: boolean
    busy?: boolean
    error?: unknown
}

/** Labeled fieldset section for use inside an OptionsBox or standalone. */
export class OptionGroup<TProps extends OptionGroupBaseProps = OptionGroupBaseProps>
    extends Component<TProps> {
    static override liveProps = optionGroupLiveProps
    readonly groupId: string
    readonly errorId: string

    constructor(props: TProps) {
        super(props)
        this.groupId = controlId('option-group', props.id)
        this.errorId = `${this.groupId}-error`
    }

    render(): CapillaryUiChild {
        if (this.props.headerEnd != null) {
            throw new Error('OptionGroup trailing header content must use a direct OptionGroupHeaderEnd child')
        }
        const {content, regions} = readDeclarativeRegions('OptionGroup', this.props.children, {
            headerEnd: OptionGroupHeaderEnd,
        })
        return this.renderOptionGroup(content, regions.headerEnd ?? null)
    }

    protected renderOptionGroup(content: CapillaryUiChild, headerEnd: CapillaryUiChild): CapillaryUiChild {
        const Host = this.Host
        const {
            label,
            ariaLabel,
            disabled = false,
            required = false,
            busy = false,
            error = null,
        } = this.props
        return <Host className={componentClass(this.props) || null}>
            <fieldset
                id={this.groupId}
                disabled={disabled}
                aria-label={label == null ? ariaLabel : null}
                aria-required={required ? 'true' : null}
                aria-busy={busy ? 'true' : null}
                aria-invalid={error == null ? null : 'true'}
                aria-describedby={error == null ? null : this.errorId}
            >
                {label != null || headerEnd != null ? <legend>
                    {label != null ? <span>{label}</span> : null}
                    {headerEnd}
                </legend> : null}
                {content}
            </fieldset>
            {this.renderOptionGroupError(error)}
        </Host>
    }

    /** Shared error anatomy for OptionGroup specializations. */
    protected renderOptionGroupError(error: unknown): CapillaryUiChild {
        return error == null ? null : <ErrorMessage id={this.errorId} error={error} />
    }

    static override hostName = 'option-group'
    static override dependencies = [OptionGroupHeaderEnd, ErrorMessage]

    static css = css`
        & {
            display: block;
            position: relative;
            min-width: 0;
        }

        & > fieldset {
            margin: 0;
            padding: 0;
            min-inline-size: 0;
            border: 0;
            width: 100%;
            box-sizing: border-box;
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
            user-select: none;
        }

        & > fieldset > legend > span {
            flex: 1;
            min-width: 0;
        }

        & > fieldset[aria-busy="true"]:not([aria-invalid="true"]) {
            background-image: var(--working-background-image);
            background-repeat: repeat;
            background-size: 2rem 2rem;
            animation: cap-working-progress .55s linear infinite;
        }

        & > fieldset[aria-invalid="true"] {
            border: 1px solid var(--error-control-border);
            border-radius: var(--ui-border-radius);
            box-shadow: var(--error-control-shadow);
        }

        @media (prefers-reduced-motion: reduce) {
            & > fieldset[aria-busy="true"] {
                animation: none !important;
            }
        }

        @media (forced-colors: active) {
            & > fieldset[aria-invalid="true"] {
                outline: 2px solid Mark;
                outline-offset: 1px;
            }
        }
    `
}
