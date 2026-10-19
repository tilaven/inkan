import { expect, test, type Page } from '@playwright/test';
import { sitemapPaths } from './support';

const paths = sitemapPaths();
const hrefs = new Map<string, string>();

async function internalHrefs(page: Page, origin: string) {
  const all = await page.$$eval('a[href]', (anchors) => anchors.map((a) => new URL(a.getAttribute('href')!, location.href).href));
  return all.filter((href) => new URL(href).origin === origin && !href.startsWith('javascript:'));
}

for (const url of paths) {
  test(`page ${url}`, async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const problems: string[] = [];
    page.on('console', (msg) => msg.type() === 'error' && problems.push(`console: ${msg.text()}`));
    page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
    page.on('requestfailed', (req) => new URL(req.url()).origin === origin && problems.push(`request failed: ${req.url()}`));
    page.on('response', (res) => new URL(res.url()).origin === origin && res.status() >= 400 && problems.push(`${res.status()}: ${res.url()}`));

    const response = await page.goto(url, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);

    for (const href of await internalHrefs(page, origin)) {
      const { pathname, search } = new URL(href);
      hrefs.set(pathname + search, url);
    }

    // Open Graph cards point at the public `url`; the same path must exist in this build.
    const card = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(card, 'og:image').toMatch(/\/og\/.+\.png$/);
    hrefs.set(new URL(card!).pathname, url);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if ((page.viewportSize()?.width ?? Infinity) <= 390) expect(overflow, 'horizontal overflow at 390px').toBeLessThanOrEqual(0);

    expect(problems).toEqual([]);
  });
}

test('every internal link resolves', async ({ request }) => {
  test.skip(hrefs.size === 0, 'no pages were crawled in this worker');
  const broken: string[] = [];
  for (const [href, from] of hrefs) {
    const res = await request.get(href);
    if (res.status() !== 200) broken.push(`${res.status()} ${href} (linked from ${from})`);
  }
  expect(broken).toEqual([]);
});
