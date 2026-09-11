import {OptionGroup, OptionGroupHeaderEnd, css, readDeclarativeRegions} from '@sylwellsoftware/fray'
import type {FrayChild, OptionGroupBaseProps} from '@sylwellsoftware/fray'

export interface CollapsibleOptionGroupProps extends OptionGroupBaseProps {
    /** Start collapsed instead of expanded. */
    collapsed?: boolean
}

/** OptionGroup with an expand/collapse toggle button in the legend. */
export class CollapsibleOptionGroup<
    TProps extends CollapsibleOptionGroupProps = CollapsibleOptionGroupProps,
> extends OptionGroup<TProps> {
    static override liveProps: readonly string[] = []
    readonly contentId: string
    private collapsed: boolean

    constructor(props: TProps) {
        super(props)
        this.collapsed = props.collapsed ?? false
        this.contentId = `${this.groupId}-content`
    }

    override render(): FrayChild {
        if (this.props.headerEnd != null) {
            throw new Error(
                'CollapsibleOptionGroup trailing header content must use a direct OptionGroupHeaderEnd child',
            )
        }
        const {content, regions} = readDeclarativeRegions(
            'CollapsibleOptionGroup',
            this.props.children,
            {headerEnd: OptionGroupHeaderEnd},
        )
        return this.renderOptionGroup(content, regions.headerEnd ?? null)
    }

    private toggle(): void {
        this.collapsed = !this.collapsed
        this.update()
    }

    protected override renderOptionGroup(content: FrayChild, headerEnd: FrayChild): FrayChild {
        const Host = this.Host
        const {
            label,
            ariaLabel,
            disabled = false,
            required = false,
            error = null,
        } = this.props
        return <Host className={this.props.className ?? this.props.class ?? null}>
            <fieldset
                id={this.groupId}
                disabled={disabled}
                aria-label={label == null ? ariaLabel : null}
                aria-required={required ? 'true' : null}
                aria-invalid={error == null ? null : 'true'}
                aria-describedby={error == null ? null : this.errorId}
            >
                <legend>
                    <button
                        type="button"
                        className="fray-collapse-toggle"
                        aria-expanded={!this.collapsed}
                        aria-controls={this.contentId}
                        onClick={() => this.toggle()}
                    >
                        {this.collapsed ? '▸' : '▾'}
                    </button>
                    {label != null ? <span>{label}</span> : null}
                    {headerEnd}
                </legend>
                <div id={this.contentId} hidden={this.collapsed}>
                    {content}
                </div>
            </fieldset>
            {error == null ? null : <p
                id={this.errorId}
                role="alert"
            >{String(error)}</p>}
        </Host>
    }

    static override hostName = 'collapsible-option-group'

    static override css = css`
        & > fieldset > legend > button.fray-collapse-toggle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 1.2em;
            height: 1.2em;
            padding: 0;
            border: 0;
            border-radius: var(--ui-border-radius);
            background: transparent;
            color: inherit;
            font: inherit;
            cursor: pointer;
            flex: 0 0 auto;
        }

        & > fieldset > legend > button.fray-collapse-toggle:hover {
            background: var(--button-background-hover, rgba(0, 0, 0, 0.05));
        }

        & > fieldset > legend > button.fray-collapse-toggle:focus-visible {
            outline: 2px solid var(--focus-color, var(--ui-accent-color));
            outline-offset: 1px;
        }

        & > fieldset > div {
            display: contents;
        }

        & > fieldset > div[hidden] {
            display: none;
        }
    `
}
