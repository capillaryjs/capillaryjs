import {AsyncCommand, Emitter} from '@capillaryjs/capillary'
import {
    Button,
    Icon,
    ListView,
    TreeView,
    DataTable,
    Popover,
    Tooltip,
    Drawer,
    Component,
    createPointerDrag,
    MenuButton,
    DropdownMenu,
    Form,
    FormField,
    FormLayout,
    TextArea,
    Textbox,
    ComboBox,
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
const hint = <Tooltip text="Hold Shift for small steps" trigger={({ariaDescribedBy, triggerRef}) =>
    <Button icon="pan" ariaLabel="Pan" title="" ariaDescribedBy={ariaDescribedBy} buttonRef={triggerRef}/>} />
// @ts-expect-error Tooltip content is noninteractive plain supplemental text.
const interactiveHint = <Tooltip text={<Button label="Action"/>} trigger={() => null}/>
void [hint, interactiveHint]
const collapse = new Emitter<'primary' | 'secondary' | null>(null)
const panels = <>
    <SplitView horizontal collapsed={live(collapse)}><SplitPrimary/><SplitSecondary/></SplitView>
    <Drawer label="Changes" edge="block-end" size="12rem" mountPolicy="active-only" valueEmitter={new Emitter(false)}/>
</>
// @ts-expect-error Drawer edges are logical, not physical.
const physicalDrawer = <Drawer label="Changes" edge="left"/>
void [panels, physicalDrawer]
const dragOwner = new Component({})
const drag = createPointerDrag<{id: string}>(dragOwner, {onCommit: state => {state.context.id.toUpperCase(); state.dx.toFixed()}})
dragOwner.listenWhile(document, 'pointerup', () => {})()
drag.dispose(); dragOwner.destroy()
const pending = new Emitter(false)
const interactions = <Panel>
    <MenuButton icon="add" ariaLabel="Create" disabled={live(pending)} items={[{id: 'class', label: 'Class', onSelect: () => {}}]}/>
    <DropdownMenu label="Commands" anchor={null} items={[{id: 'group', kind: 'group', label: 'Create', items: [{id: 'type', label: 'Type', onSelect: () => {}}]}]}/>
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
// @ts-expect-error Menu actions cannot be passive value options.
const invalidMenu = <MenuButton label="Create" items={[{id: 'one', label: 'One'}]}/>
void invalidMenu
const formCommand = new AsyncCommand<{intent: string}, void>({execute: async () => {}})
const form = <Form submitCommand={formCommand} submitArguments={({submitter}) => ({intent: submitter?.getAttribute('value') ?? ''})}>
    <FormLayout>
        <FormField controlId="name" label="Name" help="Unique name" control={field => <Textbox {...field}/>}/>
        <FormField controlId="description" label="Description" control={field => <TextArea {...field} rows={4} inputRef={{current: null}}/>}/>
    </FormLayout>
    <Button type="submit" formNoValidate ariaDescribedBy="submit-help">Save</Button>
</Form>
// @ts-expect-error Non-void form command arguments require explicit sampling.
const invalidForm = <Form<string> submitCommand={new AsyncCommand<string, void>({execute: async () => {}})}/>
// @ts-expect-error Form has one submit owner, not another onSubmit callback.
const duplicateFormSubmit = <Form submitCommand={formCommand} submitArguments={() => ({intent: ''})} onSubmit={() => {}}/>
// @ts-expect-error TextArea exposes a textarea ref, not an input ref.
const invalidAreaRef = <TextArea inputRef={{current: null} as {current: HTMLInputElement | null}}/>
void [form, invalidForm, duplicateFormSubmit, invalidAreaRef]
const choices = <>
    <ComboBox<number> label="Record" options={[{value: 0, label: 'Zero'}]} valueEmitter={new Emitter<number | null>(0)}/>
    <ComboBox<string> label="Type" options={[]} allowCustomValue searchEmitter={new Emitter('')} filter="none"/>
</>
// @ts-expect-error Custom text cannot be stored in a numeric selection.
const invalidCustomChoice = <ComboBox<number> options={[]} allowCustomValue/>
// @ts-expect-error Custom text is not a closed literal union.
const invalidLiteralChoice = <ComboBox<'a' | 'b'> options={[]} allowCustomValue/>
void [choices, invalidCustomChoice, invalidLiteralChoice]
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

const selectionPending = new Emitter(false)
const pendingTree = <TreeView label="Pending selection" nodes={[{id: 'a', label: 'Alpha'}]} selectionBusy={live(selectionPending)} />
const pendingList = <ListView items={['Alpha']} selectionBusy={live(selectionPending)} />
const pendingTable = <DataTable data={[{id: 'a'}]} columns={[{field: 'id'}]} selectionBusy={live(selectionPending)} />
void pendingTree
void pendingList
void pendingTable
