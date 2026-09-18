import {css} from '../component.js'

export const requiredInputInvalidSelector =
    ':required:invalid:not(:disabled):not([readonly]):not([aria-invalid="true"])'

export const requiredControlInvalidSelector =
    ':required:invalid:not(:disabled):not([aria-invalid="true"])'

interface RequiredPresentationOptions {
    outlineSelector: string
    indicatorSelector: string
    indicatorZIndex?: number
    indicatorSize?: string
    indicatorFontSize?: string
    indicatorInsetBlockStart?: string
    indicatorInsetInlineEnd?: string
    /**
     * Visually extends an outline without changing the outlined element's box.
     * The caller must position its marker by the same amount when it belongs
     * in that extension.
     */
    outlineInlineEndExtension?: string
}

/** Shared native-required outline and marker, with component-owned placement. */
export function requiredPresentationCss({
    outlineSelector,
    indicatorSelector,
    indicatorZIndex = 3,
    indicatorSize = '1rem',
    indicatorFontSize = '.75rem',
    indicatorInsetBlockStart = '-.5em',
    indicatorInsetInlineEnd = '-.5em',
    outlineInlineEndExtension,
}: RequiredPresentationOptions): string {
    const outline = outlineInlineEndExtension == null
        ? css`
${outlineSelector} {
    outline: 1px dashed var(--required-color);
    outline-offset: 3px;
}
`
        : css`
${outlineSelector}::before {
    content: "";
    position: absolute;
    z-index: 0;
    inset-block: -4px;
    inset-inline-start: -4px;
    inset-inline-end: calc(-4px - ${outlineInlineEndExtension});
    border: 1px dashed var(--required-color);
    border-radius: inherit;
    pointer-events: none;
}
`
    return css`
${outline}

${indicatorSelector}::after {
    content: "✲";
    position: absolute;
    z-index: ${indicatorZIndex};
    inset-block-start: ${indicatorInsetBlockStart};
    inset-inline-end: ${indicatorInsetInlineEnd};
    display: flex;
    inline-size: ${indicatorSize};
    block-size: ${indicatorSize};
    align-items: center;
    justify-content: center;
    color: var(--required-indicator-color);
    background: var(--required-indicator-background);
    font-size: ${indicatorFontSize};
    font-weight: 700;
    line-height: 1;
    pointer-events: none;
}
`
}
