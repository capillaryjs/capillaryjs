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
    outlinePaddingInlineEnd?: string
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
    outlinePaddingInlineEnd,
}: RequiredPresentationOptions): string {
    const outlinePadding = outlinePaddingInlineEnd == null
        ? ''
        : `\n    padding-inline-end: ${outlinePaddingInlineEnd};`
    return css`
${outlineSelector} {
    outline: 1px dashed var(--required-color);
    outline-offset: 3px;${outlinePadding}
}

${indicatorSelector}::after {
    content: "✲";
    position: absolute;
    z-index: ${indicatorZIndex};
    inset-block-start: ${indicatorInsetBlockStart};
    inset-inline-end: ${indicatorInsetInlineEnd};
    display: grid;
    inline-size: ${indicatorSize};
    block-size: ${indicatorSize};
    place-items: center;
    color: var(--required-indicator-color);
    background: var(--required-indicator-background);
    font-size: ${indicatorFontSize};
    font-weight: 700;
    line-height: 1;
    pointer-events: none;
}
`
}
