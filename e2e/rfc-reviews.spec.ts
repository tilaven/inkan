import { expect, test } from '@playwright/test';

const record = '/sre/rfc/0001-error-budget-policy/';

test('the record header lists reviewers and flags who they wait on', async ({ page }) => {
  await page.goto(`${record}?me=kenji`);
  const row = page.locator('.rmeta .rv');
  await expect(row.locator('dt')).toHaveText('Reviewers');
  await expect(row.locator('.rv__sum b')).toHaveText('2 of 3 approvals');
  await expect(row.locator('.rv__item')).toHaveCount(3);
  await expect(row.locator('.rv__item.is-approved')).toHaveCount(2);
  await expect(row.locator('.rv__you')).toBeVisible();
  await expect(row.locator('.rv__you')).toHaveText('Waiting on you');

  await page.goto(`${record}?me=ines`);
  await expect(page.locator('.rmeta .rv .rv__you')).toBeHidden();
});

test('the identity is remembered and the cards flag the records waiting on you', async ({ page }) => {
  await page.goto('/rfc-reviews/');
  await page.locator('#me-pick').selectOption('kenji');
  await page.goto('/decisions/');
  const card = page.locator('.dhc-link[data-waiting-on]', { has: page.locator('[data-id="sre/rfc/0001-error-budget-policy"]') });
  await expect(card.locator('.dhc__revchip')).toHaveText('2/3 ✓');
  await expect(card.locator('.dhc__you')).toBeVisible();
  await expect(page.locator('.dhc__you:visible')).toHaveCount(1);

  await page.goto('/sre/');
  await expect(page.locator('.dhc__you:visible')).toHaveCount(1);
});

test('the RFC reviews page picks an identity and fills "Waiting on you"', async ({ page }) => {
  await page.goto('/rfc-reviews/');
  const waiting = page.locator('[data-waiting-list] > li:not([hidden])');
  await expect(page.locator('[data-waiting-empty]')).toContainText('Pick yourself');
  await expect(waiting).toHaveCount(0);
  await expect(page.locator('h2', { hasText: 'Changes requested' })).toBeVisible();

  await page.locator('#me-pick').selectOption('kenji');
  await expect(waiting).toHaveCount(1);
  await expect(waiting.locator('.rr__title')).toHaveText('Error budget policy');
  await expect(page.locator('.rr__row.is-waiting .rv__you:visible')).toHaveCount(1);

  await page.reload();
  await expect(page.locator('#me-pick')).toHaveValue('kenji');
  await expect(waiting).toHaveCount(1);

  await page.locator('#me-pick').selectOption('');
  await expect(waiting).toHaveCount(0);
  await expect(page.locator('[data-waiting-empty]')).toBeVisible();
});

test('the RFC reviews page works with the identity from the URL', async ({ page }) => {
  await page.goto('/rfc-reviews/?me=jules');
  await expect(page.locator('#me-pick')).toHaveValue('jules');
  await expect(page.locator('[data-waiting-list] > li:not([hidden]) .rr__title')).toHaveText('Settle in async batches');
});

test('an identity from the URL applies to that page only', async ({ page }) => {
  await page.goto('/rfc-reviews/');
  await page.locator('#me-pick').selectOption('kenji');
  await page.goto('/rfc-reviews/?me=jules');
  await expect(page.locator('#me-pick')).toHaveValue('jules');
  await page.goto('/rfc-reviews/');
  await expect(page.locator('#me-pick')).toHaveValue('kenji');
});

test('the RFC reviews page does not scroll sideways on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/rfc-reviews/?me=kenji');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
