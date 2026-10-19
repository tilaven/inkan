import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const pages = {
  home: '/',
  record: '/sre/adr/0001-define-slos-before-dashboards/',
  'record with tables and code': '/payments/adr/0001-use-postgresql-for-the-ledger/',
  'records index': '/decisions/',
  tags: '/tags/',
  graph: '/graph/',
  export: '/export/',
  'rfc with reviewers': '/sre/rfc/0001-error-budget-policy/?me=kenji',
  'rfc reviews': '/rfc-reviews/?me=kenji',
};

const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
type Violations = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'];
const report = (violations: Violations) =>
  violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, targets: v.nodes.map((n) => n.target.join(' ')) }));

for (const [name, url] of Object.entries(pages)) {
  test(`no serious accessibility violations on ${name}`, async ({ page }) => {
    await page.goto(url, { waitUntil: 'networkidle' });
    const { violations } = await new AxeBuilder({ page }).withTags(wcag).analyze();
    expect(report(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'))).toEqual([]);
  });
}

test('landmarks stay unique on a page with several code blocks and tables', async ({ page }) => {
  await page.goto('/export/', { waitUntil: 'networkidle' });
  await expect(page.locator('.expressive-code pre[data-label]').first()).toBeAttached();
  const { violations } = await new AxeBuilder({ page }).withRules(['landmark-unique', 'aria-prohibited-attr', 'scrollable-region-focusable']).analyze();
  expect(report(violations)).toEqual([]);
});

test('the search palette keeps its contrast on the selected hit and returns focus on close', async ({ page }) => {
  await page.goto('/decisions/', { waitUntil: 'networkidle' });
  const trigger = page.locator('[data-pal-open]');
  await trigger.click();
  await page.getByRole('combobox', { name: 'Search records' }).fill('postgres');
  await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  const { violations } = await new AxeBuilder({ page }).include('dialog[data-pal]').withTags(wcag).analyze();
  expect(report(violations)).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();

  const heading = page.locator('.h1');
  await heading.evaluate((h) => ((h as HTMLElement).tabIndex = -1));
  await heading.focus();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('option').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(heading).toBeFocused();
});

test('tag pills centre their text', async ({ page }) => {
  await page.goto('/platform/adr/0001-record-architecture-decisions/', { waitUntil: 'networkidle' });
  const skew = await page.locator('.rmeta a.tag').first().evaluate((a) => {
    const box = a.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(a);
    const text = range.getBoundingClientRect();
    return Math.abs(text.top - box.top - (box.bottom - text.bottom));
  });
  expect(skew).toBeLessThan(1);
});

/** WCAG contrast ratio of two computed colours (`rgb()`, `rgba()` or `color(srgb …)`), alpha composited over `under`. */
const contrast = (fg: string, bg: string, under = [0, 0, 0]) => {
  const parse = (c: string) => {
    const n = c.replace(/^[a-z]+\(srgb\s*/, '').match(/[\d.]+/g)!.map(Number);
    return c.startsWith('color(') ? [n[0] * 255, n[1] * 255, n[2] * 255, n[3]] : n;
  };
  const flatten = ([r, g, b, a = 1]: number[]) => [r, g, b].map((v, i) => v * a + under[i] * (1 - a));
  const lum = (rgb: number[]) => rgb.map((v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const [a, b] = [lum(flatten(parse(fg))), lum(flatten(parse(bg)))].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

test('card metadata is legible on every plate', async ({ page }) => {
  await page.goto('/decisions/', { waitUntil: 'networkidle' });
  for (const part of ['.dhc__chip', '.dhc__tags', '.dhc__date']) {
    expect(await page.locator(part).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize)), part).toBeGreaterThanOrEqual(10);
  }
  const draft = page.locator('.dhc[data-status="draft"]').first();
  await expect(draft).toBeAttached();
  const colors = await draft.evaluate((card) => ({
    text: getComputedStyle(card.querySelector('.dhc__tags')!).color,
    plate: getComputedStyle(card.querySelector('.dhc__plate')!).backgroundColor,
  }));
  // The draft plate is translucent; the darkest cover art underneath is the worst case.
  expect(contrast(colors.text, colors.plate, [0, 0, 0])).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.text, colors.plate, [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
});

test('tables, math and code blocks are reachable by keyboard only while they overflow', async ({ page }) => {
  await page.goto('/payments/adr/0001-use-postgresql-for-the-ledger/', { waitUntil: 'networkidle' });
  const table = page.locator('.prose .tblw').first();
  await expect(table).toHaveAttribute('data-scroll-label', /^Table 1 in /);
  await expect(table.locator('table')).toHaveCSS('display', 'table');
  await expect(page.locator('.expressive-code pre').first()).toHaveAttribute('data-label', /./);

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(table).not.toHaveAttribute('tabindex');
  await expect(table).not.toHaveAttribute('role');
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(table).toHaveAttribute('tabindex', '0');
  await expect(table).toHaveAttribute('role', 'region');
  await expect(table).toHaveAttribute('aria-label', /^Table 1 in /);
  await table.focus();
  await expect(table).toBeFocused();

  await page.goto('/sre/rfc/0001-error-budget-policy/', { waitUntil: 'networkidle' });
  await expect(page.locator('.katex-display').first()).toHaveAttribute('data-scroll-label', /^Equation 1 in /);
});

test('the records table keeps its tag and field columns on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/decisions/', { waitUntil: 'networkidle' });
  await page.locator('.seg2 [data-view="table"]').click();
  await expect(page.locator('.table .tg').first()).toBeVisible();
  await expect(page.locator('.table .fv').first()).toBeVisible();
  const wrapper = page.locator('.table-scroll');
  await expect(wrapper).toHaveAttribute('tabindex', '0');
  await expect(wrapper).toHaveAttribute('role', 'region');
  await expect(wrapper).toHaveAttribute('aria-label', 'Table of records');
});

test('standalone controls meet the 24px target size', async ({ page }) => {
  await page.goto('/graph/', { waitUntil: 'networkidle' });
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.tree__h a, .tree__tog, .graph-toggles label')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ el: el.className || el.tagName, height: el.getBoundingClientRect().height }))
      .filter((r) => r.height < 24),
  );
  expect(small).toEqual([]);
});

/** Shift+Tab from the footer to the top of the page: the elements that got focus while lying under the sticky top bar. */
const sweepUnderTopBar = async (page: Page) => {
  await page.locator('.foot a').last().focus();
  const covered: string[] = [];
  for (let i = 0; i < 400; i++) {
    await page.keyboard.press('Shift+Tab');
    const hit = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      const bar = document.querySelector('.top')!;
      if (!el || el === document.body) return 'end';
      if (!document.querySelector('.main')!.contains(el) || bar.contains(el) || getComputedStyle(bar).position !== 'sticky') return '';
      const b = el.getBoundingClientRect();
      const t = bar.getBoundingClientRect();
      return b.height > 0 && b.top < t.bottom && b.bottom > t.top ? `${el.tagName.toLowerCase()} "${el.textContent!.trim().slice(0, 40)}" at y=${Math.round(b.top)}` : '';
    });
    if (hit === 'end') break;
    if (hit) covered.push(hit);
  }
  return covered;
};

test('focus never lands under the sticky top bar on a Shift+Tab sweep', async ({ page }) => {
  await page.goto(pages['record with tables and code'], { waitUntil: 'networkidle' });
  expect(await sweepUnderTopBar(page)).toEqual([]);
  await page.goto(pages['records index'], { waitUntil: 'networkidle' });
  expect(await sweepUnderTopBar(page)).toEqual([]);
});

test('the top bar scrolls away on a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 256 });
  await page.goto(pages.record, { waitUntil: 'networkidle' });
  await expect(page.locator('.top')).toHaveCSS('position', 'static');
});

test('pressed, current and selected states stay distinguishable in forced colors', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  const paint = (selector: string, nth = 0) =>
    page.locator(selector).nth(nth).evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.backgroundColor, s.color, s.borderTopColor, s.outlineStyle].join(' ');
    });

  // The "on" state is painted in the system Highlight colour, which forced colors keeps.
  const highlight = () =>
    page.evaluate(() => {
      const probe = document.body.appendChild(document.createElement('i'));
      probe.style.backgroundColor = 'Highlight';
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    });
  const background = (selector: string, nth = 0) => page.locator(selector).nth(nth).evaluate((el) => getComputedStyle(el).backgroundColor);

  await page.goto(pages['records index'], { waitUntil: 'networkidle' });
  const on = await highlight();
  expect(await paint('.seg2 button', 0)).not.toBe(await paint('.seg2 button', 1));
  expect(await background('.seg2 button[aria-pressed="true"]')).toBe(on);
  expect(await paint('.nav a[aria-current="page"]')).not.toBe(await paint('.nav a:not([aria-current])'));
  expect(await background('.nav a[aria-current="page"]')).toBe(on);
  await page.locator('#ftoggle').click();
  const chip = page.locator('.facets .chip[aria-pressed]').first();
  const unpressed = await paint('.facets .chip[aria-pressed]');
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  expect(await paint('.facets .chip[aria-pressed]')).not.toBe(unpressed);
  expect(await background('.facets .chip[aria-pressed]')).toBe(on);
  expect(await page.locator('.stk__fill').first().evaluate((el) => getComputedStyle(el).forcedColorAdjust)).toBe('none');

  await page.locator('[data-pal-open]').click();
  await page.getByRole('combobox', { name: 'Search records' }).fill('a');
  await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  expect(await paint('[role="option"]', 0)).not.toBe(await paint('[role="option"]', 1));
  expect(await background('[role="option"]')).toBe(on);
  await page.keyboard.press('Escape');

  await page.goto(pages.record, { waitUntil: 'networkidle' });
  expect(await paint('.dhc-modes button', 0)).not.toBe(await paint('.dhc-modes button', 1));
  expect(await background('.dhc-modes button[aria-pressed="true"]')).toBe(on);
});

test('text follows the browser default font size', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.enable');
  await cdp.send('Page.setFontSizes', { fontSizes: { standard: 24 } });
  await page.goto(pages.record, { waitUntil: 'networkidle' });
  const size = (selector: string) => page.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(await size('body')).toBe(24);
  expect(await size('.prose p')).toBeGreaterThanOrEqual(24);
  expect(await size('.nav a')).toBeGreaterThan(17);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});

test('top navigation links show a focus ring', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/', { waitUntil: 'networkidle' });
  const link = page.locator('.top__nav a').first();
  await link.focus();
  await expect(link).toHaveCSS('outline-style', 'solid');
  expect(await link.evaluate((a) => parseFloat(getComputedStyle(a).outlineWidth))).toBeGreaterThanOrEqual(2);
});

test('headings are named by their own text and the anchor by the section', async ({ page }) => {
  await page.goto('/sre/adr/0001-define-slos-before-dashboards/', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Context', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Link to/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Link to section: Context' })).toHaveAttribute('href', '#context');
  await expect(page.locator('.crumbs ol li')).toHaveText(['Acme Decisions', '/ SRE', '/ ADR', '/ 0001']);
});

test('the export document nests record sections under the record titles', async ({ page }) => {
  await page.goto('/export/', { waitUntil: 'networkidle' });
  const record = page.locator('.xp-rec').first();
  await expect(record.locator('h2.xp-title')).toHaveCount(1);
  await expect(record.locator('.prose h2')).toHaveCount(0);
  await expect(record.locator('.prose h3').first()).toHaveAccessibleName(/^\w+$/);
});

test('the sidebar is a navigation of project sections with lists, and the toggles keep one name', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'networkidle' });
  const tree = page.getByRole('navigation', { name: 'Teams and their records' });
  const sre = tree.locator('section[data-project="sre"]');
  await expect(sre.getByRole('heading', { level: 2 })).toHaveText(/SRE/);
  await expect(sre.locator('ul li a.rec').first()).toBeVisible();
  const toggle = sre.locator('[data-tree-toggle]');
  await expect(toggle).toHaveAccessibleName('2 records in SRE');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  await expect(toggle).toHaveAccessibleName('2 records in SRE');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(sre.locator('.tree__body')).toBeHidden();
  await page.reload({ waitUntil: 'networkidle' });
  await expect(sre.locator('[data-tree-toggle]')).toHaveAttribute('aria-expanded', 'false');
});

test('the theme button is a toggle that says when the dark theme is on', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const button = page.getByRole('button', { name: 'Dark theme' });
  const dark = (await page.locator('html').getAttribute('data-theme')) === 'dark';
  await expect(button).toHaveAttribute('aria-pressed', String(dark));
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', String(!dark));
  await expect(page.locator('html')).toHaveAttribute('data-theme', dark ? 'light' : 'dark');
});

test('a skip link reaches the search button before the sidebar', async ({ page }) => {
  await page.goto('/decisions/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to search' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-pal-open]')).toBeFocused();
});

test('the phone drawer has a close button and the scrim is decorative', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'networkidle' });
  const menu = page.getByRole('button', { name: 'Open navigation' });
  await menu.click();
  const close = page.getByRole('dialog', { name: 'Archive navigation' }).getByRole('button', { name: 'Close navigation' });
  await expect(close).toBeFocused();
  await expect(page.locator('[data-scrim]')).toHaveAttribute('aria-hidden', 'true');
  await close.click();
  await expect(page.locator('#side')).not.toHaveClass(/is-open/);
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('[data-side-close]')).toBeHidden();
});

test('search options are named by title, project and status, with the excerpt as description', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('[data-pal-open]').click();
  const recent = page.getByRole('option').first();
  await expect(recent).toHaveAccessibleName(/ · (ADR|RFC)\s+Status: (Draft|Proposed|In review|Accepted|Implemented|Rejected|Withdrawn|Deprecated|Superseded)\.\s*$/);
  await expect(page.locator('[data-pal-live]')).toHaveText('Recent decisions');

  await page.getByRole('combobox', { name: 'Search records' }).fill('postgres');
  const hit = page.getByRole('option').first();
  await expect(hit).toHaveAccessibleName(/^Use PostgreSQL for the ledger\s+Payments · ADR\s+Status: Implemented\.\s*$/);
  await expect(hit).toHaveAccessibleDescription(/postgres/i);
  await expect(hit.locator('.stk')).toHaveCount(1);
  await expect(page.locator('[data-pal-live]')).toHaveText(/^\d+ (of \d+ )?results?$/);
  await expect(page.locator('#pal-list')).toHaveAttribute('tabindex', '-1');

  await page.getByRole('combobox', { name: 'Search records' }).fill('xqzvw');
  await expect(page.locator('[data-pal-live]')).toHaveText('Nothing matches “xqzvw”.');
  await expect(page.locator('dialog[data-pal] [role="status"], dialog[data-pal] [aria-live]')).toHaveCount(1);
});

test('the review-due chip speaks its meaning and marks lateness in words', async ({ page }) => {
  await page.clock.setFixedTime('2026-11-20T12:00:00Z');
  await page.goto('/sre/rfc/0001-error-budget-policy/', { waitUntil: 'networkidle' });
  const chip = page.locator('.dtag[data-review-by="2026-11-06"]');
  await expect(chip).toHaveClass(/is-late/);
  await expect(chip.locator('[aria-hidden="true"]')).toHaveText('D+14 · overdue');
  await expect(chip.locator('.sr-only')).toHaveText('14 days late');

  await page.goto('/rfc-reviews/', { waitUntil: 'networkidle' });
  const row = page.locator('.bl__row[data-review-by="2026-11-06"]').first();
  await expect(row.locator('.bl__d b')).toHaveAttribute('aria-hidden', 'true');
  await expect(row.locator('[data-due]')).toHaveText('14 days late');
});

test('the RFC reviews page announces one sentence after the reader picks themselves', async ({ page }) => {
  await page.goto('/rfc-reviews/', { waitUntil: 'networkidle' });
  const status = page.locator('[data-waiting-status]');
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status).toHaveText('');
  await expect(page.locator('.bl__d b[aria-hidden="true"]').first()).toBeAttached();
  await page.locator('#me-pick').selectOption('kenji');
  await expect(status).toHaveText('1 review is waiting on you.');
  await page.locator('#me-pick').selectOption('ines');
  await expect(status).toHaveText('Nothing is waiting on you right now.');
  await expect(page.locator('main [aria-live]')).toHaveCount(0);
});

test('the records index is a list with a captioned table, and its filter strings are translated', async ({ page }) => {
  await page.goto('/decisions/?cost=10..', { waitUntil: 'networkidle' });
  await expect(page.locator('#count')).toHaveText(/^\d+ of \d+ records/);
  await expect(page.locator('ul#cards > li.cell:not([hidden])').first()).toBeVisible();
  await expect(page.locator('#tbl caption')).toHaveText('Records matching the filters');
  await expect(page.locator('#tbl th').nth(1)).toHaveText('ID');
  await expect(page.locator('#factive .chip')).toHaveAccessibleName('Remove filter Cost: from 10 k€/year');
  await page.locator('#ftoggle').click();
  await expect(page.locator('.fgroup--range input[data-bound="min"]').first()).toHaveAttribute('placeholder', 'min');
});
