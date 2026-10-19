import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { findRecord } from './records.mjs';
import { escapeRegExp } from './regex.mjs';

/** @typedef {{ file: string, line: number }} CodeRef A mention of a record in code; `file` is relative to the repo root. */

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);
const MAX_SIZE = 1024 * 1024;

/**
 * Tiny glob matcher: `**` crosses folders, `*` and `?` stay inside a segment, `{a,b}` picks one.
 * A pattern without `/` matches a file's name anywhere in the tree, like .gitignore.
 * @returns {(rel: string) => boolean}
 */
export function globMatcher(pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      const slash = pattern[i + 2] === '/';
      re += slash ? '(?:.*/)?' : '.*';
      i += slash ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const end = pattern.indexOf('}', i);
      if (end < 0) re += '\\{';
      else {
        re += `(?:${pattern.slice(i + 1, end).split(',').map(escapeRegExp).join('|')})`;
        i = end;
      }
    } else re += escapeRegExp(c);
  }
  const regex = new RegExp(`^${re}$`);
  return pattern.includes('/') ? (rel) => regex.test(rel) : (rel) => regex.test(path.posix.basename(rel));
}

/**
 * Lines of `text` mentioning `marker` followed by a record reference (`@adr sre/adr/0001`, `@adr SRE-ADR-0001`).
 * @returns {{ line: number, ref: string }[]}
 */
export function parseCodeRefs(text, marker = '@adr') {
  const re = new RegExp(`(?:^|[^\\w@])${escapeRegExp(marker)}[\\s:]+([\\w][\\w./-]*)`, 'g');
  const out = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(re)) {
      const ref = m[1].replace(/[./-]+$/, '');
      if (ref) out.push({ line: i + 1, ref });
    }
  }
  return out;
}

/** Files of the repository, relative to `repoRoot` with `/` separators: `git ls-files` in git, a walk otherwise. */
export function listFiles(repoRoot) {
  const r = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024 });
  if (r.status === 0) return r.stdout.split('\0').filter(Boolean);
  const out = [];
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), child);
      else if (entry.isFile()) out.push(child);
    }
  };
  walk(repoRoot, '');
  return out.sort();
}

/** Text of a file worth scanning, or null for binaries, huge or unreadable files. */
function readText(file, marker) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return null;
  }
  if (!stat.isFile() || stat.size > MAX_SIZE) return null;
  const buf = fs.readFileSync(file);
  if (buf.subarray(0, 8000).includes(0) || !buf.includes(marker)) return null;
  return buf.toString('utf8');
}

/**
 * Scans the repository for `<marker> <record>` comments and groups them by record id.
 * `config` is a resolved inkan config; the content folder is never scanned.
 * @returns {{ refs: Map<string, CodeRef[]>, unresolved: (CodeRef & { ref: string })[] }}
 */
export function scanCodeRefs(config, records) {
  const refs = new Map();
  const unresolved = [];
  const options = config.codeRefs;
  if (options === false || !config.repoRoot || !fs.existsSync(config.repoRoot)) return { refs, unresolved };
  const marker = options.marker || '@adr';
  const include = (options.include?.length ? options.include : ['**/*']).map(globMatcher);
  const exclude = (options.exclude ?? []).map(globMatcher);
  const content = config.contentPath ? config.contentPath.replace(/\/$/, '') + '/' : null;
  const resolved = new Map();
  for (const rel of listFiles(config.repoRoot)) {
    if (content && rel.startsWith(content)) continue;
    if (!include.some((m) => m(rel)) || exclude.some((m) => m(rel))) continue;
    const text = readText(path.join(config.repoRoot, rel), marker);
    if (text === null) continue;
    for (const { line, ref } of parseCodeRefs(text, marker)) {
      if (!resolved.has(ref)) resolved.set(ref, findRecord(records, ref));
      const record = resolved.get(ref);
      if (!record) {
        unresolved.push({ file: rel, line, ref });
        continue;
      }
      if (!refs.has(record.id)) refs.set(record.id, []);
      refs.get(record.id).push({ file: rel, line });
    }
  }
  for (const list of refs.values()) list.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return { refs, unresolved };
}

/** Link to a file (and line) in the configured repository's web UI, or undefined without one. */
export function blobUrl(repo, file, line) {
  if (!repo?.url) return undefined;
  const branch = repo.branch || 'main';
  const encoded = file.split('/').map(encodeURIComponent).join('/');
  const base = repo.provider === 'gitlab' ? `${repo.url}/-/blob/${branch}/${encoded}` : `${repo.url}/blob/${branch}/${encoded}`;
  return line ? `${base}#L${line}` : base;
}

/** Link to a file's diff within a commit in the repository's web UI, or undefined without a repo URL. */
export function commitDiffUrl(repo, sha, file) {
  if (!repo?.url) return undefined;
  if (repo.provider === 'gitlab') return `${repo.url}/-/commit/${sha}#${createHash('sha1').update(file).digest('hex')}`;
  return `${repo.url}/commit/${sha}#diff-${createHash('sha256').update(file).digest('hex')}`;
}
