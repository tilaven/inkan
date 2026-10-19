import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { run as reviewed } from '../lib/commands/reviewed.mjs';
import { run as reviews } from '../lib/commands/reviews.mjs';
import { parseFrontMatter, today } from '../lib/records.mjs';
import { addInterval } from '../lib/reviews.mjs';
import { configModule, tmpSite } from './helpers.mjs';

const day = (offset) => addInterval(today(), { count: offset, unit: 'day' });
const record = (title, extra = '') => `---\n# keep me\ntitle: "${title}"\nstatus: accepted\ndate: 2024-01-01\n${extra}---\n\n## Context\n\nText.\n`;

function site(files = {}, config) {
  const root = tmpSite({
    ...(config ? { 'inkan.config.mjs': configModule(config) } : {}),
    'decisions/sre/_project.yml': 'name: SRE\n',
    'decisions/sre/adr/0001-use-slos.md': record('Use SLOs'),
    'decisions/sre/adr/0002-use-slis.md': record('Use SLIs', `reviewBy: ${day(-10)}\n`),
    'decisions/sre/rfc/0001-draft.md': record('Draft').replace('accepted', 'proposed'),
    ...files,
  });
  const read = (f) => fs.readFileSync(path.join(root, 'decisions', f), 'utf8');
  const log = [];
  return { root, read, log, logger: (l) => log.push(l) };
}

describe('inkan reviewed', () => {
  it('records the review date and schedules the next one from the site interval', async () => {
    const { root, read, log, logger } = site({}, `{ reviews: { every: '1 year' } }`);
    expect(await reviewed({ args: ['sre/adr/1'], flags: { date: '2026-10-17' }, root, log: logger })).toBe(0);
    const text = read('sre/adr/0001-use-slos.md');
    expect(text).toContain('# keep me');
    expect(parseFrontMatter(text).data).toMatchObject({ status: 'accepted', date: '2024-01-01', reviewed: '2026-10-17' });
    expect(log).toEqual(['sre/adr/0001-use-slos: reviewed 2026-10-17, next review 2027-10-17']);
  });

  it('defaults to today', async () => {
    const { root, read, log, logger } = site({}, `{ reviews: { every: '90 days' } }`);
    await reviewed({ args: ['SRE-ADR-0001'], flags: {}, root, log: logger });
    expect(parseFrontMatter(read('sre/adr/0001-use-slos.md')).data.reviewed).toBe(today());
    expect(log).toEqual([`sre/adr/0001-use-slos: reviewed ${today()}, next review ${day(90)}`]);
  });

  it('sets the interval with --every and the next date with --next', async () => {
    const { root, read, log, logger } = site();
    await reviewed({ args: ['sre/adr/1'], flags: { date: '2026-10-17', every: '6 months' }, root, log: logger });
    expect(parseFrontMatter(read('sre/adr/0001-use-slos.md')).data).toMatchObject({ reviewed: '2026-10-17', reviewEvery: '6 months' });
    await reviewed({ args: ['sre/adr/2'], flags: { date: '2026-10-17', next: '2027-01-15' }, root, log: logger });
    expect(parseFrontMatter(read('sre/adr/0002-use-slis.md')).data).toMatchObject({ reviewed: '2026-10-17', reviewBy: '2027-01-15' });
    expect(log).toEqual(['sre/adr/0001-use-slos: reviewed 2026-10-17, next review 2027-04-17', 'sre/adr/0002-use-slis: reviewed 2026-10-17, next review 2027-01-15']);
  });

  it('drops a passed reviewBy when an interval takes over', async () => {
    const { root, read, log, logger } = site({ 'decisions/sre/_project.yml': 'name: SRE\nreviewEvery: 1 year\n' });
    await reviewed({ args: ['sre/adr/2'], flags: { date: '2026-10-17' }, root, log: logger });
    const text = read('sre/adr/0002-use-slis.md');
    expect(text).not.toContain('reviewBy');
    expect(parseFrontMatter(text).data.reviewed).toBe('2026-10-17');
    expect(log).toEqual(['sre/adr/0002-use-slis: reviewed 2026-10-17, next review 2027-10-17']);
  });

  it('drops a future reviewBy too unless --next keeps a date', async () => {
    const { root, read, logger } = site({ 'decisions/sre/_project.yml': 'name: SRE\nreviewEvery: 1 year\n', 'decisions/sre/adr/0003-later.md': record('Later', `reviewBy: ${day(30)}\n`) });
    await reviewed({ args: ['sre/adr/3'], flags: { date: '2026-10-17' }, root, log: logger });
    expect(read('sre/adr/0003-later.md')).not.toContain('reviewBy');
  });

  it('asks for --next or --every when a reviewBy has nothing to replace it', async () => {
    const { root, read, logger } = site();
    const before = read('sre/adr/0002-use-slis.md');
    await expect(reviewed({ args: ['sre/adr/2'], flags: {}, root, log: logger })).rejects.toThrow('pass --next <date> or --every <interval>');
    await expect(reviewed({ args: ['sre/adr/2'], flags: { every: 'never' }, root, log: logger })).rejects.toThrow('pass --next');
    expect(read('sre/adr/0002-use-slis.md')).toBe(before);
    await reviewed({ args: ['sre/adr/2'], flags: { every: '1 year', date: '2026-10-17' }, root, log: logger });
    expect(read('sre/adr/0002-use-slis.md')).not.toContain('reviewBy');
  });

  it('validates the options', async () => {
    const { root, logger } = site();
    const run = (flags, args = ['sre/adr/1']) => reviewed({ args, flags, root, log: logger });
    await expect(run({}, [])).rejects.toThrow('Usage');
    await expect(run({ every: 'soon' })).rejects.toThrow('--every "soon" is not an interval');
    await expect(run({ every: true })).rejects.toThrow('Usage');
    await expect(run({ date: '17.10.2026' })).rejects.toThrow('--date must be a date');
    await expect(run({ date: true })).rejects.toThrow('--date must be a date');
    await expect(run({ date: '2026-02-30' })).rejects.toThrow('--date must be a date');
    await expect(run({ date: day(1) })).rejects.toThrow('is in the future');
    await expect(run({ next: '2026-13-45' })).rejects.toThrow('--next must be a date');
    await expect(run({ next: '2026-10-17', date: '2026-10-17' })).rejects.toThrow('--next 2026-10-17 must be after the review date 2026-10-17');
    await expect(run({}, ['sre/adr/9'])).rejects.toThrow('No record matches');
  });

  it('refuses records that are not reviewed periodically', async () => {
    const { root, read, logger } = site();
    const before = read('sre/rfc/0001-draft.md');
    await expect(reviewed({ args: ['sre/rfc/1'], flags: {}, root, log: logger })).rejects.toThrow('sre/rfc/0001-draft is "proposed"; only records with status');
    expect(read('sre/rfc/0001-draft.md')).toBe(before);
  });

  it('previews with --dry-run and reports a repeat as unchanged', async () => {
    const { root, read, log, logger } = site({}, `{ reviews: { every: '1 year' } }`);
    await reviewed({ args: ['sre/adr/1'], flags: { date: '2026-10-17', 'dry-run': true }, root, log: logger });
    expect(read('sre/adr/0001-use-slos.md')).not.toContain('reviewed');
    expect(log[0]).toContain('+ reviewed: 2026-10-17');
    expect(log[1]).toBe('sre/adr/0001-use-slos: reviewed 2026-10-17, next review 2027-10-17 [dry run]');
    await reviewed({ args: ['sre/adr/1'], flags: { date: '2026-10-17' }, root, log: logger });
    await reviewed({ args: ['sre/adr/1'], flags: { date: '2026-10-17' }, root, log: logger });
    expect(log.at(-1)).toBe('sre/adr/0001-use-slos: already reviewed 2026-10-17, next review 2027-10-17');
  });
});

describe('inkan reviews', () => {
  const files = {
    'decisions/sre/adr/0001-use-slos.md': record('Use SLOs', `reviewBy: ${day(-3)}\n`),
    'decisions/sre/adr/0002-use-slis.md': record('Use SLIs', `reviewBy: ${day(5)}\nreviewed: 2024-02-01\nreviewEvery: never\n`),
    'decisions/sre/adr/0003-far.md': record('Far away', `reviewBy: ${day(200)}\n`),
    'decisions/sre/adr/0004-never.md': record('Never'),
    'decisions/sre/adr/0005-today.md': record('Today', `reviewBy: ${day(0)}\n`),
  };

  it('lists overdue and soon-due records by due date', async () => {
    const { root, log, logger } = site(files);
    expect(await reviews({ args: [], flags: {}, root, log: logger })).toBe(0);
    expect(log).toEqual([
      `${day(-3)}  3 days late  SRE-ADR-0001  Use SLOs`,
      `${day(0)}  today        SRE-ADR-0005  Today`,
      `${day(5)}  in 5 days    SRE-ADR-0002  Use SLIs`,
      '\n1 overdue, 2 due within 30 days.',
    ]);
  });

  it('narrows with --within and widens with --all', async () => {
    const { root, log, logger } = site(files);
    await reviews({ args: [], flags: { within: '1' }, root, log: logger });
    expect(log.map((l) => l.split('  ').at(-1))).toEqual(['Use SLOs', 'Today', '\n1 overdue, 1 due within 1 day.']);
    log.length = 0;
    await reviews({ args: [], flags: { all: true }, root, log: logger });
    expect(log).toHaveLength(5);
    expect(log.at(-1)).toBe('\n4 reviews scheduled, 1 overdue.');
    log.length = 0;
    await reviews({ args: [], flags: { within: '0' }, root, log: logger });
    expect(log).toHaveLength(3);
  });

  it('uses reviews.soon and says when nothing is due', async () => {
    const wide = site(files, `{ reviews: { soon: 365 } }`);
    await reviews({ args: [], flags: {}, root: wide.root, log: wide.logger });
    expect(wide.log).toHaveLength(5);
    const empty = site({ 'decisions/sre/adr/0002-use-slis.md': record('Use SLIs') });
    await reviews({ args: [], flags: {}, root: empty.root, log: empty.logger });
    await reviews({ args: [], flags: { all: true }, root: empty.root, log: empty.logger });
    expect(empty.log).toEqual(['No reviews due within 30 days.', 'No records have a review scheduled.']);
  });

  it('prints JSON', async () => {
    const { root, log, logger } = site(files, `{ reviews: { every: '1 year' } }`);
    await reviews({ args: [], flags: { json: true, within: '7' }, root, log: logger });
    const rows = JSON.parse(log[0]);
    expect(rows.map((r) => r.id)).toEqual(['sre/adr/0004-never', 'sre/adr/0001-use-slos', 'sre/adr/0005-today', 'sre/adr/0002-use-slis']);
    expect(rows[1]).toEqual({
      id: 'sre/adr/0001-use-slos',
      ref: 'SRE-ADR-0001',
      title: 'Use SLOs',
      project: 'sre',
      status: 'accepted',
      due: day(-3),
      reviewed: null,
      every: '1 year',
      days: -3,
      urgency: 'overdue',
    });
    expect(rows.map((r) => r.urgency)).toEqual(['overdue', 'overdue', 'soon', 'soon']);
  });

  it('rejects a bad --within', async () => {
    const { root, logger } = site();
    await expect(reviews({ args: [], flags: { within: 'soon' }, root, log: logger })).rejects.toThrow('Usage');
    await expect(reviews({ args: [], flags: { within: true }, root, log: logger })).rejects.toThrow('Usage');
    await expect(reviews({ args: [], flags: { within: '' }, root, log: logger })).rejects.toThrow('Usage');
  });
});
