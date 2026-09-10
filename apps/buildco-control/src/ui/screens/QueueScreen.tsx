import { Button, FilterPanel, GroupPanel, ListView, Panel, QuadCheckbox, Sidebar, SplitView, Toolbar, live } from "@sylwellsoftware/fray";
import type { FrayChild } from "@sylwellsoftware/fray";
import { CONDITIONS } from "../../app/contract.ts";
import type { SemanticMode, ViewResult } from "../../app/contract.ts";
import { bootstrap, flags, openProject } from "../session.ts";
import { RecordCard } from "../shared.tsx";
import { ScreenView, options } from "./base.tsx";

export class QueueScreen extends ScreenView {
  protected onInit(): void {
    this.onCleanup(
      this.state.selection.subscribe(
        ({ value }) => { if (value) openProject(value); },
        { emitCurrent: false },
      ),
    );
  }

  protected renderContent(result?: ViewResult): FrayChild {
    const b = this.read(bootstrap);

    return (
      <SplitView
        primarySize="285px"
        primaryLabel="Work conditions"
        secondaryLabel="Matching work"
        primary={
          <Sidebar island ariaLabel="Work conditions" header={<h2>Build your work queue</h2>}>
            <Toolbar label="Work queue filters">
              {this.text("search", "Work")}
              {this.project()}
              {this.select("type", "Project types", b?.choices.projectTypes ?? [])}
              {this.select("phaseType", "Phase types", b?.choices.phaseTypes ?? [])}
            </Toolbar>

            <GroupPanel header="Conditions">
              <div className="semantic-grid">
                {this.conditionFields.map(c => (
                  <QuadCheckbox
                    key={c.value}
                    label={c.label}
                    valueEmitter={c.emitter}
                    disabled={live(flags.disabled)}
                  />
                ))}
              </div>
            </GroupPanel>

            <p className="muted semantic-help">
              ☐ Neutral · ✓ Prefer (any) · + Require (all) · × Deny. Deny always wins.
            </p>

            <details>
              <summary>Project lifecycle filter</summary>
              <FilterPanel
                label="Project lifecycle"
                options={options(["active", "completed", "planned"])}
                filters={Object.entries(JSON.parse(this.field("lifecycle").get() || "{}")) as [string, SemanticMode][]}
                onChange={filters => this.field("lifecycle").set(JSON.stringify(Object.fromEntries(filters)))}
              />
            </details>
          </Sidebar>
        }
        secondary={
          <Panel
            island
            header={
              <div className="section-heading">
                <h2>Matching work</h2>
                <span className="count">{result?.total.toLocaleString() ?? "…"}</span>
              </div>
            }
          >
            <ListView
              items={this.rows}
              label="Work queue results"
              itemKey="id"
              selectedItemEmitter={this.state.selection}
              renderItem={row => (
                <div className="queue-record">
                  <RecordCard row={row} />
                  <div className="trait-tags">
                    {CONDITIONS.filter(c => row.traits?.[c.value]).map(c => (
                      <span className="status warn" key={c.value}>{c.label}</span>
                    ))}
                  </div>
                  <Button label="Open phase ↗" onClick={() => openProject(row)} />
                </div>
              )}
            />
            {this.pager(result)}
            {this.selected(result)}
          </Panel>
        }
      />
    );
  }
}
