import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { run as status } from '../lib/commands/status.mjs';
import { run as supersede } from '../lib/commands/supersede.mjs';
import { diffLines } from '../lib/lifecycle.mjs';
import { parseFrontMatter } from '../lib/records.mjs';
import { configModule, tmpSite } from './helpers.mjs';

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'cli.mjs');
const runCli = (args, cwd) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });

const record = (title, extra = '') => `---\n# keep me\ntitle: "${title}"\nstatus: proposed\ndate: 2024-01-01\nauthors: [kim]\n${extra}---\n\n## Context\n\nText.\n`;

function site(config) {
  const root = tmpSite({
    ...(config ? { 'inkan.config.mjs': configModule(config) } : {}),
    'decisions/sre/_project.yml': 'name: SRE\n',
    'decisions/sre/adr/0001-use-slos.md': record('Use SLOs'),
    'decisions/sre/adr/0002-use-slis.md': record('Use SLIs'),
    'decisions/payments/_project.yml': 'name: Payments\n',
    'decisions/payments/adr/0001-ledger.md': record('Ledger', 'supersedes: [sre/adr/0001-use-slos]\n'),
  });
  const read = (f) => fs.readFileSync(path.join(root, 'decisions', f), 'utf8');
  const log = [];
  return { root, read, log, logger: (l) => log.push(l) };
}

describe('inkan status', () => {
  it('changes the status and keeps the file as written', async () => {
    const { root, read, log, logger } = site();
    expect(await status({ args: ['sre/adr/1', 'accepted'], flags: {}, root, log: logger })).toBe(0);
    const text = read('sre/adr/0001-use-slos.md');
    expect(text).toContain('# keep me');
    expect(text).toContain('title: "Use SLOs"');
    expect(parseFrontMatter(text).data).toMatchObject({ status: 'accepted', date: '2024-01-01' });
    expect(text.endsWith('---\n\n## Context\n\nText.\n')).toBe(true);
    expect(log).toEqual(['sre/adr/0001-use-slos: proposed -> accepted']);
  });

  it('accepts refs and paths, sets the date on --date and reports a no-op', async () => {
    const { root, read, log, logger } = site();
    await status({ args: ['SRE-ADR-0002', 'rejected'], flags: { date: true }, root, log: logger });
    const today = new Date().toISOString().slice(0, 10);
    expect(parseFrontMatter(read('sre/adr/0002-use-slis.md')).data).toMatchObject({ status: 'rejected', date: today });
    await status({ args: [path.join(root, 'decisions/sre/adr/0002-use-slis.md'), 'rejected'], flags: {}, root, log: logger });
    expect(log).toEqual([`sre/adr/0002-use-slis: proposed -> rejected (date ${today})`, 'sre/adr/0002-use-slis: already rejected']);
  });

  it('writes the day given to --date and rejects dates that are not days', async () => {
    const { root, read, log, logger } = site();
    await status({ args: ['sre/adr/1', 'accepted'], flags: { date: '2020-01-31' }, root, log: logger });
    expect(parseFrontMatter(read('sre/adr/0001-use-slos.md')).data).toMatchObject({ status: 'accepted', date: '2020-01-31' });
    expect(log).toEqual(['sre/adr/0001-use-slos: proposed -> accepted (date 2020-01-31)']);
    for (const date of ['2020-02-30', '31/01/2020', 'yesterday']) {
      await expect(status({ args: ['sre/adr/2', 'accepted'], flags: { date }, root, log: logger })).rejects.toThrow('--date must be a date like 2026-10-17.');
    }
    expect(parseFrontMatter(read('sre/adr/0002-use-slis.md')).data.status).toBe('proposed');
  });

  it('refuses a --date value that is not a day and arguments it does not expect, from the command line', () => {
    const { root, read } = site();
    for (const args of [['--date', 'yesterday'], ['--date', '31/01/2020'], ['--date=2020-02-30'], ['extra'], ['--date', '2020-01-01', 'extra']]) {
      const r = runCli(['status', 'sre/adr/1', 'accepted', ...args], root);
      expect(r.status, args.join(' ')).toBe(1);
      expect(r.stderr).toMatch(/--date must be a date like|Usage: inkan status/);
    }
    expect(parseFrontMatter(read('sre/adr/0001-use-slos.md')).data).toMatchObject({ status: 'proposed', date: '2024-01-01' });
    expect(runCli(['status', 'sre/adr/1', 'accepted', '--date', '2020-01-01', '--dry-run'], root).stdout).toContain('+ date: 2020-01-01');
    expect(runCli(['supersede', 'sre/adr/1', 'sre/adr/2', '--date', 'soon', '--dry-run'], root).status).toBe(1);
    expect(runCli(['supersede', 'sre/adr/1', 'sre/adr/2', 'extra', '--dry-run'], root).status).toBe(1);
  });

  it('prints a diff and writes nothing with --dry-run', async () => {
    const { root, read, log, logger } = site();
    await status({ args: ['sre/adr/0001-use-slos', 'accepted'], flags: { 'dry-run': true }, root, log: logger });
    expect(read('sre/adr/0001-use-slos.md')).toContain('status: proposed');
    expect(log[0]).toContain('- status: proposed\n+ status: accepted');
    expect(log[1]).toBe('sre/adr/0001-use-slos: proposed -> accepted [dry run]');
  });

  it('rejects unknown statuses and records with a hint', async () => {
    const { root, logger } = site();
    await expect(status({ args: ['sre/adr/1', 'acepted'], flags: {}, root, log: logger })).rejects.toThrow('Did you mean "accepted"?');
    await expect(status({ args: ['sre/adr/9', 'accepted'], flags: {}, root, log: logger })).rejects.toThrow('No record matches "sre/adr/9"');
    await expect(status({ args: ['sre/adr/1'], flags: {}, root, log: logger })).rejects.toThrow('Usage');
    const custom = site(`{ statuses: { live: { label: 'Live', current: true } } }`);
    await expect(status({ args: ['sre/adr/1', 'accepted'], flags: {}, root: custom.root, log: custom.logger })).rejects.toThrow('Known: live.');
  });
});

describe('inkan supersede', () => {
  it('links both records across projects and is idempotent', async () => {
    const { root, read, log, logger } = site();
    expect(await supersede({ args: ['sre/adr/2', 'payments/adr/1'], flags: {}, root, log: logger })).toBe(0);
    expect(parseFrontMatter(read('sre/adr/0002-use-slis.md')).data).toMatchObject({ status: 'superseded', supersededBy: ['payments/adr/0001-ledger'] });
    expect(parseFrontMatter(read('payments/adr/0001-ledger.md')).data.supersedes).toEqual(['sre/adr/0001-use-slos', 'sre/adr/0002-use-slis']);
    expect(read('payments/adr/0001-ledger.md')).toContain('supersedes: [sre/adr/0001-use-slos, sre/adr/0002-use-slis]');
    expect(log).toEqual([
      'sre/adr/0002-use-slis: proposed -> superseded, supersededBy += payments/adr/0001-ledger',
      'payments/adr/0001-ledger: supersedes += sre/adr/0002-use-slis',
    ]);
    const before = read('sre/adr/0002-use-slis.md') + read('payments/adr/0001-ledger.md');
    await supersede({ args: ['sre/adr/2', 'payments/adr/1'], flags: {}, root, log: logger });
    expect(read('sre/adr/0002-use-slis.md') + read('payments/adr/0001-ledger.md')).toBe(before);
    expect(log.slice(2)).toEqual(['sre/adr/0002-use-slis: already superseded by payments/adr/0001-ledger', 'payments/adr/0001-ledger: already supersedes sre/adr/0002-use-slis']);
  });

  it('stamps the date on the superseded record with --date', async () => {
    const { root, read, log, logger } = site();
    const today = new Date().toISOString().slice(0, 10);
    await supersede({ args: ['sre/adr/1', 'sre/adr/2'], flags: { date: true }, root, log: logger });
    expect(parseFrontMatter(read('sre/adr/0001-use-slos.md')).data).toMatchObject({ status: 'superseded', date: today });
    expect(parseFrontMatter(read('sre/adr/0002-use-slis.md')).data.date).toBe('2024-01-01');
    expect(log[0]).toBe(`sre/adr/0001-use-slos: proposed -> superseded, supersededBy += sre/adr/0002-use-slis (date ${today})`);
    await supersede({ args: ['payments/adr/1', 'sre/adr/2'], flags: { date: '2025-06-01' }, root, log: logger });
    expect(parseFrontMatter(read('payments/adr/0001-ledger.md')).data.date).toBe('2025-06-01');
    await expect(supersede({ args: ['sre/adr/1', 'sre/adr/2'], flags: { date: 'soon' }, root, log: logger })).rejects.toThrow('--date must be a date');
  });

  it('refuses the same record, keeps the status when "superseded" is not configured and honours --dry-run', async () => {
    const { root, logger } = site();
    await expect(supersede({ args: ['sre/adr/1', 'SRE-ADR-0001'], flags: {}, root, log: logger })).rejects.toThrow('cannot supersede itself');
    const custom = site(`{ statuses: { proposed: { label: 'P', open: true }, live: { label: 'Live', current: true } } }`);
    await supersede({ args: ['sre/adr/1', 'sre/adr/2'], flags: {}, root: custom.root, log: custom.logger });
    expect(parseFrontMatter(custom.read('sre/adr/0001-use-slos.md')).data).toMatchObject({ status: 'proposed', supersededBy: ['sre/adr/0002-use-slis'] });
    const dry = site();
    await supersede({ args: ['sre/adr/1', 'sre/adr/2'], flags: { 'dry-run': true }, root: dry.root, log: dry.logger });
    expect(dry.read('sre/adr/0001-use-slos.md')).not.toContain('supersededBy');
    expect(dry.read('sre/adr/0002-use-slis.md')).not.toContain('supersedes');
    expect(dry.log.filter((l) => l.startsWith('---'))).toHaveLength(2);
  });
});

describe('diffLines', () => {
  it('lists removed lines before added ones', () => {
    expect(diffLines('a\nb\nc', 'a\nx\nc\nd', 'f')).toBe('--- f\n- b\n+ x\n+ d');
  });
});
