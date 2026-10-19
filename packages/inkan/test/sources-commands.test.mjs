import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatAnnotations } from '../lib/check.mjs';
import { run as check } from '../lib/commands/check.mjs';
import { run as importRecords } from '../lib/commands/import.mjs';
import { run as status } from '../lib/commands/status.mjs';
import { run as supersede } from '../lib/commands/supersede.mjs';
import { loadConfig } from '../lib/config.mjs';
import { loadRecords } from '../lib/records.mjs';
import { syncSources } from '../lib/sources.mjs';
import { bareRepo, configModule, tmpSite } from './helpers.mjs';

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'cli.mjs');
const record = (title, extra = '') => `---\ntitle: ${title}\nstatus: proposed\n${extra}---\n\nBody.\n`;
const noop = () => {};

describe('records from a repo source', () => {
  async function siteWithSource() {
    const { remote } = bareRepo({ 'docs/decisions/adr/0001-remote.md': record('Remote', 'authors: [ghost]\n') });
    const root = tmpSite({
      'inkan.config.mjs': configModule(`{ sources: [{ project: 'checkout', repo: ${JSON.stringify(remote)} }] }`),
      'decisions/_authors.yml': '- id: ania\n  name: Ania\n',
      'decisions/sre/_project.yml': 'name: SRE\nowners: [ania]\n',
      'decisions/sre/adr/0001-local.md': record('Local', 'authors: [ania]\n'),
    });
    return { root, remote, config: await loadConfig(root) };
  }

  it('status and supersede refuse to edit the read-only clone', async () => {
    const { root, config } = await siteWithSource();
    await syncSources(config, { log: noop });
    const file = loadRecords(await loadConfig(root)).find((r) => r.project === 'checkout').file;
    const before = fs.readFileSync(file, 'utf8');
    await expect(status({ args: ['checkout/adr/1', 'accepted'], flags: {}, root, log: noop })).rejects.toThrow(/comes from the "checkout" source.*change it in that repository/);
    await expect(supersede({ args: ['sre/adr/1', 'checkout/adr/1'], flags: {}, root, log: noop })).rejects.toThrow(/"checkout" source/);
    await expect(supersede({ args: ['checkout/adr/1', 'sre/adr/1'], flags: {}, root, log: noop })).rejects.toThrow(/"checkout" source/);
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
    expect(fs.readFileSync(path.join(root, 'decisions/sre/adr/0001-local.md'), 'utf8')).not.toContain('supersede');
  });

  it('check fetches a missing clone instead of reporting missing records, and skips author/project rules for it', async () => {
    const { root } = await siteWithSource();
    fs.appendFileSync(path.join(root, 'decisions/sre/adr/0001-local.md'), '');
    fs.writeFileSync(path.join(root, 'decisions/sre/adr/0002-link.md'), record('Link', 'related: [checkout/adr/0001-remote]\nauthors: [ania]\n'));
    const out = [];
    const log = console.log;
    console.log = (l) => out.push(l);
    const err = console.error;
    console.error = noop;
    let code;
    try {
      code = await check({ flags: {}, root });
    } finally {
      console.log = log;
      console.error = err;
    }
    expect(out.join('\n')).not.toMatch(/ghost|missing-record|does not exist|no owners|_project\.yml/);
    expect(code).toBe(0);
  });

  it('does not annotate files outside the workspace or in node_modules', () => {
    const problems = [
      { level: 'error', rule: 'x', message: 'm', file: '/ws/decisions/a.md' },
      { level: 'error', rule: 'x', message: 'm', file: '/ws/node_modules/.inkan/sources/c/a.md' },
      { level: 'error', rule: 'x', message: 'm', file: '/elsewhere/a.md' },
    ];
    expect(formatAnnotations(problems, { workspace: '/ws' })).toHaveLength(1);
  });
});

describe('names that belong to a source', () => {
  const sourceConfig = configModule(`{ sources: [{ project: 'checkout', dir: './other' }] }`);

  it('import refuses a project named like a source', async () => {
    const root = tmpSite({ 'inkan.config.mjs': sourceConfig, 'other/docs/decisions/adr/0001-x.md': record('X'), 'old/0001-y.md': '# 1. Y\n\nDate: 2024-01-01\n\n## Status\n\nAccepted\n' });
    await expect(importRecords({ args: ['old'], flags: { project: 'checkout' }, root, log: noop, warn: noop })).rejects.toThrow(/"checkout" is fetched from a source/);
    expect(fs.existsSync(path.join(root, 'decisions/checkout'))).toBe(false);
  });

  it('new refuses a project named like a source', () => {
    const root = tmpSite({ 'inkan.config.mjs': sourceConfig, 'other/docs/decisions/adr/0001-x.md': record('X') });
    const r = spawnSync(process.execPath, [cli, 'new', 'adr', 'checkout', 'Something', '--root', root], { encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/"checkout" is fetched from a source/);
    expect(fs.existsSync(path.join(root, 'decisions/checkout'))).toBe(false);
  });
});
