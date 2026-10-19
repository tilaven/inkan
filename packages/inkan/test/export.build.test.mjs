/**
 * End to end: builds the example site, runs `inkan export` as HTML and PDF and, when Chromium is installed,
 * screenshots /export/ (screen and print, light and dark, 1440 and 390 wide) into INKAN_SHOTS or the temp dir.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { packageDir } from '../lib/config.mjs';
import { mimeType, pdfPageCount, sitePath } from '../lib/export.mjs';

const example = path.resolve(packageDir, '../../examples/company-decisions');
const dist = path.join(example, 'dist');
const cli = path.join(packageDir, 'bin/cli.mjs');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'inkan-export-'));
const shots = process.env.INKAN_SHOTS || path.join(out, 'shots');
const BUILD_TIMEOUT = 240_000;

const run = (args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd: out, env: { ...process.env, INKAN_ROOT: '' } });

async function chromium() {
  const { chromium } = await import('playwright-core');
  try {
    return await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  } catch {
    return null;
  }
}

describe('inkan export', () => {
  it('builds the example and writes one self-contained HTML file', { timeout: BUILD_TIMEOUT }, () => {
    const r = run(['export', '--root', example, '--out', 'decisions.html']);
    expect(r.stderr).not.toMatch(/Error/);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Wrote decisions\.html/);
    expect(fs.existsSync(path.join(dist, 'export/index.html'))).toBe(true);
    const html = fs.readFileSync(path.join(out, 'decisions.html'), 'utf8');
    expect(html).toContain('<title>Acme Decisions: decisions');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<link');
    expect(html).not.toMatch(/url\(\/_astro/);
    expect(html).toContain('data:font/woff2');
    expect(html).toContain('id="r-sre-adr-0001-define-slos-before-dashboards"');
    // Only current records are in; the table of contents links to each of them in the page.
    expect(html).not.toContain('Run CI on Jenkins');
    expect(html).toContain('href="#r-payments-adr-0001-use-postgresql-for-the-ledger"');
    expect(html).toContain('.expressive-code{');
    // Heading ids are prefixed per record, so every record keeps its own "Context".
    expect(html).toContain('id="r-sre-adr-0001-define-slos-before-dashboards-context"');
    expect(html).not.toMatch(/ id="context"/);
  });

  it('keeps the export page out of the sitemap and links it from the footer', () => {
    const sitemap = fs.readdirSync(dist).filter((f) => /^sitemap-\d+\.xml$/.test(f)).map((f) => fs.readFileSync(path.join(dist, f), 'utf8')).join('');
    expect(sitemap).not.toContain('/export/');
    expect(fs.readFileSync(path.join(dist, 'index.html'), 'utf8')).toContain('href="/export/">Print / export</a>');
  });

  it('renders Mermaid diagrams as inline SVG, writes an A4 PDF and screenshots the page', { timeout: BUILD_TIMEOUT }, async () => {
    const browser = await chromium();
    if (!browser) {
      console.warn('Chromium is not installed, the PDF and screenshot checks are skipped.');
      return;
    }
    const html = fs.readFileSync(path.join(out, 'decisions.html'), 'utf8');
    expect(html).toMatch(/<pre class="mermaid"[^>]*data-processed="true"[^>]*>\s*<svg/);

    const r = run(['export', '--root', example, '--no-build', '--pdf', '--out', 'decisions.pdf']);
    expect(r.status, r.stderr).toBe(0);
    const pdf = fs.readFileSync(path.join(out, 'decisions.pdf'));
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = pdfPageCount(pdf);
    expect(pages).toBeGreaterThanOrEqual(8);
    expect(pages).toBeLessThanOrEqual(16);
    expect(r.stdout).toContain(`${pages} pages`);

    const server = http.createServer((req, res) => {
      let file = sitePath(req.url, { dist });
      if (file && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!file || !fs.existsSync(file)) return res.writeHead(404).end();
      res.writeHead(200, { 'content-type': mimeType(file) });
      fs.createReadStream(file).pipe(res);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    fs.mkdirSync(shots, { recursive: true });
    try {
      for (const width of [1440, 390]) {
        for (const theme of ['light', 'dark']) {
          const page = await browser.newPage({ viewport: { width, height: 900 } });
          const errors = [];
          page.on('pageerror', (e) => errors.push(e.message));
          await page.goto(`http://127.0.0.1:${server.address().port}/export/?theme=${theme}`, { waitUntil: 'networkidle' });
          await page.waitForFunction(() => [...document.querySelectorAll('pre.mermaid')].every((p) => p.hasAttribute('data-processed')));
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({ path: path.join(shots, `export-screen-${theme}-${width}.png`), fullPage: true });
          expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `overflow at ${width}`).toBeLessThanOrEqual(0);
          await page.emulateMedia({ media: 'print' });
          await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
          expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
          await page.screenshot({ path: path.join(shots, `export-print-${theme}-${width}.png`), fullPage: true });
          expect(errors).toEqual([]);
          await page.close();
        }
      }
    } finally {
      await browser.close();
      server.close();
    }
  });
});
