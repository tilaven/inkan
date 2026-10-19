import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { tmpSite } from '../test/helpers.mjs';
import { addInterval, isInterval, isoDate, nextReview, parseInterval, reviewOptions, reviewSchedule, reviewStatuses } from './reviews.mjs';

const statuses = ['accepted', 'implemented'];
const opts = (extra) => ({ statuses, ...extra });

describe('parseInterval', () => {
  it('reads counts with long, short and plural units', () => {
    expect(parseInterval('1 year')).toEqual({ count: 1, unit: 'year' });
    expect(parseInterval('18 Months')).toEqual({ count: 18, unit: 'month' });
    expect(parseInterval('90d')).toEqual({ count: 90, unit: 'day' });
    expect(parseInterval('2w')).toEqual({ count: 2, unit: 'week' });
    expect(parseInterval(' 6 mo ')).toEqual({ count: 6, unit: 'month' });
    expect(parseInterval(2)).toBeNull();
  });

  it('rejects anything else', () => {
    for (const v of ['', 'soon', '0 days', '-1 year', '1.5 years', '1 fortnight', 'year', '1 ms', '10000 years', null, undefined, false]) expect(parseInterval(v)).toBeNull();
  });
});

describe('isInterval', () => {
  it('accepts intervals and the opt-outs', () => {
    expect(isInterval('1 year')).toBe(true);
    expect(isInterval('never')).toBe(true);
    expect(isInterval(' Never ')).toBe(true);
    expect(isInterval(false)).toBe(true);
    expect(isInterval('sometimes')).toBe(false);
    expect(isInterval(null)).toBe(false);
  });
});

describe('isoDate', () => {
  it('normalises dates and rejects other values', () => {
    expect(isoDate(new Date('2026-03-04T10:00:00Z'))).toBe('2026-03-04');
    expect(isoDate('2026-03-04')).toBe('2026-03-04');
    expect(isoDate('2026-03-04T10:00:00Z')).toBe('2026-03-04');
    for (const v of ['yesterday', '2026-13-45', '2026-02-30', 20260304, null, undefined, new Date('x')]) expect(isoDate(v)).toBeNull();
  });
});

describe('addInterval', () => {
  const add = (date, interval) => addInterval(date, /** @type {{ count: number, unit: string }} */ (parseInterval(interval)));

  it('adds days and weeks across month and year ends', () => {
    expect(add('2026-12-30', '5 days')).toBe('2027-01-04');
    expect(add('2026-10-17', '2 weeks')).toBe('2026-10-31');
    expect(add('2024-02-28', '2 days')).toBe('2024-03-01');
  });

  it('adds months and years', () => {
    expect(add('2026-10-17', '6 months')).toBe('2027-04-17');
    expect(add('2026-10-17', '1 year')).toBe('2027-10-17');
    expect(add('2026-11-30', '3 months')).toBe('2027-02-28');
    expect(add('2026-10-17', '15 months')).toBe('2028-01-17');
  });

  it('clamps to the end of shorter months', () => {
    expect(add('2026-01-31', '1 month')).toBe('2026-02-28');
    expect(add('2026-08-31', '1 month')).toBe('2026-09-30');
    expect(add('2026-03-31', '12 months')).toBe('2027-03-31');
  });

  it('handles leap years', () => {
    expect(add('2024-01-31', '1 month')).toBe('2024-02-29');
    expect(add('2024-02-29', '1 year')).toBe('2025-02-28');
    expect(add('2024-02-29', '4 years')).toBe('2028-02-29');
    expect(add('2023-02-28', '1 year')).toBe('2024-02-28');
  });
});

describe('reviewStatuses', () => {
  const config = { statuses: { draft: { label: 'D', open: true }, accepted: { label: 'A', current: true }, live: { label: 'L', current: true } } };

  it('defaults to the current statuses', () => {
    expect(reviewStatuses(config)).toEqual(['accepted', 'live']);
  });

  it('can be set in the config', () => {
    expect(reviewStatuses({ ...config, reviews: { statuses: ['draft'] } })).toEqual(['draft']);
  });
});

describe('nextReview', () => {
  it('has no schedule without a date, an interval or a review status', () => {
    expect(nextReview({ status: 'accepted', date: '2026-01-01' }, opts())).toBeNull();
    expect(nextReview({ status: 'accepted', reviewEvery: '1 year' }, opts())).toBeNull();
    expect(nextReview({ date: '2026-01-01', reviewEvery: '1 year' }, opts())).toBeNull();
    expect(nextReview({ status: 'proposed', date: '2026-01-01', reviewEvery: '1 year', reviewBy: '2026-06-01' }, opts())).toBeNull();
  });

  it('counts the interval from the record date, then from the last review', () => {
    expect(nextReview({ status: 'accepted', date: '2025-10-17', reviewEvery: '1 year' }, opts())).toEqual({ due: '2026-10-17', reviewed: null, every: '1 year', from: 'interval' });
    expect(nextReview({ status: 'accepted', date: '2025-10-17', reviewed: '2026-04-30', reviewEvery: '6 months' }, opts())).toEqual({
      due: '2026-10-30',
      reviewed: '2026-04-30',
      every: '6 months',
      from: 'interval',
    });
  });

  it('accepts dates parsed from YAML', () => {
    expect(nextReview({ status: 'accepted', date: new Date('2025-10-17'), reviewEvery: '90 days' }, opts())?.due).toBe('2026-01-15');
  });

  it('lets reviewBy win until the record is reviewed on or after it', () => {
    const data = { status: 'accepted', date: '2025-01-01', reviewBy: '2026-03-01', reviewEvery: '1 year' };
    expect(nextReview(data, opts())).toMatchObject({ due: '2026-03-01', from: 'reviewBy' });
    expect(nextReview({ ...data, reviewed: '2026-02-28' }, opts())).toMatchObject({ due: '2026-03-01', from: 'reviewBy' });
    expect(nextReview({ ...data, reviewed: '2026-03-01' }, opts())).toMatchObject({ due: '2027-03-01', from: 'interval' });
    expect(nextReview({ ...data, reviewed: '2026-05-10' }, opts())).toMatchObject({ due: '2027-05-10', from: 'interval' });
  });

  it('keeps reviewBy as a one-off when no interval applies', () => {
    expect(nextReview({ status: 'accepted', reviewBy: '2026-03-01' }, opts())).toMatchObject({ due: '2026-03-01', every: null, from: 'reviewBy' });
    expect(nextReview({ status: 'accepted', date: '2025-01-01', reviewBy: '2026-03-01', reviewed: '2026-03-02' }, opts())).toBeNull();
  });

  it('prefers the record interval over the project and the site', () => {
    const data = { status: 'accepted', date: '2026-01-01' };
    expect(nextReview(data, opts({ siteEvery: '2 years' }))?.due).toBe('2028-01-01');
    expect(nextReview(data, opts({ siteEvery: '2 years', projectEvery: '1 year' }))?.due).toBe('2027-01-01');
    expect(nextReview({ ...data, reviewEvery: '3 months' }, opts({ siteEvery: '2 years', projectEvery: '1 year' }))?.due).toBe('2026-04-01');
  });

  it('stops scheduling at the level that opts out', () => {
    const data = { status: 'accepted', date: '2026-01-01' };
    expect(nextReview({ ...data, reviewEvery: 'never' }, opts({ projectEvery: '1 year', siteEvery: '1 year' }))).toBeNull();
    expect(nextReview({ ...data, reviewEvery: false }, opts({ siteEvery: '1 year' }))).toBeNull();
    expect(nextReview(data, opts({ projectEvery: 'never', siteEvery: '1 year' }))).toBeNull();
    expect(nextReview({ ...data, reviewEvery: '1 year' }, opts({ projectEvery: 'never' }))?.due).toBe('2027-01-01');
  });

  it('ignores intervals it cannot read', () => {
    expect(nextReview({ status: 'accepted', date: '2026-01-01', reviewEvery: 'whenever' }, opts({ siteEvery: '1 year' }))).toBeNull();
  });

  it('keeps the opt-out for reviewBy records', () => {
    expect(nextReview({ status: 'accepted', reviewBy: '2026-03-01', reviewEvery: 'never' }, opts())).toMatchObject({ due: '2026-03-01', every: null });
  });
});

describe('reviewOptions', () => {
  it('collects the statuses and the project and site intervals', () => {
    const config = { statuses: { accepted: { label: 'A', current: true } }, reviews: { every: '2 years' } };
    const projects = new Map([['sre', { id: 'sre', data: { reviewEvery: '1 year' } }]]);
    expect(reviewOptions(config, projects, 'sre')).toEqual({ statuses: ['accepted'], projectEvery: '1 year', siteEvery: '2 years' });
    expect(reviewOptions(config, projects, 'pay')).toEqual({ statuses: ['accepted'], projectEvery: undefined, siteEvery: '2 years' });
  });
});

describe('reviewSchedule', () => {
  const statuses = { accepted: { label: 'A', current: true } };
  const record = (root, data) => ({ file: path.join(root, 'decisions/sre/adr/0001-x.md'), project: 'sre', data });

  it('applies project and site intervals', () => {
    const projects = new Map([['sre', { id: 'sre', data: { reviewEvery: '6 months' } }]]);
    const schedule = reviewSchedule({ statuses, reviews: { every: '1 year' }, contentDir: '/nowhere' }, projects);
    expect(schedule(record('/nowhere', { status: 'accepted', date: '2026-01-31' }))?.due).toBe('2026-07-31');
  });

  it('counts from the first commit when the record has no date', () => {
    const root = tmpSite({ 'decisions/sre/adr/0001-x.md': '---\ntitle: X\nstatus: accepted\n---\n' });
    const env = { ...process.env, GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@x.test', GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@x.test', GIT_AUTHOR_DATE: '2025-03-10T12:00:00Z', GIT_COMMITTER_DATE: '2025-03-10T12:00:00Z' };
    for (const args of [['init', '-q'], ['add', '-A'], ['commit', '-q', '-m', 'x']]) spawnSync('git', args, { cwd: root, env });
    const config = { statuses, reviews: { every: '1 year' }, contentDir: path.join(root, 'decisions') };
    expect(reviewSchedule(config, new Map())(record(root, { status: 'accepted' }))?.due).toBe('2026-03-10');
    expect(reviewSchedule({ ...config, git: { dates: false } }, new Map())(record(root, { status: 'accepted' }))).toBeNull();
  });
});
