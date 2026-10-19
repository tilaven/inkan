import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'astro/zod';

const common = {
  enabled: z.boolean().optional(),
  types: z.array(z.string().min(1)).optional(),
  statuses: z.array(z.string().min(1)).optional(),
};
const ownerName = /^[\w.-]+\/[\w.-]+$/;
const projectPath = /^[\w.-]+(\/[\w.-]+)+$/;

const commentsProvider = z.discriminatedUnion('provider', [
  z
    .object({
      ...common,
      provider: z.literal('giscus'),
      repo: z.string().regex(ownerName, 'must be "owner/name"').optional(),
      repoId: z.string().min(1),
      category: z.string().min(1),
      categoryId: z.string().min(1),
      mapping: z.enum(['specific', 'pathname', 'url', 'title', 'og:title']).optional(),
      strict: z.boolean().optional(),
      reactions: z.boolean().optional(),
      inputPosition: z.enum(['top', 'bottom']).optional(),
      lang: z.string().min(1).optional(),
      theme: z.object({ light: z.string().min(1).optional(), dark: z.string().min(1).optional() }).strict().optional(),
    })
    .strict(),
  z
    .object({
      ...common,
      provider: z.literal('gitlab'),
      project: z.string().regex(projectPath, 'must be the project path, e.g. "group/repo"').optional(),
      host: z.url({ protocol: /^https?$/ }).optional(),
      labels: z.array(z.string().min(1)).optional(),
    })
    .strict(),
  z.object({ ...common, provider: z.literal('custom'), component: z.string().min(1), options: z.record(z.string(), z.unknown()).optional() }).strict(),
], { error: 'provider must be one of giscus, gitlab, custom' });

/** `false` turns comments off. */
export const commentsSchema = z.preprocess((v) => (v === false ? undefined : v), commentsProvider.optional());

const OFF = { enabled: false, provider: null, types: [], statuses: null };

/** Owner/name or group path of `repo.url` when it is hosted on `provider`. */
function repoPath(repo, provider) {
  if (!repo?.url || (repo.provider ?? 'github') !== provider) return null;
  try {
    const u = new URL(repo.url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return { origin: u.origin, path: u.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/, '') || null };
  } catch {
    return null;
  }
}

/** giscus names Chinese by region and every other language by its base tag. */
const giscusLang = (locale = 'en') => {
  const tag = Intl.getCanonicalLocales(locale)[0];
  return tag.startsWith('zh-') ? tag : tag.split('-')[0];
};

/**
 * The resolved `comments` option: `enabled`, `provider`, `types`, `statuses` (null for every status) and the
 * provider's own keys with defaults, `repo`/`project` taken from `repo.url` when not given. Idempotent.
 * @returns {{ issues: { path: PropertyKey[], message: string }[], value: any }}
 */
export function resolveComments(comments, { repo, root, docTypes, statuses: known, locale }) {
  if (!comments || comments.provider === null) return { issues: [], value: OFF };
  const parsed = commentsProvider.safeParse(comments.statuses === null ? { ...comments, statuses: undefined } : comments);
  if (!parsed.success) return { issues: parsed.error.issues, value: OFF };
  const { enabled = true, types = ['rfc'], statuses = null, ...rest } = /** @type {Record<string, any>} */ (parsed.data);
  /** @type {Record<string, any>} */
  const out = { enabled, types, statuses, ...rest };
  const issues = [];
  for (const [key, names, allowed] of [['types', types, docTypes], ['statuses', statuses ?? [], known]]) {
    if (!allowed) continue;
    names.forEach((name, i) => {
      if (!(name in allowed)) issues.push({ path: [key, i], message: `unknown ${key === 'types' ? 'record type' : 'status'} "${name}" (known: ${Object.keys(allowed).join(', ')})` });
    });
  }
  if (out.provider === 'giscus') {
    out.repo ??= repoPath(repo, 'github')?.path ?? undefined;
    if (!out.repo || !ownerName.test(out.repo)) issues.push({ path: ['repo'], message: 'set repo ("owner/name"), or a GitHub repo.url to take it from' });
    Object.assign(out, {
      mapping: out.mapping ?? 'specific',
      strict: out.strict ?? true,
      reactions: out.reactions ?? true,
      inputPosition: out.inputPosition ?? 'top',
      lang: out.lang ?? giscusLang(locale),
      theme: { light: 'light', dark: 'dark', ...out.theme },
    });
  } else if (out.provider === 'gitlab') {
    const fromRepo = repoPath(repo, 'gitlab');
    out.host = (out.host ?? fromRepo?.origin ?? 'https://gitlab.com').replace(/\/+$/, '');
    out.project ??= fromRepo?.path ?? undefined;
    if (!out.project) issues.push({ path: ['project'], message: 'set project ("group/repo"), or a GitLab repo.url to take it from' });
    out.labels ??= [];
  } else {
    out.component = out.component.startsWith('file:') ? fileURLToPath(out.component) : path.resolve(root, out.component);
    out.options ??= {};
  }
  return { issues, value: out };
}
