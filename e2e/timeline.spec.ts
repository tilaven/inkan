import { expect, test } from '@playwright/test';

test.skip(({}, info) => info.project.name !== 'e2e-desktop-light', 'sets its own viewport; one colour scheme is enough');

for (const width of [390, 1024, 1440, 1920]) {
  for (const zoom of [1, 2]) {
    test(`month labels stay clear of the cards at ${width}px, text ${zoom * 100}%`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/timeline/');
      // Off-screen `content-visibility: auto` months report empty boxes.
      await page.addStyleTag({ content: `html { font-size: ${zoom * 100}%; } * { content-visibility: visible !important; }` });
      await page.evaluate(() => document.fonts.ready);
      const months = page.locator('.tl .month');
      expect(await months.count()).toBeGreaterThan(0);
      const overlaps = await months.evaluateAll((sections) =>
        sections.flatMap((m) => {
          const label = m.querySelector('.month__l h3 [aria-hidden]')!.getBoundingClientRect();
          const count = m.querySelector('.month__l > span')!.getBoundingClientRect();
          const cards = m.querySelector('ul')!.getBoundingClientRect();
          const covers = (r: DOMRect) => cards.top < r.bottom && cards.left < r.right && cards.right > r.left;
          return covers(label) || covers(count) ? [m.querySelector('time')!.getAttribute('datetime')] : [];
        }),
      );
      expect(overlaps).toEqual([]);
    });
  }
}
