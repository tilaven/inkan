import { expect, test } from '@playwright/test';

const pages = {
  home: '/',
  decisions: '/decisions/',
  record: '/sre/adr/0001-define-slos-before-dashboards/',
  project: '/sre/',
  timeline: '/timeline/',
  graph: '/graph/',
  backlog: '/backlog/',
  reviews: '/reviews/',
  authors: '/authors/',
  tags: '/tags/',
  handbook: '/handbook/',
  rfc: '/sre/rfc/0001-error-budget-policy/?me=kenji',
  'rfc-reviews': '/rfc-reviews/?me=kenji',
};

for (const [name, url] of Object.entries(pages)) {
  test(`visual ${name}`, async ({ page }) => {
    await page.clock.setFixedTime('2026-10-15T12:00:00Z');
    const res = await page.goto(url, { waitUntil: 'networkidle' });
    expect(res?.status()).toBe(200);
    await page.evaluate(() => document.fonts.ready);
    // Off-screen `content-visibility: auto` blocks are not painted in a full-page capture.
    await page.addStyleTag({ content: '* { content-visibility: visible !important; }' });
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, animations: 'disabled' });
  });
}
