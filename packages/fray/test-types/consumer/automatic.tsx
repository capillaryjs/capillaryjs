import {Emitter} from '@sylwellsoftware/glue'
import {
    Button,
    Panel,
    ProgressBar,
    RadioGroup,
    Sidebar,
    SplitView,
    live,
} from '@sylwellsoftware/fray'

const tree = <Panel header="Automatic"><Button label="Save" /></Panel>
const input = <input aria-label="Name" ref={{current: null} as {current: HTMLInputElement | null}} />
const sidebar = <Sidebar header="Requests">Request one</Sidebar>
const split = <SplitView primary="Navigation" secondary="Content" />
const progress = <ProgressBar label="Loading" value={null} />
const radioOptions = new Emitter([['one', 'One']] as const)
const radioDisabled = new Emitter(false)
const radio = <RadioGroup
    options={radioOptions.get()}
    disabled={live(radioDisabled)}
    required={live(radioDisabled)}
/>

// @ts-expect-error Packed automatic JSX declarations reject invalid props.
const invalid = <Button disabled="yes" />
// @ts-expect-error Packed declarations reject live RadioGroup options.
const invalidRadioOptions = <RadioGroup options={live(radioOptions)} />
// @ts-expect-error Packed declarations reject raw emitter RadioGroup options.
const invalidRawRadioOptions = <RadioGroup options={radioOptions} />

void tree
void input
void sidebar
void split
void progress
void radio
void invalid
void invalidRadioOptions
void invalidRawRadioOptions
