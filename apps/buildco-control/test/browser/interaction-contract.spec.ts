import {expect, test} from '@playwright/test';

test('query filters show pending work, retain results, report failure and recover', async ({page}) => {
    // Hold real worker responses at the transport seam, not by adding delays
    // or a second lifecycle to application code.
    await page.addInitScript(() => {
        const NativeWorker = window.Worker;
        window.Worker = class extends NativeWorker {
            private held = new Set<number>();
            constructor(url: string | URL, options?: WorkerOptions) {
                super(url, options);
                this.addEventListener('message', event => {
                    if (!this.held.delete(event.data.id)) return;
                    event.stopImmediatePropagation();
                    const fail = Reflect.get(window, 'failNextView') === true;
                    Reflect.set(window, 'failNextView', false);
                    const data = fail ? {...event.data, status: 500, body: {error: 'Controlled view failure'}} : event.data;
                    setTimeout(() => this.dispatchEvent(new MessageEvent('message', {data})), 600);
                });
            }
            override postMessage(message: unknown, transferOrOptions?: Transferable[] | StructuredSerializeOptions): void {
                const request = message as {id?: number; url?: string};
                if (request.id != null && request.url?.includes('/api/view/queue')) this.held.add(request.id);
                if (Array.isArray(transferOrOptions)) super.postMessage(message, transferOrOptions);
                else super.postMessage(message, transferOrOptions);
            }
        };
    });
    await page.goto('/?profile=small#/queue');
    const search = page.getByRole('textbox', {name: 'Search', exact: true});
    await expect(search).toBeVisible();
    await expect(search).not.toHaveAttribute('aria-busy');
    const list = page.getByRole('listbox', {name: 'Queue items', exact: true});
    await expect(list).toBeVisible();
    await search.fill('a');
    await expect(search).toHaveAttribute('aria-busy', 'true');
    await expect(search).toBeEnabled();
    await expect(page.locator('cap-listview')).toHaveAttribute('data-cap-retained-loading', '');
    await expect(page.getByRole('combobox', {name: 'Project scope'})).toHaveAttribute('aria-busy', 'true');
    await search.fill(''); // superseding input remains possible
    await expect(search).not.toHaveAttribute('aria-busy');
    await page.evaluate(() => Reflect.set(window, 'failNextView', true));
    const refresh = page.getByRole('button', {name: 'Refresh results', exact: true});
    await refresh.click();
    await expect(refresh).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(list).toBeVisible();
    await expect(refresh).not.toHaveAttribute('aria-busy');
    await refresh.click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(refresh).not.toHaveAttribute('aria-busy');
});
