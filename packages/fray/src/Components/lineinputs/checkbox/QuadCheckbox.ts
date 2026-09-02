import {FilterMode} from '../../../util/filterMode.js'
import type {FilterModeValue} from '../../../util/filterMode.js'
import {Checkbox} from './Checkbox.js'
import type {CheckboxProps, CheckboxSymbol} from './Checkbox.js'

export type QuadCheckboxProps = Omit<CheckboxProps<FilterModeValue>, 'symbols'>

// QuadCheckbox: (Deny ✖) → (Neutral ☐) → (Prefer ✓) → (Require +)
// Must have all [+]
// Must not have any [✖]
// Should have at least one [✓] (if any are marked [✓])
export class QuadCheckbox extends Checkbox<FilterModeValue> {
    static override hostName = 'quad-checkbox'
    static override standaloneHostName = 'quad-checkbox'

    static symbols = [
        ['✖', FilterMode.Deny],
        ['☐', FilterMode.Neutral],
        ['✓', FilterMode.Prefer],
        ['+', FilterMode.Require],
    ] as const satisfies readonly CheckboxSymbol<FilterModeValue>[]

    static defaultSemanticState = FilterMode.Neutral

    constructor(props: QuadCheckboxProps = {}) {
        super({...props, symbols: QuadCheckbox.symbols})
    }
}
