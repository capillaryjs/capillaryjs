import {FetchState} from '@capillaryjs/capillary'
import type {
    Emitter,
    EmitterNotification,
    FetchStateValue,
    SubscribeOptions,
} from '@capillaryjs/capillary'
import {Component, FilterMode} from '@capillaryjs/capillary-ui'
import type {
    ComponentProps,
    CapillaryUiChild,
    FilterModeValue,
} from '@capillaryjs/capillary-ui'
import {
    Checkbox,
    ColorPicker,
    OptionGroup,
    ThemePicker,
    Toggle,
    Toolbar,
} from '@capillaryjs/capillary-ui'

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
    render(): CapillaryUiChild {
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
                    [FetchState.Loading, 'Loading (refresh)'],
                    ['loading-replace', 'Loading (replace)'],
                    [FetchState.Error, 'Error'],
                ]}
            />
            <OptionGroup ariaLabel="Component state" className="gallery-flag-group">
                <Checkbox label="Disabled"
                    valueEmitter={flagCheckboxState(model.componentDisabled)} />
                <Checkbox label="Required"
                    valueEmitter={flagCheckboxState(model.componentRequired)} />
                <Checkbox label="Read-only"
                    valueEmitter={flagCheckboxState(model.componentReadOnly)} />
                <Checkbox label="Busy override"
                    valueEmitter={flagCheckboxState(model.componentBusyFlag)} />
                <Checkbox label="Validation error"
                    valueEmitter={flagCheckboxState(model.componentErrorFlag)} />
            </OptionGroup>
        </Toolbar>
    }

    static dependencies = [Toolbar, Toggle, ThemePicker, ColorPicker, OptionGroup, Checkbox]
}

/**
 * Live two-way view of a boolean flag emitter as the FilterMode value a
 * Checkbox cycles: Prefer/Require map to set, Neutral/Deny to clear.
 */
function flagCheckboxState(flag: Emitter<boolean>) {
    const toState = (value: boolean): FilterModeValue =>
        value ? FilterMode.Prefer : FilterMode.Neutral
    return {
        get: () => toState(flag.get()),
        getError: () => flag.getError(),
        getFetchState(): FetchStateValue {
            return flag.getFetchState()
        },
        subscribe(
            listener: (notification: EmitterNotification<FilterModeValue, unknown>) => void,
            options?: SubscribeOptions,
        ): () => void {
            return flag.subscribe(
                (notification) => listener({
                    ...notification,
                    value: toState(notification.value),
                }),
                options,
            )
        },
        set: (value: FilterModeValue, cause?: unknown): boolean =>
            flag.set(value === FilterMode.Prefer || value === FilterMode.Require, cause),
    }
}
