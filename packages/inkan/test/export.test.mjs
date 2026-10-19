import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaults } from '../lib/defaults.mjs';
import { MARK_END, MARK_START, assetFile, exportStatuses, exportTitle, extractDocument, inlineCssUrls, pdfPageCount, sitePath, standaloneHtml } from '../lib/export.mjs';
import { tmpSite } from './helpers.mjs';

const config = (extra = {}) => ({ ...defaults, ...extra });

describe('exportStatuses', () => {
  it('defaults to the statuses marked current', () => {
    expect(exportStatuses(config())).toEqual(['accepted', 'implemented']);
  });
  it('takes export.statuses when given', () => {
    expect(exportStatuses(config({ export: { statuses: ['accepted', 'deprecated'] } }))).toEqual(['accepted', 'deprecated']);
    expect(exportStatuses(config({ export: { statuses: [] } }))).toEqual(['accepted', 'implemented']);
  });
  it('follows custom status sets', () => {
    expect(exportStatuses(config({ statuses: { live: { label: 'Live', current: true }, old: { label: 'Old' } } }))).toEqual(['live']);
  });
});

describe('exportTitle', () => {
  it('uses export.title or "<title>: decisions"', () => {
    expect(exportTitle(config({ title: 'Acme' }))).toBe('Acme: decisions');
    expect(exportTitle(config({ export: { title: 'Acme audit pack' } }))).toBe('Acme audit pack');
  });

  it('writes the default in the site language', async () => {
    const { resolveMessages } = await import('../lib/i18n/index.mjs');
    expect(exportTitle({ ...config({ title: 'Acme' }), locale: 'pl', messages: resolveMessages('pl') })).toBe('Acme: decyzje');
  });
});

describe('sitePath', () => {
  const dist = '/srv/dist';
  it('maps site urls to dist files and strips the base', () => {
    expect(sitePath('/_astro/a.css', { dist })).toBe(path.join(dist, '_astro/a.css'));
    expect(sitePath('/docs/_astro/a.css?v=1', { dist, base: '/docs' })).toBe(path.join(dist, '_astro/a.css'));
    expect(sitePath('/docs/', { dist, base: '/docs/' })).toBe(dist);
    expect(sitePath('/a%20b.png', { dist })).toBe(path.join(dist, 'a b.png'));
  });
  it('ignores external, data and relative urls and paths escaping dist', () => {
    for (const href of ['https://x/y.css', '//x/y.css', 'data:image/png;base64,AA', '#top', 'a.css', '', undefined]) expect(sitePath(href, { dist })).toBeNull();
    expect(sitePath('/../etc/passwd', { dist })).toBe(path.join(dist, 'etc/passwd'));
  });
});

describe('standaloneHtml', () => {
  const dist = tmpSite({
    '_astro/site.css': 'body{color:red}@font-face{font-family:F;src:url(/_astro/f.woff2) format("woff2"),url(/_astro/f.woff) format("woff"),url(/_astro/f.ttf) format("truetype")}',
    '_astro/ec.css': '.expressive-code{display:block}',
    '_astro/f.woff2': 'WOFF2',
    '_astro/f.woff': 'WOFF',
    'img/logo.png': 'PNG',
    'export/index.html': [
      '<!doctype html><html><head><title>Acme: decisions</title><link rel="stylesheet" href="/_astro/site.css"><style>.stk{mask:url(/img/logo.png)}</style><script>alert(1)</script></head>',
      '<body><header class="top">chrome</header>',
      MARK_START,
      '<div class="xp"><a href="/sre/adr/0001-x/">rec</a><a href="#r-1">toc</a><a href="https://e.x/">ext</a>',
      '<img src="/img/logo.png" srcset="/img/logo.png 2x" alt=""><div class="expressive-code"><link rel="stylesheet" href="/_astro/ec.css"><script type="module" src="/_astro/ec.js"></script><pre>code</pre></div>',
      '<pre class="mermaid">graph TD</pre><script>print()</script></div>',
      MARK_END,
      '<footer class="foot">foot</footer></body></html>',
    ].join('\n'),
  });
  const html = fs.readFileSync(path.join(dist, 'export/index.html'), 'utf8');

  it('finds files and inlines css urls', () => {
    expect(assetFile('/_astro/site.css', { dist })).toBe(path.join(dist, '_astro/site.css'));
    expect(assetFile('/_astro/missing.css', { dist })).toBeNull();
    const css = inlineCssUrls(fs.readFileSync(path.join(dist, '_astro/site.css'), 'utf8'), { dist });
    expect(css).toContain('url(data:font/woff2;base64,V09GRjI=) format("woff2")');
    expect(css).not.toContain('f.woff)');
    expect(css).not.toContain('f.ttf');
  });

  it('extracts the document between the marks', () => {
    expect(extractDocument(html)).toMatch(/^<div class="xp">[\s\S]*<\/div>$/);
    expect(extractDocument('<html>no marks</html>')).toBeNull();
  });

  it('writes one file with styles, fonts and images inlined and no scripts', () => {
    const out = standaloneHtml(html, { dist, siteUrl: 'https://decisions.acme.example' });
    expect(out).toContain('<title>Acme: decisions</title>');
    expect(out).toContain('data-theme="light"');
    expect(out).toContain('body{color:red}');
    expect(out).toContain('.expressive-code{display:block}');
    expect(out).toContain('.stk{mask:url(data:image/png;base64,UE5H)}');
    expect(out).toContain('<img src="data:image/png;base64,UE5H" alt="">');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<link');
    expect(out).not.toContain('class="top"');
    expect(out).not.toContain('class="foot"');
    expect(out).toContain('href="https://decisions.acme.example/sre/adr/0001-x/"');
    expect(out).toContain('href="#r-1"');
    expect(out).toContain('href="https://e.x/"');
    expect(out).toContain('<pre class="mermaid">graph TD</pre>');
  });

  it('keeps site links relative without a site url', () => {
    expect(standaloneHtml(html, { dist })).toContain('href="/sre/adr/0001-x/"');
  });

  it('rejects a page without marks', () => {
    expect(() => standaloneHtml('<html><head></head><body></body></html>', { dist })).toThrow(/export page/);
  });
});

describe('pdfPageCount', () => {
  it('counts page objects', () => {
    expect(pdfPageCount(Buffer.from('1 0 obj << /Type /Pages /Kids [] >> 2 0 obj << /Type /Page /Parent 1 0 R >> 3 0 obj << /Type/Page >>'))).toBe(2);
  });
});
