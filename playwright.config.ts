import {defineConfig} from '@playwright/test'

export default defineConfig({
    testDir: './packages/capillary-ui/test/browser',
    testMatch: '**/*.spec.ts',
    fullyParallel: true,
    forbidOnly: true,
    retries: 0,
    reporter: 'line',
    use: {
        baseURL: 'http://127.0.0.1:4174',
        headless: true,
    },
    webServer: {
        command: 'pnpm --filter @capillaryjs/capillary-ui exec vite test/browser --host 127.0.0.1 --port 4174',
        url: 'http://127.0.0.1:4174',
        reuseExistingServer: false,
        timeout: 30_000,
    },
    projects: [
        {name: 'chromium', use: {browserName: 'chromium'}},
        {name: 'firefox', use: {browserName: 'firefox'}},
        {name: 'webkit', use: {browserName: 'webkit'}},
    ],
})
