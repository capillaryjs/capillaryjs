/** @jsxRuntime classic */
/** @jsx h */
import {Emitter} from '@sylwellsoftware/glue'
import {Button, Panel, h, live} from '../src/index.js'

const label = new Emitter('Save')
const disabled = new Emitter(false)

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

void classicTree
void invalidClassicTree
void invalidClassicLiveProp
