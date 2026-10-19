import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { tmpSite } from '../test/helpers.mjs';
import { gitHistory, loadAuthors, matchAuthor, statusHistory } from './git.mjs';

const git = (cwd, args, env = {}) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout;
};
/** Commits everything with the given author at `date` (seconds since the epoch). */
const commit = (cwd, message, { name, email, date }) => {
  git(cwd, ['add', '-A']);
  git(cwd, ['commit', '-q', '-m', message], {
    GIT_AUTHOR_NAME: name,
    GIT_AUTHOR_EMAIL: email,
    GIT_COMMITTER_NAME: name,
    GIT_COMMITTER_EMAIL: email,
    GIT_AUTHOR_DATE: `${date} +0000`,
    GIT_COMMITTER_DATE: `${date + 1000} +0000`,
  });
};

const ann = { name: 'Ann Alpha', email: 'ann@acme.test', date: 1_700_000_000 };
const bob = { name: 'Bob Beta', email: 'bob@acme.test', date: 1_700_500_000 };

function repo() {
  const root = tmpSite({ 'decisions/sre/adr/0001-first.md': '---\ntitle: First\n---\n', 'decisions/sre/adr/0002 second "q".md': '---\ntitle: Second\n---\n', 'pages/handbook.md': '# Hi\n' });
  git(root, ['init', '-q']);
  commit(root, 'first', ann);
  fs.appendFileSync(path.join(root, 'decisions/sre/adr/0001-first.md'), 'Body\n');
  fs.writeFileSync(path.join(root, 'decisions/sre/adr/0003-third.md'), '---\ntitle: Third\n---\n');
  commit(root, 'second', bob);
  return root;
}

const adr = (status, body = '') => `---\ntitle: T\n${status ? `status: ${status}\n` : ''}---\n${body}`;
const sha = (cwd) => git(cwd, ['rev-parse', 'HEAD']).trim();

describe('statusHistory', () => {
  it('lists status changes oldest first with author date, author and commit, dropping no-op touches', () => {
    const root = tmpSite({ 'decisions/sre/adr/0001-a.md': adr('proposed'), 'decisions/sre/adr/0002-b.md': adr(), 'decisions/sre/adr/notes.txt': 'status: x\n' });
    git(root, ['init', '-q']);
    const file = path.join(root, 'decisions/sre/adr/0001-a.md');
    commit(root, 'add', ann);
    const first = sha(root);
    fs.writeFileSync(file, adr('proposed', 'Body\n'));
    commit(root, 'edit body', { ...ann, date: ann.date + 10 });
    fs.writeFileSync(file, adr('"proposed"', 'Body\nstatus: not front matter\n'));
    commit(root, 'touch the line', { ...bob, date: bob.date - 10 });
    fs.writeFileSync(file, adr('accepted', 'Body\nstatus: not front matter\n'));
    commit(root, 'accept', bob);
    const second = sha(root);
    fs.writeFileSync(path.join(root, 'decisions/sre/adr/0002-b.md'), adr('draft'));
    commit(root, 'give b a status', bob);

    const history = statusHistory([path.join(root, 'decisions')]);
    const real = fs.realpathSync(root);
    const a = history?.get(path.join(real, 'decisions/sre/adr/0001-a.md'));
    expect(a).toEqual([
      { status: 'proposed', date: new Date(ann.date * 1000), author: { name: ann.name, email: ann.email }, commit: first, path: 'decisions/sre/adr/0001-a.md', root: real },
      { status: 'accepted', date: new Date(bob.date * 1000), author: { name: bob.name, email: bob.email }, commit: second, path: 'decisions/sre/adr/0001-a.md', root: real },
    ]);
    expect(history?.get(path.join(real, 'decisions/sre/adr/0002-b.md'))?.map((c) => c.status)).toEqual(['draft']);
    expect(history?.has(path.join(real, 'decisions/sre/adr/notes.txt'))).toBe(false);
    expect(history?.size).toBe(2);
  });

  it('keeps both sides of a merge, orders by author date and skips front matter that does not parse', () => {
    const root = tmpSite({ 'decisions/x/adr/0001-a.md': adr('proposed') });
    const file = path.join(root, 'decisions/x/adr/0001-a.md');
    git(root, ['init', '-q', '-b', 'main']);
    commit(root, 'add', ann);
    git(root, ['checkout', '-q', '-b', 'side']);
    fs.writeFileSync(file, adr('accepted'));
    commit(root, 'accept', { ...bob, date: ann.date + 100 });
    git(root, ['checkout', '-q', 'main']);
    fs.writeFileSync(file, '---\ntitle: [broken\nstatus: proposed\n---\n');
    commit(root, 'break', { ...ann, date: ann.date + 150 });
    fs.writeFileSync(file, adr('implemented'));
    commit(root, 'implement', { ...ann, date: ann.date + 200 });
    git(root, ['merge', '-q', '-X', 'ours', '--no-edit', 'side'], { GIT_AUTHOR_NAME: ann.name, GIT_AUTHOR_EMAIL: ann.email, GIT_COMMITTER_NAME: ann.name, GIT_COMMITTER_EMAIL: ann.email });
    const history = statusHistory([path.join(root, 'decisions')]);
    expect(history?.get(path.join(fs.realpathSync(root), 'decisions/x/adr/0001-a.md'))?.map((c) => c.status)).toEqual(['proposed', 'accepted', 'implemented']);
  });

  it('ignores a status line in the body and files that never had a status', () => {
    const root = tmpSite({ 'decisions/x/adr/0001-a.md': adr(undefined, 'status: body\n'), 'decisions/x/adr/0002-b.md': adr() });
    git(root, ['init', '-q']);
    commit(root, 'add', ann);
    fs.writeFileSync(path.join(root, 'decisions/x/adr/0002-b.md'), adr(undefined, 'more\nstatus: later\n'));
    commit(root, 'edit', bob);
    expect(statusHistory([path.join(root, 'decisions')])?.size).toBe(0);
  });

  it('records a removed status as null and continues across a delete and re-add', () => {
    const root = tmpSite({ 'decisions/x/adr/0001-a.md': adr('accepted') });
    git(root, ['init', '-q']);
    const file = path.join(root, 'decisions/x/adr/0001-a.md');
    commit(root, 'add', ann);
    fs.rmSync(file);
    commit(root, 'delete', bob);
    fs.writeFileSync(file, adr('accepted'));
    commit(root, 'restore', bob);
    fs.writeFileSync(file, adr());
    commit(root, 'drop status', { ...bob, date: bob.date + 10 });
    const changes = statusHistory([path.join(root, 'decisions')])?.get(path.join(fs.realpathSync(root), 'decisions/x/adr/0001-a.md'));
    expect(changes?.map((c) => c.status)).toEqual(['accepted', null]);
    expect(changes?.[0].author.name).toBe(ann.name);
  });

  it('reads several folders and repositories, skipping shallow clones with one warning', () => {
    const a = tmpSite({ 'decisions/sre/adr/0001-a.md': adr('proposed'), 'more/0001-m.md': adr('draft') });
    git(a, ['init', '-q']);
    commit(a, 'add', ann);
    const b = tmpSite({ 'decisions/sre/adr/0001-b.md': adr('accepted') });
    git(b, ['init', '-q']);
    commit(b, 'add', bob);
    const shallow = path.join(tmpSite(), 'clone');
    git(a, ['clone', '-q', '--depth', '1', `file://${a}`, shallow]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const dirs = [path.join(a, 'decisions'), path.join(a, 'more'), path.join(b, 'decisions'), path.join(shallow, 'decisions')];
      const history = statusHistory(dirs);
      const keys = [...(history?.keys() ?? [])];
      expect(keys).toContain(path.join(fs.realpathSync(a), 'decisions/sre/adr/0001-a.md'));
      expect(keys).toContain(path.join(fs.realpathSync(a), 'more/0001-m.md'));
      expect(keys).toContain(path.join(fs.realpathSync(b), 'decisions/sre/adr/0001-b.md'));
      expect(keys.some((k) => k.startsWith(fs.realpathSync(shallow)))).toBe(false);
      statusHistory(dirs);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('returns null outside git', () => {
    expect(statusHistory([path.join(tmpSite({ 'decisions/a.md': adr('proposed') }), 'decisions')])).toBeNull();
  });
});

describe('gitHistory', () => {
  it('gives first commit (author date and author) and last change of every file in one pass', () => {
    const root = repo();
    const history = gitHistory([path.join(root, 'decisions'), path.join(root, 'pages'), path.join(root, 'missing')]);
    const real = fs.realpathSync(root);
    const at = (file) => {
      const h = history?.get(path.join(real, file));
      if (!h) throw new Error(`no history for ${file}`);
      return h;
    };
    const first = at('decisions/sre/adr/0001-first.md');
    expect(first.created.getTime()).toBe(ann.date * 1000);
    expect(first.author).toEqual({ name: ann.name, email: ann.email });
    expect(first.updated.getTime()).toBe((bob.date + 1000) * 1000);
    const quoted = at('decisions/sre/adr/0002 second "q".md');
    expect(quoted.author.name).toBe(ann.name);
    expect(quoted.updated.getTime()).toBe((ann.date + 1000) * 1000);
    const third = at('decisions/sre/adr/0003-third.md');
    expect(third.author.email).toBe(bob.email);
    expect(at('pages/handbook.md').author.name).toBe(ann.name);
    expect(history?.size).toBe(4);
  });

  it('reads several repositories, skipping shallow clones with one warning', () => {
    const a = repo();
    const b = repo();
    const shallow = path.join(tmpSite(), 'clone');
    git(a, ['clone', '-q', '--depth', '1', `file://${a}`, shallow]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const dirs = [path.join(a, 'decisions'), path.join(b, 'decisions'), path.join(shallow, 'decisions')];
      const history = gitHistory(dirs);
      expect(history?.has(path.join(fs.realpathSync(a), 'decisions/sre/adr/0001-first.md'))).toBe(true);
      expect(history?.has(path.join(fs.realpathSync(b), 'decisions/sre/adr/0001-first.md'))).toBe(true);
      expect([...(history?.keys() ?? [])].some((f) => f.startsWith(fs.realpathSync(shallow)))).toBe(false);
      gitHistory(dirs);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('shallow clone');
    } finally {
      warn.mockRestore();
    }
  });

  it('returns null outside git and for missing folders', () => {
    const root = tmpSite({ 'decisions/x.md': '' });
    expect(gitHistory(path.join(root, 'decisions'))).toBeNull();
    expect(gitHistory(path.join(root, 'nope'))).toBeNull();
  });
});

describe('matchAuthor', () => {
  const authors = {
    ann: { name: 'Ann Alpha', email: 'Ann@acme.test' },
    bob: { name: 'Bob Beta', github: 'bobb' },
    cy: { name: 'Cy Gamma', gitlab: 'cy-g' },
  };
  it('matches by email, handle, name and hosting login', () => {
    expect(matchAuthor({ name: 'Someone', email: 'ann@acme.test' }, authors)).toBe('ann');
    expect(matchAuthor({ name: 'bob', email: 'x@y.z' }, authors)).toBe('bob');
    expect(matchAuthor({ name: 'BOB BETA', email: '' }, authors)).toBe('bob');
    expect(matchAuthor({ name: 'bobb', email: '' }, authors)).toBe('bob');
    expect(matchAuthor({ name: 'Cy', email: '123+cy-g@users.noreply.gitlab.com' }, authors)).toBe('cy');
    expect(matchAuthor({ name: 'B', email: '99+bobb@users.noreply.github.com' }, authors)).toBe('bob');
  });
  it('falls back to the git name', () => {
    expect(matchAuthor({ name: 'Dee Delta', email: 'dee@acme.test' }, authors)).toBe('Dee Delta');
    expect(matchAuthor({ name: '', email: 'dee@acme.test' }, {})).toBe('dee@acme.test');
  });
});

describe('loadAuthors', () => {
  it('reads list and map forms, and tolerates a missing file', () => {
    const list = tmpSite({ 'decisions/_authors.yml': '- id: ann\n  name: Ann\n  email: ann@acme.test\n' });
    expect(loadAuthors(path.join(list, 'decisions'))).toEqual({ ann: { name: 'Ann', email: 'ann@acme.test' } });
    const map = tmpSite({ 'decisions/_authors.yaml': 'bob:\n  name: Bob\n' });
    expect(loadAuthors(path.join(map, 'decisions'))).toEqual({ bob: { name: 'Bob' } });
    expect(loadAuthors(path.join(map, 'none'))).toEqual({});
  });
});
