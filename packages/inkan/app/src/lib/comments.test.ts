import { describe, expect, it } from 'vitest';
import { hasComments, type CommentsRule } from './comments';

const rule: CommentsRule = { enabled: true, provider: 'giscus', types: ['rfc'], statuses: null };
const rec = (type: string | null, status?: string, comments?: boolean) => ({ type, status, entry: { data: { comments } } });

describe('hasComments', () => {
  it('follows the configured types and statuses', () => {
    expect(hasComments(rec('rfc', 'draft'), rule)).toBe(true);
    expect(hasComments(rec('adr', 'accepted'), rule)).toBe(false);
    expect(hasComments(rec(null), rule)).toBe(false);
    const open = { ...rule, statuses: ['draft', 'proposed'] };
    expect(hasComments(rec('rfc', 'proposed'), open)).toBe(true);
    expect(hasComments(rec('rfc', 'accepted'), open)).toBe(false);
    expect(hasComments(rec('rfc'), open)).toBe(false);
  });

  it('lets front matter switch a single record', () => {
    expect(hasComments(rec('rfc', 'draft', false), rule)).toBe(false);
    expect(hasComments(rec('adr', 'accepted', true), rule)).toBe(true);
  });

  it('shows nothing when comments are off', () => {
    expect(hasComments(rec('rfc', 'draft', true), { ...rule, enabled: false })).toBe(false);
    expect(hasComments(rec('rfc', 'draft', true), { ...rule, provider: null })).toBe(false);
  });
});
