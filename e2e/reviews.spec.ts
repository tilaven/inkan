import { expect, test } from '@playwright/test';

test('the home "Review overdue" stat counts what /reviews/ lists as overdue and links there', async ({ page }) => {
  // Both pages recount from the browser clock, so a fixed time keeps them comparable across midnight.
  await page.clock.setFixedTime('2026-10-15T12:00:00Z');
  await page.goto('/reviews/');
  const overdue = await page.locator('[data-group="overdue"] [data-count]').textContent();
  await expect(page.locator('.page-head .lede')).toContainText(`${overdue} are overdue`);

  await page.goto('/');
  const stat = page.locator('a.stat.hot');
  await expect(stat).toHaveAttribute('href', '/reviews/');
  await expect(stat.locator('span')).toHaveText('Review overdue');
  await expect(stat.locator('b')).toHaveText(overdue!);
});

test('the backlog lede renders its markup and the past-due count', async ({ page }) => {
  const lede = page.locator('.page-head .lede');
  await page.goto('/backlog/');
  await expect(lede.locator('code')).toHaveText('reviewBy');
  await expect(lede).not.toContainText('<');
  await expect(lede).toContainText(/(\d+ (is|are) past due\.|Nothing is overdue\.)$/);
});
