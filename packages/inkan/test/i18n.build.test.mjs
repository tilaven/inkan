import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import en from '../lib/i18n/en.mjs';
import { configModule, tmpSite } from './helpers.mjs';

const cli = fileURLToPath(new URL('../bin/cli.mjs', import.meta.url));

describe('build in Polish', () => {
  it('renders the interface, dates and Markdown labels in the configured language', { timeout: 180_000 }, () => {
    const root = tmpSite({
      'inkan.config.mjs': configModule(`{ locale: 'pl', search: { enabled: false }, translations: { pl: { 'nav.timeline': 'Kalendarium' } } }`),
      'decisions/sre/_project.yml': 'name: SRE\n',
      'decisions/sre/adr/0001-slos.md': '---\ntitle: SLO\nstatus: accepted\ndate: 2026-03-02\nreviewBy: 2026-05-01\nreviewEvery: 1 year\n---\n> [!WARNING]\n> Uwaga.\n\n- [x] gotowe\n',
      'decisions/sre/adr/0002-alerts.md': '---\ntitle: Alerty\nstatus: proposed\ndate: 2026-03-04\n---\nTreść.\n',
    });
    const build = spawnSync(process.execPath, [cli, 'build', '--root', root], { encoding: 'utf8' });
    expect(build.status, build.stderr + build.stdout).toBe(0);

    const read = (f) => fs.readFileSync(path.join(root, 'dist', f), 'utf8');
    const pages = ['index.html', 'decisions/index.html', 'timeline/index.html', 'backlog/index.html', 'reviews/index.html', 'graph/index.html', 'sre/adr/0001-slos/index.html', 'export/index.html'];
    for (const page of pages) {
      const html = read(page);
      expect(html, page).toContain('<html lang="pl"');
      expect(html, page).toContain('Kalendarium');
      for (const key of Object.keys(en)) expect(html, `${page}: ${key}`).not.toMatch(new RegExp(`[>"]${key.replace(/\./g, '\\.')}[<"]`));
    }
    const record = read('sre/adr/0001-slos/index.html');
    expect(record).toContain('Przyjęty');
    expect(read('index.html')).toContain('Archiwum decyzji');
    expect(record).toContain('Ostrzeżenie');
    expect(record).toContain('aria-label="Zrobione"');
    expect(read('decisions/index.html')).toContain('Wszystkie decyzje');
    expect(read('timeline/index.html')).toMatch(/>mar<.*marzec \d{4}</);
    expect(read('export/index.html')).toContain('Inkan: decyzje');
    expect(read('reviews/index.html')).toContain('Do przeglądu');
    expect(record).toContain('Następny przegląd');
    expect(read('graph/index.html')).toContain('Nic nie jest jeszcze powiązane');
  });
});
