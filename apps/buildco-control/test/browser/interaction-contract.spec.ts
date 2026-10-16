import {expect, test} from '@playwright/test';

test('project selection scopes slow feedback to its node and phases while tree filtering stays local', async ({page}) => {
    await page.addInitScript(() => {
        const NativeWorker = window.Worker;
        Reflect.set(window, 'projectRequests', 0);
        window.Worker = class extends NativeWorker {
            private projects = new Set<number>();
            private replies: unknown[] = [];
            constructor(url: string | URL, options?: WorkerOptions) {
                super(url, options);
                Reflect.set(window, 'releaseProjectViews', () => {
                    Reflect.set(window, 'holdProjectViews', false);
                    for (const data of this.replies.splice(0)) this.dispatchEvent(new MessageEvent('message', {data}));
                });
                this.addEventListener('message', event => {
                    if (!this.projects.delete(event.data.id) || !Reflect.get(window, 'holdProjectViews')) return;
                    event.stopImmediatePropagation(); this.replies.push(event.data);
                });
            }
            override postMessage(message: unknown, options?: Transferable[] | StructuredSerializeOptions): void {
                const request = message as {id?: number; url?: string};
                if (request.id != null && request.url?.includes('/api/view/projects')) {
                    this.projects.add(request.id);
                    Reflect.set(window, 'projectRequests', Reflect.get(window, 'projectRequests') + 1);
                }
                if (Array.isArray(options)) super.postMessage(message, options); else super.postMessage(message, options);
            }
        };
    });
    await page.goto('/?profile=small#/projects');
    const tree = page.getByRole('tree', {name: 'Project structure'});
    const roots = tree.locator('[role="treeitem"][aria-level="1"]');
    await expect(roots).toHaveCount(5);
    const search = page.getByRole('textbox', {name: 'Search', exact: true});
    const refresh = page.getByRole('button', {name: 'Refresh results', exact: true});
    await page.evaluate(() => Reflect.set(window, 'holdProjectViews', true));
    await roots.last().click();
    await expect(roots.last()).toHaveAttribute('aria-selected', 'true');
    await expect(roots.last()).toHaveAttribute('aria-busy', 'true');
    await expect(roots.last()).toHaveAttribute('data-cap-busy-visible', '');
    await expect(tree).not.toHaveAttribute('aria-busy');
    await expect(tree.locator('..')).not.toHaveAttribute('data-cap-busy-visible');
    await expect(search).not.toHaveAttribute('aria-busy');
    await expect(refresh).not.toHaveAttribute('aria-busy');
    const phases = page.getByRole('table', {name: 'Phases', exact: true});
    await expect(phases).toHaveAttribute('aria-busy', 'true');
    const before = await page.evaluate(() => Reflect.get(window, 'projectRequests'));
    await search.fill('not-a-project');
    await expect(tree).toHaveCount(0);
    expect(await page.evaluate(() => Reflect.get(window, 'projectRequests'))).toBe(before);
    await search.fill('');
    await expect(tree).toBeVisible();
    await expect(search).not.toHaveAttribute('aria-busy');
    await page.evaluate(() => Reflect.get(window, 'releaseProjectViews')());
    await expect(phases).not.toHaveAttribute('aria-busy');
    await expect(roots.last()).not.toHaveAttribute('aria-busy');
    await page.evaluate(() => Reflect.set(window, 'holdProjectViews', true));
    await refresh.click();
    await expect(refresh).toHaveAttribute('aria-busy', 'true');
    await expect(search).not.toHaveAttribute('aria-busy');
    await page.evaluate(() => Reflect.get(window, 'releaseProjectViews')());
    await expect(refresh).not.toHaveAttribute('aria-busy');
});

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
    await expect(page.getByRole('combobox', {name: 'Project scope'})).not.toHaveAttribute('aria-busy');
    await expect(page.getByRole('button', {name: 'Refresh results', exact: true})).not.toHaveAttribute('aria-busy');
    const resets = page.getByRole('button', {name: 'Reset', exact: true});
    await resets.first().click();
    await expect(resets.first()).toHaveAttribute('aria-busy', 'true');
    await expect(resets.nth(1)).not.toHaveAttribute('aria-busy');
    await expect(search).toHaveValue('');
    await expect(search).not.toHaveAttribute('aria-busy');
    await expect(list).not.toHaveAttribute('aria-busy');
    await expect(resets.first()).not.toHaveAttribute('aria-busy');
    await page.evaluate(() => Reflect.set(window, 'failNextView', true));
    const refresh = page.getByRole('button', {name: 'Refresh results', exact: true});
    await refresh.click();
    await expect(refresh).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(list).toBeVisible();
    await expect(refresh).not.toHaveAttribute('aria-busy');
    await refresh.click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(refresh).not.toHaveAttribute('aria-busy');
});

test('confirmed issue save survives failed report/reference reads and Retry never repeats the write', async ({page}) => {
    await page.addInitScript(() => {
        const NativeWorker = window.Worker;
        Reflect.set(window, 'mutationCount', 0);
        window.Worker = class extends NativeWorker {
            private requests = new Map<number, string>();
            constructor(url: string | URL, options?: WorkerOptions) {
                super(url, options);
                this.addEventListener('message', event => {
                    const path = this.requests.get(event.data.id);
                    if (!path || event.data.progress !== undefined) return;
                    this.requests.delete(event.data.id);
                    if (Reflect.get(window, 'holdReference') && path.includes('/api/bootstrap')) {
                        event.stopImmediatePropagation();
                        Reflect.set(window, 'failHeldReference', () => this.dispatchEvent(new MessageEvent('message', {
                            data: {...event.data, status: 503, body: {error: 'Controlled reference failure'}}
                        })));
                    } else if (Reflect.get(window, 'failReport') && path.includes('/api/view/issue-report')) {
                        event.stopImmediatePropagation();
                        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', {
                            data: {...event.data, status: 503, body: {error: 'Controlled report failure'}}
                        })));
                    }
                });
            }
            override postMessage(message: unknown, options?: Transferable[] | StructuredSerializeOptions): void {
                const request = message as {id?: number; url?: string};
                if (request.id != null && request.url) {
                    this.requests.set(request.id, request.url);
                    if (request.url.includes('/api/mutate')) Reflect.set(window, 'mutationCount', Reflect.get(window, 'mutationCount') + 1);
                }
                if (Array.isArray(options)) super.postMessage(message, options); else super.postMessage(message, options);
            }
        };
    });
    await page.goto('/?profile=small#/issue-report');
    const items = page.getByRole('listbox', {name: 'Issues', exact: true}).getByRole('option');
    await expect(items.first()).toBeVisible();
    await items.first().click();
    await page.getByRole('button', {name: 'Edit', exact: true}).click();
    const dialog = page.getByRole('dialog', {name: 'Edit issue', exact: true});
    await dialog.getByRole('textbox', {name: 'Title', exact: true}).fill('Confirmed issue with failed reload');
    await page.evaluate(async () => {
        const path = '/src/app/services.ts';
        const {demo} = await import(path);
        let disconnect = () => {};
        disconnect = demo.notice.subscribe(() => {
            disconnect();
            throw new Error('Controlled independent notification failure');
        }, {emitCurrent: false});
    });
    await page.evaluate(() => {Reflect.set(window, 'holdReference', true); Reflect.set(window, 'failReport', true);});
    await dialog.getByRole('button', {name: 'Save', exact: true}).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('status').filter({hasText: 'The report could not be refreshed'})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Retry reference data', exact: true})).toHaveAttribute('aria-busy', 'true');
    await page.evaluate(() => {Reflect.set(window, 'holdReference', false); Reflect.get(window, 'failHeldReference')();});
    await expect(page.getByRole('alert').filter({hasText: 'Reference data could not be refreshed'})).toBeVisible();
    await page.getByRole('button', {name: 'Retry reference data', exact: true}).click();
    await expect(page.getByRole('alert').filter({hasText: 'Reference data could not be refreshed'})).toHaveCount(0);
    await page.evaluate(() => Reflect.set(window, 'failReport', false));
    await page.getByRole('button', {name: 'Refresh issue report', exact: true}).click();
    await expect(page.getByRole('heading', {name: 'Confirmed issue with failed reload', exact: true})).toBeVisible();
    expect(await page.evaluate(() => Reflect.get(window, 'mutationCount'))).toBe(1);
});
