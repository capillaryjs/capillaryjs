import {defineConfig} from '@playwright/test'

export default defineConfig({
    testDir: '.',
    testMatch: [
        'packages/capillary-ui/test/browser/**/*.spec.ts',
        'apps/component-gallery/test/browser/**/*.spec.ts',
        'apps/capillary-devtools-demo/test/browser/**/*.spec.ts',
    ],
    fullyParallel: true,
    forbidOnly: true,
    retries: 0,
    reporter: 'line',
    use: {
        baseURL: 'http://127.0.0.1:4174',
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    webServer: [{
        command: 'pnpm --filter @capillaryjs/capillary-ui exec vite test/browser --host 127.0.0.1 --port 4174',
        url: 'http://127.0.0.1:4174',
        reuseExistingServer: false,
        timeout: 30_000,
    }, {
        command: 'pnpm --filter @sylwellsoftware/component-gallery exec vite --host 127.0.0.1 --port 4175 --strictPort',
        url: 'http://127.0.0.1:4175',
        reuseExistingServer: false,
        timeout: 30_000,
    }, {
        command: 'pnpm --filter @capillaryjs/capillary-devtools-demo exec vite --host 127.0.0.1 --port 4176 --strictPort',
        url: 'http://127.0.0.1:4176',
        reuseExistingServer: false,
        timeout: 30_000,
    }],
    projects: [
        {name: 'chromium', use: {browserName: 'chromium'}},
        {name: 'firefox', use: {browserName: 'firefox'}},
        {name: 'webkit', use: {browserName: 'webkit'}},
    ],
})
