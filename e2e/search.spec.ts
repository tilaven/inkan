import { expect, test } from '@playwright/test';

test('search has one entry point and one shortcut', async ({ page }) => {
  await page.goto('/decisions/');
  const triggers = page.locator('[data-pal-open]');
  await expect(triggers).toHaveCount(1);
  await expect(triggers).toBeVisible();

  const palette = page.getByRole('dialog', { name: 'Search records' });
  await page.locator('body').press('/');
  await expect(palette).toBeHidden();

  await page.keyboard.press('ControlOrMeta+k');
  await expect(palette).toBeVisible();
  await expect(page.getByRole('option').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();

  await triggers.click();
  await expect(palette).toBeVisible();
});

test('search finds records in the Pagefind index', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-pal-open]').click();
  await page.getByRole('combobox', { name: 'Search records' }).fill('postgres');
  const first = page.getByRole('option').first();
  await expect(first).toContainText(/postgres/i);
  await expect(first.locator('mark').first()).toBeVisible();

  const projects = JSON.parse((await page.locator('[data-pal]').getAttribute('data-projects')) ?? '{}') as Record<string, { name: string; ink: string }>;
  const id = new URL((await first.getAttribute('href')) ?? '', page.url()).pathname.split('/')[1];
  const project = projects[id];
  expect(project, `project "${id}" in data-projects`).toBeDefined();
  await expect(first.locator('.hit__meta')).toContainText(project.name);
  expect(await first.getAttribute('style')).toContain(`--ink: var(--inkan-ink-${project.ink})`);

  await page.keyboard.press('Enter');
  await page.waitForURL((url) => url.pathname !== '/');
});
