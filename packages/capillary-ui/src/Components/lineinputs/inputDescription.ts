/** Associations owned by an outer field without replacing control-owned errors. */
export interface InputDescriptionProps {
    ariaDescribedBy?: string
    ariaInvalid?: boolean
}
export function inputDescription(props: InputDescriptionProps, error: unknown, errorId: string): {
    'aria-invalid': string | null
    'aria-describedby': string | null
} {
    return {
        'aria-invalid': error != null || props.ariaInvalid ? 'true' : null,
        'aria-describedby': [props.ariaDescribedBy, error == null ? null : errorId].filter(Boolean).join(' ') || null,
    }
}
