/** @jsxRuntime classic */
/** @jsx h */
import {Button, Panel, Sidebar, h} from '@sylwellsoftware/fray'

const tree = <Panel header="Classic"><Button label="Save" /></Panel>
const sidebar = <Sidebar header="Requests">Request one</Sidebar>

// @ts-expect-error Packed classic JSX declarations reject invalid props.
const invalid = <Button disabled="yes" />

void tree
void sidebar
void invalid
