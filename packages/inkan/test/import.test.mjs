import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectFormat, mapStatus, run as importRecords, parseSource } from '../lib/commands/import.mjs';
import { defaults } from '../lib/defaults.mjs';
import { parseFrontMatter } from '../lib/records.mjs';
import { tmpSite } from './helpers.mjs';

const fixtures = path.join(import.meta.dirname, 'fixtures', 'import');

async function importInto(root, inputs, flags = {}) {
  const log = [];
  const warnings = [];
  const code = await importRecords({ args: inputs, flags: { project: 'legacy', ...flags }, root, log: (l) => log.push(l), warn: (w) => warnings.push(w) });
  const dir = path.join(root, 'decisions', 'legacy', flags.type ?? 'adr');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
  const read = (name) => parseFrontMatter(fs.readFileSync(path.join(dir, name), 'utf8'));
  return { code, log, warnings, dir, files, read };
}

describe('inkan import', () => {
  it('converts log4brains records: header list, date-numbered files, status links and body links', async () => {
    const root = tmpSite();
    const { code, files, read, log, warnings } = await importInto(root, [path.join(fixtures, 'log4brains')]);
    expect(code).toBe(0);
    expect(files).toEqual(['0001-use-log4brains-to-manage-the-adrs.md', '0002-use-markdown-architectural-decision-records.md']);
    const first = read(files[0]);
    expect(first.data).toEqual({
      title: 'Use Log4brains to manage the ADRs',
      status: 'superseded',
      date: '2020-09-27',
      deciders: ['jdoe', 'Jane Roe'],
      tags: ['tooling', 'docs'],
      supersededBy: ['legacy/adr/0002-use-markdown-architectural-decision-records'],
    });
    expect(first.body.startsWith('Technical Story: [ARCH-12](https://issues.example.com/ARCH-12)\n\n## Context and Problem Statement\n')).toBe(true);
    expect(first.body).not.toMatch(/^- (Status|Deciders|Date|Tags):/m);
    expect(first.body).toContain('[Log4brains](https://github.com/thomvaill/log4brains)');
    const second = read(files[1]);
    expect(second.data).toEqual({ title: 'Use Markdown Architectural Decision Records', status: 'accepted', date: '2020-10-12', deciders: ['jdoe'] });
    expect(second.body).toContain('[the first ADR](./0001-use-log4brains-to-manage-the-adrs.md)');
    expect(fs.readFileSync(path.join(root, 'decisions/legacy/_project.yml'), 'utf8')).toContain('name: legacy');
    expect(log.filter((l) => l.startsWith('Skipped'))).toEqual([expect.stringContaining('notes.md: no heading')]);
    expect(log.at(-1)).toMatch(/^Imported 2 records into .*legacy[\\/]adr, skipped 1\.$/);
    expect(warnings).toEqual([]);
  });

  it('converts MADR 3/4 front matter and keeps original numbers', async () => {
    const root = tmpSite();
    const { files, read, warnings } = await importInto(root, [path.join(fixtures, 'madr')], { format: 'madr' });
    expect(files).toEqual(['0001-use-markdown-architectural-decision-records.md', '0002-use-yaml-for-config.md', '0003-use-toml-for-config.md']);
    expect(read(files[0]).data).toEqual({
      title: 'Use Markdown Architectural Decision Records',
      status: 'accepted',
      date: '2023-03-01',
      deciders: ['Ada', 'Grace'],
      consulted: ['Linus'],
      informed: ['team-platform', 'team-sre'],
    });
    expect(read(files[0]).body.startsWith('## Context and Problem Statement')).toBe(true);
    expect(read(files[1]).data).toMatchObject({ status: 'superseded', deciders: ['Ada'], supersededBy: ['legacy/adr/0003-use-toml-for-config'] });
    const third = read(files[2]);
    expect(third.data).toEqual({ title: 'Use TOML for config: fewer surprises', status: 'accepted', date: '2023-06-10' });
    expect(third.body).toContain('[ADR-0002](./0002-use-yaml-for-config.md#decision-outcome)');
    expect(warnings).toEqual([]);
  });

  it('converts adr-tools records and drops the Status section', async () => {
    const root = tmpSite();
    const { files, read } = await importInto(root, [path.join(fixtures, 'adr-tools')]);
    expect(files).toEqual(['0001-record-architecture-decisions.md', '0002-use-postgres.md', '0003-use-cockroachdb.md']);
    const first = read(files[0]);
    expect(first.data).toEqual({ title: 'Record architecture decisions', status: 'accepted', date: '2016-02-12' });
    expect(first.body).not.toContain('## Status');
    expect(first.body).not.toContain('Date:');
    expect(first.body.startsWith('## Context\n')).toBe(true);
    expect(read(files[1]).data).toMatchObject({ status: 'superseded', supersededBy: ['legacy/adr/0003-use-cockroachdb'] });
    const third = read(files[2]);
    expect(third.data).toMatchObject({ status: 'accepted', supersedes: ['legacy/adr/0002-use-postgres'] });
    expect(third.body).toContain('[2. Use Postgres](./0002-use-postgres.md)');
    expect(third.body).not.toContain('Supersedes [');
  });

  it('renumbers clashes, never overwrites, skips re-imports and respects --dry-run and --type', async () => {
    const root = tmpSite({
      'decisions/legacy/_project.yml': 'name: Legacy\n',
      'decisions/legacy/adr/0001-already-here.md': '---\ntitle: Already here\n---\nbody\n',
      'decisions/legacy/adr/0002-use-postgres.md': '---\ntitle: Mine\n---\nbody\n',
    });
    const dry = await importInto(root, [path.join(fixtures, 'adr-tools')], { 'dry-run': true });
    expect(dry.files).toEqual(['0001-already-here.md', '0002-use-postgres.md']);
    expect(dry.log.filter((l) => l.startsWith('Would write'))).toHaveLength(2);

    const { files, read, log } = await importInto(root, [path.join(fixtures, 'adr-tools')]);
    expect(files).toEqual(['0001-already-here.md', '0002-use-postgres.md', '0003-use-cockroachdb.md', '0004-record-architecture-decisions.md']);
    expect(fs.readFileSync(path.join(root, 'decisions/legacy/adr/0002-use-postgres.md'), 'utf8')).toContain('title: Mine');
    expect(log).toContainEqual(expect.stringContaining('0002-use-postgres.md: already imported as 0002-use-postgres.md'));
    expect(read('0003-use-cockroachdb.md').data.supersedes).toBeUndefined();
    expect(read('0003-use-cockroachdb.md').body).toContain('[2. Use Postgres](0002-use-postgres.md)');

    const again = await importInto(root, [path.join(fixtures, 'adr-tools')]);
    expect(again.files).toEqual(files);
    expect(again.log.at(-1)).toMatch(/^Imported 0 records/);

    const rfc = await importInto(root, [path.join(fixtures, 'madr', '0003-use-toml-for-config.md')], { type: 'rfc' });
    expect(rfc.files).toEqual(['0003-use-toml-for-config.md']);
    expect(rfc.read(rfc.files[0]).data.status).toBe('accepted');
  });

  it('warns about links outside the import and unknown statuses', async () => {
    const root = tmpSite({ 'inkan.config.mjs': `export default { statuses: { live: { label: 'Live', current: true }, old: { label: 'Old' } } };\n` });
    const { read, warnings, files } = await importInto(root, [path.join(fixtures, 'adr-tools', '0002-use-postgres.md')]);
    expect(files).toEqual(['0002-use-postgres.md']);
    expect(read(files[0]).data).toEqual({ title: 'Use Postgres', date: '2016-03-01' });
    expect(warnings).toEqual([
      expect.stringContaining('status "Superseded by [3. Use CockroachDB](0003-use-cockroachdb.md)" is not configured'),
      expect.stringContaining('superseded by link "0003-use-cockroachdb.md" points outside this import'),
    ]);
  });

  it('imports into an existing folder named by its slug', async () => {
    const root = tmpSite({ 'decisions/Legacy Ops/_project.yml': 'name: Legacy Ops\n' });
    await importRecords({ args: [path.join(fixtures, 'adr-tools')], flags: { project: 'legacy-ops' }, root, log: () => {}, warn: () => {} });
    expect(fs.readdirSync(path.join(root, 'decisions'))).toEqual(['Legacy Ops']);
    const file = path.join(root, 'decisions/Legacy Ops/adr/0003-use-cockroachdb.md');
    expect(parseFrontMatter(fs.readFileSync(file, 'utf8')).data.supersedes).toEqual(['legacy-ops/adr/0002-use-postgres']);
    await expect(importRecords({ args: [fixtures], flags: { project: 'New Team' }, root })).rejects.toThrow('Invalid project name "New Team"');
  });

  it('validates its arguments', async () => {
    const root = tmpSite();
    await expect(importRecords({ args: [], flags: { project: 'x' }, root })).rejects.toThrow('Usage');
    await expect(importRecords({ args: [fixtures], flags: {}, root })).rejects.toThrow('Usage');
    await expect(importRecords({ args: [fixtures], flags: { project: 'x', format: 'nope' }, root })).rejects.toThrow('Unknown format "nope"');
    await expect(importRecords({ args: [fixtures], flags: { project: 'x', type: 'pm' }, root })).rejects.toThrow('Unknown type "pm"');
    await expect(importRecords({ args: ['missing-dir'], flags: { project: 'x' }, root })).rejects.toThrow('no such file or folder');
  });
});

describe('parseSource / detectFormat / mapStatus', () => {
  it('detects the dialect per file', () => {
    expect(detectFormat('# 1. X\n\nDate: 2020-01-01\n\n## Status\n\nAccepted\n')).toBe('adr-tools');
    expect(detectFormat('# X\n\n* Status: accepted\n\n## Context\n')).toBe('madr');
  });

  it('uses the front-matter title when the heading is missing and skips files without either', () => {
    expect(parseSource('---\ntitle: From YAML\n---\nText\n', 'madr')).toMatchObject({ title: 'From YAML', body: 'Text\n' });
    expect(parseSource('No heading here\n', 'madr')).toBeNull();
  });

  it('maps statuses with synonyms and typos, only onto configured ones', () => {
    expect(mapStatus('Accepted', defaults.statuses)).toBe('accepted');
    expect(mapStatus('superseded by [x](y.md)', defaults.statuses)).toBe('superseded');
    expect(mapStatus('Approved', defaults.statuses)).toBe('accepted');
    expect(mapStatus('acepted', defaults.statuses)).toBe('accepted');
    expect(mapStatus('{proposed | rejected}', defaults.statuses)).toBeUndefined();
    expect(mapStatus('Approved', { live: { label: 'Live' } })).toBeUndefined();
  });
});

describe('inkan import edge cases', () => {
  it('keeps a leading --- rule in the body', async () => {
    const src = tmpSite({ 'in/0001-queues.md': '# Use queues\n\n---\nContext: we need queues\n---\n\nThe rest.\n' });
    const root = tmpSite({ 'decisions/.keep': '' });
    await importRecords({ args: [path.join(src, 'in')], flags: { project: 'legacy' }, root, log: () => {}, warn: () => {} });
    const [file] = fs.readdirSync(path.join(root, 'decisions/legacy/adr'));
    const { data, body } = parseFrontMatter(fs.readFileSync(path.join(root, 'decisions/legacy/adr', file), 'utf8'));
    expect(data.Context).toBeUndefined();
    expect(body).toContain('Context: we need queues');
  });

  it('refuses project names that are not folder names', async () => {
    const root = tmpSite({ 'decisions/.keep': '' });
    await expect(importRecords({ args: ['x'], flags: { project: '../x' }, root, log: () => {}, warn: () => {} })).rejects.toThrow('Invalid project name');
  });
});
