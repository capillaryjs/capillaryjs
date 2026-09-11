import {Emitter} from '@sylwellsoftware/glue'
import {
    Button,
    NavigationBar,
    Panel,
    ProgressBar,
    RadioGroup,
    Sidebar,
    SplitPrimary,
    SplitSecondary,
    SplitView,
    Tab,
    TabPanel,
    RouteOutlet,
    defineRoute,
    routeTarget,
    live,
} from '@sylwellsoftware/fray'

const tree = <Panel header="Automatic"><Button label="Save" /></Panel>
const input = <input aria-label="Name" ref={{current: null} as {current: HTMLInputElement | null}} />
const sidebar = <Sidebar header="Requests">Request one</Sidebar>
const split = <SplitView>
    <SplitPrimary>Navigation</SplitPrimary>
    <SplitSecondary>Content</SplitSecondary>
</SplitView>
const progress = <ProgressBar label="Loading" value={null} />
const tabs = <TabPanel mountPolicy="active-only">
    <Tab id="first" label="First">First content</Tab>
</TabPanel>
const firstRoute = defineRoute('automatic-first')
const activeRoute = new Emitter<string | number | null>('first')
const navigation = <NavigationBar label="Primary" items={[
    {id: 'first', label: 'First', to: routeTarget(firstRoute)},
]} />
const outlet = <RouteOutlet
    valueEmitter={activeRoute}
    mountPolicy="lazy"
    views={[{id: 'first', route: firstRoute, content: 'First view'}]}
/>
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
void tabs
void navigation
void outlet
void radio
void invalid
void invalidRadioOptions
void invalidRawRadioOptions
