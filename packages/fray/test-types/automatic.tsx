import {Emitter} from '@sylwellsoftware/glue'
import {
    Button,
    DescriptionItem,
    DescriptionList,
    Panel,
    ProgressBar,
    Sidebar,
    SplitView,
    Textbox,
    live,
} from '../src/index.js'

const label = new Emitter('Save')
const disabled = new Emitter(false)
const inputValue = new Emitter('Ada')
const numericValue = new Emitter(1)

const automaticTree = (
    <Panel header="Automatic JSX">
        <Button label={label} disabled={live(disabled)} />
        <Textbox valueEmitter={inputValue} />
        <p>{inputValue}</p>
        <input bind:value={inputValue} />
    </Panel>
)

const inputRef: {current: HTMLInputElement | null} = {current: null}
const input = <input aria-label="Name" ref={inputRef} />
const sidebar = <Sidebar header="Requests" ariaLabel="Fallback">Request one</Sidebar>
const details = <DescriptionList><DescriptionItem term="Owner" value="Team" /></DescriptionList>
const split = <SplitView primary="Navigation" secondary="Content" />
const progress = <ProgressBar label="Refresh" value={2} max={4} />

// @ts-expect-error Automatic JSX checks intrinsic ref node types.
const invalidInput = <input ref={{current: 'not-an-input'}} />
// @ts-expect-error Automatic JSX checks component prop types.
const invalidAutomaticTree = <Button disabled="yes" />
// @ts-expect-error live() retains the emitter's scalar value type.
const invalidLiveProp = <Button disabled={live(label)} />
// @ts-expect-error bind:value requires a writable string emitter.
const invalidValueBinding = <input bind:value={numericValue} />
// @ts-expect-error bind:checked requires a writable boolean emitter.
const invalidCheckedBinding = <input bind:checked={inputValue} />

void automaticTree
void input
void sidebar
void details
void split
void progress
void invalidInput
void invalidAutomaticTree
void invalidLiveProp
void invalidValueBinding
void invalidCheckedBinding
