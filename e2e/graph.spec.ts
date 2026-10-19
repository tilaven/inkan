import { expect, test } from '@playwright/test';

const kafka = 'platform/adr/0009-move-the-event-bus-to-kafka';
const node = (id: string) => `.g-node[data-id="${id}"]`;
const lit = '.graph .is-on';

test('?focus lights a record and its neighbours; toggles and Escape update it', async ({ page }) => {
  await page.goto(`/graph/?focus=${kafka}`);
  await expect(page.locator('[data-graph]')).toHaveClass(/is-focus/);
  await expect(page.locator(node(kafka))).toHaveClass(/is-on/);
  await expect(page.locator(node('platform/adr/0004-use-sqs-as-the-event-bus'))).toHaveClass(/is-on/);

  await page.getByLabel('Supersedes').uncheck();
  await expect(page.locator(node('platform/adr/0004-use-sqs-as-the-event-bus'))).not.toHaveClass(/is-on/);
  await expect(page.locator(node('payments/rfc/0001-settle-in-async-batches'))).toHaveClass(/is-on/);

  await page.keyboard.press('Escape');
  await expect(page.locator(lit)).toHaveCount(0);
});

test('keyboard focus on a node lights it', async ({ page }) => {
  await page.goto('/graph/');
  await page.locator(node(kafka)).focus();
  await expect(page.locator(node(kafka))).toHaveClass(/is-on/);
});

test('?focus on a record that is not drawn says so', async ({ page }) => {
  await page.goto('/graph/?focus=sre/adr/0001-define-slos-before-dashboards');
  await expect(page.locator('[data-graph-missing]')).toBeVisible();
  await expect(page.locator('[data-graph-missing]')).toHaveAttribute('role', 'status');
  await expect(page.locator(lit)).toHaveCount(0);
});

test('?focus marks the pinned node as current and focuses it; the list follows the toggles', async ({ page }) => {
  await page.goto(`/graph/?focus=${kafka}`);
  await expect(page.locator(node(kafka))).toHaveAttribute('aria-current', 'true');
  await expect(page.locator(node(kafka))).toBeFocused();
  await expect(page.locator('.g-cols')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.graph__scroll')).toHaveAccessibleName(/Records in one row per project/);

  await page.locator('.graph-list summary').click();
  await expect(page.locator('.graph-list li[data-kind="related"]:visible').first()).toBeVisible();
  await page.getByLabel('Related').uncheck();
  await expect(page.locator('.graph-list li[data-kind="related"]:visible')).toHaveCount(0);
  await expect(page.locator('.graph-list li[data-kind="supersedes"]:visible').first()).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator(node(kafka))).not.toHaveAttribute('aria-current', 'true');
});
