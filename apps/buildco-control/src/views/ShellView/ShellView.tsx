import type {CapillaryUiChild} from "@capillaryjs/capillary-ui";
import {Component, Panel} from "@capillaryjs/capillary-ui";
import {bootstrap} from "../../app/services.ts";
import {ScenarioLoadingScreen} from "./components/ScenarioLoadingScreen.tsx";

export class ShellView extends Component {
    render(): CapillaryUiChild {
        const b = this.snapshot(bootstrap);
        return <>
            {!b.value && <ScenarioLoadingScreen/>}
            {b.value && <Panel key="workspace" island allocation="natural">
                <p className="muted">Scenario loaded. Operational workspace will appear here.</p>
            </Panel>}
        </>;
    }
}
