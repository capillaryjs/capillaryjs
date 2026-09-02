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
        'line-height': '1.25',
        'font-size': 'var(--ui-font-size)',
        'min-height': 'calc(var(--ui-font-size) + var(--ui-padding) + var(--ui-padding))',
        color: 'var(--ui-text-color)',
        'border-radius': 'var(--ui-border-radius)',
        'box-sizing': 'border-box',
    },

    input: {
        background: 'var(--ui-input-bg)',
        padding: 'var(--ui-padding-v) var(--ui-padding-h)',
        'pointer-events': 'all',
        border: 'var(--ui-input-border)',
        width: 'var(--input-width)',
        'box-shadow': 'var(--input-shadow)',
        'box-sizing': 'border-box',
        'white-space': 'nowrap',
        variants: {
            ':focus-visible': {
                outline: '2px solid transparent',
                'outline-offset': '1px',
                'border-color': 'var(--ui-accent-color)',
                'box-shadow': '0 0 0 1px var(--ui-accent-color-highlight)',
            },
            ':disabled': {
                background: 'var(--ui-input-bg-disabled)',
                'border-color': 'var(--ui-input-border-disabled)',
                color: 'var(--ui-input-text-color-disabled)',
                cursor: 'not-allowed',
            },
        },
    },

    inputlike: {
        background: 'var(--ui-input-bg)',
        padding: 'var(--ui-padding-v) var(--ui-padding-h)',
        'pointer-events': 'all',
        border: 'var(--ui-input-border)',
        'box-shadow': 'var(--input-shadow)',
        'box-sizing': 'border-box',
        'white-space': 'nowrap',
        'border-radius': 'var(--ui-border-radius)',
    },

    labeledinput: {
        display: 'flex',
        'flex-flow': 'row nowrap',
        'align-items': 'center',
        gap: '.5em',
    },

    label: {
        color: 'var(--ui-text-color)',
        'font-size': 'var(--ui-font-size)',
    },

    disabled: {
        'border-color': 'var(--ui-input-border-disabled)',
        color: 'var(--ui-input-text-color-disabled)',
    },

    error: {
        color: 'var(--error-color)',
    },

    working: {
        display: 'inline',
        position: 'absolute',
        'z-index': '1',
        margin: 'auto',
        animation: 'fray-placeholder-progress 0.8s linear infinite',
        'background-repeat': 'repeat',
        'background-size': '2rem 2rem',
        'background-image': 'linear-gradient(-45deg, #0001 25%,  #fff1 25%, #fff1 50%, #0001 50%, #0001 75%, #fff1 75%, #fff1)',
        border: '0 solid transparent',
        'border-radius': 'inherit',
        'box-sizing': 'border-box',
    },

    panel: {
        background: 'var(--panel-bg)',
        border: 'var(--panel-border)',
        'border-radius': 'var(--panel-radius)',
        'box-shadow': 'var(--panel-shadow)',
        color: 'var(--panel-color)',
    },

    sectionheader: {
        'box-shadow': 'var(--sectionheader-shadow)',
        background: 'var(--sectionheader-bg)',
        color: 'var(--sectionheader-color)',
    },

    uiline: {
        'box-sizing': 'border-box',
        'line-height': '1.25',
        'font-size': 'var(--ui-font-size)',
        'min-height': 'calc(var(--ui-font-size) + var(--ui-padding) + var(--ui-padding))',
        color: 'var(--ui-text-color)',
        padding: 'var(--ui-padding-v) var(--ui-padding-h)',
        'border-radius': 'var(--ui-border-radius)',
        cursor: 'pointer',
        'user-select': 'none',
    },

    noselect: {
        'user-select': 'var(--noselect-user-select)',
        'cursor': 'var(--noselect-cursor)',
    },

    button: {
        'box-sizing': 'border-box',
        background: 'var(--button-background)',
        border: 'var(--button-border)',
        'box-shadow': 'var(--button-shadow)',
        color: 'var(--button-color)',
        cursor: 'default',
        'user-select': 'none',
        variants: {
            ':hover': {
                background: 'var(--button-background-hover)',
                'box-shadow': 'var(--button-shadow)',
            },
            ':focus-visible': {
                outline: '2px solid transparent',
                'outline-offset': '1px',
                border: '1px solid var(--ui-accent-color)',
                'box-shadow': '0 0 0 1px var(--ui-accent-color-highlight)',
            },
            ':disabled': {
                background: 'var(--button-background-disabled)',
                border: 'var(--button-border-disabled)',
                color: 'var(--ui-input-text-color-disabled)',
                cursor: 'not-allowed',
                'pointer-events': 'none',
            },
        },
    },

    toolbar: {
        background: 'var(--toolbar-bg)',
        border: 'var(--toolbar-border)',
        'border-radius': 'var(--toolbar-radius)',
        'box-shadow': 'var(--toolbar-shadow)',
        color: 'var(--toolbar-color)',
    },

} satisfies Record<string, BaseStyleDefinition>

export type BaseStyleName = keyof typeof baseStyleDefinitions
