import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSite, formatAnnotations, formatText, keyLine, summary, toJson } from './check.mjs';
import { loadConfig } from './config.mjs';
import { loadAuthors } from './records.mjs';
import { tmpSite } from '../test/helpers.mjs';

const record = (front, body = '\nBody.\n') => `---\n${front.trim()}\n---\n${body}`;
const project = 'name: SRE\nowners: [ania]\n';

async function check(files, opts) {
  const root = tmpSite({ 'decisions/sre/_project.yml': project, ...files });
  const config = await loadConfig(root);
  const result = checkSite(config, { today: new Date(2026, 9, 16), ...opts });
  const rel = (f) => path.relative(root, f).split(path.sep).join('/');
  return { ...result, root, config, problems: result.problems.map((p) => ({ ...p, file: rel(p.file) })) };
}

const messages = (r, level) => r.problems.filter((p) => !level || p.level === level).map((p) => p.message);

describe('checkSite', () => {
  it('reports a protected project when authentication is not configured', async () => {
    const files = { 'decisions/ops/_project.yml': 'name: Ops\nowners: [ania]\nprotected: true\n', 'decisions/ops/adr/0001-a.md': record('title: A\nstatus: accepted\ndate: 2025-01-02') };
    const r = await check(files);
    expect(r.problems).toMatchObject([
      { level: 'error', rule: 'project-protected', file: 'decisions/ops/_project.yml', message: 'project "ops" is protected (protected: true) but `authentication` is not set in inkan.config, so nobody could sign in to see it' },
    ]);
    const root = tmpSite({ 'decisions/sre/_project.yml': project, 'inkan.config.mjs': "export default { authentication: { type: 'github', clientId: 'x' } };\n", ...files });
    expect(checkSite(await loadConfig(root)).problems).toEqual([]);
  });

  it('passes a clean site', async () => {
    const r = await check({
      'decisions/sre/adr/0001-a.md': record('title: A\nstatus: accepted\ndate: 2025-01-02'),
      'decisions/sre/rfc/0001-r.md': record('title: R\nstatus: proposed\ndate: 2026-10-01\nreviewBy: 2026-12-01\nrelated: [sre/adr/0001-a]'),
    });
    expect(r.problems).toEqual([]);
    expect(r.records).toBe(2);
    expect(r.projects).toBe(1);
  });

  it('reports links to records that do not exist, with a suggestion', async () => {
    const r = await check({
      'decisions/sre/adr/0001-use-slos.md': record('title: A\nstatus: accepted'),
      'decisions/sre/adr/0002-b.md': record('title: B\nstatus: accepted\nrelated: [sre/adr/0001-use-slo]\nsupersedes: nope/adr/0001-x'),
    });
    expect(r.problems).toMatchObject([
      { level: 'error', rule: 'missing-record', file: 'decisions/sre/adr/0002-b.md', line: 4, message: 'related points to "sre/adr/0001-use-slo", which does not exist, did you mean "sre/adr/0001-use-slos"?' },
      { level: 'error', rule: 'missing-record', line: 5, message: 'supersedes points to "nope/adr/0001-x", which does not exist' },
    ]);
  });

  it('accepts short ids and refs in links', async () => {
    const r = await check({
      'decisions/sre/adr/0001-a.md': record('title: A\nstatus: superseded\nsupersededBy: [SRE-ADR-0002]'),
      'decisions/sre/adr/0002-b.md': record('title: B\nstatus: accepted\nsupersedes: [sre/adr/1]'),
    });
    expect(r.problems).toEqual([]);
  });

  it('reports duplicate numbers within a project and type', async () => {
    const r = await check({
      'decisions/sre/adr/0001-a.md': record('title: A'),
      'decisions/sre/adr/0001-b.md': record('title: B'),
      'decisions/sre/adr/0002-c.md': record('title: C'),
      'decisions/sre/rfc/0001-d.md': record('title: D'),
    });
    expect(messages(r, 'error')).toEqual([
      'number 1 is also used by 0001-b.md (sre/adr)',
      'number 1 is also used by 0001-a.md (sre/adr)',
    ]);
  });

  it('reports missing, unparsable and title-less front matter', async () => {
    const r = await check({
      'decisions/sre/adr/0001-a.md': 'No front matter at all.\n',
      'decisions/sre/adr/0002-b.md': record('title: "B\nstatus: [accepted'),
      'decisions/sre/adr/0003-c.md': record('status: accepted\ndate: 2025-01-01'),
      'decisions/sre/adr/0004-d.md': record('title: ""'),
    });
    expect(r.problems).toMatchObject([
      { level: 'error', rule: 'front-matter', file: 'decisions/sre/adr/0001-a.md', message: 'missing front matter (the file must start with a --- block holding at least a title)' },
      { level: 'error', rule: 'front-matter', file: 'decisions/sre/adr/0002-b.md', message: expect.stringMatching(/^front matter does not parse: /) },
      { level: 'error', rule: 'title', file: 'decisions/sre/adr/0003-c.md', message: 'front matter has no title' },
      { level: 'error', rule: 'title', file: 'decisions/sre/adr/0004-d.md', line: 2, message: 'front matter has no title' },
    ]);
    expect(r.problems[1].line).toBeGreaterThanOrEqual(2);
  });

  it('reports statuses missing from the config', async () => {
    const r = await check({
      'decisions/sre/adr/0001-a.md': record('title: A\nstatus: acepted'),
      'decisions/sre/adr/0002-b.md': record('title: B\nstatus: 42'),
    });
    expect(r.problems).toMatchObject([
      { level: 'error', rule: 'status', line: 3, message: 'unknown status "acepted", did you mean "accepted"?' },
      { level: 'error', rule: 'status', message: expect.stringMatching(/^unknown status "42" \(known: draft, proposed, .*superseded\)$/) },
    ]);
  });

  it('reports invalid dates', async () => {
    const r = await check({
      'decisions/sre/adr/0001-a.md': record('title: A\ndate: yesterday\nreviewBy: 2026-13-45'),
      'decisions/sre/adr/0002-b.md': record('title: B\ndate: 2025-02-03\nreviewBy: 2025-02-03T10:00:00Z'),
    });
    expect(r.problems).toMatchObject([
      { level: 'error', rule: 'date', line: 3, message: 'date "yesterday" is not a date (use YYYY-MM-DD)' },
      { level: 'error', rule: 'date', line: 4, message: 'reviewBy "2026-13-45" is not a date (use YYYY-MM-DD)' },
    ]);
  });

  it('warns about one-sided supersede links', async () => {
    const r = await check({
      'decisions/sre/adr/0001-a.md': record('title: A\nstatus: superseded'),
      'decisions/sre/adr/0002-b.md': record('title: B\nstatus: accepted\nsupersedes: [sre/adr/0001-a]'),
      'decisions/sre/adr/0003-c.md': record('title: C\nstatus: superseded\nsupersededBy: [sre/adr/0002-b]'),
    });
    expect(r.problems).toMatchObject([
      { level: 'warning', rule: 'one-sided-supersede', file: 'decisions/sre/adr/0002-b.md', line: 4, message: 'supersedes sre/adr/0001-a, but sre/adr/0001-a does not list supersededBy: sre/adr/0002-b' },
      { level: 'warning', rule: 'one-sided-supersede', file: 'decisions/sre/adr/0003-c.md', message: 'supersededBy sre/adr/0002-b, but sre/adr/0002-b does not list supersedes: sre/adr/0003-c' },
    ]);
  });

  it('warns when a superseded record keeps another status', async () => {
    const r = await check({
      'decisions/sre/adr/0001-a.md': record('title: A\nstatus: accepted\nsupersededBy: [sre/adr/0002-b]'),
      'decisions/sre/adr/0002-b.md': record('title: B\nstatus: accepted\nsupersedes: [sre/adr/0001-a]'),
    });
    expect(r.problems).toMatchObject([{ level: 'warning', rule: 'superseded-status', line: 3, message: 'has supersededBy but its status is "accepted" instead of "superseded"' }]);
  });

  it('skips the superseded-status rule when the config has no such status', async () => {
    const r = await check({
      'inkan.config.mjs': `export default { statuses: { live: { label: 'Live', current: true }, old: { label: 'Old' } } };\n`,
      'decisions/sre/adr/0001-a.md': record('title: A\nstatus: old\nsupersededBy: [sre/adr/0002-b]'),
      'decisions/sre/adr/0002-b.md': record('title: B\nstatus: live\nsupersedes: [sre/adr/0001-a]'),
    });
    expect(r.problems).toEqual([]);
  });

  it('warns about project folders without _project.yml or owners', async () => {
    const r = await check({
      'decisions/sre/_project.yml': 'name: SRE\n',
      'decisions/sre/adr/0001-a.md': record('title: A'),
      'decisions/bare/adr/0001-a.md': record('title: A'),
      'decisions/empty/_project.yml': 'name: Empty\n',
    });
    expect(r.problems).toMatchObject([
      { level: 'warning', rule: 'project-file', file: 'decisions/bare', message: 'project folder "bare" has no _project.yml (name, description, owners)' },
      { level: 'warning', rule: 'project-owners', file: 'decisions/sre/_project.yml', message: 'project "sre" has no owners' },
    ]);
  });

  it('warns about authors and deciders missing from _authors.yml', async () => {
    const r = await check({
      'decisions/_authors.yml': '- id: ania\n  name: Ania\n- id: marek\n  name: Marek\n',
      'decisions/sre/adr/0001-a.md': record('title: A\nauthors: [ania, anja]\ndeciders: bob'),
    });
    expect(r.problems).toMatchObject([
      { level: 'warning', rule: 'unknown-author', line: 3, message: 'author "anja" is not in _authors.yml, did you mean "ania"?' },
      { level: 'warning', rule: 'unknown-author', line: 4, message: 'decider "bob" is not in _authors.yml' },
    ]);
    const none = await check({ 'decisions/sre/adr/0001-a.md': record('title: A\nauthors: [whoever]') });
    expect(none.problems).toEqual([]);
  });

  it('reads an author directory written as a map', () => {
    const root = tmpSite({ 'decisions/_authors.yml': 'ania:\n  name: Ania\nmarek:\n  name: Marek\n' });
    expect(Object.keys(loadAuthors(path.join(root, 'decisions')))).toEqual(['ania', 'marek']);
    expect(loadAuthors(path.join(root, 'nope'))).toEqual({});
  });

  it('warns about overdue reviews of open records only', async () => {
    const r = await check({
      'decisions/sre/rfc/0001-a.md': record('title: A\nstatus: proposed\nreviewBy: 2026-10-15'),
      'decisions/sre/rfc/0002-b.md': record('title: B\nstatus: proposed\nreviewBy: 2026-10-16'),
      'decisions/sre/rfc/0003-c.md': record('title: C\nstatus: accepted\nreviewBy: 2026-01-01'),
      'decisions/sre/rfc/0004-d.md': record('title: D\nreviewBy: 2026-01-01'),
    });
    expect(r.problems.filter((p) => p.rule === 'review-overdue')).toMatchObject([
      { level: 'warning', file: 'decisions/sre/rfc/0001-a.md', line: 4, message: 'review deadline 2026-10-15 has passed but the status is still "proposed"' },
    ]);
  });

  it('warns about decided records whose review date has passed', async () => {
    const r = await check({
      'decisions/sre/adr/0001-a.md': record('title: A\nstatus: accepted\ndate: 2025-01-01\nreviewBy: 2026-10-15'),
      'decisions/sre/adr/0002-b.md': record('title: B\nstatus: accepted\ndate: 2025-01-01\nreviewBy: 2026-10-16'),
      'decisions/sre/adr/0003-c.md': record('title: C\nstatus: accepted\ndate: 2025-01-01\nreviewBy: 2026-10-01\nreviewed: 2026-10-02'),
      'decisions/sre/adr/0004-d.md': record('title: D\nstatus: superseded\ndate: 2025-01-01\nreviewBy: 2026-01-01'),
    });
    expect(r.problems.filter((p) => p.rule === 'review-due')).toMatchObject([
      { level: 'warning', file: 'decisions/sre/adr/0001-a.md', line: 5, message: 'review date 2026-10-15 has passed; review it and run `inkan reviewed sre/adr/0001-a`' },
    ]);
  });

  it('schedules reviews from an interval set on the record, the project or the site', async () => {
    const r = await check({
      'inkan.config.mjs': `export default { reviews: { every: '2 years' } };\n`,
      'decisions/sre/_project.yml': `${project}reviewEvery: 1 year\n`,
      'decisions/sre/adr/0001-a.md': record('title: A\nstatus: accepted\ndate: 2025-10-15'),
      'decisions/sre/adr/0002-b.md': record('title: B\nstatus: accepted\ndate: 2025-10-16'),
      'decisions/sre/adr/0003-c.md': record('title: C\nstatus: accepted\ndate: 2020-01-01\nreviewEvery: never'),
      'decisions/sre/adr/0004-d.md': record('title: D\nstatus: accepted\ndate: 2020-01-01\nreviewed: 2026-03-01\nreviewEvery: 6 months'),
      'decisions/sre/adr/0005-e.md': record('title: E\nstatus: accepted\ndate: 2020-01-01\nreviewed: 2026-10-01'),
      'decisions/sre/rfc/0001-f.md': record('title: F\nstatus: proposed\ndate: 2020-01-01'),
    });
    expect(messages(r)).toEqual([
      'review every 1 year (due 2026-10-15) has passed; review it and run `inkan reviewed sre/adr/0001-a`',
      'review every 6 months (due 2026-09-01) has passed; review it and run `inkan reviewed sre/adr/0004-d`',
    ]);
  });

  it('falls back to the site interval and ignores records without a review status', async () => {
    const r = await check({
      'inkan.config.mjs': `export default { reviews: { every: '1 year' } };\n`,
      'decisions/sre/adr/0001-a.md': record('title: A\nstatus: accepted\ndate: 2024-01-31'),
      'decisions/sre/adr/0002-b.md': record('title: B\nstatus: proposed\ndate: 2024-01-31'),
    });
    expect(messages(r)).toEqual(['review every 1 year (due 2025-01-31) has passed; review it and run `inkan reviewed sre/adr/0001-a`']);
  });

  it('rejects intervals it cannot read', async () => {
    const r = await check({
      'decisions/sre/_project.yml': `${project}reviewEvery: soon\n`,
      'decisions/sre/adr/0001-a.md': record('title: A\nstatus: accepted\nreviewEvery: every now and then'),
      'decisions/sre/adr/0002-b.md': record('title: B\nstatus: accepted\nreviewEvery: never'),
    });
    expect(r.problems.filter((p) => p.rule === 'review-interval')).toMatchObject([
      { level: 'error', file: 'decisions/sre/_project.yml', message: expect.stringContaining('project "sre": reviewEvery') },
      { level: 'error', file: 'decisions/sre/adr/0001-a.md', line: 4, message: expect.stringContaining('"every now and then" is not an interval') },
    ]);
  });

  describe('reviewers', () => {
    it('reports reviewers that cannot be read', async () => {
      const r = await check({
        'decisions/sre/rfc/0001-a.md': record('title: A\nstatus: proposed\nreviewers:\n  alice: maybe'),
      });
      expect(r.problems).toMatchObject([{ level: 'error', rule: 'reviewers', file: 'decisions/sre/rfc/0001-a.md', line: 4 }]);
      expect(r.problems[0].message).toContain('maybe');
    });

    it('warns about reviewers missing from _authors.yml', async () => {
      const r = await check({
        'decisions/_authors.yml': '- id: ania\n  name: Ania\n',
        'decisions/sre/rfc/0001-a.md': record('title: A\nstatus: proposed\nreviewers: [ania, anja]'),
      });
      expect(r.problems).toMatchObject([{ level: 'warning', rule: 'unknown-author', line: 4, message: 'reviewer "anja" is not in _authors.yml, did you mean "ania"?' }]);
    });

    it('warns when a current record still has requested changes', async () => {
      const r = await check({
        'decisions/sre/rfc/0001-a.md': record('title: A\nstatus: accepted\nreviewers:\n  ania: approved\n  bob: changes-requested'),
        'decisions/sre/rfc/0002-b.md': record('title: B\nstatus: proposed\nreviewers:\n  bob: changes-requested'),
      });
      expect(r.problems).toMatchObject([
        { level: 'warning', rule: 'review-blocked', file: 'decisions/sre/rfc/0001-a.md', line: 4, message: 'status is "accepted" but bob still has requested changes' },
      ]);
    });

    it('names who an overdue review waits on', async () => {
      const r = await check({
        'decisions/sre/rfc/0001-a.md': record('title: A\nstatus: proposed\nreviewBy: 2026-10-01\nreviewers:\n  ania: approved\n  bob: pending'),
      });
      expect(messages(r)).toEqual(['review deadline 2026-10-01 has passed but the status is still "proposed" (waiting on bob)']);
    });
  });

  it('ignores non-record pages and hidden files', async () => {
    const r = await check({
      'decisions/_landing.md': 'no front matter',
      'decisions/handbook.md': 'no front matter',
      'decisions/sre/index.md': 'no front matter',
      'decisions/sre/notes/0001-x.md': 'no front matter',
      'decisions/sre/adr/0001-a.md': record('title: A'),
    });
    expect(r.problems).toEqual([]);
    expect(r.records).toBe(1);
  });
});

describe('custom fields', () => {
  const config = `export default { fields: { risk: { type: 'enum', values: ['low', 'high'], required: true }, cost: { type: 'number' } } };\n`;

  it('reports invalid and missing required values, pointing at the key', async () => {
    const r = await check({
      'inkan.config.mjs': config,
      'decisions/sre/adr/0001-a.md': record('title: A\nrisk: low\ncost: 12'),
      'decisions/sre/adr/0002-b.md': record('title: B\nrisk: extreme\ncost: lots'),
      'decisions/sre/adr/0003-c.md': record('title: C'),
    });
    expect(r.problems).toMatchObject([
      { level: 'error', rule: 'field', file: 'decisions/sre/adr/0002-b.md', line: 3, message: 'risk: "extreme" is not one of low, high' },
      { level: 'error', rule: 'field', file: 'decisions/sre/adr/0002-b.md', line: 4, message: 'cost: "lots" is not a number' },
      { level: 'error', rule: 'field', file: 'decisions/sre/adr/0003-c.md', line: undefined, message: 'risk is required' },
    ]);
  });

  it('uses the fields of the record\'s project', async () => {
    const r = await check({
      'inkan.config.mjs': config,
      'decisions/sre/_project.yml': `${project}fields:\n  risk: false\n  pci: { type: boolean }\n`,
      'decisions/sre/adr/0001-a.md': record('title: A\npci: maybe'),
    });
    expect(r.problems).toMatchObject([{ rule: 'field', line: 3, message: 'pci: "maybe" is not true or false' }]);
  });

  it('reports an invalid fields block on the _project.yml without checking its records', async () => {
    const r = await check({
      'inkan.config.mjs': config,
      'decisions/sre/_project.yml': `${project}fields:\n  pci: { type: enum }\n`,
      'decisions/sre/adr/0001-a.md': record('title: A'),
    });
    expect(r.problems).toMatchObject([{ level: 'error', rule: 'project-fields', file: 'decisions/sre/_project.yml', message: expect.stringContaining('fields.pci.values') }]);
  });

  it('reports a field with two types on the _project.yml', async () => {
    const r = await check({
      'inkan.config.mjs': config,
      'decisions/sre/_project.yml': `${project}fields:\n  cost: { type: text }\n`,
      'decisions/sre/adr/0001-a.md': record('title: A\nrisk: low'),
    });
    expect(r.problems).toMatchObject([{ rule: 'project-fields', file: 'decisions/sre/_project.yml', message: expect.stringContaining('"cost" is a number field') }]);
  });
});

describe('output', () => {
  const result = {
    records: 3,
    projects: 1,
    problems: [
      { level: 'error', rule: 'title', message: 'front matter has no title', file: '/site/decisions/sre/adr/0001-a.md', line: 2, record: 'sre/adr/0001-a' },
      { level: 'warning', rule: 'project-owners', message: 'project "sre" has no owners', file: '/site/decisions/sre/_project.yml' },
    ],
  };

  it('prints one line per problem, grouped by file, and a summary', () => {
    expect(formatText(result, { cwd: '/site' })).toBe(
      ['decisions/sre/adr/0001-a.md:2 error front matter has no title', '', 'decisions/sre/_project.yml warning project "sre" has no owners', '', '1 error, 1 warning (3 records in 1 project).'].join('\n'),
    );
    expect(formatText({ records: 2, projects: 2, problems: [] })).toBe('No problems found (2 records in 2 projects).');
    expect(summary({ records: 1, projects: 1, problems: [result.problems[1], result.problems[1]] })).toBe('2 warnings (1 record in 1 project).');
  });

  it('emits GitHub annotations with escaped properties', () => {
    expect(formatAnnotations([{ ...result.problems[0], message: 'a,b:c\nd' }, result.problems[1]], { workspace: '/site' })).toEqual([
      '::error file=decisions/sre/adr/0001-a.md,line=2,title=inkan check (title)::a,b:c%0Ad',
      '::warning file=decisions/sre/_project.yml,title=inkan check (project-owners)::project "sre" has no owners',
    ]);
  });

  it('serialises to JSON with relative paths', () => {
    expect(toJson(result, { cwd: '/site' })).toMatchObject({ ok: false, errors: 1, warnings: 1, records: 3, problems: [{ file: 'decisions/sre/adr/0001-a.md', line: 2 }, { file: 'decisions/sre/_project.yml' }] });
  });

  it('finds the line of a front matter key', () => {
    const text = '---\ntitle: X\n"status": y\ntags:\n  - a\n---\nbody\ntitle: not here\n';
    expect(keyLine(text, 'title')).toBe(2);
    expect(keyLine(text, 'status')).toBe(3);
    expect(keyLine(text, 'tags')).toBe(4);
    expect(keyLine(text, 'date')).toBeUndefined();
    expect(keyLine('no front matter', 'title')).toBeUndefined();
  });
});
