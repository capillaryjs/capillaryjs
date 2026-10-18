import {Component, Textbox, css} from "@capillaryjs/capillary-ui";
import type {CapillaryUiChild, ComponentProps} from "@capillaryjs/capillary-ui";
import type {Emitter} from "@capillaryjs/capillary";

interface RangeFilterProps extends ComponentProps {
    readonly label: string
    readonly unit: string
    readonly valueEmitter: Emitter<string>
    readonly min: number
    readonly max: number
    readonly step: number
}

/** Shared bounded range filter; the framework control owns native input behavior. */
export class RangeFilter extends Component<RangeFilterProps> {
    static override hostName = "buildco-range-filter"
    static override dependencies = [Textbox]

    render(): CapillaryUiChild {
        const value = this.read(this.props.valueEmitter)
        const Host = this.Host
        return <Host>
            <div className="range-filter">
                <Textbox label={this.props.label} type="range" min={this.props.min} max={this.props.max} step={this.props.step}
                    valueEmitter={this.props.valueEmitter}/>
                <output>{value} {this.props.unit}</output>
            </div>
        </Host>
    }

    static override css = css`
        & { display: inline-block; min-inline-size: 0; }
        & .range-filter { display: flex; align-items: center; gap: .4rem; min-inline-size: 0; }
        & cap-textbox, & text-box { flex: 1 1 auto; min-inline-size: 0; }
        & output { flex: 0 0 auto; font-variant-numeric: tabular-nums; }
    `
}
