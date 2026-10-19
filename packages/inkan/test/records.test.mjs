import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSite } from '../lib/check.mjs';
import { loadConfig } from '../lib/config.mjs';
import { resolveRecord } from '../lib/lifecycle.mjs';
import { findRecord, findRecords, loadAuthors, loadProjects, loadRecords, parseFrontMatter, slugify, updateFrontMatter, yamlScalar } from '../lib/records.mjs';
import { tmpSite } from './helpers.mjs';

describe('yamlScalar', () => {
  it('quotes values that would not read back as the same string', () => {
    for (const s of ['[RFC] Use queues', '"Quoted" title', '*Draft* Use X', '!important', 'a: b', 'yes', '#1 priority']) {
      expect(parseFrontMatter(`---\ntitle: ${yamlScalar(s)}\n---\n`).data.title).toBe(s);
    }
    expect(yamlScalar('Plain title')).toBe('Plain title');
  });
});

describe('findRecords', () => {
  const records = [
    { id: 'sre/adr/0001-a', file: '/x/a.md', project: 'sre', type: 'adr', number: 1, ref: 'SRE-ADR-0001' },
    { id: 'sre/adr/0001-b', file: '/x/b.md', project: 'sre', type: 'adr', number: 1, ref: 'SRE-ADR-0001' },
    { id: 'sre/adr/0002-c', file: '/x/c.md', project: 'sre', type: 'adr', number: 2, ref: 'SRE-ADR-0002' },
  ];

  it('reports every match, so duplicate numbers are ambiguous in any spelling', () => {
    for (const q of ['SRE-ADR-0001', 'sre/adr/1', 'sre/adr/0001']) {
      expect(findRecords(records, q)).toHaveLength(2);
      expect(findRecord(records, q)).toBeUndefined();
      expect(() => resolveRecord(records, q)).toThrow(/ambiguous: sre\/adr\/0001-a, sre\/adr\/0001-b/);
    }
    expect(resolveRecord(records, 'SRE-ADR-0002').id).toBe('sre/adr/0002-c');
  });
});

describe('project ids', () => {
  it('names a project after the slug its records get, whatever the folder is called', async () => {
    const root = tmpSite({
      'decisions/Ops Plans/_project.yml': 'name: Ops Plans\nreviewEvery: 6 months\n',
      'decisions/Ops Plans/adr/0001-plan.md': '---\ntitle: Plan\n---\n',
      'decisions/SRE/adr/0001-slos.md': '---\ntitle: SLOs\n---\n',
    });
    const config = await loadConfig(root);
    const projects = loadProjects(config);
    expect([...projects.keys()]).toEqual(['ops-plans', 'sre']);
    expect(projects.get('ops-plans')).toMatchObject({ folder: 'Ops Plans', dir: path.join(config.contentDir, 'Ops Plans'), data: { name: 'Ops Plans' } });
    const records = loadRecords(config);
    expect(records.map((r) => [r.id, r.project, r.ref])).toEqual([
      ['ops-plans/adr/0001-plan', 'ops-plans', 'OPS-PLANS-ADR-0001'],
      ['sre/adr/0001-slos', 'sre', 'SRE-ADR-0001'],
    ]);
    expect(findRecord(records, 'Ops Plans/adr/1')?.id).toBe('ops-plans/adr/0001-plan');
  });
});

describe('updateFrontMatter', () => {
  it('fills empty front matter', () => {
    expect(updateFrontMatter('---\n---\nbody\n', { status: 'accepted' })).toBe('---\nstatus: accepted\n---\nbody\n');
  });

  it('does not treat a leading --- rule as front matter', () => {
    const text = '---\nJust a rule above this text\n---\nmore\n';
    expect(parseFrontMatter(text).body).toBe(text);
    expect(updateFrontMatter(text, { status: 'accepted' })).toBe(`---\nstatus: accepted\n---\n${text}`);
  });

  it('names the file when the YAML does not parse', () => {
    expect(() => updateFrontMatter('---\ntitle: a\ntitle: b\n---\n', { status: 'x' }, 'sre/adr/1')).toThrow('sre/adr/1: front matter does not parse');
    expect(() => updateFrontMatter('---\ntitle: [a\n---\n', { status: 'x' }, 'f.md')).toThrow('f.md: front matter does not parse');
  });

  it('keeps CRLF line endings', () => {
    const out = updateFrontMatter('---\r\ntitle: A\r\n---\r\n\r\nBody\r\n', { status: 'accepted', tags: ['a', 'b'] });
    expect(out).toBe('---\r\ntitle: A\r\nstatus: accepted\r\ntags: [a, b]\r\n---\r\n\r\nBody\r\n');
    expect(out.replace(/\r\n/g, '')).not.toContain('\n');
  });
});

describe('shared helpers', () => {
  it('slugify folds diacritics and ł', () => {
    expect(slugify('Zażółć gęślą jaźń: v2!')).toBe('zazolc-gesla-jazn-v2');
  });

  it('loadAuthors reads lists and maps, ignores entries without an id', () => {
    const list = tmpSite({ 'c/_authors.yml': '- id: ann\n  name: Ann\n- name: no id\n- plain\n' });
    expect(loadAuthors(path.join(list, 'c'))).toEqual({ ann: { name: 'Ann' } });
  });
});

describe('broken front matter', () => {
  it('is reported per file instead of aborting the whole site', async () => {
    const root = tmpSite({
      'decisions/sre/_project.yml': 'name: SRE\nowners: [ann]\n',
      'decisions/sre/adr/0001-ok.md': '---\ntitle: Fine\nstatus: accepted\ndate: 2026-01-01\n---\nBody\n',
      'decisions/sre/adr/0002-alias.md': '---\ntitle: *Draft* Use X\n---\nBody\n',
    });
    const config = await loadConfig(root, { warn: () => {} });
    expect(loadRecords(config)).toHaveLength(2);
    const { problems } = checkSite(config, { today: new Date('2026-02-01') });
    expect(problems).toContainEqual(expect.objectContaining({ level: 'error', rule: 'front-matter', record: 'sre/adr/0002-alias' }));
  });
});
