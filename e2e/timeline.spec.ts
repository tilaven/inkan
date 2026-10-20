import { expect, test } from '@playwright/test';

for (const width of [390, 1440, 1920]) {
  for (const zoom of [1, 2]) {
    test(`month labels stay clear of the cards at ${width}px, text ${zoom * 100}%`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/timeline/');
      await page.addStyleTag({ content: `html { font-size: ${zoom * 100}%; } * { content-visibility: visible !important; }` });
      await page.evaluate(() => document.fonts.ready);
      const overlaps = await page.locator('.tl .month').evaluateAll((months) =>
        months.flatMap((m) => {
          const label = m.querySelector('.month__l h3 [aria-hidden]')!.getBoundingClientRect();
          const cards = m.querySelector('ul')!.getBoundingClientRect();
          const covered = cards.top < label.bottom && cards.left < label.right && cards.right > label.left;
          return covered ? [m.querySelector('time')!.getAttribute('datetime')] : [];
        }),
      );
      expect(overlaps).toEqual([]);
    });
  }
}
