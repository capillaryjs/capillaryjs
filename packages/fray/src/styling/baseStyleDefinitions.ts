export type CSSDeclarations = Record<string, string>
export type CSSVariantMap = Record<string, CSSDeclarations>
export type BaseStyleDefinition = Record<string, string | CSSVariantMap>

export const baseStyleDefinitions = {
    after: {
        content: '""',
        display: 'block',
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        'pointer-events': 'none',
    },

    inputline: {
        display: 'flex',
        'flex-flow': 'row nowrap',
        position: 'relative',
        'line-height': 'var(--fray-line-height, 1.25)',
        'font-size': 'var(--fray-font-size, var(--ui-font-size))',
        'min-height': 'var(--fray-control-min-height, 2rem)',
        color: 'var(--fray-ui-color, var(--ui-text-color))',
        'border-radius': 'var(--fray-radius-md, var(--ui-border-radius))',
        'box-sizing': 'border-box',
    },

    input: {
        background: 'var(--fray-input-background, var(--ui-input-bg))',
        color: 'var(--fray-input-color, var(--fray-ui-color, var(--ui-text-color)))',
        padding: 'var(--ui-padding-v, 0.25rem) var(--ui-padding-h, 0.5rem)',
        'pointer-events': 'all',
        border: 'var(--fray-input-border, var(--ui-input-border))',
        width: 'var(--input-width, 15rem)',
        'box-shadow': 'var(--fray-input-shadow, var(--input-shadow, none))',
        'box-sizing': 'border-box',
        'white-space': 'nowrap',
        variants: {
            ':focus-visible': {
                outline: '2px solid transparent',
                'outline-offset': '1px',
                'border-color': 'var(--fray-color-focus, var(--ui-accent-color))',
                'box-shadow': 'var(--fray-focus-ring, 0 0 0 2px var(--ui-accent-color-highlight))',
            },
            ':disabled': {
                background: 'var(--fray-input-background-disabled, var(--ui-input-bg-disabled))',
                'border-color': 'var(--fray-color-border, var(--ui-input-border-disabled))',
                color: 'var(--fray-input-color-disabled, var(--ui-input-text-color-disabled))',
                cursor: 'not-allowed',
            },
        },
    },

    inputlike: {
        background: 'var(--fray-input-background, var(--ui-input-bg))',
        color: 'var(--fray-input-color, var(--fray-ui-color, var(--ui-text-color)))',
        padding: 'var(--ui-padding-v, 0.25rem) var(--ui-padding-h, 0.5rem)',
        'pointer-events': 'all',
        border: 'var(--fray-input-border, var(--ui-input-border))',
        'box-shadow': 'var(--fray-input-shadow, var(--input-shadow, none))',
        'box-sizing': 'border-box',
        'white-space': 'nowrap',
        'border-radius': 'var(--fray-radius-md, var(--ui-border-radius))',
    },

    labeledinput: {
        display: 'flex',
        'flex-flow': 'row nowrap',
        'align-items': 'center',
        gap: '.5em',
    },

    label: {
        color: 'var(--fray-ui-color, var(--ui-text-color))',
        'font-size': 'var(--fray-font-size, var(--ui-font-size))',
    },

    disabled: {
        'border-color': 'var(--fray-color-border, var(--ui-input-border-disabled))',
        color: 'var(--fray-input-color-disabled, var(--ui-input-text-color-disabled))',
    },

    error: {
        color: 'var(--fray-color-error, var(--error-color))',
    },

    working: {
        display: 'inline',
        position: 'absolute',
        'z-index': '1',
        margin: 'auto',
        animation: 'fray-placeholder-progress 0.8s linear infinite',
        'background-repeat': 'repeat',
        'background-size': '2rem 2rem',
        'background-image': 'var(--fray-working-background-image)',
        border: '0 solid transparent',
        'border-radius': 'inherit',
        'box-sizing': 'border-box',
    },

    panel: {
        background: 'var(--fray-panel-background, var(--panel-bg))',
        border: 'var(--fray-panel-border, var(--panel-border))',
        'border-radius': 'var(--fray-panel-radius, var(--panel-radius))',
        'box-shadow': 'var(--fray-panel-shadow, var(--panel-shadow))',
        color: 'var(--fray-panel-color, var(--panel-color))',
    },

    sectionheader: {
        'box-shadow': 'var(--fray-section-header-shadow, var(--fray-header-shadow, var(--sectionheader-shadow)))',
        background: 'var(--fray-section-header-background, var(--fray-header-background, var(--sectionheader-bg)))',
        color: 'var(--fray-section-header-color, var(--fray-header-color, var(--sectionheader-color)))',
        border: 'var(--fray-section-header-border, var(--fray-header-border, 0 solid transparent))',
    },

    uiline: {
        'box-sizing': 'border-box',
        'line-height': 'var(--fray-line-height, 1.25)',
        'font-size': 'var(--fray-font-size, var(--ui-font-size))',
        'min-height': 'var(--fray-control-min-height, 2rem)',
        color: 'var(--fray-ui-color, var(--ui-text-color))',
        padding: 'var(--ui-padding-v, 0.25rem) var(--ui-padding-h, 0.5rem)',
        'border-radius': 'var(--fray-radius-md, var(--ui-border-radius))',
        cursor: 'pointer',
        'user-select': 'none',
    },

    noselect: {
        'user-select': 'var(--noselect-user-select)',
        'cursor': 'var(--noselect-cursor)',
    },

    button: {
        'box-sizing': 'border-box',
        background: 'var(--fray-button-background, var(--button-background))',
        border: 'var(--fray-button-border, var(--button-border))',
        'box-shadow': 'var(--fray-button-shadow, var(--button-shadow))',
        color: 'var(--fray-button-color, var(--button-color))',
        cursor: 'default',
        'user-select': 'none',
        variants: {
            ':hover': {
                background: 'var(--fray-button-background-hover, var(--button-background-hover))',
                'box-shadow': 'var(--fray-button-shadow, var(--button-shadow))',
            },
            ':focus-visible': {
                outline: '2px solid transparent',
                'outline-offset': '1px',
                border: '1px solid var(--fray-color-focus, var(--ui-accent-color))',
                'box-shadow': 'var(--fray-focus-ring, 0 0 0 2px var(--ui-accent-color-highlight))',
            },
            ':disabled': {
                background: 'var(--fray-button-background-disabled, var(--button-background-disabled))',
                border: 'var(--button-border-disabled, var(--fray-button-border))',
                color: 'var(--fray-input-color-disabled, var(--ui-input-text-color-disabled))',
                cursor: 'not-allowed',
                'pointer-events': 'none',
            },
        },
    },

    toolbar: {
        background: 'var(--fray-toolbar-background, var(--toolbar-bg))',
        border: 'var(--fray-toolbar-border, var(--toolbar-border))',
        'border-radius': 'var(--toolbar-radius, var(--fray-radius-md))',
        'box-shadow': 'var(--fray-toolbar-shadow, var(--toolbar-shadow))',
        color: 'var(--fray-toolbar-color, var(--toolbar-color))',
    },

} satisfies Record<string, BaseStyleDefinition>

export type BaseStyleName = keyof typeof baseStyleDefinitions
