/**
 * Sources: records kept in other repositories (or folders) and shown here as one project each.
 * `inkan sync` keeps a shallow, sparse clone of every `repo` source under node_modules/.inkan/sources.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { markdownFiles, projectId } from './records.mjs';
import { plural } from './text.mjs';

export const DEFAULT_SOURCE_PATH = 'docs/decisions';

/** Folder holding the clones of `repo` sources, one per project. */
export const sourcesCacheDir = (root) => path.join(root, 'node_modules', '.inkan', 'sources');

/** True for `scheme://...` URLs and scp-style `[user@]host:path` remotes; anything else is a local path. */
export const isRemoteRepo = (repo) => /^[a-z][a-z0-9+.-]+:\/\//i.test(repo) || /^(?:[\w.-]+@)?[\w.-]{2,}:(?!\/\/)/.test(repo);

/** Web URL of a git remote (`git@github.com:acme/x.git` -> `https://github.com/acme/x`), or null for local paths. */
export function repoWebUrl(repo) {
  if (!isRemoteRepo(repo)) return null;
  const https = /^(https?:\/\/)(?:[^@/]+@)?([^/]+\/.+?)(?:\.git)?\/?$/.exec(repo);
  if (https) return `${https[1]}${https[2]}`;
  const ssh = /^(?:ssh:\/\/)?(?:[\w.-]+@)?([\w.-]+)(?::\d+)?[:/]\/?(.+?)(?:\.git)?\/?$/.exec(repo);
  if (!ssh || /^file:/.test(repo)) return null;
  return `https://${ssh[1]}/${ssh[2]}`;
}

/** `github` unless the host looks like GitLab (set `provider` on the source for self-hosted instances). */
export const repoProvider = (repo) => (/gitlab/i.test(repo) ? 'gitlab' : 'github');

const canonical = (p) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
};

const hasRecords = (dir, docTypes) =>
  fs.existsSync(dir) &&
  (['_project.yml', '_project.yaml', ...Object.keys(docTypes)].some((n) => fs.existsSync(path.join(dir, n))));

/**
 * Where a source's `<type>/` folders are. A source laid out like the hub (`<path>/<project>/<type>/...`)
 * is accepted too: the project's own folder is used when `<path>` itself holds no records.
 */
export function sourceContentDir(source, docTypes) {
  const base = path.join(source.root, source.path);
  const nested = path.join(base, source.project);
  return !hasRecords(base, docTypes) && hasRecords(nested, docTypes) ? nested : base;
}

const branchOf = (dir) => {
  const r = spawnSync('git', ['symbolic-ref', '--short', 'HEAD'], { cwd: dir, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
};

/**
 * Resolves the `sources` of a config: absolute folders, defaults and the layout found on disk.
 * `root` is the clone (or the local folder), `contentDir` the folder with the `<type>/` subfolders.
 * @param {{ project: string, repo?: string, provider?: 'github' | 'gitlab', dir?: string, branch?: string, path?: string }[]} sources
 */
export function resolveSources(sources, { root, contentDir, docTypes }) {
  const seen = new Set();
  const localFolders = fs.existsSync(contentDir) ? fs.readdirSync(contentDir, { withFileTypes: true }).filter((e) => e.isDirectory()) : [];
  return sources.map((s) => {
    const project = projectId(s.project);
    if (seen.has(project)) throw new Error(`inkan: sources: project "${s.project}" is listed twice`);
    seen.add(project);
    const local = localFolders.find((e) => projectId(e.name) === project);
    if (local) {
      throw new Error(`inkan: sources: project "${s.project}" also exists locally (${path.relative(root, path.join(contentDir, local.name))}); remove one of them`);
    }
    const source = {
      project,
      repo: s.repo ?? null,
      dir: s.dir ? path.resolve(root, s.dir) : null,
      branch: s.branch ?? null,
      path: (s.path ?? DEFAULT_SOURCE_PATH).replace(/^\.?\/+|\/+$/g, '') || '.',
      root: s.repo ? path.join(sourcesCacheDir(root), project) : canonical(path.resolve(root, s.dir ?? '.')),
    };
    source.contentDir = sourceContentDir(source, docTypes);
    // Path of `contentDir` inside the source repo, for edit links and "New ADR" buttons.
    source.recordsPath = path.relative(source.root, source.contentDir).split(path.sep).join('/');
    source.web = s.repo ? repoWebUrl(s.repo) : null;
    source.provider = s.repo ? (s.provider ?? repoProvider(s.repo)) : null;
    // What git clones from: local paths (relative to the project) become file:// URLs, or git ignores `--depth`.
    source.remote = s.repo ? (isRemoteRepo(s.repo) ? s.repo : pathToFileURL(path.resolve(root, s.repo)).href) : null;
    // Branch the clone is on, when the config leaves it to the remote's default.
    source.head = s.repo && !s.branch && fs.existsSync(path.join(source.root, '.git')) ? branchOf(source.root) : null;
    return source;
  });
}

/** True when a `repo` source has not been fetched yet. */
export const isMissing = (source) => !!source.repo && !fs.existsSync(path.join(source.root, '.git'));

function git(args, cwd, source) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  if (r.error) throw new Error(`sync ${source.project}: git is not available (${r.error.message})`);
  if (r.status !== 0) {
    throw new Error(`sync ${source.project}: git ${args[0]} failed for ${source.repo}${source.branch ? ` (${source.branch})` : ''}:\n  ${r.stderr.trim().split('\n').join('\n  ')}`);
  }
  return r.stdout.trim();
}

/**
 * Fetches one `repo` source into its cache folder: a shallow, single-branch clone with only `path` checked out.
 * Later runs fetch the new tip and reset to it, so the cache never accumulates history.
 */
export function fetchSource(source) {
  const { root, path: dir } = source;
  const url = source.remote ?? source.repo;
  if (!fs.existsSync(path.join(root, '.git'))) {
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(root), { recursive: true });
    git(['clone', '--quiet', '--depth', '1', '--no-checkout', '--single-branch', ...(source.branch ? ['--branch', source.branch] : []), '--', url, root], path.dirname(root), source);
    if (dir !== '.') git(['sparse-checkout', 'set', '--', dir], root, source);
    git(['checkout', '--quiet'], root, source);
  } else {
    if (git(['remote', 'get-url', 'origin'], root, source) !== url) git(['remote', 'set-url', 'origin', '--', url], root, source);
    if (dir !== '.') git(['sparse-checkout', 'set', '--', dir], root, source);
    git(['fetch', '--quiet', '--depth', '1', '--', 'origin', source.branch ?? 'HEAD'], root, source);
    git(['reset', '--quiet', '--hard', 'FETCH_HEAD'], root, source);
  }
  if (!fs.existsSync(path.join(root, dir))) {
    throw new Error(`sync ${source.project}: folder "${dir}" not found in ${source.repo}${source.branch ? ` (${source.branch})` : ''}`);
  }
  return git(['rev-parse', '--short', 'HEAD'], root, source);
}

/**
 * Syncs every `repo` source of a resolved config and reports each one. With `missingOnly`, sources that
 * already have a cache are left alone (what `dev` does on start-up).
 * @param {{ sources: any[], root: string, docTypes: object }} config
 */
export async function syncSources(config, { log = console.log, missingOnly = false } = {}) {
  const sources = config.sources.filter((s) => s.repo && (!missingOnly || isMissing(s)));
  for (const source of sources) {
    const commit = fetchSource(source);
    const contentDir = sourceContentDir(source, config.docTypes);
    const count = markdownFiles(contentDir).length;
    const where = `${source.repo}${source.branch ? ` (${source.branch})` : ''} ${source.path}`;
    log(`sync: ${source.project} ← ${where} @ ${commit}: ${plural(count, 'record')}`);
  }
  return sources.length;
}
