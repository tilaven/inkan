import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('facets start collapsed and active filters stay visible', async ({ page }) => {
  await page.goto('/decisions/?project=sre&type=rfc');
  const toggle = page.locator('#ftoggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#facets')).toBeHidden();
  await expect(toggle.locator('em')).toHaveText('2');

  const active = page.locator('#factive .chip');
  await expect(active).toHaveCount(2);
  await expect(active.first()).toHaveAccessibleName(/^Remove filter Team: SRE/);
  await active.first().focus();
  await page.keyboard.press('Enter');
  await expect(active).toHaveCount(1);
  await expect(active.first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(active).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(page).toHaveURL(/\/decisions\/$/);
});

test('filters without a matching chip are still shown', async ({ page }) => {
  await page.goto('/decisions/?tag=no-such-tag');
  await expect(page.locator('#factive .chip')).toHaveText(/#no-such-tag/);
  await expect(page.locator('#ftoggle em')).toHaveText('1');
});

test('the toggle opens and closes the facets', async ({ page }) => {
  await page.goto('/decisions/');
  const toggle = page.locator('#ftoggle');
  await toggle.click();
  await expect(page.locator('#facets')).toBeVisible();
  await page.locator('.fgroup[data-facet="type"] .chip[data-value="rfc"]').click();
  await expect(page).toHaveURL(/\?type=rfc$/);
  await expect(page.locator('#factive .chip')).toHaveCount(1);
  await expect(toggle.locator('em')).toHaveText('1');

  const { violations } = await new AxeBuilder({ page }).include('#filters').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#facets')).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});

test('a chip field filters by click and by URL', async ({ page }) => {
  await page.goto('/decisions/');
  await page.locator('#ftoggle').click();
  const risk = page.locator('.fgroup[data-field="risk"]');
  await expect(risk.locator('.chip[data-value]')).toHaveText([/^low/, /^medium/, /^high/]);
  await risk.locator('.chip[data-value="high"]').click();
  await expect(page).toHaveURL(/\?risk=high$/);
  await expect(page.locator('#factive .chip')).toHaveAccessibleName(/^Remove filter Risk: high/);
  await expect(page.locator('#count')).toHaveText(/^2 of \d+ records/);

  await page.goto('/decisions/?risk=medium,low&pci=true&view=table');
  await expect(page.locator('#tbl tbody tr:visible')).toHaveCount(2);
  await expect(page.locator('.fgroup[data-field="pci"] .chip[aria-pressed="true"]')).toHaveText(/^Yes/);
  await expect(page.locator('#factive .chip')).toHaveCount(3);
  await expect(page.locator('#tbl th.fv')).toHaveText(['Risk']);
  await expect(page.locator('#tbl tbody tr:visible td.fv')).toHaveText(['low', 'medium']);
});

test('a range field filters by URL and by input, and its pill clears it', async ({ page }) => {
  await page.goto('/decisions/?cost=10..50');
  await expect(page.locator('#count')).toHaveText(/^3 of \d+ records/);
  const pill = page.locator('#factive .chip');
  await expect(pill).toHaveAccessibleName('Remove filter Cost: 10–50 k€/year');
  const min = page.locator('.fgroup[data-field="cost"] input[data-bound="min"]');
  const max = page.locator('.fgroup[data-field="cost"] input[data-bound="max"]');
  await expect(min).toHaveValue('10');
  await expect(max).toHaveValue('50');

  await page.locator('#ftoggle').click();
  await max.fill('');
  await expect(page).toHaveURL(/\?cost=10\.\.$/);
  await expect(pill).toHaveText(/Cost: from 10 k€\/year/);
  await min.fill('100');
  await expect(page).toHaveURL(/\?cost=100\.\.$/);
  await expect(page.locator('#count')).toHaveText(/^1 of \d+ records/);

  await pill.click();
  await expect(page).toHaveURL(/\/decisions\/$/);
  await expect(min).toHaveValue('');
  await expect(page.locator('#factive')).toBeHidden();

  await min.fill('25');
  await max.fill('25');
  await expect(page).toHaveURL(/\?cost=25$/);
  await page.locator('#reset').click();
  await expect(page).toHaveURL(/\/decisions\/$/);
  await expect(max).toHaveValue('');
});

test('the record header lists the custom fields', async ({ page }) => {
  await page.goto('/payments/adr/0001-use-postgresql-for-the-ledger/');
  const row = (label: string) => page.locator('.rmeta div', { has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) }).locator('dd');
  await expect(row('Risk')).toHaveText('medium');
  await expect(row('Risk').locator('a')).toHaveAttribute('href', /\/decisions\/\?risk=medium$/);
  await expect(row('Cost')).toHaveText('25 k€/year');
  await expect(row('PCI scope')).toHaveText('Yes');
  await expect(row('PCI scope').locator('a')).toHaveAttribute('href', /\/decisions\/\?pci=true$/);
  await row('Risk').locator('a').click();
  await expect(page.locator('#factive .chip')).toHaveAccessibleName(/^Remove filter Risk: medium/);
});
