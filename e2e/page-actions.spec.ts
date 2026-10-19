import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const record = '/sre/adr/0001-define-slos-before-dashboards/';
const markdown = '/sre/adr/0001-define-slos-before-dashboards.md';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('copy page puts the raw Markdown on the clipboard', async ({ page }) => {
  await page.goto(record);
  await page.getByRole('button', { name: 'Copy page' }).click();
  await expect(page.locator('[data-pact-label]')).toHaveText('Copied');
  const raw = await (await page.request.get(markdown)).text();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(raw);
});

test('the menu opens, moves with the keyboard and closes on Escape', async ({ page, baseURL }) => {
  await page.goto(record);
  const toggle = page.getByRole('button', { name: 'More page actions' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const items = page.getByRole('menuitem');
  await expect(items).toHaveText(['Copy link to page', 'Open Markdown page', 'Use in Claude', 'Use in ChatGPT']);
  await expect(items.first()).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(items.last()).toBeFocused();

  const { violations } = await new AxeBuilder({ page }).include('.pact').analyze();
  expect(violations.map((v) => v.id)).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(toggle).toBeFocused();

  const prompt = encodeURIComponent(`Read ${new URL(markdown, baseURL).href} so I can ask questions about it.`);
  await expect(page.locator('.pact__ai--claude')).toHaveAttribute('href', `https://claude.ai/new?q=${prompt}`);
  await expect(page.locator('.pact__ai--chatgpt')).toHaveAttribute('href', `https://chatgpt.com/?hints=search&q=${prompt}`);
  await expect(page.getByRole('menuitem', { name: 'Open Markdown page', includeHidden: true })).toHaveAttribute('href', markdown);
});

test('copy link copies the page URL', async ({ page, baseURL }) => {
  await page.goto(record);
  await page.getByRole('button', { name: 'More page actions' }).click();
  await page.getByRole('menuitem', { name: 'Copy link to page' }).click();
  await expect(page.getByRole('menu')).toBeHidden();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(new URL(record, baseURL).href);
});

test('links that open a new tab say so', async ({ page }) => {
  await page.goto(record);
  await page.getByRole('button', { name: 'More page actions' }).click();
  for (const name of ['Open Markdown page', 'Use in Claude', 'Use in ChatGPT']) {
    await expect(page.getByRole('menuitem', { name })).toHaveAccessibleDescription('Opens in a new tab');
  }
});
