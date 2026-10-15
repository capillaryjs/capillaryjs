/** Unit-test only native API stand-in. Real top-layer/dismissal behavior is
 * qualified by Playwright in Chromium, Firefox and WebKit, not by this stub. */
export function installPopoverStub(prototype: object): void {
    const open = new WeakSet<HTMLElement>()
    const matches = Reflect.get(prototype, 'matches') as HTMLElement['matches']
    Object.defineProperties(prototype, {
        showPopover: {configurable: true, value(this: HTMLElement) {
            open.add(this)
            this.dispatchEvent(new Event('toggle'))
        }},
        hidePopover: {configurable: true, value(this: HTMLElement) {
            open.delete(this)
            this.dispatchEvent(new Event('toggle'))
        }},
        matches: {configurable: true, value(this: HTMLElement, selector: string) {
            return selector === ':popover-open' ? open.has(this) : matches.call(this, selector)
        }},
    })
}
