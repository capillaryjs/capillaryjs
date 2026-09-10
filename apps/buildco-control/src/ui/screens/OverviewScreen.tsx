import { Button, ListView, Panel, Toggle } from "@sylwellsoftware/fray";
import type { FrayChild } from "@sylwellsoftware/fray";
import type { ViewResult } from "../../app/contract.ts";
import { openProject } from "../session.ts";
import { Metrics, RecordCard, Status } from "../shared.tsx";
import { ScreenView } from "./base.tsx";

export class OverviewScreen extends ScreenView {
  protected onInit(): void {
    this.onCleanup(
      this.state.selection.subscribe(
        ({ value }) => { if (value) openProject(value); },
        { emitCurrent: false },
      ),
    );
  }

  protected renderContent(result?: ViewResult): FrayChild {
    return (
      <>
        <Metrics items={result?.metrics ?? []} />
        <div className="overview-grid">
          <Panel
            island
            header={
              <div className="section-heading">
                <h2>Project portfolio</h2>
                <Toggle
                  valueEmitter={this.field("scope")}
                  options={[
                    ["all", "All projects"],
                    ["active", "Active"],
                    ["risk", "At risk"],
                  ]}
                  ariaLabel="Portfolio scope"
                />
              </div>
            }
          >
            <ListView
              items={this.rows}
              itemKey="id"
              label="Project portfolio"
              selectedItemEmitter={this.state.selection}
              renderItem={row => (
                <div className="portfolio-card">
                  <RecordCard row={row} />
                  <Button label="Open project ↗" onClick={() => openProject(row)} />
                </div>
              )}
            />
            {this.pager(result)}
          </Panel>

          <Panel
            island
            header={
              <div>
                <span className="eyebrow">Actionable now</span>
                <h2>Needs attention</h2>
              </div>
            }
          >
            <p className="muted">Active phases with delivery risks or unresolved issues.</p>

            {(result?.attention ?? []).map(row => (
              <article className="attention-card" key={row.id}>
                <div className="record-title">
                  <Status value={row.status} />
                  <span className="numeric">+{String(row.variance)}d</span>
                </div>
                <h3>{row.name}</h3>
                <p>{row.project}</p>
                <div className="record-facts">
                  <span>{String(row.openIssues)} open issues</span>
                  <span>{String(row.shortage)} shortages</span>
                </div>
                <Button label="Inspect phase →" onClick={() => openProject(row)} />
              </article>
            ))}

            {!!result?.milestones?.length && (
              <section>
                <h2>Milestones at risk</h2>
                {result.milestones.map(row => (
                  <article key={row.id} className="attention-card">
                    <h3>{row.name}</h3>
                    <p>{row.project}</p>
                    <p>Baseline {row.date} · Forecast {String(row.forecast)}</p>
                    <Button label="Review project →" onClick={() => openProject(row)} />
                  </article>
                ))}
              </section>
            )}
          </Panel>
        </div>
      </>
    );
  }
}
