/** @jsxRuntime classic */
/** @jsx h */
import {Emitter} from '@sylwellsoftware/glue'
import {Button, Panel, RadioGroup, h, live} from '../src/index.js'

const label = new Emitter('Save')
const disabled = new Emitter(false)
const options = new Emitter([['one', 'One']] as const)

const classicTree = (
    <Panel header="Classic JSX">
        <Button label={label} disabled={live(disabled)} />
        <input type="checkbox" bind:checked={disabled} />
    </Panel>
)

// @ts-expect-error Classic JSX checks component prop types.
const invalidClassicTree = <Button disabled="yes" />
// @ts-expect-error Classic JSX retains live() value types.
const invalidClassicLiveProp = <Button disabled={live(label)} />
const classicRadio = <RadioGroup
    options={options.get()}
    disabled={live(disabled)}
    required={live(disabled)}
/>
// @ts-expect-error Classic JSX rejects live RadioGroup options.
const invalidClassicRadioOptions = <RadioGroup options={live(options)} />

void classicTree
void invalidClassicTree
void invalidClassicLiveProp
void classicRadio
void invalidClassicRadioOptions
