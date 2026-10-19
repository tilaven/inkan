import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { run as rfcReview } from '../lib/commands/rfc-review.mjs';
import { parseFrontMatter } from '../lib/records.mjs';
import { configModule, tmpSite } from './helpers.mjs';

const record = (title, extra = '') => `---\n# keep me\ntitle: "${title}"\nstatus: proposed\nauthors: [kim]\n${extra}---\n\n## Context\n\nText.\n`;
const today = new Date().toISOString().slice(0, 10);

function site(extra = {}) {
  const root = tmpSite({
    'decisions/sre/_project.yml': 'name: SRE\n',
    'decisions/sre/rfc/0001-queues.md': record('Queues', 'reviewBy: 2026-12-01\nreviewers: [alice, bob]\n'),
    'decisions/sre/rfc/0002-limits.md': record('Limits', 'reviewers:\n  alice: approved\n  bob: pending\n'),
    'decisions/sre/rfc/0003-tracing.md': record('Tracing', 'reviewers:\n  carol: changes-requested\n'),
    'decisions/sre/rfc/0004-done.md': record('Done', 'status: accepted\nreviewers: [alice]\n').replace('status: proposed\n', ''),
    ...extra,
  });
  const read = (f) => fs.readFileSync(path.join(root, 'decisions', f), 'utf8');
  const log = [];
  return { root, read, log, logger: (l) => log.push(l) };
}

describe('inkan rfc-review', () => {
  it('records an answer, keeps the file as written and counts approvals', async () => {
    const { root, read, log, logger } = site();
    expect(await rfcReview({ args: ['sre/rfc/1', 'alice', 'approve'], flags: { note: 'Looks good' }, root, log: logger })).toBe(0);
    const text = read('sre/rfc/0001-queues.md');
    expect(text).toContain('# keep me');
    expect(text.endsWith('---\n\n## Context\n\nText.\n')).toBe(true);
    expect(parseFrontMatter(text).data.reviewers).toEqual({
      alice: { state: 'approved', date: today, note: 'Looks good' },
      bob: 'pending',
    });
    expect(log).toEqual(['sre/rfc/0001-queues: alice approved (1 of 2 approvals)']);
  });

  it('adds missing reviewers, accepts state names and resets', async () => {
    const { root, read, log, logger } = site();
    await rfcReview({ args: ['SRE-RFC-0002', 'dan', 'changes-requested'], flags: {}, root, log: logger });
    await rfcReview({ args: ['SRE-RFC-0002', 'alice', 'reset'], flags: {}, root, log: logger });
    expect(parseFrontMatter(read('sre/rfc/0002-limits.md')).data.reviewers).toEqual({
      alice: 'pending',
      bob: 'pending',
      dan: { state: 'changes-requested', date: today },
    });
    expect(log).toEqual(['sre/rfc/0002-limits: dan requested changes (1 of 3 approvals)', 'sre/rfc/0002-limits: alice reset to pending (0 of 3 approvals)']);
  });

  it('prints a diff and writes nothing with --dry-run', async () => {
    const { root, read, log, logger } = site();
    await rfcReview({ args: ['sre/rfc/1', 'bob', 'approve'], flags: { 'dry-run': true }, root, log: logger });
    expect(read('sre/rfc/0001-queues.md')).toContain('reviewers: [alice, bob]');
    expect(log[0]).toContain('+ ');
    expect(log.at(-1)).toBe('sre/rfc/0001-queues: bob approved (1 of 2 approvals) [dry run]');
  });

  it('warns about reviewers missing from _authors.yml', async () => {
    const { root, log, logger } = site({ 'decisions/_authors.yml': '- id: kim\n  name: Kim\n' });
    await rfcReview({ args: ['sre/rfc/1', 'alice', 'approve'], flags: {}, root, log: logger });
    expect(log[0]).toBe('warning: reviewer "alice" is not in _authors.yml');
  });

  it('rejects unknown verdicts, records and missing arguments', async () => {
    const { root, logger } = site();
    await expect(rfcReview({ args: ['sre/rfc/1', 'alice', 'aprove'], flags: {}, root, log: logger })).rejects.toThrow('Did you mean "approve"?');
    await expect(rfcReview({ args: ['sre/rfc/9', 'alice', 'approve'], flags: {}, root, log: logger })).rejects.toThrow('No record matches');
    await expect(rfcReview({ args: ['sre/rfc/1', 'alice'], flags: {}, root, log: logger })).rejects.toThrow('Usage');
    await expect(rfcReview({ args: [], flags: {}, root, log: logger })).rejects.toThrow('Usage');
  });

  it('lists the open records waiting on a reviewer', async () => {
    const { root, log, logger } = site();
    await rfcReview({ args: [], flags: { for: 'bob' }, root, log: logger });
    expect(log).toEqual(['SRE-RFC-0001  Queues  (review, review by 2026-12-01)', 'SRE-RFC-0002  Limits  (review)']);
    log.length = 0;
    await rfcReview({ args: [], flags: { for: 'kim', format: 'json' }, root, log: logger });
    expect(JSON.parse(log[0])).toEqual([{ id: 'sre/rfc/0003-tracing', ref: 'SRE-RFC-0003', title: 'Tracing', why: 'changes requested', reviewBy: null }]);
    log.length = 0;
    await rfcReview({ args: [], flags: { for: 'zed' }, root, log: logger });
    expect(log).toEqual(['Nothing is waiting on zed.']);
  });

  it('is wired into the CLI', async () => {
    const { root } = site({ 'inkan.config.mjs': configModule('{ reviewers: { approvals: 1 } }') });
    const { spawnSync } = await import('node:child_process');
    const cli = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../bin/cli.mjs');
    const r = spawnSync(process.execPath, [cli, 'rfc-review', 'sre/rfc/1', 'alice', 'approve', '--root', root], { encoding: 'utf8' });
    expect(r.stdout.trim()).toBe('sre/rfc/0001-queues: alice approved (1 of 1 approvals)');
  });
});
