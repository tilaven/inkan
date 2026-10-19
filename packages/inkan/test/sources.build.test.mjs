import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bareRepo, configModule, tmpSite } from './helpers.mjs';

const cli = fileURLToPath(new URL('../bin/cli.mjs', import.meta.url));
const record = (title, extra = '') => `---\ntitle: ${title}\nstatus: accepted\ndate: 2026-01-02\n${extra}---\n## Context\n${title}\n`;

describe('build with sources', () => {
  it('fetches a repo source on its own and shows its records as a project', { timeout: 180_000 }, () => {
    // The service repo keeps the hub's own layout one level down (`docs/decisions/<project>/<type>`).
    const { remote } = bareRepo({
      'docs/decisions/checkout/_project.yml': 'name: Checkout\ndescription: From the service repo.\n',
      'docs/decisions/checkout/adr/0001-first.md': record('First', 'tags: [edge]\n') + '\nSee [the second](./0002-second.md) and ![flow](./flow.svg).\n',
      'docs/decisions/checkout/adr/0002-second.md': record('Second'),
      'docs/decisions/checkout/adr/flow.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    });
    const root = tmpSite({
      'inkan.config.mjs': configModule(`{ search: { enabled: false }, sources: [{ project: 'checkout', repo: ${JSON.stringify(remote)} }] }`),
      'decisions/sre/_project.yml': 'name: SRE\n',
      'decisions/sre/adr/0001-slos.md': record('SLOs', 'related: [checkout/adr/0001-first]\n'),
    });
    const offline = spawnSync(process.execPath, [cli, 'build', '--offline', '--root', root], { encoding: 'utf8' });
    expect(offline.status).toBe(1);
    expect(offline.stderr).toContain('--offline: no cached copy of source checkout; run `inkan sync` first');

    const build = spawnSync(process.execPath, [cli, 'build', '--root', root], { encoding: 'utf8' });
    expect(build.status, build.stderr + build.stdout).toBe(0);
    expect(build.stdout).toMatch(/sync: checkout ← .*remote\.git docs\/decisions @ [0-9a-f]{7}: 2 records/);

    const dist = path.join(root, 'dist');
    const read = (f) => fs.readFileSync(path.join(dist, f), 'utf8');
    const page = read('checkout/adr/0001-first/index.html');
    expect(page).toContain('href="/checkout/adr/0002-second/"');
    expect(page).toMatch(/src="\/_astro\/flow\.[^"]+\.svg"/);
    expect(page).toContain('CHECKOUT-ADR-0001');
    expect(read('checkout/index.html')).toContain('From the service repo.');
    expect(read('decisions/index.html')).toContain('Checkout');
    const json = JSON.parse(read('decisions.json'));
    const first = json.find((d) => d.id === 'checkout/adr/0001-first');
    expect(first).toMatchObject({ project: 'checkout', ref: 'CHECKOUT-ADR-0001', source: `${remote} docs/decisions/checkout/adr/0001-first.md` });
    expect(json.find((d) => d.id === 'sre/adr/0001-slos').source).toBe('decisions/sre/adr/0001-slos.md');
    expect(read('llms.txt')).toContain('## Checkout (checkout)');
  });
});
