/** @jsxRuntime classic */
/** @jsx h */
import {Emitter} from '@sylwellsoftware/glue'
import {Button, Panel, RadioGroup, Sidebar, h, live} from '@sylwellsoftware/fray'

const tree = <Panel header="Classic"><Button label="Save" /></Panel>
const sidebar = <Sidebar header="Requests">Request one</Sidebar>
const radioOptions = new Emitter([['one', 'One']] as const)
const radioDisabled = new Emitter(false)
const radio = <RadioGroup
    options={radioOptions.get()}
    disabled={live(radioDisabled)}
    required={live(radioDisabled)}
/>

// @ts-expect-error Packed classic JSX declarations reject invalid props.
const invalid = <Button disabled="yes" />
// @ts-expect-error Packed classic declarations reject live RadioGroup options.
const invalidRadioOptions = <RadioGroup options={live(radioOptions)} />

void tree
void sidebar
void radio
void invalid
void invalidRadioOptions
