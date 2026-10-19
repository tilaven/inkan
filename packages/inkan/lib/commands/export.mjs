/**
 * inkan export [--out decisions.html] [--pdf] [--no-build]
 * One self-contained HTML file (or, with --pdf, an A4 PDF) of every current decision, built from the site's /export/ page.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { loadConfig, packageDir } from '../config.mjs';
import { exportTitle, mimeType, pdfPageCount, sitePath, standaloneHtml } from '../export.mjs';

const MERMAID_TIMEOUT = 30_000;
const INSTALL_HINT = 'Install it with `npx playwright-core install chromium`, or point PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH at a Chrome/Chromium binary.';
const PACKAGE_HINT = 'Install the optional dependency with `npm install playwright-core`, then a browser with `npx playwright-core install chromium`.';

export async function run({ flags, root }) {
  const config = await loadConfig(root);
  const cwd = process.cwd();
  const pdf = flags.pdf === true || /\.pdf$/i.test(String(flags.out ?? ''));
  const out = path.resolve(String(flags.out ?? (pdf ? 'decisions.pdf' : 'decisions.html')));
  const dist = path.join(config.root, 'dist');
  const base = config.base || '/';

  if (flags['no-build']) {
    if (!fs.existsSync(path.join(dist, 'export/index.html'))) throw new Error(`No built export page in ${dist}. Run \`inkan build\` first or drop --no-build.`);
  } else {
    process.env.INKAN_ROOT = config.root;
    // Astro keeps build scratch files under the working directory; `--root` must work from anywhere.
    process.chdir(config.root);
    const { build } = await import('astro');
    await build({ root: path.join(packageDir, 'app'), logLevel: 'warn' });
  }

  const page = fs.readFileSync(path.join(dist, 'export/index.html'), 'utf8');
  const hasDiagrams = /<pre class="mermaid"/.test(page);
  const browser = pdf || hasDiagrams ? await launchChromium({ required: pdf }) : null;
  fs.mkdirSync(path.dirname(out), { recursive: true });

  if (!browser) {
    if (hasDiagrams) console.warn(`inkan: Chromium not found, Mermaid diagrams are left as source. ${INSTALL_HINT}`);
    fs.writeFileSync(out, standaloneHtml(page, { dist, base, siteUrl: config.url }));
    return done(out, cwd);
  }

  const server = await serve(dist, base);
  try {
    const tab = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
    await tab.goto(`${server.url}${base.replace(/\/$/, '')}/export/?theme=light`, { waitUntil: 'networkidle' });
    if (hasDiagrams) {
      await tab.waitForFunction(() => [...document.querySelectorAll('pre.mermaid')].every((p) => p.hasAttribute('data-processed')), null, { timeout: MERMAID_TIMEOUT });
    }
    await tab.evaluate(() => document.fonts.ready);
    if (pdf) {
      await tab.emulateMedia({ media: 'print' });
      const footer = `<div style="width:100%;margin:0 14mm;display:flex;justify-content:space-between;font:8px/1 ui-monospace,Menlo,monospace;color:#586279;letter-spacing:.06em;text-transform:uppercase"><span>${escapeHtml(exportTitle(config))}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
      const buffer = await tab.pdf({
        path: out,
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: footer,
        margin: { top: '16mm', right: '14mm', bottom: '18mm', left: '14mm' },
      });
      return done(out, cwd, `${pdfPageCount(buffer)} pages`);
    }
    const rendered = await tab.evaluate(() => document.documentElement.outerHTML);
    fs.writeFileSync(out, standaloneHtml(rendered, { dist, base, siteUrl: config.url }));
    return done(out, cwd);
  } finally {
    await browser.close();
    server.close();
  }
}

function done(out, cwd, extra) {
  const size = fs.statSync(out).size;
  console.log(`Wrote ${path.relative(cwd, out)} (${size > 1e6 ? `${(size / 1e6).toFixed(1)} MB` : `${Math.round(size / 1e3)} kB`}${extra ? `, ${extra}` : ''})`);
  return 0;
}

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Headless Chromium through playwright-core; null when the package or the browser is missing and not required. */
export async function launchChromium({ required, load = () => import('playwright-core') }) {
  let chromium;
  try {
    ({ chromium } = await load());
  } catch (e) {
    const notInstalled = e instanceof Error && 'code' in e && e.code === 'ERR_MODULE_NOT_FOUND' && /'playwright-core'/.test(e.message);
    if (!notInstalled) throw e;
    if (required) throw new Error(`playwright-core is needed for the PDF export but is not installed. ${PACKAGE_HINT}`);
    console.warn(`inkan: playwright-core is not installed, Mermaid diagrams are left as source. ${PACKAGE_HINT}`);
    return null;
  }
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
  try {
    return await chromium.launch({ executablePath });
  } catch (e) {
    const missing = /Executable doesn't exist|Failed to launch|ENOENT|not found/i.test(e instanceof Error ? e.message : String(e));
    if (!missing) throw e;
    if (required) throw new Error(`Chromium is needed for the PDF export but was not found. ${INSTALL_HINT}`);
    return null;
  }
}

/** Static server for the built site on a free port, so scripts and fonts load like on the deployed site. */
function serve(dist, base) {
  const server = http.createServer((req, res) => {
    let file = sitePath(req.url, { dist, base });
    if (file && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file || !fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': mimeType(file) });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
    });
  });
}
