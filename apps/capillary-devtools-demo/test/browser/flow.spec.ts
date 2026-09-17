import {test, expect} from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {filterTrace, projectFlow, traceAttempts} from '../../../../packages/capillary-devtools/src/model/projection.js'
import type {TraceRecording} from '../../../../packages/capillary-devtools/src/model/types.js'

const url = 'http://127.0.0.1:4176'
const recording = (page: import('@playwright/test').Page) => page.evaluate(() =>
    (Reflect.get(window, 'capillaryFlowLab') as {recording(): TraceRecording}).recording())
const metrics = (page: import('@playwright/test').Page) => page.evaluate(() =>
    (Reflect.get(window, 'capillaryFlowLab') as {metrics(): unknown}).metrics())

test('real search reaches the table, UI bindings and every non-UI leaf; replay is isolated', async ({page}) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(url)
    await page.getByRole('textbox', {name: 'Search', exact: true}).fill('capillary')
    await page.getByRole('textbox', {name: 'Search', exact: true}).press('Tab')
    await expect(page.getByTestId('summary')).toHaveText('2 results')
    const trace = await recording(page)
    const root = trace.events.findLast((event) => event.kind === 'interaction' && event.cause === 'input')!
    const events = filterTrace(trace, {rootId: root.id})
    const labels = new Set(events.map((event) => trace.nodes.find((node) => node.id === event.nodeId)?.label))
    for (const label of ['searchText', 'normalizedSearch', 'searchResults', 'resultCount', 'data-table',
        'combinedScore (unsubscribed)', 'savedSearch (unsubscribed)', 'persist search callback']) expect(labels.has(label), label).toBe(true)
    expect(events.filter((event) => event.nodeId === trace.nodes.find((node) => node.label === 'combinedScore (unsubscribed)')?.id)).toHaveLength(2)
    const flow = projectFlow(trace, events)
    expect(flow.nodes.some((node) => node.node.label === 'savedSearch (unsubscribed)' && node.leaf)).toBe(true)
    await expect(page.getByRole('region', {name: 'Propagation graph'})).toContainText('Downstream leaves')
    const before = await metrics(page)
    const eventCount = (await recording(page)).events.length
    const positions = await page.locator('.trace-node').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('style')))
    await page.getByRole('button', {name: 'First step', exact: true}).click()
    await expect(page.locator('.trace-node[data-reached="true"]')).toHaveCount(1)
    await expect(page.locator('.trace-edge[data-observed="true"][data-reached="true"]')).toHaveCount(0)
    await page.getByRole('button', {name: 'Next step', exact: true}).click()
    await expect(page.getByRole('region', {name: 'Trace details'})).toContainText('searchText')
    await page.getByRole('slider', {name: 'Replay step'}).fill('5')
    await page.getByRole('button', {name: 'Play', exact: true}).click()
    await expect(page.getByRole('button', {name: 'Pause', exact: true})).toBeVisible()
    await page.getByRole('button', {name: 'Pause', exact: true}).click()
    await page.getByRole('button', {name: 'Complete flow', exact: true}).click()
    expect(await page.locator('.trace-node').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('style')))).toEqual(positions)
    expect(await metrics(page)).toEqual(before)
    expect((await recording(page)).events).toHaveLength(eventCount)
    expect((await recording(page)).nodes.some((node) => /TraceInspector|FlowGraphView|TracePlayback/.test(node.label))).toBe(false)
    expect(errors).toEqual([])
    if (test.info().project.name === 'chromium') await page.screenshot({path: '.artifacts/devtools/flow.png', fullPage: true})
})

test('failure/retry, supersession, abort/disposal and command completion are inspectable', async ({page}) => {
    await page.goto(url)
    await page.getByRole('button', {name: 'Fail then retry', exact: true}).click()
    await expect(page.getByTestId('summary')).toHaveText('2 results')
    expect(traceAttempts((await recording(page)).events).map((attempt) => attempt.status)).toEqual(['failed', 'succeeded'])
    await page.getByRole('button', {name: 'Start pending request', exact: true}).click()
    await expect.poll(async () => traceAttempts((await recording(page)).events).at(-1)?.status).toBe('unfinished in capture')
    const oldRoot = (await recording(page)).events.findLast((event) => event.kind === 'interaction')!
    await page.getByRole('button', {name: 'Supersede pending request', exact: true}).click()
    await expect.poll(async () => traceAttempts((await recording(page)).events).at(-1)?.status).toBe('succeeded')
    const superseded = filterTrace(await recording(page), {rootId: oldRoot.id})
    expect(traceAttempts(superseded).map((attempt) => attempt.status)).toEqual(['superseded'])
    await page.locator(`[data-root-id="${oldRoot.id}"]`).click()
    await expect(page.getByRole('region', {name: 'Causal trace'})).toContainText('superseded')
    await page.getByRole('button', {name: 'Start pending request', exact: true}).click()
    await page.getByRole('button', {name: 'Abort request', exact: true}).click()
    expect(traceAttempts((await recording(page)).events).at(-1)?.status).toBe('aborted')
    await page.getByRole('button', {name: 'Run command', exact: true}).click()
    await page.getByRole('button', {name: 'Complete command', exact: true}).click()
    await expect(page.getByLabel('Command result')).toContainText('Saved')
    await page.getByRole('button', {name: 'Start pending request', exact: true}).click()
    await page.getByRole('button', {name: 'Dispose query', exact: true}).click()
    const disposed = await recording(page)
    expect(disposed.nodes.find((node) => node.label === 'searchResults')?.disposedSequence).not.toBeNull()
    expect(traceAttempts(disposed.events).at(-1)?.status).toBe('aborted')
})

test('table rendering and captured row contents are inspectable without header render noise', async ({page}) => {
    await page.goto(url)
    await page.getByRole('textbox', {name: 'Search', exact: true}).fill('plumbing')
    await expect(page.getByTestId('summary')).toHaveText('2 results')
    const trace = await recording(page)
    const root = trace.events.findLast(event => event.kind === 'interaction' && event.cause === 'input')!
    const events = filterTrace(trace, {rootId: root.id})
    const body = trace.nodes.find(node => node.label === 'Table body')!
    const header = trace.nodes.find(node => node.label === 'Table header')!
    const query = trace.nodes.find(node => node.label === 'searchResults')!
    expect(events.some(event => event.nodeId === header.id)).toBe(false)
    expect(events.some(event => event.nodeId === body.id && (event.consumer?.domWrites ?? 0) > 0)).toBe(true)
    await page.locator(`.trace-node[data-node-id="${body.id}"]`).click()
    const details = page.getByRole('region', {name: 'Trace details'})
    await expect(details).toContainText('Own renderer DOM writes')
    await expect(details).toContainText('Table body')
    await page.locator(`.trace-node[data-node-id="${query.id}"]`).click()
    await details.locator('summary').filter({hasText: /^Value: Array/}).click()
    await details.locator('summary').filter({hasText: /^0: Object/}).click()
    await expect(details.getByText('title: "plumbing · first"', {exact: true})).toBeVisible()
})

test('unchanged branches, source/target convergence filters, capture limits and compact composition', async ({page}) => {
    await page.goto(url)
    await page.getByRole('button', {name: 'Direct write / diamond', exact: true}).click()
    await expect(page.getByTestId('summary')).toHaveText('2 results')
    const trace = await recording(page)
    const source = trace.nodes.find((node) => node.label === 'searchText')!
    const target = trace.nodes.find((node) => node.label === 'combinedScore (unsubscribed)')!
    await page.getByLabel('From source', {exact: true}).selectOption(source.id)
    await page.getByLabel('To target', {exact: true}).selectOption(target.id)
    await expect(page.getByRole('region', {name: 'Causal trace'})).toContainText('vowelCount')
    await expect(page.getByRole('region', {name: 'Causal trace'})).toContainText('searchLength')
    await page.getByRole('button', {name: 'Unchanged normalization', exact: true}).click()
    expect((await recording(page)).events.some((event) => event.kind === 'recomputed-unchanged')).toBe(true)
    await page.goto(`${url}/?limit=12`)
    await page.getByRole('button', {name: 'Direct write / diamond', exact: true}).click()
    await expect(page.getByRole('region', {name: 'Capillary DevTools', exact: true})).toContainText('evicted by the recording budget')
    expect((await recording(page)).events.length).toBeLessThanOrEqual(12)
    await page.goto(`${url}/?late=1`)
    await expect(page.getByRole('region', {name: 'Capillary DevTools', exact: true})).toContainText('earlier activity is unknown')
    await page.goto(`${url}/compact.html`)
    await page.getByRole('textbox', {name: 'Search', exact: true}).fill('compact')
    await expect(page.getByRole('region', {name: 'Propagation graph'})).toContainText('searchResults')
    await expect(page.getByRole('region', {name: 'Causal trace'})).toHaveCount(0)
})

test('keyboard and constrained-width inspection remains accessible with reduced motion', async ({page}) => {
    await page.emulateMedia({reducedMotion: 'reduce'})
    await page.setViewportSize({width: 780, height: 900})
    await page.goto(url)
    await page.getByRole('textbox', {name: 'Search', exact: true}).fill('accessible')
    await expect(page.getByTestId('summary')).toHaveText('2 results')
    await page.getByRole('button', {name: 'First step', exact: true}).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('slider', {name: 'Replay step'})).toHaveValue('0')
    const results = await new AxeBuilder({page}).include('cap-traceinspector').analyze()
    expect(results.violations).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
