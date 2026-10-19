import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PW_PORT ?? 4403);
const site = process.env.INKAN_SITE ?? 'examples/company-decisions';
const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const schemes = ['light', 'dark'] as const;

const matrix = (prefix: string, testMatch: RegExp | string[]) =>
  Object.entries(viewports).flatMap(([device, viewport]) =>
    schemes.map((colorScheme) => ({
      name: `${prefix}-${device}-${colorScheme}`,
      testMatch,
      use: { ...devices['Desktop Chrome'], viewport, colorScheme, deviceScaleFactor: 1 },
    })),
  );

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002 } },
  projects: [...matrix('e2e', /(crawl|a11y|filters|search|page-actions|rfc-reviews|graph|reviews)\.spec\.ts/), ...matrix('visual', /visual\.spec\.ts/)],
  webServer: {
    command: `node packages/inkan/bin/cli.mjs preview --root ${site} --port ${port}`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
