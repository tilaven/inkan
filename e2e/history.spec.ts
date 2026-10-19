import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('a record lists its status changes, newest first, without accessibility violations', async ({ page }) => {
  await page.goto('/sre/adr/0001-define-slos-before-dashboards/');
  const history = page.getByRole('region', { name: /History/ });
  const rows = history.getByRole('listitem');
  await expect(rows.first()).toBeVisible();
  const dates = await rows.locator('time').evaluateAll((els) => els.map((e) => e.getAttribute('datetime')));
  expect(dates).toEqual([...dates].sort().reverse());
  const { violations } = await new AxeBuilder({ page }).include('.rhist').analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});

test('the history fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/sre/adr/0001-define-slos-before-dashboards/');
  await expect(page.locator('.rhist')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
