import {Emitter} from '@capillaryjs/capillary'
import {
    CapillaryUiApp, Component, Header, Layout, NavigationBar, Panel, RouteOutlet, Sidebar,
    SplitPrimary, SplitSecondary, SplitView, Toolbar, createBrowserRouter, createCapillaryUiRuntime,
    createHashNavigation, defineRoute,
} from '../../src/index.js'
import '../../themes/base.css'

const options = new URLSearchParams(location.search)
document.documentElement.dir = options.get('dir') ?? 'ltr'
const details = new Emitter(true)
const mode = new Emitter<boolean | undefined>(true)
const route = new Emitter<string | number | null>('main')
const mainRoute = defineRoute('main')
const otherRoute = defineRoute('other')

class Page extends Component {
    render() {
        return <Layout horizontal allocation="flexible" id="row"
            islands={options.has('nested') ? true : undefined}>
            <Sidebar id="sidebar" island header="Sidebar" />
            <section class="cap-layout-vertical cap-size-flexible">
                <Layout vertical allocation="flexible" id="column" scroll={options.has('scroll')}
                    islands={options.has('nested') ? true : undefined}>
                    <Panel id="overview" island header="Overview" />
                    <Panel id="results" island allocation="flexible" header="Results">
                        <Layout vertical id="inner">
                            <span>First ordinary child</span><span>Second ordinary child</span>
                        </Layout>
                    </Panel>
                </Layout>
            </section>
            {this.read(details) ? <Panel id="details" island header="Details" /> : null}
        </Layout>
    }

    static dependencies = [Layout, Sidebar, Panel]
}

class Fixture extends Component {
    render() {
        if (options.has('app-header')) return <CapillaryUiApp id="canvas"
            sizing={options.has('embedded') ? 'embedded' : 'viewport'}
            islands={this.read(mode)} layout="vertical">
            <header id="shell-header" class="island">
                <NavigationBar label="Application pages" items={[
                    {id: 'home', label: 'Home', to: {kind: 'external', href: '#home'}},
                ]} />
                <Toolbar id="shell-toolbar">Actions</Toolbar>
            </header>
            <Header id="shell-heading" island>Application heading</Header>
            <Header id="plain-heading">Ordinary heading</Header>
            <header id="plain-header">Ordinary native header</header>
            <Layout vertical id="nested-headers">
                <Header id="nested-heading" island>Section heading</Header>
                <header id="nested-header" class="island">Section header</header>
            </Layout>
            <footer id="shell-footer" class="island">Footer</footer>
        </CapillaryUiApp>

        return <CapillaryUiApp id="canvas" sizing="viewport" islands={this.read(mode)} layout="vertical">
            <Header id="heading" island>Header</Header>
            {options.has('split') ? <Layout vertical allocation="flexible" id="split-container">
                <SplitView className="test-split"
                    {...(options.get('axis') === 'vertical' ? {vertical: true} : {horizontal: true})}
                    primarySize="160px" primaryMinSize={80} secondaryMinSize={80}>
                    <SplitPrimary scroll={options.has('scroll')}
                        island={options.has('pane-islands')}
                        islands={options.has('nested') ? true : undefined}>
                        {options.has('pane-islands') ? 'Primary' :
                            <Panel id="primary-surface" island allocation="flexible">Primary</Panel>}
                    </SplitPrimary>
                    <SplitSecondary scroll={options.has('scroll')}
                        island={options.has('pane-islands')}
                        islands={options.has('nested') ? true : undefined}>
                        {options.has('pane-islands') ? 'Secondary' :
                            <Panel id="secondary-surface" island allocation="flexible">Secondary</Panel>}
                    </SplitSecondary>
                </SplitView>
            </Layout> : <RouteOutlet id="pages" activeViewEmitter={route} mountPolicy="lazy" views={[
                {id: 'main', route: mainRoute, content: <Page />},
                {id: 'other', route: otherRoute, content: <>
                    <Panel id="other-first" island header="First routed island" />
                    <Panel id="other-second" island header="Second routed island" />
                </>},
            ]} />}
            <footer id="footer" class="island">Footer</footer>
        </CapillaryUiApp>
    }

    static dependencies = [CapillaryUiApp, Header, Layout, NavigationBar, Toolbar, SplitView, Panel, RouteOutlet, Page]
}

const runtime = createCapillaryUiRuntime({router: createBrowserRouter({adapter: createHashNavigation(window)})})
runtime.registerStyles(Fixture).injectStyles(document)
runtime.mount(runtime.create(Fixture), document.body)
globalThis.capillaryUiIslandTest = {
    showDetails: (value) => details.set(value),
    selectRoute: (value) => route.set(value),
    setMode: (value) => mode.set(value),
}
