import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontMatter } from './records.mjs';

/**
 * @typedef {{ created: Date, updated: Date, author: { name: string, email: string } }} FileHistory
 * `created`/`author` come from the commit that added the file, `updated` from the last one touching it.
 */

/** Absolute, symlink-free path when the file exists; the plain resolved path otherwise. */
export function realpath(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    return path.resolve(file);
  }
}

/** Top-level folder of the repository containing `dir`, or null outside git. */
export function gitRoot(dir) {
  if (!fs.existsSync(dir)) return null;
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8' });
  return r.status === 0 ? realpath(r.stdout.trim()) : null;
}

const warned = new Set();
const isShallow = (root) => spawnSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: root, encoding: 'utf8' }).stdout.trim() === 'true';

/** Folders grouped by the repository they are in, skipping shallow clones (with one warning each). Null when none is in git. */
function repositories(dirs) {
  const list = (Array.isArray(dirs) ? dirs : [dirs]).filter((d) => d && fs.existsSync(d)).map(realpath);
  const byRoot = new Map();
  for (const dir of list) {
    const root = gitRoot(dir);
    if (root) byRoot.set(root, [...(byRoot.get(root) ?? []), dir]);
  }
  if (!byRoot.size) return null;
  for (const root of [...byRoot.keys()]) {
    if (!isShallow(root)) continue;
    byRoot.delete(root);
    if (!warned.has(root)) {
      warned.add(root);
      console.warn(`inkan: ${root} is a shallow clone, so dates, authors and status history are not inferred from git (fetch the full history, e.g. fetch-depth: 0 or GIT_DEPTH: 0)`);
    }
  }
  return byRoot;
}

/**
 * One `git log` per repository over `dirs` gives the first and last commit of every file below them, keyed by
 * absolute path. Folders may live in different repositories. Returns null when none is in a git repository.
 * Shallow clones are skipped with a warning: their oldest visible commit is not the file's first.
 * Renames count as a new file (no `--follow`).
 * @returns {Map<string, FileHistory> | null}
 */
export function gitHistory(dirs) {
  const byRoot = repositories(dirs);
  if (!byRoot) return null;
  const history = new Map();
  for (const [root, inside] of byRoot) readLog(root, inside, history);
  return history;
}

function readLog(root, inside, history) {
  const r = spawnSync('git', ['log', '-z', '--name-status', '--no-renames', '--format=%x01%at%x09%ct%x09%ae%x09%an', '--', ...inside], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (r.status !== 0) return;
  // Newest commit first: the first time a path shows up is its last change, an `A` entry its creation.
  let commit;
  const tokens = r.stdout.split('\0');
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith('\x01')) {
      const [at, ct, email, name] = t.slice(1).split('\t');
      commit = { created: new Date(Number(at) * 1000), updated: new Date(Number(ct) * 1000), author: { name, email } };
      continue;
    }
    const status = t.replace(/^\n/, '');
    if (!commit || !status || i + 1 >= tokens.length) continue;
    const file = path.join(root, tokens[++i]);
    const prev = history.get(file);
    if (!prev) history.set(file, { ...commit });
    else if (status.startsWith('A')) {
      prev.created = commit.created;
      prev.author = commit.author;
    }
  }
}

/**
 * @typedef {{ status: string | null, date: Date, author: { name: string, email: string }, commit: string, path: string, root: string }} StatusChange
 * `status` is the front matter value after the commit (null when absent), `date` the author date, `path` relative to `root`.
 */

const MARKDOWN = /\.mdx?$/i;

/**
 * Status changes of every Markdown file below `dirs`, oldest first, keyed by absolute path. One `git log` finds the commits
 * that touched a `status:` line and one `git cat-file --batch` per repository reads the files at those commits.
 * Commits that leave the status as it was, or whose front matter does not parse, are dropped. Merges do not hide either parent's commits. Same repositories, shallow-clone skipping and rename handling as gitHistory.
 * @returns {Map<string, StatusChange[]> | null}
 */
export function statusHistory(dirs) {
  const byRoot = repositories(dirs);
  if (!byRoot) return null;
  const history = new Map();
  for (const [root, inside] of byRoot) readStatuses(root, inside, history);
  return history;
}

function readStatuses(root, inside, history) {
  const r = spawnSync('git', ['log', '-z', '--full-history', '--no-renames', '--name-status', '--format=%x01%H%x09%at%x09%ae%x09%an', '-G^status:', '--', ...inside], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (r.status !== 0) return;
  const changes = [];
  let commit;
  const tokens = r.stdout.split('\0');
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith('\x01')) {
      const [sha, at, email, name] = t.slice(1).split('\t');
      commit = { sha, date: new Date(Number(at) * 1000), author: { name, email } };
      continue;
    }
    const kind = t.replace(/^\n/, '');
    if (!commit || !kind || i + 1 >= tokens.length) continue;
    const file = tokens[++i];
    if (!kind.startsWith('D') && MARKDOWN.test(file) && !file.includes('\n')) changes.push({ ...commit, file });
  }
  if (!changes.length) return;
  const blobs = spawnSync('git', ['cat-file', '--batch'], {
    cwd: root,
    input: changes.map((c) => `${c.sha}:${c.file}\n`).join(''),
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (blobs.status !== 0) return;
  const out = blobs.stdout;
  let pos = 0;
  const texts = changes.map(() => {
    const eol = out.indexOf(10, pos);
    const header = out.toString('utf8', pos, eol);
    pos = eol + 1;
    if (header.endsWith(' missing')) return null;
    const size = Number(header.split(' ')[2]);
    const text = out.toString('utf8', pos, pos + size);
    pos += size + 1;
    return text;
  });
  // Oldest first by author date: rebased commits keep their date but land later in the log.
  const order = changes.map((_, i) => changes.length - 1 - i).sort((a, b) => changes[a].date - changes[b].date);
  for (const i of order) {
    if (texts[i] === null) continue;
    const { data, error } = parseFrontMatter(texts[i]);
    if (error) continue;
    const { sha, date, author, file } = changes[i];
    const value = data.status;
    const status = value == null || typeof value === 'object' ? null : String(value).trim() || null;
    const abs = path.join(root, file);
    const list = history.get(abs) ?? [];
    if (status === (list.at(-1)?.status ?? null)) continue;
    list.push({ status, date, author, commit: sha, path: file, root });
    history.set(abs, list);
  }
}

export { loadAuthors } from './records.mjs';

const norm = (v) => (v == null ? '' : String(v).trim().toLowerCase());

/**
 * Handle of the directory entry matching a git author (by email, handle, name or GitHub/GitLab login),
 * or the git name when nobody matches.
 */
export function matchAuthor(author, authors) {
  const email = norm(author.email);
  const name = norm(author.name);
  const login = email.includes('@') ? norm(email.split('@')[0].replace(/^\d+\+/, '')) : '';
  const find = (test) => Object.entries(authors).find(([handle, a]) => test(norm(handle), a ?? {}));
  const hit =
    (email && find((_, a) => norm(a.email) === email)) ||
    (name && find((h, a) => h === name || norm(a.name) === name || norm(a.github) === name || norm(a.gitlab) === name)) ||
    // "12345+login@users.noreply.github.com" style addresses carry the login.
    (login && email.endsWith('noreply.github.com') && find((h, a) => h === login || norm(a.github) === login)) ||
    (login && email.endsWith('noreply.gitlab.com') && find((h, a) => h === login || norm(a.gitlab) === login));
  return hit ? hit[0] : author.name?.trim() || author.email?.trim() || '';
}
