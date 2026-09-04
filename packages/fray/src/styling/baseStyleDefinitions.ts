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
        'min-height': 'var(--control-min-height, 2rem)',
        'box-sizing': 'border-box',
    },

    input: {
        'pointer-events': 'all',
        width: 'var(--input-width, 15rem)',
        'box-sizing': 'border-box',
        'white-space': 'nowrap',
    },

    inputlike: {
        'pointer-events': 'all',
        'box-sizing': 'border-box',
        'white-space': 'nowrap',
    },

    labeledinput: {
        display: 'flex',
        'flex-flow': 'row nowrap',
        'align-items': 'center',
        gap: '.5em',
    },

    working: {
        display: 'inline',
        position: 'absolute',
        'z-index': '1',
        margin: 'auto',
        animation: 'fray-placeholder-progress 0.8s linear infinite',
        'background-repeat': 'repeat',
        'background-size': '2rem 2rem',
        'background-image': 'var(--working-background-image)',
        border: '0 solid transparent',
        'border-radius': 'inherit',
        'box-sizing': 'border-box',
    },

    uiline: {
        'box-sizing': 'border-box',
        'min-height': 'var(--control-min-height, 2rem)',
        cursor: 'pointer',
        'user-select': 'none',
    },

    noselect: {
        'user-select': 'var(--noselect-user-select)',
        'cursor': 'var(--noselect-cursor)',
    },

    button: {
        'box-sizing': 'border-box',
        cursor: 'default',
        'user-select': 'none',
        variants: {
            ':disabled': {
                cursor: 'not-allowed',
                'pointer-events': 'none',
            },
        },
    },

} satisfies Record<string, BaseStyleDefinition>

export type BaseStyleName = keyof typeof baseStyleDefinitions
