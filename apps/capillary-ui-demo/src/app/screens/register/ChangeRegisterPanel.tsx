import {Component, DataTable, Panel, ProgressBar} from '@capillaryjs/capillary-ui'
import type {ComponentProps, CapillaryUiChild} from '@capillaryjs/capillary-ui'
import type {MeridianModel} from '../../model/MeridianModel.js'
import type {Change} from '../../model/types.js'

interface ChangeRegisterPanelProps extends ComponentProps {
    readonly model: MeridianModel
}

export class ChangeRegisterPanel extends Component<ChangeRegisterPanelProps> {
    render(): CapillaryUiChild {
        const {model} = this.props
        return <Panel island className="change-register-panel" header="Change register">
            <DataTable<Change>
                dataSource={model.changeTable}
                rowKey="id"
                caption="Changes in selected scope"
                emptyMessage="No changes match the current Register filters."
                selectedItemEmitter={model.registerSelection}
                columns={[
                    {field: 'id', label: 'ID', sortable: true},
                    {field: 'title', label: 'Change', sortable: true},
                    {field: 'site', label: 'Site', sortable: true},
                    {
                        field: 'risk',
                        label: 'Risk',
                        sortable: true,
                        filterOptions: ['Low', 'Medium', 'High', 'Critical'],
                    },
                    {field: 'status', label: 'Status', sortable: true},
                    {
                        field: 'progress',
                        label: 'Progress',
                        sortable: true,
                        render: (change) => <ProgressBar
                            label={`${change.title}: ${change.progress}% complete`}
                            value={change.progress}
                            valueText={`${change.progress}%`}
                        />,
                    },
                ]}
            />
        </Panel>
    }
}
