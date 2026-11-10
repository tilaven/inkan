import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const record = '/platform/adr/0009-move-the-event-bus-to-kafka/';
const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test('a diagram opens full screen, zooms and pans from the keyboard, and goes back on Escape', async ({ page }) => {
  await page.goto(record, { waitUntil: 'networkidle' });
  await expect(page.locator('pre.mermaid svg')).toBeAttached();
  const open = page.getByRole('button', { name: 'Enlarge: Diagram 1' });
  await open.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Diagram 1' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('region', { name: 'Zoomable view' })).toBeFocused();
  await expect(dialog.locator('svg[id^="mermaid-"]')).toBeVisible();
  const level = dialog.locator('[data-zoom-level]');
  const fitted = await level.textContent();

  await page.keyboard.press('+');
  await expect(level).not.toHaveText(fitted!);
  const item = dialog.locator('[data-zoom-item]');
  const before = await item.boundingBox();
  await page.keyboard.press('ArrowLeft');
  expect((await item.boundingBox())!.x).toBeGreaterThan(before!.x);
  await page.keyboard.press('0');
  await expect(level).toHaveText(fitted!);

  const { violations } = await new AxeBuilder({ page }).withTags(wcag).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
  await expect(page.locator('pre.mermaid svg')).toHaveCount(1);
});

test('the wheel zooms around the pointer and dragging moves the diagram', async ({ page }) => {
  await page.goto(record, { waitUntil: 'networkidle' });
  await expect(page.locator('pre.mermaid svg')).toBeAttached();
  await page.locator('pre.mermaid').click();
  const dialog = page.getByRole('dialog', { name: 'Diagram 1' });
  await expect(dialog).toBeVisible();
  const level = dialog.locator('[data-zoom-level]');
  const fitted = Number.parseInt((await level.textContent())!);

  const stage = (await dialog.locator('[data-zoom-stage]').boundingBox())!;
  await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => Number.parseInt((await level.textContent())!)).toBeGreaterThan(fitted);

  const item = dialog.locator('[data-zoom-item]');
  const before = (await item.boundingBox())!;
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width / 2 - 120, stage.y + stage.height / 2 - 60, { steps: 4 });
  await page.mouse.up();
  const after = (await item.boundingBox())!;
  expect(after.x).toBeLessThan(before.x);

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
});
