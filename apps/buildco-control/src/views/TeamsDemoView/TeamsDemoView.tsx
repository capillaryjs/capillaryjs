import type {FrayChild} from "@sylwellsoftware/fray";
import {Component, DataTable, ListView, Panel, Sidebar, SplitPrimary, SplitSecondary, SplitView} from "@sylwellsoftware/fray";
import type {TableColumn, TableRow} from "@sylwellsoftware/fray";

interface TeamItem {
    id: string;
    name: string;
    lead: string;
}

interface TeamRow extends TableRow {
    id: string;
    name: string;
    lead: string;
    members: string;
    specialty: string;
    availability: string;
}

const teamItems: TeamItem[] = [
    {id: "t1", name: "Concrete Crew", lead: "A. Hansen"},
    {id: "t2", name: "Steel Team", lead: "M. Nielsen"},
    {id: "t3", name: "Electrical Squad", lead: "K. Olsen"},
    {id: "t4", name: "Plumbing Group", lead: "J. Pedersen"},
    {id: "t5", name: "Finishing Team", lead: "L. Sørensen"},
];

const teamRows: TeamRow[] = [
    {id: "t1", name: "Concrete Crew", lead: "A. Hansen", members: "12", specialty: "Foundations & slabs", availability: "Busy"},
    {id: "t2", name: "Steel Team", lead: "M. Nielsen", members: "8", specialty: "Structural steel", availability: "Available"},
    {id: "t3", name: "Electrical Squad", lead: "K. Olsen", members: "6", specialty: "Wiring & systems", availability: "Available"},
    {id: "t4", name: "Plumbing Group", lead: "J. Pedersen", members: "5", specialty: "Pipes & fixtures", availability: "Busy"},
    {id: "t5", name: "Finishing Team", lead: "L. Sørensen", members: "10", specialty: "Interior & exterior", availability: "Partially"},
];

const columns: TableColumn<TeamRow>[] = [
    {field: "name", label: "Team", sortable: true},
    {field: "lead", label: "Lead", sortable: true},
    {field: "members", label: "Members", sortable: true},
    {field: "specialty", label: "Specialty", sortable: true},
    {field: "availability", label: "Availability", sortable: true},
];

export class TeamsDemoView extends Component {
    render(): FrayChild {
        return <SplitView className="teams-workspace fray-size-flexible" primarySize="18rem" primaryLabel="Teams" secondaryLabel="Team details">
            <SplitPrimary>
                <Sidebar island allocation="flexible" header="Teams">
                    <ListView
                        label="Team list"
                        items={teamItems}
                        itemKey="id"
                        renderItem={item => <span>{item.name}</span>}
                    />
                </Sidebar>
            </SplitPrimary>
            <SplitSecondary>
                <Panel island allocation="flexible" header="Team roster">
                    <DataTable
                        caption="Teams"
                        columns={columns}
                        data={teamRows}
                        rowKey="id"
                    />
                </Panel>
            </SplitSecondary>
        </SplitView>;
    }

    static dependencies = [DataTable, ListView, Panel, Sidebar, SplitView];
}
