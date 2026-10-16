import {Button, Component, css} from "@capillaryjs/capillary-ui";
import {bootstrap, demo} from "./services.ts";

/** Observe independent outcomes without re-registering the surrounding routes. */
export class OperationFeedback extends Component {
    static hostName = "buildco-operation-feedback";
    static dependencies = [Button];
    render() {
        const reference = this.snapshot(bootstrap), notice = this.read(demo.notice);
        const refreshing = reference.value != null && reference.fetchState === "loading";
        const Host = this.Host;
        return <Host className="cap-size-natural" hidden={!notice && !reference.error && !refreshing}>
            {notice ? <p role="status">{notice}</p> : null}
            {reference.error != null || refreshing ? <aside>
                {reference.error != null ? <p role="alert">Reference data could not be refreshed. Any confirmed operation remains complete. {String(reference.error)}</p>
                    : <p role="status">Refreshing reference data…</p>}
                <Button icon="refresh" ariaLabel="Retry reference data" busy={refreshing} onClick={() => void bootstrap.retry()}/>
            </aside> : null}
        </Host>;
    }
    static css = css`& { display: block; } & [hidden], &[hidden] { display: none; }`;
}
