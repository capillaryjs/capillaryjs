import type {FrayChild} from "@sylwellsoftware/fray";
import {Button, Component, Panel, ProgressBar} from "@sylwellsoftware/fray";
import {bootstrap, demo} from "../../../app/services.ts";

export class ScenarioLoadingScreen extends Component {
    render(): FrayChild {
        const b = this.snapshot(bootstrap);
        return <Panel key="startup" island allocation="natural">
            <div className="startup" role="status"><span className="eyebrow">BuildCo Control</span>
                <h1>{b.fetchState === "error" ? "The scenario could not be loaded" : "Preparing your operational workspace"}</h1>
                <p>{b.fetchState === "error" ? String(b.error) : "Generating projects, crews, materials, and their connected histories. The full demo may take about 30 seconds."}</p>{b.fetchState === "error" ?
                    <Button label="Retry startup" onClick={() => void bootstrap.retry()}/> :
                    <ProgressBar label="Preparing scenario" valueEmitter={demo.progress}/>}</div>
        </Panel>;
    }
}
