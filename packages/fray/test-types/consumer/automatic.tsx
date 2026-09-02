import {Button, Panel, ProgressBar, Sidebar, SplitView} from '@sylwellsoftware/fray'

const tree = <Panel header="Automatic"><Button label="Save" /></Panel>
const input = <input aria-label="Name" ref={{current: null} as {current: HTMLInputElement | null}} />
const sidebar = <Sidebar header="Requests">Request one</Sidebar>
const split = <SplitView primary="Navigation" secondary="Content" />
const progress = <ProgressBar label="Loading" value={null} />

// @ts-expect-error Packed automatic JSX declarations reject invalid props.
const invalid = <Button disabled="yes" />

void tree
void input
void sidebar
void split
void progress
void invalid
