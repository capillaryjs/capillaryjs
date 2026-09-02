export function requiredQuery<TElement extends Element = HTMLElement>(
    selector: string,
    root: ParentNode = document,
): TElement {
    const element = root.querySelector<TElement>(selector)
    if (element == null) throw new Error(`Missing test element: ${selector}`)
    return element
}

export function requiredAt<TValue>(
    values: ArrayLike<TValue> | readonly TValue[],
    index: number,
): TValue {
    const value = values[index]
    if (value === undefined) throw new Error(`Missing test value at index ${index}`)
    return value
}
