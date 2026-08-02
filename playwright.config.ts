import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'on-first-retry' },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        }
      }
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 13'], browserName: 'webkit', colorScheme: 'dark' }
    }
  ]
});
