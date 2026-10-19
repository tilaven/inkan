import { describe, expect, it } from 'vitest';
import { commentCount, httpUrl, isoDate, newIssueUrl, notesUrl, parseDiscussionUrl, pickIssue, readNotes, searchUrl, webUrl } from './gitlab';

const host = 'https://gitlab.example.com/';

describe('parseDiscussionUrl', () => {
  it('parses issues and merge requests on the host', () => {
    expect(parseDiscussionUrl('https://gitlab.example.com/group/sub/repo/-/issues/12', host)).toEqual({ kind: 'issues', project: 'group/sub/repo', iid: 12 });
    expect(parseDiscussionUrl('https://gitlab.example.com/g/r/-/merge_requests/3/', host)).toEqual({ kind: 'merge_requests', project: 'g/r', iid: 3 });
    expect(parseDiscussionUrl('https://gitlab.example.com/g/r/-/work_items/5', host)).toEqual({ kind: 'issues', project: 'g/r', iid: 5 });
  });

  it('rejects other hosts, other pages and garbage', () => {
    expect(parseDiscussionUrl('https://gitlab.com/g/r/-/issues/1', host)).toBeNull();
    expect(parseDiscussionUrl('https://gitlab.example.com/g/r/-/epics/1', host)).toBeNull();
    expect(parseDiscussionUrl('https://gitlab.example.com/g/r/-/issues/new', host)).toBeNull();
    expect(parseDiscussionUrl('not a url', host)).toBeNull();
    expect(parseDiscussionUrl(undefined, host)).toBeNull();
  });
});

describe('urls', () => {
  const target = { kind: 'issues' as const, project: 'g/r', iid: 7 };

  it('builds the web and API urls without doubled slashes', () => {
    expect(webUrl(host, target)).toBe('https://gitlab.example.com/g/r/-/issues/7');
    const issue = new URL(notesUrl(host, { ...target, project: '/g/r/' }));
    expect(issue.origin + issue.pathname).toBe('https://gitlab.example.com/api/graphql');
    expect(JSON.parse(issue.searchParams.get('variables')!)).toEqual({ path: 'g/r', iid: '7' });
    expect(issue.searchParams.get('query')).toContain('item: issue(iid: $iid)');
    expect(issue.searchParams.get('query')).toContain('notes(last: 100, filter: ONLY_COMMENTS)');
    expect(new URL(notesUrl(host, { ...target, kind: 'merge_requests' })).searchParams.get('query')).toContain('item: mergeRequest(iid: $iid)');
  });

  it('reads the thread from a GraphQL response', () => {
    const note = { id: 'gid://gitlab/Note/1', body: 'Hi', createdAt: '2026-10-17T09:00:00Z', author: { name: 'Ana', avatarUrl: '/uploads/a.png' } };
    const json = { data: { project: { item: { webUrl: 'https://gitlab.example.com/g/r/-/work_items/7', notes: { pageInfo: { hasPreviousPage: true }, nodes: [note, null] } } } } };
    expect(readNotes(json, host)).toEqual({
      webUrl: 'https://gitlab.example.com/g/r/-/work_items/7',
      more: true,
      notes: [{ ...note, author: { name: 'Ana', avatarUrl: 'https://gitlab.example.com/uploads/a.png' } }],
    });
    expect(readNotes({ data: { project: null }, errors: [{ message: 'not found' }] }, host)).toBeNull();
    expect(readNotes(null, host)).toBeNull();
    const odd = { data: { project: { item: { notes: { nodes: [{ id: '2', body: 7 }, { id: '3', body: 'Ok', createdAt: '', author: null }] } } } } };
    expect(readNotes(odd, host)).toEqual({ webUrl: undefined, more: false, notes: [{ id: '3', body: 'Ok', createdAt: '', author: null }] });
  });

  it('searches by ref in titles, falling back to the title', () => {
    expect(searchUrl({ host, project: 'g/r', ref: 'SRE-RFC-0001', title: 'Use SLOs' })).toBe(
      'https://gitlab.example.com/api/v4/projects/g%2Fr/issues?search=SRE-RFC-0001&in=title&state=all&per_page=20',
    );
    expect(searchUrl({ host, project: 'g/r', ref: null, title: 'Use SLOs' })).toContain('search=Use+SLOs');
  });

  it('prefills a new issue with the title, the page link and label commands', () => {
    const u = new URL(newIssueUrl({ host, project: 'g/r', title: 'SRE-RFC-0001 Use SLOs', pageUrl: 'https://docs.example.com/sre/rfc/1/', labels: ['rfc', 'needs review'] }));
    expect(u.origin + u.pathname).toBe('https://gitlab.example.com/g/r/-/issues/new');
    expect(u.searchParams.get('issue[title]')).toBe('SRE-RFC-0001 Use SLOs');
    expect(u.searchParams.get('issue[description]')).toBe('https://docs.example.com/sre/rfc/1/\n\n/label ~"rfc"\n/label ~"needs review"');
  });

  it('omits the label block when there are none', () => {
    const u = new URL(newIssueUrl({ host, project: 'g/r', title: 'T', pageUrl: 'https://d/p/' }));
    expect(u.searchParams.get('issue[description]')).toBe('https://d/p/');
  });
});

describe('pickIssue', () => {
  const issues = [
    { iid: 1, title: 'SRE-RFC-00012 later one' },
    { iid: 2, title: 'sre-rfc-0001: Use SLOs' },
    { iid: 3, title: 'Use SLOs' },
  ];

  it('matches the ref at the start, case-insensitively, as a whole token', () => {
    expect(pickIssue(issues, { ref: 'SRE-RFC-0001', title: 'Use SLOs' })?.iid).toBe(2);
    expect(pickIssue(issues, { ref: 'SRE-RFC-0002', title: 'x' })).toBeUndefined();
  });

  it('compares titles when the record has no ref', () => {
    expect(pickIssue(issues, { ref: null, title: 'use slos ' })?.iid).toBe(3);
    expect(pickIssue(issues, { title: 'Use' })).toBeUndefined();
  });
});

describe('rendering helpers', () => {
  it('keeps only http(s) urls', () => {
    expect(httpUrl('https://gitlab.com/u')).toBe('https://gitlab.com/u');
    expect(httpUrl('javascript:alert(1)')).toBeUndefined();
    expect(httpUrl('/relative')).toBeUndefined();
    expect(httpUrl(null)).toBeUndefined();
  });

  it('formats dates and counts', () => {
    expect(isoDate('2026-10-17T09:30:00.000Z')).toBe('2026-10-17');
    expect(commentCount(0)).toBe('No comments yet');
    expect(commentCount(1)).toBe('1 comment on GitLab');
    expect(commentCount(4)).toBe('4 comments on GitLab');
    expect(commentCount(97, true)).toBe('Latest 97 comments on GitLab');
  });
});
