import { Button, Component, Dialog, Dropdown, Textbox, live } from "@sylwellsoftware/fray";
import type { FrayChild } from "@sylwellsoftware/fray";
import { Emitter } from "@sylwellsoftware/glue";
import type { Choice, Mutation, Row } from "../app/contract.ts";
import { human } from "../app/contract.ts";
import { bootstrap, buildco, mutate } from "./session.ts";

type EditRequest = { kind: Mutation["kind"]; action: Mutation["action"]; row?: Row; projectId?: string };
export const editor = new Emitter<EditRequest | null>(null);
export class RecordEditor extends Component {
  private open = new Emitter(false);
  private fields = Object.fromEntries(["project", "phase", "title", "description", "severity", "person", "due", "estimate", "lostHours", "impactDays"].map(key => [key, new Emitter("")])) as Record<string, Emitter<string>>;
  private choices = new Emitter<Choice[]>([]);
  private error = new Emitter("");
  private requestId = 0;
  initialize(): void {
    for (const value of [this.open, this.choices, this.error, ...Object.values(this.fields)]) this.onCleanup(() => value.dispose());
    this.onCleanup(editor.subscribe(({ value }) => {
      if (!value) { this.open.set(false); return; }
      mutate.reset(); this.error.set("");
      const row = value.row;
      const projectId = value.projectId === "__all" ? "" : value.projectId;
      for (const [key, field] of Object.entries(this.fields)) field.set(String(key === "project" ? row?.projectId || projectId || bootstrap.get()?.projects.find(p => p.status === "active")?.id || "" : key === "phase" ? row?.phaseId ?? "" : key === "title" ? row?.name ?? "" : key === "description" ? row?.description ?? "" : key === "severity" ? row?.severity ?? "medium" : key === "person" ? row?.assignedToId ?? "__none" : key === "due" ? row?.due ?? "" : key === "estimate" ? row?.estimate ?? 0 : key === "lostHours" ? row?.hours ?? 0 : row?.impact ?? 1));
      void this.loadChoices(); this.open.set(true);
    }));
    this.onCleanup(this.fields.project!.subscribe(() => { if (editor.get()?.action === "create") this.fields.phase!.set(""); void this.loadChoices(); }, { emitCurrent: false }));
  }
  private async loadChoices(): Promise<void> {
    const id = ++this.requestId;
    try { const result = await buildco.choices(this.fields.project!.get()); if (id === this.requestId) this.choices.set(result.phases ?? []); }
    catch (error) { if (id === this.requestId) this.error.set(String(error)); }
  }
  private async save(): Promise<void> {
    const current = editor.get(); if (!current) return;
    if (current.action !== "resolve" && (!this.fields.phase!.get() || this.fields.title!.get().trim().length < 3)) { this.error.set("Choose a phase and enter a title with at least 3 characters."); return; }
    const result = await mutate.run({ kind: current.kind, action: current.action, id: current.row?.id, projectId: this.fields.project!.get(), phaseId: this.fields.phase!.get(), title: this.fields.title!.get(), description: this.fields.description!.get(), severity: this.fields.severity!.get(), personId: this.fields.person!.get() === "__none" ? undefined : this.fields.person!.get() || undefined, dueDate: this.fields.due!.get() || undefined, estimatedCost: Number(this.fields.estimate!.get()), lostHours: Number(this.fields.lostHours!.get()), impactDays: Number(this.fields.impactDays!.get()) });
    if (result) editor.set(null); else this.error.set(mutate.getError() instanceof Error ? (mutate.getError() as Error).message : "The command failed. Please try again.");
  }
  render(): FrayChild {
    const current = this.read(editor), error = this.read(this.error), busy = this.read(mutate.isRunning);
    const resolving = current?.action === "resolve", delay = current?.kind === "delay";
    const title = resolving ? delay ? "End delay" : "Resolve issue" : `${current?.action === "edit" ? "Edit" : "Report"} ${delay ? "delay" : "issue"}`;
    return <Dialog title={title} valueEmitter={this.open} description="Changes apply to this shared in-memory scenario. Regenerating the scenario resets edits." onClose={() => editor.set(null)} actions={<><Button label="Cancel" disabled={busy} onClick={() => editor.set(null)} /><Button label={resolving ? title : "Save record"} busy={live(mutate.isRunning)} disabled={busy} onClick={() => void this.save()} /></>}>
      {error && <p role="alert" className="fetch-notice error">{error}</p>}
      {resolving ? <p>Mark “{current?.row?.name}” as {delay ? "ended" : "resolved"} on {bootstrap.get()?.metadata.anchorDate}?</p> : <div className="editor-fields">
        <Dropdown key={`projects-${bootstrap.get()?.metadata.seed}`} label="Project" valueEmitter={this.fields.project!} options={bootstrap.get()?.choices.projects ?? []} disabled={current?.action === "edit" || busy} required />
        <Dropdown label="Phase" placeholder="Choose a phase…" valueEmitter={this.fields.phase!} options={this.choices} disabled={current?.action === "edit" || busy} required />
        <Textbox label={delay ? "Delay description" : "Issue title"} valueEmitter={this.fields.title!} required maxLength={180} disabled={busy} />
        {!delay && <><Textbox label="Description" valueEmitter={this.fields.description!} disabled={busy} /><Dropdown label="Severity" valueEmitter={this.fields.severity!} options={["low", "medium", "high", "critical"].map(value => ({ value, label: human(value) }))} disabled={busy} /><Dropdown label="Assigned person" valueEmitter={this.fields.person!} options={[{ value: "__none", label: "Unassigned" }, ...bootstrap.get()?.choices.people ?? []]} disabled={busy} /><Textbox label="Due date" type="date" valueEmitter={this.fields.due!} disabled={busy} /><Textbox label="Estimated cost · DKK" type="number" valueEmitter={this.fields.estimate!} disabled={busy} /></>}
        {delay && <><Textbox label="Estimated lost hours" type="number" valueEmitter={this.fields.lostHours!} disabled={busy || current?.action === "edit"} /><Textbox label="Estimated schedule impact · days" type="number" valueEmitter={this.fields.impactDays!} disabled={busy || current?.action === "edit"} /></>}
        {current?.action === "create" && <p className="muted">{delay ? "Recorded as an active, reduced-capacity delay with an unclassified cause." : "Recorded as an open issue with an unknown, suspected cause. No actual cost is invented; actual costs come from attributed resource entries."}</p>}
      </div>}
    </Dialog>;
  }
}
