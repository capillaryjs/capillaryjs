import {FetchState} from '@sylwellsoftware/glue'
import {Component} from '@sylwellsoftware/fray'
import type {ComponentProps, FrayChild} from '@sylwellsoftware/fray'
import {ColorPicker, ThemePicker, Toggle, Toolbar} from '@sylwellsoftware/fray'

import type {GalleryModel} from '../model/GalleryModel.js'

export interface GalleryToolbarProps extends ComponentProps {
    model: GalleryModel
}

/**
 * Gallery control toolbar below the navbar: layout variant, theme and color
 * pickers, the shared data-state selector, and the component-state flags that
 * gallery pages apply to showcased controls.
 */
export class GalleryToolbar extends Component<GalleryToolbarProps> {
    render(): FrayChild {
        const model = this.props.model
        return <Toolbar label="Gallery controls" className="gallery-controls">
            <Toggle
                label="Layout"
                valueEmitter={model.layoutVariant}
                options={[['shell', 'App shell'], ['website', 'Website']]}
            />
            <ThemePicker label="Theme" valueEmitter={model.themeSelection} />
            <ColorPicker label="Colors" valueEmitter={model.colorSelection} />
            <Toggle
                label="Emitter state"
                valueEmitter={model.dataState}
                options={[
                    [FetchState.Initial, 'Initial'],
                    [FetchState.Ready, 'Ready'],
                    [FetchState.Loading, 'Loading'],
                    [FetchState.Error, 'Error'],
                ]}
            />
            <div class="gallery-flag-group" role="group" aria-label="Component state">
                <label>
                    <input type="checkbox" bind:checked={model.componentDisabled} />
                    Disabled
                </label>
                <label>
                    <input type="checkbox" bind:checked={model.componentRequired} />
                    Required
                </label>
                <label>
                    <input type="checkbox" bind:checked={model.componentReadOnly} />
                    Read-only
                </label>
                <label>
                    <input type="checkbox" bind:checked={model.componentBusyFlag} />
                    Busy override
                </label>
                <label>
                    <input type="checkbox" bind:checked={model.componentErrorFlag} />
                    Validation error
                </label>
            </div>
        </Toolbar>
    }

    static dependencies = [Toolbar, Toggle, ThemePicker, ColorPicker]
}
