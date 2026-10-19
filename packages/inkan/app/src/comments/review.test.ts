import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { lineUrl, nextPage, parseReviewUrl, pinComments, readReviewComments, reviewRequestUrl, type ReviewTarget } from './review';

const file = 'docs/rfc/0001.md';
const github: ReviewTarget = { provider: 'github', owner: 'o', repo: 'r', number: 12, url: 'https://github.com/o/r/pull/12' };
const gitlab: ReviewTarget = { provider: 'gitlab', host: 'https://gitlab.example.com', project: 'g/sub/r', iid: 7, url: 'https://gitlab.example.com/g/sub/r/-/merge_requests/7' };

describe('parseReviewUrl', () => {
  it('parses GitHub pull requests, dropping the sub page, query and hash', () => {
    expect(parseReviewUrl('https://github.com/o/r/pull/12')).toEqual(github);
    expect(parseReviewUrl('https://github.com/o/r/pull/12/files?diff=unified#diff-abc')).toEqual(github);
    expect(parseReviewUrl('https://www.github.com/o/r/pull/12/')).toEqual(github);
  });

  it('parses merge requests on any GitLab host, keeping nested groups', () => {
    expect(parseReviewUrl('https://gitlab.example.com/g/sub/r/-/merge_requests/7')).toEqual(gitlab);
    expect(parseReviewUrl('https://gitlab.example.com/g/sub/r/-/merge_requests/7/diffs#note_1')).toEqual(gitlab);
    expect(parseReviewUrl('https://gitlab.com/g/r/-/merge_requests/3/')).toEqual({ provider: 'gitlab', host: 'https://gitlab.com', project: 'g/r', iid: 3, url: 'https://gitlab.com/g/r/-/merge_requests/3' });
  });

  it('rejects issues, other pages and garbage', () => {
    expect(parseReviewUrl('https://github.com/o/r/issues/12')).toBeNull();
    expect(parseReviewUrl('https://github.com/o/r/pull/new')).toBeNull();
    expect(parseReviewUrl('https://github.com/o/r/pull/12abc')).toBeNull();
    expect(parseReviewUrl('https://gitlab.example.com/g/r/-/issues/7')).toBeNull();
    expect(parseReviewUrl('https://gitlab.example.com/g/r/-/merge_requests/')).toBeNull();
    expect(parseReviewUrl('ftp://github.com/o/r/pull/12')).toBeNull();
    expect(parseReviewUrl('not a url')).toBeNull();
    expect(parseReviewUrl('')).toBeNull();
    expect(parseReviewUrl(undefined)).toBeNull();
  });
});

describe('reviewRequestUrl', () => {
  it('asks the GitHub REST API for the review comments', () => {
    expect(reviewRequestUrl(github)).toBe('https://api.github.com/repos/o/r/pulls/12/comments?per_page=100');
  });

  it('asks GitLab GraphQL for notes with their diff position', () => {
    const u = new URL(reviewRequestUrl({ ...gitlab, host: 'https://gitlab.example.com/' }));
    expect(u.origin + u.pathname).toBe('https://gitlab.example.com/api/graphql');
    expect(JSON.parse(u.searchParams.get('variables')!)).toEqual({ path: 'g/sub/r', iid: '7' });
    const query = u.searchParams.get('query')!;
    expect(query).toContain('mergeRequest(iid: $iid)');
    expect(query).toContain('notes(last: 100, filter: ONLY_COMMENTS)');
    expect(query).toContain('position { filePath newLine oldLine }');
    expect(query).toContain('author { name username webUrl avatarUrl }');
  });
});

describe('readReviewComments', () => {
  const user = { login: 'ana', html_url: 'https://github.com/ana', avatar_url: 'https://avatars.githubusercontent.com/u/1' };

  it('reads GitHub comments on the file, outdated ones at their original line, none on removed lines, sorted by line then date', () => {
    const json = [
      { path: file, line: 20, original_line: 18, body: 'Later', user, html_url: 'https://github.com/o/r/pull/12#discussion_r2', created_at: '2026-10-17T10:00:00Z' },
      { path: file, line: 20, original_line: 18, body: 'Earlier', user, html_url: 'https://github.com/o/r/pull/12#discussion_r1', created_at: '2026-10-17T09:00:00Z' },
      { path: file, line: null, original_line: 5, body: 'Old', user: { login: 'reviewer' }, html_url: 'https://github.com/o/r/pull/12#discussion_r3', created_at: '2026-10-16T09:00:00Z' },
      { path: 'other.md', line: 1, body: 'Elsewhere', user, created_at: '2026-10-16T09:00:00Z' },
      { path: file, line: 4, side: 'LEFT', body: 'On a removed line', user, created_at: '' },
      { path: file, line: 0, body: 'No line', user, created_at: '' },
      { path: file, line: 'x', body: 'String line', user, created_at: '' },
      { path: file, line: 3, body: 7, user, created_at: '' },
      { path: file, line: 3, body: 'Odd links', user: { login: 'ana', html_url: 'javascript:alert(1)', avatar_url: 'data:image/png;base64,AA' }, html_url: 'mailto:x@y', created_at: '' },
      null,
    ];
    expect(readReviewComments(github, json, file)).toEqual([
      { line: 3, outdated: false, body: 'Odd links', author: { name: 'ana', url: undefined, avatar: undefined }, url: undefined, createdAt: '' },
      { line: 5, outdated: true, body: 'Old', author: { name: 'reviewer', url: undefined, avatar: undefined }, url: 'https://github.com/o/r/pull/12#discussion_r3', createdAt: '2026-10-16T09:00:00Z' },
      { line: 20, outdated: false, body: 'Earlier', author: { name: 'ana', url: user.html_url, avatar: user.avatar_url }, url: 'https://github.com/o/r/pull/12#discussion_r1', createdAt: '2026-10-17T09:00:00Z' },
      { line: 20, outdated: false, body: 'Later', author: { name: 'ana', url: user.html_url, avatar: user.avatar_url }, url: 'https://github.com/o/r/pull/12#discussion_r2', createdAt: '2026-10-17T10:00:00Z' },
    ]);
  });

  it('reads GitLab notes positioned on the file, skipping removed lines, with avatars made absolute', () => {
    const author = { name: 'Ana', username: 'ana', webUrl: 'https://gitlab.example.com/ana', avatarUrl: '/uploads/a.png' };
    const nodes = [
      { body: 'On new line', createdAt: '2026-10-17T09:00:00Z', url: 'https://gitlab.example.com/g/sub/r/-/merge_requests/7#note_2', author, position: { filePath: file, newLine: 9, oldLine: null } },
      { body: 'On removed line', createdAt: '2026-10-17T09:00:00Z', url: null, author, position: { filePath: file, newLine: null, oldLine: 4 } },
      { body: 'Other file', createdAt: '', url: null, author, position: { filePath: 'other.md', newLine: 1, oldLine: 1 } },
      { body: 'Plain note', createdAt: '', url: null, author, position: null },
      { body: 'No author', createdAt: '2026-10-17T08:00:00Z', url: 'https://gitlab.example.com/g/sub/r/-/merge_requests/7#note_1', author: null, position: { filePath: file, newLine: 2, oldLine: 2 } },
      { body: 'Username only', createdAt: '', url: null, author: { username: 'reviewer', avatarUrl: 'https://cdn.example.com/r.png' }, position: { filePath: file, newLine: 2.5, oldLine: null } },
      { body: 'Bad avatar', createdAt: '', url: null, author: { username: 'reviewer', avatarUrl: 'javascript:alert(1)' }, position: { filePath: file, newLine: 11, oldLine: null } },
      { body: null, createdAt: '', url: null, author, position: { filePath: file, newLine: 1, oldLine: null } },
      null,
    ];
    const json = { data: { project: { mergeRequest: { notes: { nodes } } } } };
    expect(readReviewComments(gitlab, json, file)).toEqual([
      { line: 2, outdated: false, body: 'No author', author: { name: '', url: undefined, avatar: undefined }, url: 'https://gitlab.example.com/g/sub/r/-/merge_requests/7#note_1', createdAt: '2026-10-17T08:00:00Z' },
      { line: 9, outdated: false, body: 'On new line', author: { name: 'Ana', url: author.webUrl, avatar: 'https://gitlab.example.com/uploads/a.png' }, url: 'https://gitlab.example.com/g/sub/r/-/merge_requests/7#note_2', createdAt: '2026-10-17T09:00:00Z' },
      { line: 11, outdated: false, body: 'Bad avatar', author: { name: 'reviewer', url: undefined, avatar: undefined }, url: undefined, createdAt: '' },
    ]);
  });

  it('returns nothing for missing or malformed responses', () => {
    expect(readReviewComments(github, null, file)).toEqual([]);
    expect(readReviewComments(github, { message: 'API rate limit exceeded' }, file)).toEqual([]);
    expect(readReviewComments(github, 'nope', file)).toEqual([]);
    expect(readReviewComments(gitlab, null, file)).toEqual([]);
    expect(readReviewComments(gitlab, [], file)).toEqual([]);
    expect(readReviewComments(gitlab, { data: { project: null }, errors: [{ message: 'not found' }] }, file)).toEqual([]);
    expect(readReviewComments(gitlab, { data: { project: { mergeRequest: { notes: { nodes: 'x' } } } } }, file)).toEqual([]);
  });
});

describe('pinComments', () => {
  const blocks = [
    { start: 5, end: 7 },
    { start: 9, end: 9 },
    { start: 12, end: 20 },
  ];
  const at = (...lines: number[]) => lines.map((line) => ({ line }));

  it('pins each line to the block containing it, or the nearest block above', () => {
    const pins = pinComments(blocks, at(6, 5, 7, 9, 12, 20, 8, 10, 11));
    expect([...pins.keys()].sort()).toEqual([0, 1, 2]);
    expect(pins.get(0)).toEqual(at(6, 5, 7, 8));
    expect(pins.get(1)).toEqual(at(9, 10, 11));
    expect(pins.get(2)).toEqual(at(12, 20));
  });

  it('pins lines outside the blocks to the first or last one', () => {
    const pins = pinComments(blocks, at(1, 4, 21, 999));
    expect(pins.get(0)).toEqual(at(1, 4));
    expect(pins.get(2)).toEqual(at(21, 999));
    expect(pins.has(1)).toBe(false);
  });

  it('keeps the comments and leaves blocks without comments out', () => {
    const comments = [{ line: 6, body: 'a' }, { line: 13, body: 'b' }];
    const pins = pinComments(blocks, comments);
    expect(pins.get(0)).toEqual([comments[0]]);
    expect(pins.get(2)).toEqual([comments[1]]);
    expect(pins.size).toBe(2);
    expect(pinComments(blocks, []).size).toBe(0);
    expect(pinComments([], at(1, 2)).size).toBe(0);
  });
});

describe('lineUrl', () => {
  const hash = (algorithm: string) => createHash(algorithm).update(file).digest('hex');

  it('opens the GitHub diff at the line of the file', async () => {
    await expect(lineUrl(github, file, 42)).resolves.toBe(`https://github.com/o/r/pull/12/files#diff-${hash('sha256')}R42`);
  });

  it('opens the GitLab diff at the file', async () => {
    await expect(lineUrl(gitlab, file, 42)).resolves.toBe(`https://gitlab.example.com/g/sub/r/-/merge_requests/7/diffs#${hash('sha1')}`);
  });

  it('falls back to the bare diff without Web Crypto', async () => {
    vi.stubGlobal('crypto', undefined);
    try {
      await expect(lineUrl(github, file, 42)).resolves.toBe('https://github.com/o/r/pull/12/files');
      await expect(lineUrl(gitlab, file, 42)).resolves.toBe('https://gitlab.example.com/g/sub/r/-/merge_requests/7/diffs');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('nextPage', () => {
  it('reads the next link of a GitHub Link header', () => {
    const link = '<https://api.github.com/repositories/1/pulls/12/comments?per_page=100&page=2>; rel="next", <https://api.github.com/repositories/1/pulls/12/comments?per_page=100&page=3>; rel="last"';
    expect(nextPage(link)).toBe('https://api.github.com/repositories/1/pulls/12/comments?per_page=100&page=2');
  });

  it('is null on the last page, without a header or for non-http links', () => {
    expect(nextPage('<https://api.github.com/x?page=1>; rel="prev"')).toBeNull();
    expect(nextPage(null)).toBeNull();
    expect(nextPage('<javascript:alert(1)>; rel="next"')).toBeNull();
  });
});
