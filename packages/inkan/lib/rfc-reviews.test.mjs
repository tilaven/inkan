import { describe, expect, it } from 'vitest';
import { parseReviewers, reviewSummary, setReview } from './rfc-reviews.mjs';

describe('parseReviewers', () => {
  it('reads a handle, a list and a map', () => {
    expect(parseReviewers('alice').reviewers).toEqual([{ handle: 'alice', state: 'pending' }]);
    expect(parseReviewers(['alice', { bob: 'approved' }]).reviewers).toEqual([
      { handle: 'alice', state: 'pending' },
      { handle: 'bob', state: 'approved' },
    ]);
    expect(
      parseReviewers({ alice: 'Approved', bob: { state: 'changes-requested', date: new Date('2026-10-12'), note: 'Rollback?' }, carol: null }).reviewers,
    ).toEqual([
      { handle: 'alice', state: 'approved' },
      { handle: 'bob', state: 'changes-requested', date: '2026-10-12', note: 'Rollback?' },
      { handle: 'carol', state: 'pending' },
    ]);
  });

  it('keeps the readable reviewers and reports the rest', () => {
    const { reviewers, errors } = parseReviewers({ alice: 'lgtm', bob: { state: 'approved', when: 'x' } });
    expect(reviewers).toEqual([{ handle: 'bob', state: 'approved' }]);
    expect(errors).toEqual([
      'reviewer "alice" has unknown state "lgtm" (use pending, approved, changes-requested)',
      'reviewer "bob" has unknown key when (use state, date, note)',
    ]);
    expect(parseReviewers(42).errors).toHaveLength(1);
    expect(parseReviewers([{ a: 1, b: 2 }]).errors).toHaveLength(1);
  });
});

describe('reviewSummary', () => {
  const r = (spec) => parseReviewers(spec).reviewers;
  const base = { authors: ['ann'], deciders: [], open: true };

  it('waits on pending reviewers until enough approve', () => {
    const s = reviewSummary({ ...base, reviewers: r({ alice: 'approved', bob: 'pending', carol: 'pending' }) });
    expect(s).toMatchObject({ status: 'in-review', approved: 1, pending: 2, required: 3, waitingOn: ['bob', 'carol'] });
    expect(reviewSummary({ ...base, approvals: 1, reviewers: r({ alice: 'approved', bob: 'pending' }) })).toMatchObject({ status: 'approved', required: 1, waitingOn: ['ann'] });
  });

  it('hands the record back to the authors when changes are requested', () => {
    expect(reviewSummary({ ...base, reviewers: r({ alice: 'changes-requested', bob: 'approved' }) })).toMatchObject({ status: 'changes-requested', waitingOn: ['ann'] });
  });

  it('asks the deciders to settle an approved record', () => {
    expect(reviewSummary({ ...base, deciders: ['dan'], reviewers: r(['alice']) }).status).toBe('in-review');
    expect(reviewSummary({ ...base, deciders: ['dan'], reviewers: r({ alice: 'approved' }) }).waitingOn).toEqual(['dan']);
  });

  it('waits on nobody once the record is closed or has no reviewers', () => {
    expect(reviewSummary({ ...base, open: false, reviewers: r(['alice']) })).toMatchObject({ status: 'closed', waitingOn: [] });
    expect(reviewSummary({ ...base, reviewers: [] })).toMatchObject({ status: 'none', required: 0, waitingOn: [] });
  });
});

describe('setReview', () => {
  it('writes the map form and keeps the others', () => {
    expect(setReview(['alice', 'bob'], 'bob', 'approved', { date: '2026-10-17' })).toEqual({ alice: 'pending', bob: { state: 'approved', date: '2026-10-17' } });
    expect(setReview({ alice: 'approved' }, 'carol', 'changes-requested', { note: 'Why?' })).toEqual({ alice: 'approved', carol: { state: 'changes-requested', note: 'Why?' } });
    expect(setReview({ alice: { state: 'approved', date: '2026-10-01' } }, 'alice', 'pending', { date: '2026-10-17' })).toEqual({ alice: 'pending' });
  });

  it('refuses unknown states and unreadable values', () => {
    expect(() => setReview([], 'a', 'lgtm')).toThrow('Unknown review state "lgtm"');
    expect(() => setReview({ a: 'nope' }, 'b', 'approved')).toThrow('unknown state');
  });
});

describe('handles', () => {
  it('match without case or a leading @', () => {
    expect(parseReviewers(['Marek', { '@marek': 'approved' }]).reviewers).toEqual([{ handle: 'marek', state: 'approved' }]);
    expect(setReview({ Marek: 'pending' }, '@marek', 'approved')).toEqual({ Marek: 'approved' });
    expect(() => setReview([], ' @ ', 'approved')).toThrow('empty');
  });
});
