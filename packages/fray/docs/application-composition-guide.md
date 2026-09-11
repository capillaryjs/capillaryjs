# Fray Application Composition Guide

This guide helps you turn an application's intended functionality into readable
screens, component boundaries, and layouts. It assumes familiarity with HTML,
CSS, and TypeScript, but no particular experience with Fray.

Start with the work the user needs to do. Decide which information and controls
belong together, which regions persist during navigation, and what should
happen when data changes. Then choose components and layout mechanics that
express those decisions.

These are design recommendations within Fray's existing contracts, rather
than a mandatory application template. Applications own composition and policy;
Fray owns presentation and browser lifecycle; Glue owns reactive propagation.
The companion [repository layout guide](application-layout-guide.md) explains
where to put the resulting code.

## 1. Start with workflows and relationships

For each screen, write down the question it answers and the actions it supports.
For example, a records application might have these workflows:

| Workflow | Information and interaction | Likely composition |
| --- | --- | --- |
| Find records needing attention | Search, status filters, matching records | Controls beside results |
| Investigate one record | Record selection, summary, history | Navigator beside a workspace with local tabs |
| Read a report | Headings, prose, supporting tables | A document that grows with its content |
| Monitor activity | Several changing result streams | Independently scrolling regions |

Similar colors, spacing, and headers do not require identical screen structure.
Give each workflow an appropriate arrangement while sharing presentation traits
and components where their meaning stays consistent.

Identify the authoritative values and how interactions affect them. A search
control can write a Glue emitter used as a query argument; a results component
can observe the query result. Both components participate in one workflow
without either needing to know the other's DOM structure. Keep business rules
and reusable calculations in application/domain code, and use a view-owned
coordinator when several controls and results need orchestration. A simple
screen does not need a coordinator merely for consistency with larger screens.

Keep these boundaries distinct:

| Boundary | Decision it expresses |
| --- | --- |
| Component | A presentation or interaction responsibility with a useful contract |
| Route or tab | A navigable choice and its content lifetime |
| State owner | Who creates, changes, and disposes a value or operation |
| Layout region | How space is allocated and content arranged |
| Scroll container | Which content moves when the user scrolls |
| Island | A meaningful, visually self-contained work surface |

A results island can contain several components that share a view's state and
use one inner scroll container. None of those boundaries requires the others
to occupy the same place in the tree.

## 2. Separate persistent structure from changing content

Put application-wide branding, navigation, and status in the application root.
Put an outlet where page content changes. A page then declares the arrangement
needed for its own workflow.

The following excerpts use current Fray APIs. Imports and application-specific
data implementations are omitted. `RecordsView`, `ActivityView`,
`RecordNavigator`, `RecordSummary`, `RecordHistory`, `RecordFilters`, and
`RecordsResults` are application components, not Fray exports. See
[TSX setup](../README.md#set-up-tsx) for imports, presentation assets, and style
collection. Class components declare their rendered component dependencies so
`mountFrayApp()` can collect structural CSS, including components appearing only
in inactive routes or conditional branches.

```tsx
const recordsRoute = defineRoute('records')
const activityRoute = defineRoute('activity')

class RecordsApp extends FrayApp {
    protected override renderContent() {
        return <>
            <header className="fray-size-natural">
                <h1>Records</h1>
            </header>
            <NavigationBar
                allocation="natural"
                label="Application sections"
                items={[
                    {id: 'records', label: 'Records', to: routeTarget(recordsRoute)},
                    {id: 'activity', label: 'Activity', to: routeTarget(activityRoute)},
                ]}
            />
            <main className="fray-size-flexible fray-layout-vertical">
                <RouteOutlet
                    mountPolicy="active-only"
                    views={[
                        {id: 'records', route: recordsRoute, content: <RecordsView />},
                        {id: 'activity', route: activityRoute, content: <ActivityView />},
                    ]}
                />
            </main>
            <footer className="fray-size-natural">Connected</footer>
        </>
    }

    static dependencies = [NavigationBar, RouteOutlet, RecordsView, ActivityView]
}

const router = createBrowserRouter({adapter: createHashNavigation()})
const runtime = createFrayRuntime({router})
const app = mountFrayApp(runtime, RecordsApp, document.querySelector('#app')!, {
    sizing: 'viewport',
    layout: 'vertical',
    landmark: 'none',
})
```

Here `FrayApp` supplies the bounded root and its vertical arrangement. The
explicit `<main>` supplies the primary-content landmark, so the root uses
`landmark: 'none'` to avoid nesting main landmarks. The example assumes a
dedicated app document with its default body margin removed. At application
shutdown, destroy `app`, dispose the caller-owned `router`, and dispose any
application-owned service scope after its component tree.

`NavigationBar` renders native route links and their active state. `RouteOutlet`
owns the destination content and registers its sibling routes. Keep one owner
for that route set. Navigation does not require rebuilding the application
root or duplicating the header in each page.

The header remains mounted; it can still update a title or status. Remaining
mounted also differs from remaining visible: in a document-flow application,
a persistent header may scroll off screen. Section 4 explains the sizing
choice. The example's `active-only` policy is a deliberate choice, not the
default; section 3 explains alternatives.

### Apply the same pattern within a screen

A record workspace can keep its navigator and selected record while changing
only the summary/history tab. In this excerpt, `selection` is an
application-owned writable record-key emitter shared by the three application
components; its owner outlives both tab contents.

```tsx
<section className="fray-size-flexible fray-layout-horizontal"
    aria-label="Record workspace">
    <Sidebar allocation="natural" className="record-navigation"
        island header="Records">
        <RecordNavigator selection={selection} />
    </Sidebar>
    <section className="island fray-size-flexible fray-layout-vertical"
        aria-label="Selected record">
        <TabPanel label="Record sections" className="fray-size-flexible"
            mountPolicy="lazy">
            <Tab id="summary" label="Summary">
                <RecordSummary selection={selection} />
            </Tab>
            <Tab id="history" label="History">
                <RecordHistory selection={selection} />
            </Tab>
        </TabPanel>
    </section>
</section>
```

Application CSS sets the navigator's width. `Sidebar` owns scrolling for its
contents; `TabPanel` provides scrolling tabpanel containers. The two islands
are siblings. The tab panel does not introduce another island inside the
selected-record surface.

This local arrangement persists while switching its tabs. Its lifetime when
leaving the whole screen is a separate top-level outlet decision. Add route
descriptors to the tabs when those destinations should be addressable through
the router; local tab selection alone does not require URLs.

### Share definitions and instances deliberately

Two pages can each use the same layout component and receive separate mounted
instances. This centralizes structure without making their controls, selection,
or scroll positions global. If the same region should survive navigation, move
its owning instance above the relevant outlet instead.

A shared sidebar belongs in the shell when its purpose and desired lifetime
are application-wide. Sidebars with different page-specific controls can stay
inside their pages, even when they share width, styling, and arrangement.

When a page changes content in shared chrome, first determine whether that
content needs to live there. Page-specific actions can often remain in the
page's toolbar. For a genuinely shared header or status region, let the shell
compose content from the active selection and application-owned values or
callbacks. A supplied outlet `valueEmitter` can also be observed by other
regions; only the outlet registers the routes. Keep presentation markup in
components and data/operations in services. Avoid having mounted pages locate
and modify shell DOM or leave global toolbar registrations behind on exit.

## 3. Choose state lifetime and transition boundaries

Decide what the user should find when returning to a screen. A draft may need
to survive navigation; a hover detail may not. Preserving a filter value does
not necessarily require preserving the entire results DOM.

`RouteOutlet` and `TabPanel` offer the same `mountPolicy` choices:

| Policy | Content lifetime | Use when |
| --- | --- | --- |
| `eager` (default) | Mount every branch and retain it | All branches should initialize immediately |
| `lazy` | Mount on first selection, then retain visited branches | Reusing visited component/DOM state matters |
| `active-only` | Destroy inactive content and mount the selected branch | Recreating views is appropriate and inactive content should be released |

Retained content remains mounted and can keep subscriptions and queries active.
It is not automatically paused while hidden. Destroying a view cleans up its
rendered subtree and renderer-managed subscriptions and runs its cleanup hooks.
Arrange disposal of application-created queries, emitters, and subscriptions
through their owner's `onCleanup()` or `onDestroy()`; simply storing an object
in a component field does not arrange its disposal. A destroyed view does not
dispose a shared application service or stop work owned elsewhere. Choose query
activation and disposal with the same care as component lifetime. Fray does not
fetch merely because a route exists.

Keep state that must survive a destroyed view in an owner that outlives it,
such as its enclosing workspace or an application-owned service. Keep local
state local when its lifetime should match the view. Create emitters, queries,
and other owned objects at their lifetime boundary, rather than creating new
ones on every render. Layout convenience is not a reason to mirror all values
into a global UI store.

Use recreatable TSX/VNodes for `active-only` branches. A destroyed component
instance cannot be mounted again. Use stable keys to preserve sibling identity;
changing a key intentionally resets that subtree. Neither retained DOM nor
long-lived state implies persistence across a browser reload.

### Confine loading and errors to the affected work

If only results are loading, keep the shell, filters, and useful actions
available. A results component can observe a query snapshot and choose loading,
error, empty, or populated output inside its assigned region. Returning a
spinner before rendering the entire page frame removes that frame and its
local component state too.

Decide whether a refresh keeps the previous result visible with a busy indicator
or clears it. Disable actions whose prerequisites are unavailable rather than
disabling unrelated navigation. An empty result still occupies a meaningful
results region in a fullscreen workspace. Application-wide startup failures
may justify a broader boundary; the scope should match what is unavailable.

Details opened by a selection follow the same principle: the page owns the
selection and close action, while a details component presents the selected
information. A page can conditionally include details without making every
shared layout aware of selection policy.

See [component lifecycle](../README.md#components-and-lifecycle),
[reactive templates](../README.md#reactive-templates),
[application services](../README.md#application-services), and
[routing](../README.md#browser-routing) for implementation contracts.

## 4. Choose viewport allocation or document flow

Make this choice from the intended interaction, before adding scrollbars.

| Model | Extent and scrolling | Typical uses |
| --- | --- | --- |
| Viewport allocation | A bounded root allocates remaining space; designated inner regions scroll | Workspaces, editors, monitoring screens |
| Document flow | Content determines height; the browser document scrolls | Articles, long registers, record pages, portals |

A horizontal arrangement, a grid, or a set of islands does not decide which
model applies. A dashboard can use either model.

### Keep the bounded chain intact

For a viewport application, `FrayApp.sizing="viewport"` supplies the external
bound. `layout="vertical"` arranges its direct children. Each intermediate DOM
container must carry the allocation to the region that needs it:

```text
viewport root, vertical arrangement
├── header and navigation: natural
├── main: flexible, vertical arrangement
│   └── outlet and active page: carry the available space
│       ├── toolbar: natural
│       └── results: flexible, scroll owner
└── footer: natural
```

Fray's public traits express the common mechanics:

- `fray-layout-horizontal` / `fray-layout-vertical`: arrange direct children.
- `fray-size-natural`: retain the content/application allocation on the parent's
  main axis; this does not itself set a fixed width or height.
- `fray-size-flexible`: share remaining space and permit shrinking below
  intrinsic content size through zero logical minimums.
- `fray-scroll`: make an already bounded region an overflow owner.

Flexible sizing does not imply scrolling. An auto-height wrapper does not
inherit a viewport bound just because a distant ancestor has one. Extracting a
component that adds a DOM wrapper can therefore change layout: preserve the
DOM shape or deliberately carry allocation through the new host.

Here is one possible `RecordsView` for the shell above. `RecordFilters` and
`RecordsResults` resolve or receive the application's shared view state; the
former renders controls and the latter renders the result/loading/error
content. The frame remains present through those states.

```tsx
class RecordsView extends Component {
    render() {
        return <section className="records-workspace fray-size-flexible fray-layout-horizontal"
            aria-label="Find records">
            <aside className="record-filters island fray-size-natural fray-scroll"
                aria-label="Record filters" tabIndex={0}>
                <RecordFilters />
            </aside>
            <section className="island fray-size-flexible fray-layout-vertical"
                aria-label="Matching records">
                <Toolbar allocation="natural" label="Result actions">
                    <button type="button" onClick={exportRecords}>Export</button>
                </Toolbar>
                <Layout vertical allocation="flexible" scroll
                    ariaLabel="Record results" tabIndex={0}>
                    <RecordsResults />
                </Layout>
            </section>
        </section>
    }

    static dependencies = [RecordFilters, RecordsResults, Toolbar]
}
```

`exportRecords` is an application action. Application CSS supplies dimensions
and spacing, for example:

```css
.records-workspace { gap: 1rem; }
.record-filters { inline-size: 18rem; }
.record-navigation { inline-size: 18rem; }
```

The filters and results have separate scroll owners, and the toolbar stays
outside the results scrollbar. The application must adapt the widths or
arrangement when the available space cannot accommodate both regions. Generic
scroll regions need appropriate accessible names and keyboard access; consider
the focusability already provided by their contents when choosing tab stops.

Use component arguments where they target the intended element. `Panel` uses
`orientation` for its content, while supported components use `allocation`
for their outer host. A generic layout class on a component host might arrange
its generated header or toolbar instead of the content you supplied. Support
is explicit; do not assume every component accepts the same layout arguments.

Components such as `Sidebar`, `Panel`, `TabPanel`, and `RouteOutlet` already
have layout/overflow behavior. Inspect that contract before adding another
scroll container. Existing ancestor overflow can be an inactive fallback;
verify which element actually has scroll range. Avoid concealing allocation
errors with blanket clipping.

### Let a document grow

For a traditional register, a content-oriented `RecordsResults` can contribute
its full height to the page. This is an alternative root, not a child placed
inside the preceding viewport shell:

```tsx
class RegisterApp extends FrayApp {
    protected override renderContent() {
        return <main className="register-page">
            <h1>Record register</h1>
            <RecordFilters />
            <RecordsResults />
        </main>
    }

    static dependencies = [RecordFilters, RecordsResults]
}

mountFrayApp(createFrayRuntime(), RegisterApp, document.querySelector('#app')!, {
    sizing: 'embedded',
    landmark: 'none',
})
```

```css
.register-page {
    max-inline-size: 70rem;
    margin-inline: auto;
    padding: 1rem;
}
```

There is no bounded results container here. More rows increase page height.
The surrounding host page must also allow document flow. Setting an inner
component to `embedded` inside an already constrained scrolling shell does not
transfer scrolling to the browser document.

Keep reusable result content free of a forced viewport height when callers
need both uses. A deliberately bounded result widget can instead document that
requirement and be used only where appropriate. Large data sets still need
application-owned query limits, pagination, or another suitable strategy;
document scrolling does not remove the cost of rendering rows.

### Adapt the composition without changing the ownership rules

- A classic fullscreen shell reserves natural space for chrome and allocates
  the rest to its workspace.
- A data workspace separates control allocation from a flexible results region.
- A workbench repeats the bounded chain through nested panes. Make size ratios
  and each pane's scroll owner intentional. `SplitView` supplies a two-pane
  composition and accessible resizing mechanics, but not size persistence or
  responsive policy.
- A fullscreen monitoring screen can allocate equal shares to similarly
  decorated sibling regions with independent scrolling. Equal flexible growth
  does not guarantee equal outer boxes with different padding or borders.
- Articles and registers grow in document flow; record/detail and portal pages
  can add application-owned columns or grids while retaining that behavior.

Application CSS owns precise widths, ratios, gaps, maximum sizes, and responsive
rearrangement. Fray does not provide breakpoint variants. Prefer responsive CSS
when the same component tree can serve the smaller layout, and keep visual,
reading, and keyboard order coherent. If a changed structure remounts content,
account for its state and focus lifetime explicitly.

See [root sizing](../README.md#root-sizing-and-typography) and
[layout traits](../README.md#reusable-traits) for the public contract.

## 5. Extract components that establish a useful contract

A reader should see the screen's major regions, their contents, and the values
connecting them. The internals of a known component can stay behind its API.
Readable composition does not require placing every control in one large
render method.

Use this decision table when similar markup appears:

| What is actually shared? | A useful starting point |
| --- | --- |
| Styling, spacing, or widths, with varying anatomy | Native markup and shared CSS traits/tokens |
| A fixed arrangement with a few meaningful content regions | A shared layout component accepting parent-specific named region children |
| An accessible interaction or recognizable widget | A component such as `GroupPanel`, `Sidebar`, or a domain-specific presentation |
| A substantial part of one screen | A component colocated with that screen, even if it has only one caller |
| Mostly another component's props, passed straight through | Keep the direct use unless the wrapper adds a meaningful contract |

There is no fixed number of repeated lines or callers that makes extraction
correct. Ask whether these structures should change together and whether the
new API lets readers trust what is hidden. Two visually similar sections may
need to evolve independently.

For example, a `FilterSidebar` that only renders supplied children followed by
a status-filter panel hides their ordering without owning a sidebar or useful
behavior. Declaring those siblings in the view can be clearer. A `RecordFilters`
component that owns a recognizable set of application filters and their reset
interaction provides a stronger contract, even if its implementation is small.

### Pass content as content

Use props to configure a component. Use ordinary children for ordered content
in one region. Use parent-specific named region children when a template has
several distinct content roles.

Configuration props include identifiers, short labels, state bindings,
callbacks, allocation modes, accessibility names, and other values that remain
easy to read on the component's opening tag. A compact heading such as
`header="Display options"` is also reasonable there. Props should rarely carry
a substantial `FrayChild` tree: important structure becomes punctuation-heavy
and disappears from the visible parent/child hierarchy.

Choose the content API from what the parent does with it:

| Content relationship | Preferred API |
| --- | --- |
| One body whose children render in authored sequence | Ordinary children |
| A homogeneous ordered collection | Ordered declarative item children such as `Tab` |
| Several regions with different roles | Parent-specific declarative region children |
| Elements genuinely generated from metadata | A typed data/model prop |

If a component simply renders several supplied elements in one panel body,
ordinary children are already the ordered contract. Do not assign special
meaning to child indexes unnecessarily:

`GroupPanel` owns its labeled group structure and presentation. Its caller owns
the controls. For example, `state.colorBy` and `state.relativeTo` below are
writable emitters created by the view's state owner:

```tsx
<GroupPanel header="Display options">
    <RadioGroup
        label="Colors represent"
        options={[
            ['status', 'Status'],
            ['owner', 'Owner'],
        ]}
        valueEmitter={state.colorBy}
    />
    <RadioGroup
        label="Compare against"
        options={[
            ['selection', 'Selection'],
            ['all', 'All records'],
        ]}
        valueEmitter={state.relativeTo}
    />
</GroupPanel>
```

This keeps the controls, their order, and their bindings visible while sharing
the group chrome. `OptionsPanel` provides a more specific arrangement for
option groups when that is the intended structure.

A wrapper that accepts an array of radio-group specifications merely to
reconstruct these elements adds another authoring format and must forward each
control capability. Prefer the existing composition when the structure is
authored directly. Data-driven definitions are appropriate when the controls
really come from metadata or when the component owns a meaningful model.

When regions have different meanings, name them with parent-specific
components. SplitView's named regions are specialized Layout panes rather than
non-visual markers:

```tsx
<SplitView horizontal allocation="flexible" primarySize="18rem"
    separatorLabel="Resize record navigation">
    <SplitPrimary vertical scroll label="Record navigation">
        <RecordNavigator selection={selection} />
    </SplitPrimary>
    <SplitSecondary vertical scroll label="Record details">
        <RecordSummary selection={selection} />
        <RecordHistory selection={selection} />
    </SplitSecondary>
</SplitView>
```

SplitView owns the separator's pointer and keyboard behavior and reports sizes;
the application owns persistence and responsive policy. `PanelToolbar`,
`SidebarToolbar`, `DialogActions`, and
`OptionGroupHeaderEnd` provide the corresponding named insertion points for
those components. Their contents remain nested in the call site instead of
being hidden in `toolbar={...}` or `actions={...}` props. Short heading and
label props remain configuration:

```tsx
<Panel header="Matching records">
    <PanelToolbar>
        <Toolbar label="Result actions">
            <Button label="Export" onClick={exportRecords} />
        </Toolbar>
    </PanelToolbar>
    <RecordsResults />
</Panel>
```

Use positional region assignment only when every position receives the same
treatment and ordering is the complete meaning—for example, an equal-panel
component that wraps each ordinary child in the same panel. If “first” means
navigation and “second” means workspace, explicit names are more resilient and
readable.

Prefer semantic marker names such as `ShellHeader` and `ShellContent` over a
universal `<Slot name="header">`. The supported anatomy is then visible in the
import and TSX types; two parents cannot silently give the same string name
different contracts. The shared parsing mechanism may be generic, but the
public composition language should describe the region's role.

### Define a component with named regions

Application-defined templates can extend `DeclarativeRegion` for each role and
use `readDeclarativeRegions()` to consume their direct children:

```tsx
class ShellHeader extends DeclarativeRegion {}
class ShellContent extends DeclarativeRegion {}
class ShellFooter extends DeclarativeRegion {}

class ApplicationShell extends Component {
    render() {
        const {regions} = readDeclarativeRegions(
            'ApplicationShell',
            this.props.children,
            {
                header: ShellHeader,
                content: ShellContent,
                footer: ShellFooter,
            },
            {allowContent: false, required: ['content']},
        )

        return <Layout vertical className="application-shell">
            {regions.header == null ? null : <header>{regions.header}</header>}
            <main className="fray-size-flexible">{regions.content}</main>
            {regions.footer == null ? null : <footer>{regions.footer}</footer>}
        </Layout>
    }

    static dependencies = [Layout, ShellHeader, ShellContent, ShellFooter]
}
```

The resulting use keeps the supplied anatomy visible:

```tsx
<ApplicationShell>
    <ShellHeader>
        <Brand />
        <NavigationBar label="Application sections" items={navigationItems} />
    </ShellHeader>
    <ShellContent>
        <RouteOutlet views={routes} />
    </ShellContent>
    <ShellFooter>
        <ConnectionStatus />
    </ShellFooter>
</ApplicationShell>
```

Region markers are non-visual instructions, not additional surfaces or DOM
wrappers. They must be direct children of the parent that documents them.
`readDeclarativeRegions()` preserves ordinary content order, rejects duplicate
or foreign region markers, can reject ordinary content, and can require named
regions. Keep the region set small and stable. Put reactive values inside a
region rather than making the template anatomy itself a changing stream.

A named region exposes where caller-owned content belongs; it does not reveal
or transfer the parent's other responsibilities. The parent still owns the
rendered landmarks, allocation, scrolling, accessibility wiring, and region
order. Source order should normally match rendered and keyboard order.

Expose only genuine variability. If every caller receives the same application
header or footer, render it inside the shell rather than adding a region merely
because the structure has a name. A single-use shell can remain direct markup
in the application root; named regions do not make an otherwise unnecessary
abstraction valuable.

Prefer a few meaningful regions over a universal panel whose many options
change its topology. If callers repeatedly need to inspect internals or target
private descendants to place content correctly, reconsider the boundary.

### Make a shared layout's promises explicit

A small layout component can earn its place by preserving a reliable sizing
chain and scroll boundary. State its contract in ordinary terms:

> This workspace fills its parent's allocated space, keeps a toolbar above
> the results, and gives the results region the scrollbar.

Document what space it expects, how its host participates, where content is
placed, and whether it owns scrolling or delegates it. If it deliberately
supports both document flow and bounded allocation, make those modes explicit
and verify both. It need not expose every CSS property as a prop.

Sharing CSS centralizes presentation but leaves structural markup repeated.
Extracting a layout centralizes structural changes but asks readers to learn
its contract. Choose based on the changes that should remain coordinated.
Keep arrangement and scrolling visible in the TSX of the component that owns
them; callers can then rely on its documented contract.

### Prefer composition for screens; use inheritance deliberately

A view can contain a layout and supply its contents. Making every view inherit
from a layout spreads the declaration across overridden methods and does not
make the layout instance persist across navigation. Composition is the usual
choice for assembling application screens.

Inheritance remains useful where Fray provides an intentional specialization
contract. An application root can extend `FrayApp` and override
`renderContent()`, as above. `OptionsPanel` extends `GroupPanel` to specialize
shared chrome. Such examples do not require an application-wide hierarchy of
page base classes.

## 6. Share styling without multiplying surfaces

Use an island for a meaningful work surface: a navigation area, a results
workspace, or a substantial analysis region. Do not turn every extracted
component into a separate island. Several controls, groups, and data views can
belong to one island; islands must not nest.

Let the composition that knows the surrounding surfaces choose island
placement. A reusable inner component should normally leave that choice to
its caller. The `island` prop or class supplies surface treatment, not space
allocation or the intended scroll owner. A `GroupPanel` inside an island can
retain its ordinary group chrome without itself being another island.

Use native elements for native semantics. Apply Fray's public traits directly
to those elements when they participate in Fray layout or presentation. For
example, an application shell can naturally use
`<header className="island fray-size-natural">` and
`<footer className="island fray-size-natural">`; a Fray-specific header or
footer component is not required merely to obtain the standard surface
treatment.

Conversely, Fray does not infer that treatment from the native element type
alone. A plain `header`, `footer`, `section`, or `aside` remains ordinary
application markup until the application explicitly opts it into a Fray trait or
places it inside a Fray-owned component contract. Share application CSS through
meaningful traits rather than extracting components solely to attach a class.
Components own their structural presentation; themes and palette assets supply
the chosen visual treatment. Follow the
[styling contract](../README.md#styling-contract) rather than duplicating
internal component styles in every screen.

Development controls are another application-owned boundary. If an app provides
forced loading, disabled, or validation states for testing, apply them to the
intended content while leaving the controls that restore normal operation
usable. A demo harness is not a required layer of every Fray application.

## 7. Review the design through real transitions

Before treating a composition or shared layout as established, check:

- Can a reader identify the screen's task, major regions, and control/result
  relationships without opening a chain of forwarding wrappers?
- Does navigation replace only the intended content? Test return navigation and
  direct nested URLs when routing is enabled.
- Do drafts, selections, and filters survive or reset deliberately? Are owned
  subscriptions and queries released at the right lifetime boundary?
- During loading, refresh, error, and empty results, do useful controls remain
  available and is feedback confined to the affected region?
- With overflowing content, which elements actually scroll? In a viewport
  layout, verify that content does not accidentally grow the document or
  create competing ancestor scrollbars.
- With little or no content, does a bounded workspace still fill its allocation
  and keep bottom chrome in place? In a document layout, does more content grow
  the document naturally?
- At narrow widths and enlarged text, do controls remain reachable? Check
  landmarks, headings, region names, keyboard order, and focus after content
  changes. Do not rely on clipping to make geometry appear correct.
- Are shared structure and styling centralized where they should change
  together, while page-specific decisions remain easy to find?

For reusable layouts, browser geometry checks can verify bounds and actual
scroll ranges; visual and keyboard review checks how the composition feels to
use. A screenshot of one populated desktop state does not establish the whole
contract.
