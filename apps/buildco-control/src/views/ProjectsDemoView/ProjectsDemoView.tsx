import type {FrayChild} from "@sylwellsoftware/fray";
import {Component, DataTable, ListView, Panel, Sidebar, SplitPrimary, SplitSecondary, SplitView} from "@sylwellsoftware/fray";
import type {TableColumn, TableRow} from "@sylwellsoftware/fray";

interface ProjectItem {
    id: string;
    name: string;
    status: string;
}

interface ProjectRow extends TableRow {
    id: string;
    name: string;
    status: string;
    progress: string;
    budget: string;
}

const projectItems: ProjectItem[] = [
    {id: "p1", name: "Harbour Tower", status: "active"},
    {id: "p2", name: "North Bridge", status: "planning"},
    {id: "p3", name: "Riverside Park", status: "completed"},
    {id: "p4", name: "City Library", status: "active"},
    {id: "p5", name: "Metro Extension", status: "delayed"},
];

const projectRows: ProjectRow[] = [
    {id: "p1", name: "Harbour Tower", status: "active", progress: "62%", budget: "12.5M DKK"},
    {id: "p2", name: "North Bridge", status: "planning", progress: "5%", budget: "8.0M DKK"},
    {id: "p3", name: "Riverside Park", status: "completed", progress: "100%", budget: "3.2M DKK"},
    {id: "p4", name: "City Library", status: "active", progress: "38%", budget: "5.6M DKK"},
    {id: "p5", name: "Metro Extension", status: "delayed", progress: "21%", budget: "45.0M DKK"},
];

const columns: TableColumn<ProjectRow>[] = [
    {field: "name", label: "Project", sortable: true},
    {field: "status", label: "Status", sortable: true},
    {field: "progress", label: "Progress", sortable: true},
    {field: "budget", label: "Budget", sortable: true},
];

export class ProjectsDemoView extends Component {
    render(): FrayChild {
        return <SplitView className="projects-workspace fray-size-flexible" primarySize="18rem" primaryLabel="Projects" secondaryLabel="Project details">
            <SplitPrimary>
                <Sidebar island allocation="flexible" header="Projects">
                    <ListView
                        label="Project list"
                        items={projectItems}
                        itemKey="id"
                        renderItem={item => <span>{item.name}</span>}
                    />
                </Sidebar>
            </SplitPrimary>
            <SplitSecondary>
                <Panel island allocation="flexible" header="Project summary">
                    <DataTable
                        caption="Projects"
                        columns={columns}
                        data={projectRows}
                        rowKey="id"
                    />
                </Panel>
            </SplitSecondary>
        </SplitView>;
    }

    static dependencies = [DataTable, ListView, Panel, Sidebar, SplitView];
}
