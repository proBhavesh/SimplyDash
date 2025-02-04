import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 360000,
  workers: 1,
  use: {
    browserName: 'chromium',
    headless: false,
  },
  projects: [
    {
      name: 'chromium',
      testMatch: /memory-monitor\.spec\.ts/
    }
  ]
});
