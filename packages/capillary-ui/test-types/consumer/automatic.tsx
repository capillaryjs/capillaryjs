import {Emitter} from '@capillaryjs/capillary'
import {
    Button,
    Icon,
    ListView,
    TreeView,
    DataTable,
    Popover,
    TabLine,
    CapillaryUiApp,
    Layout,
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
} from '@capillaryjs/capillary-ui'

const tree = <Panel header="Automatic"><Button label="Save" /></Panel>
const pending = new Emitter(false)
const interactions = <Panel>
    <Button icon="add" appearance="subtle" ariaLabel="Add item" busy={live(pending)} disableWhileRunning={false}
        ariaControls="item-popup" ariaExpanded={false} ariaHasPopup="dialog"/>
    <Icon name="grip"/>
    <Popover label="Add relationship" anchor={null} defaultValue={false}>Target</Popover>
    <ListView items={['one']} busy={live(pending)}/>
    <TreeView label="Tree" nodes={[{id: 'one', label: 'One'}]} busy={live(pending)}/>
    <DataTable data={[{name: 'One'}]} columns={[{field: 'name'}]} busy={live(pending)}/>
    <TabLine tabs={[{id: 'one', label: 'One', busy: true}]} busy={live(pending)}/>
    <TabPanel tabs={[{id: 'one', label: 'One', content: 'Content'}]} busy={live(pending)}/>
</Panel>
void interactions
const input = <input aria-label="Name" ref={{current: null} as {current: HTMLInputElement | null}} />
const sidebar = <Sidebar header="Requests">Request one</Sidebar>
const layout = <Layout vertical scroll>Content</Layout>
const islandLayout = <CapillaryUiApp islands>
    <Layout horizontal><Panel island header="Surface" /></Layout>
    <Layout vertical islands={false}>Ordinary spacing</Layout>
</CapillaryUiApp>
// @ts-expect-error Island layout is a static boolean policy.
const invalidIslandLayout = <Layout vertical islands="automatic" />
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
    {id: 'portal', label: 'Portal', to: {kind: 'external', href: 'https://portal.example/'}},
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
void layout
void islandLayout
void invalidIslandLayout
void split
void progress
void tabs
void navigation
void outlet
void radio
void invalid
void invalidRadioOptions
void invalidRawRadioOptions
