import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'astro/zod';
import { commentsSchema, resolveComments } from './comments.mjs';
import { componentNames } from './components.mjs';
import { defaults } from './defaults.mjs';
import { fieldsSchema } from './fields.mjs';
import { MOTIF_NAME } from './motifs.mjs';
import { PROJECT_NAME } from './records.mjs';
import { authenticationSchema, protectedRoutesSchema, resolveAuthentication } from './auth/config.mjs';
import { isInterval } from './reviews.mjs';
import { resolveSources } from './sources.mjs';

export const CONFIG_FILES = ['inkan.config.ts', 'inkan.config.mjs', 'inkan.config.js', 'inkan.config.json'];

/** Directory of the inkan package (templates, app). */
export const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function findConfigFile(root) {
  for (const name of CONFIG_FILES) {
    const file = path.join(root, name);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

const navLink = z.object({ label: z.string(), href: z.string() }).strict();
const headTag = z
  .object({ tag: z.string(), attrs: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(), content: z.string().optional() })
  .strict();
const fn = z.custom((v) => typeof v === 'function', { message: 'expected a function' });
const entrypoint = z.union([z.string().min(1), z.instanceof(URL)]);
const motifs = z.record(z.string(), entrypoint).superRefine((map, ctx) => {
  for (const name of Object.keys(map)) {
    if (!MOTIF_NAME.test(name)) {
      ctx.addIssue({ code: 'custom', path: [name], message: 'motif names use lowercase letters, digits and dashes and start with a letter' });
    }
  }
});

/** Plugins keep unknown keys (newer plugins may carry more); loadConfig warns about them. */
const plugin = z
  .object({
    name: z.string(),
    config: fn.optional(),
    remarkPlugins: z.array(z.unknown()).optional(),
    rehypePlugins: z.array(z.unknown()).optional(),
    vitePlugins: z.array(z.unknown()).optional(),
    integrations: z.array(z.unknown()).optional(),
    pages: z.array(z.object({ pattern: z.string(), entrypoint }).strict()).optional(),
    motifs: motifs.optional(),
    head: z.array(headTag).optional(),
    navigation: z.array(navLink).optional(),
  })
  .passthrough();

const noDash = /^(?!-)/;

/** A project pulled from another repository (`repo`) or folder (`dir`); `path` is the records folder inside it. */
const source = z
  .object({
    project: z.string().min(1).regex(PROJECT_NAME, 'must be a folder name (letters, digits, - and _)'),
    repo: z.string().min(1).regex(noDash, 'must not start with "-"').optional(),
    provider: z.enum(['github', 'gitlab']).optional(),
    dir: z.string().min(1).optional(),
    branch: z.string().min(1).regex(noDash, 'must not start with "-"').optional(),
    path: z.string().regex(noDash, 'must not start with "-"').regex(/^(?!\/|\.\.(\/|$))(?!.*\/\.\.(\/|$)).*$/, 'must be a relative path inside the source').optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (!s.repo === !s.dir) ctx.addIssue({ code: 'custom', message: 'set exactly one of repo or dir' });
    if (s.branch && !s.repo) ctx.addIssue({ code: 'custom', path: ['branch'], message: 'only applies to repo sources' });
    if (s.provider && !s.repo) ctx.addIssue({ code: 'custom', path: ['provider'], message: 'only applies to repo sources' });
  });

/** @type {(v: unknown) => v is Record<string, any>} */
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const searchCommon = { enabled: z.boolean().optional(), maxResults: z.number().int().min(1).max(50).optional() };
const params = z.record(z.string(), z.unknown()).optional();
const searchProvider = z.discriminatedUnion('type', [
  z
    .object({
      ...searchCommon,
      type: z.literal('pagefind'),
      ranking: z
        .object({ termFrequency: z.number(), pageLength: z.number(), termSimilarity: z.number(), termSaturation: z.number() })
        .partial()
        .strict()
        .optional(),
    })
    .strict(),
  z.object({ ...searchCommon, type: z.literal('algolia'), appId: z.string().min(1), apiKey: z.string().min(1), indexName: z.string().min(1), params }).strict(),
  z
    .object({ ...searchCommon, type: z.literal('meilisearch'), host: z.url(), apiKey: z.string().optional(), indexUid: z.string().min(1), params })
    .strict(),
  z
    .object({
      ...searchCommon,
      type: z.literal('typesense'),
      host: z.url(),
      apiKey: z.string().min(1),
      collection: z.string().min(1),
      queryBy: z.string().optional(),
      params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    })
    .strict(),
  z.object({ ...searchCommon, type: z.literal('custom'), module: z.string().min(1), options: params }).strict(),
], { error: 'type must be one of pagefind, algolia, meilisearch, typesense, custom' });
/** `false` turns search off; without `type` the built-in Pagefind index is used. */
export const searchSchema = z.preprocess((v) => {
  if (v === false) return { type: 'pagefind', enabled: false };
  return isObject(v) && !('type' in v) ? { ...v, type: 'pagefind' } : v;
}, searchProvider);

/**
 * The resolved `search` option: always an object with `enabled`, `type` and `maxResults`, and `module` as an absolute path.
 * Idempotent, because plugin hooks may set `search` again.
 */
export function resolveSearch(search, root) {
  const parsed = searchSchema.safeParse(search);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({ ...issue, path: ['search', ...issue.path] }));
    throw new Error(`Invalid inkan config:\n  ${formatIssues(issues, null).join('\n  ')}`);
  }
  const out = { enabled: true, maxResults: defaults.search.maxResults, ...parsed.data };
  if (out.type === 'custom') out.module = out.module.startsWith('file:') ? fileURLToPath(out.module) : path.resolve(root, out.module);
  return out;
}

/** The resolved `comments` option, see lib/comments.mjs. */
function resolveCommentsOption(config) {
  const { issues, value } = resolveComments(config.comments, config);
  if (issues.length) {
    const lines = formatIssues(issues.map((issue) => ({ ...issue, path: ['comments', ...issue.path] })), config.configFile);
    throw new Error(`Invalid inkan config:\n  ${lines.join('\n  ')}`);
  }
  return value;
}

/** Shape of inkan.config.*; every key is optional and unknown keys are rejected. */
export const configSchema = z
  .object({
    /** JSON configs may point editors at a schema. */
    $schema: z.string(),
    title: z.string(),
    tagline: z.string(),
    description: z.string(),
    url: z.string(),
    base: z.string(),
    repo: z.object({ url: z.string(), branch: z.string().optional(), provider: z.enum(['github', 'gitlab']).optional() }).strict(),
    contentDir: z.string().min(1),
    templatesDir: z.string().min(1),
    pagesDir: z.string().min(1),
    logo: z.string().nullable(),
    favicon: z.string().nullable(),
    customCss: z.array(z.string()),
    theme: z.object({ default: z.enum(['system', 'light', 'dark']).optional() }).strict(),
    navigation: z.array(navLink),
    banner: z.object({ message: z.string(), dismissible: z.boolean().optional() }).strict().nullable(),
    footer: z.object({ copyright: z.string().optional(), links: z.array(navLink).optional() }).strict(),
    redirects: z.record(z.string(), z.string()),
    search: searchSchema,
    comments: commentsSchema,
    head: z.array(headTag),
    components: z.object(Object.fromEntries(componentNames.map((n) => [n, z.string().optional()]))).strict(),
    mdxComponents: z.string().nullable(),
    plugins: z.array(plugin),
    issueLinks: z.array(z.object({ pattern: z.string(), url: z.string() }).strict()),
    sources: z.array(source),
    git: z.object({ dates: z.boolean().optional(), authors: z.boolean().optional(), history: z.boolean().optional() }).strict(),
    codeRefs: z.union([
      z.literal(false),
      z.object({ include: z.array(z.string()).optional(), exclude: z.array(z.string()).optional(), marker: z.string().optional() }).strict(),
    ]),
    og: z.union([z.literal(false), z.object({ theme: z.enum(['light', 'dark']).optional() }).strict()]),
    sidebar: z.object({ sort: z.enum(['newest', 'oldest', 'number']).optional() }).strict(),
    export: z.object({ statuses: z.array(z.string()).optional(), title: z.string().optional() }).strict(),
    reviewers: z.object({ approvals: z.number().int().positive().nullable().optional() }).strict(),
    reviews: z
      .object({
        every: z.union([z.string(), z.literal(false)]).nullable().refine((v) => v == null || isInterval(v), 'expected an interval like "1 year", "6 months" or "90 days"').optional(),
        statuses: z.array(z.string()).optional(),
        soon: z.number().int().nonnegative().optional(),
      })
      .strict(),
    notify: z
      .object({
        statuses: z.array(z.string()).optional(),
        channels: z
          .array(
            z
              .object({
                type: z.enum(['slack', 'teams', 'webhook']),
                url: z.string().optional(),
                name: z.string().min(1).optional(),
                projects: z.array(z.string()).optional(),
                types: z.array(z.string()).optional(),
                statuses: z.array(z.string()).optional(),
                headers: z.record(z.string(), z.string()).optional(),
                body: fn.optional(),
              })
              .strict()
              .superRefine((c, ctx) => {
                if (c.type !== 'webhook' && (c.headers || c.body)) ctx.addIssue({ code: 'custom', message: 'headers and body only apply to webhook channels' });
              }),
          )
          .optional(),
      })
      .strict(),
    docTypes: z.record(z.string(), z.object({ label: z.string(), plural: z.string(), description: z.string() }).strict()),
    statuses: z.record(
      z.string(),
      z
        .object({ label: z.string(), open: z.boolean().optional(), current: z.boolean().optional(), sticker: z.string().optional(), color: z.string().optional() })
        .strict(),
    ),
    fields: fieldsSchema,
    /** Sign-in for protected projects and routes; needs `inkan serve`. */
    authentication: authenticationSchema.nullable(),
    protectedRoutes: protectedRoutesSchema,
    landing: z
      .object({
        title: z.string().nullable().optional(),
        tagline: z.string().nullable().optional(),
        eyebrow: z.string().nullable(),
        image: z.object({ src: z.string(), dark: z.string().optional(), alt: z.string() }).strict().nullable(),
        command: z.string().nullable(),
        features: z.array(z.object({ title: z.string(), text: z.string(), link: z.string().optional() }).strict()),
        actions: z.array(z.object({ text: z.string(), link: z.string(), variant: z.enum(['primary', 'secondary', 'ghost']).optional() }).strict()),
        sections: z.array(z.string()),
      })
      .partial()
      .strict(),
  })
  .partial()
  .strict();

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]++;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/** Closest known key, for "did you mean" hints. */
export function closest(key, candidates) {
  const best = candidates.map((c) => [c, distance(key.toLowerCase(), c.toLowerCase())]).sort((a, b) => a[1] - b[1])[0];
  return best && best[1] <= Math.max(2, Math.floor(key.length / 3)) ? best[0] : null;
}

/** Keys the schema allows at `issuePath` (descending through optional/nullable wrappers, arrays and records). */
export function knownKeysAt(schema, issuePath) {
  let node = schema;
  const inner = (n) => {
    while (n && (n.type === 'optional' || n.type === 'nullable' || n.type === 'default')) n = n.unwrap();
    return n;
  };
  node = inner(node);
  for (const p of issuePath) {
    if (!node) return [];
    if (node.type === 'object') node = inner(node.shape[p]);
    else if (node.type === 'array') node = inner(node.element);
    else if (node.type === 'record') node = inner(node.valueType);
    else return [];
  }
  return node?.type === 'object' ? Object.keys(node.shape).filter((k) => k !== '$schema') : [];
}

/**
 * Turns zod issues into `file: key.path: message` lines.
 * @param {import('zod').ZodType} [schema]
 */
export function formatIssues(issues, file, schema = configSchema) {
  const prefix = file ? path.basename(file) : 'inkan.config';
  return issues.flatMap((issue) => {
    const where = issue.path.length ? issue.path.join('.') : '(root)';
    if (issue.code === 'unrecognized_keys') {
      const known = knownKeysAt(schema, issue.path);
      return issue.keys.map((key) => {
        const hint = closest(key, known);
        const at = issue.path.length ? `${where}.${key}` : key;
        return `${prefix}: ${at}: unknown option${hint ? `, did you mean "${hint}"?` : ''}`;
      });
    }
    const message = issue.message
      .replace(/^Too small: expected string to have >=1 characters$/, 'must not be empty')
      .replace(/^Invalid input: /, '')
      .replace(/^Invalid option: /, '')
      .replace(/^Expected/, 'expected');
    return [`${prefix}: ${where}: ${message}`];
  });
}

/**
 * @param {string | null} [file]
 * @throws {Error} with one line per problem
 */
export function validateConfig(user, file = null) {
  if (!user || typeof user !== 'object' || Array.isArray(user)) {
    throw new Error(`${file ? path.basename(file) : 'inkan.config'}: the default export must be an object (use defineConfig({ ... }))`);
  }
  const result = configSchema.safeParse(user);
  if (!result.success) throw new Error(`Invalid inkan config:\n  ${formatIssues(result.error.issues, file).join('\n  ')}`);
  if (result.data.protectedRoutes?.length && !result.data.authentication) {
    throw new Error(`Invalid inkan config:\n  ${file ? path.basename(file) : 'inkan.config'}: protectedRoutes: needs \`authentication\` to let anyone in`);
  }
  const { $schema, ...config } = result.data;
  return config;
}

const pluginKeys = knownKeysAt(plugin, []);
/** Unknown plugin keys are kept but reported, so a typo does not silently do nothing. */
export function unknownPluginKeys(plugins) {
  return plugins.flatMap((p) => Object.keys(p).filter((k) => !pluginKeys.includes(k)).map((k) => `plugin "${p.name}": unknown key "${k}"`));
}

const afterHooks = z.object({ head: z.array(headTag), navigation: z.array(navLink) });

function merge(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra ?? {})) {
    if (v === undefined) continue;
    out[k] = isObject(v) && isObject(base[k]) ? merge(base[k], v) : v;
  }
  return out;
}

/**
 * Loads the user's config from `root`, validates it, resolves every path to an absolute one
 * and runs the plugins' `config` hooks. Apart from `plugins`, the result is plain JSON-able data.
 */
export async function loadConfig(root = process.cwd(), { warn = console.warn } = {}) {
  root = path.resolve(root);
  const file = findConfigFile(root);
  let user = {};
  if (file?.endsWith('.json')) user = JSON.parse(fs.readFileSync(file, 'utf8'));
  else if (file) user = (await import(`${pathToFileURL(file).href}?t=${fs.statSync(file).mtimeMs}`)).default ?? {};
  user = validateConfig(user, file);
  for (const message of unknownPluginKeys(user.plugins ?? [])) warn(`inkan: ${message}`);

  // Statuses and types replace the defaults when given, so removing one is possible.
  // A fresh copy: plugin hooks may mutate the config, and loadConfig runs on every dev-server restart.
  let config = merge({ ...structuredClone(defaults), statuses: undefined, docTypes: undefined }, user);
  config.statuses = user.statuses ?? structuredClone(defaults.statuses);
  config.docTypes = user.docTypes ?? structuredClone(defaults.docTypes);
  config.banner = user.banner ? { dismissible: false, ...user.banner } : null;
  config.search = user.search === undefined ? { ...defaults.search } : user.search;
  if (process.env.BASE_PATH) config.base = process.env.BASE_PATH;

  const abs = (p) => (p ? path.resolve(root, p) : null);
  config.root = root;
  config.configFile = file;
  config.contentDir = abs(config.contentDir);
  config.customCss = config.customCss.map(abs);
  config.logo = abs(config.logo);
  config.favicon = abs(config.favicon);
  if (config.landing.image) config.landing.image = { ...config.landing.image, src: abs(config.landing.image.src), dark: abs(config.landing.image.dark) };
  config.pagesDir = abs(config.pagesDir);
  config.mdxComponents = abs(config.mdxComponents);
  config.components = Object.fromEntries(Object.entries(config.components).map(([name, file]) => [name, abs(file)]));
  config.search = resolveSearch(config.search, root);
  config.comments = resolveCommentsOption(config);
  config.authentication = resolveAuthentication(config.authentication);

  // Templates: the user's folder wins, the package's built-ins fill the gaps.
  config.templates = {};
  for (const dir of [path.join(packageDir, 'templates'), abs(config.templatesDir)]) {
    if (!dir || !fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      config.templates[f.replace(/\.md$/, '')] = fs.readFileSync(path.join(dir, f), 'utf8');
    }
  }
  config.templatesDir = abs(config.templatesDir);
  config.sources = resolveSources(config.sources, config);

  // Repo root (for edit links and `source` paths); falls back to the config folder outside git.
  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' });
  config.repoRoot = git.status === 0 ? fs.realpathSync(git.stdout.trim()) : root;
  config.contentPath = path.relative(config.repoRoot, fs.existsSync(config.contentDir) ? fs.realpathSync(config.contentDir) : config.contentDir).split(path.sep).join('/');

  // Hooks see absolute paths and must be idempotent: loadConfig runs on every dev-server restart.
  for (const plugin of config.plugins) {
    config = (await plugin.config?.(config)) ?? config;
  }
  config.head = [...config.head, ...config.plugins.flatMap((p) => p.head ?? [])];
  config.navigation = [...config.navigation, ...config.plugins.flatMap((p) => p.navigation ?? [])];
  config.search = resolveSearch(config.search, root);
  config.comments = resolveCommentsOption(config);
  const checked = afterHooks.safeParse(config);
  if (!checked.success) {
    throw new Error(`Invalid inkan config after plugin hooks:\n  ${formatIssues(checked.error.issues, file, afterHooks).join('\n  ')}`);
  }
  return config;
}
