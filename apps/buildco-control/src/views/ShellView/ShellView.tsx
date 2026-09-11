import type {FrayChild} from "@sylwellsoftware/fray";
import {Component, Panel} from "@sylwellsoftware/fray";
import {bootstrap} from "../../app/services.ts";
import {ScenarioLoadingScreen} from "./components/ScenarioLoadingScreen.tsx";

export class ShellView extends Component {
    render(): FrayChild {
        const b = this.snapshot(bootstrap);
        return <>
            {!b.value && <ScenarioLoadingScreen/>}
            {b.value && <Panel key="workspace" island allocation="natural">
                <p className="muted">Scenario loaded. Operational workspace will appear here.</p>
            </Panel>}
        </>;
    }
}
