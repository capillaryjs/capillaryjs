import {FilterMode} from '../../../util/filterMode.js'
import type {FilterModeValue} from '../../../util/filterMode.js'
import {Checkbox} from './Checkbox.js'
import type {CheckboxProps, CheckboxSymbol} from './Checkbox.js'

export type TriCheckboxProps = Omit<CheckboxProps<FilterModeValue>, 'symbols'>

export class TriCheckbox extends Checkbox<FilterModeValue> {
    static override hostName = 'tri-checkbox'

    static symbols = [
        ['✖', FilterMode.Deny],
        ['☐', FilterMode.Neutral],
        ['✓', FilterMode.Prefer],
    ] as const satisfies readonly CheckboxSymbol<FilterModeValue>[]

    static defaultSemanticState = FilterMode.Neutral

    constructor(props: TriCheckboxProps = {}) {
        super({...props, symbols: TriCheckbox.symbols})
    }
}
