import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { file, glob } from 'astro/loaders';
import path from 'node:path';
import fs from 'node:fs';
import { docId } from '../../lib/pages.mjs';
import { projectId } from '../../lib/records.mjs';
import { escapeGlob } from '../../lib/auth/protect.mjs';
import { isInterval } from '../../lib/reviews.mjs';
import { globs, landingFile as findLandingFile } from './lib/loaders';
import { parseReviewers } from '../../lib/rfc-reviews.mjs';
import { projectFieldsSchema } from '../../lib/fields.mjs';

// Set by astro.config.mjs from the user's inkan.config (absolute path).
const contentDir = process.env.INKAN_CONTENT_DIR!;
const pagesDir = process.env.INKAN_PAGES_DIR;
const statuses = JSON.parse(process.env.INKAN_STATUSES || '[]') as [string, ...string[]];
/** Folders of protected projects, left out of the public build altogether (astro.config.mjs). */
const excluded = JSON.parse(process.env.INKAN_EXCLUDED_PROJECTS || '[]') as string[];
/** Folders of other repositories shown as one project each (`sources` in inkan.config). */
const sources = (JSON.parse(process.env.INKAN_SOURCES || '[]') as { project: string; contentDir: string }[]).filter((s) => !excluded.includes(s.project));

const trim = (s: unknown) => String(s).replace(/^\/+|\/+$/g, '');

/** Accepts a single value or a list, so `tags: db` and `tags: [db]` both work. */
const list = z
  .union([z.string(), z.array(z.string())])
  .nullish()
  .transform((v) => (v == null ? [] : Array.isArray(v) ? v : [v]));

const authorsFile = path.join(contentDir, '_authors.yml');
const landingFile = findLandingFile(contentDir);
/** Markdown files, skipping `_`-prefixed files and folders. */
const content = ['**/*.{md,mdx}', '!**/_*', '!**/_*/**'];
/** Loader that yields nothing, for optional files that are absent. */
const empty = (name: string) => ({ name, load: async () => {} });

export const collections = {
  /**
   * Every Markdown/MDX file under the content dir (files and folders starting with `_` are ignored).
   * The URL mirrors the path: sre/adr/0001-x.md -> /sre/adr/0001-x/
   */
  docs: defineCollection({
    loader: globs([
      { base: contentDir, pattern: [...content, ...excluded.map((id) => `!${escapeGlob(id)}/**`)], generateId: ({ entry, data }) => docId(entry, data.slug) },
      // A source's files sit one level up (`<type>/<file>.md`), so its id is prefixed with the project.
      ...sources.map(({ project, contentDir: base }) => ({
        base,
        pattern: content,
        generateId: ({ entry, data }: { entry: string; data: Record<string, unknown> }) =>
          data.slug ? `${project}/${trim(data.slug)}` : docId(`${project}/${entry}`),
      })),
    ]),
    // Loose, so custom `fields` (checked against their definitions in toDecision) reach the record.
    schema: z.looseObject({
      title: z.string(),
      description: z.string().optional(),
      status: (statuses.length ? z.enum(statuses) : z.string()).optional(),
      /** Date the decision was made / RFC was opened. */
      date: z.coerce.date().optional(),
      authors: list,
      /** People who signed off (ADR "deciders"). */
      deciders: list,
      tags: list,
      /** Paths of related records, e.g. `sre/adr/0001-use-slos`. */
      supersedes: list,
      supersededBy: list,
      related: list,
      /** Who is asked to review: a list of handles, or a map of handle to state (see lib/rfc-reviews.mjs). */
      reviewers: z.unknown().optional().transform((v, ctx) => {
        const { reviewers, errors } = parseReviewers(v);
        for (const message of errors) ctx.addIssue({ code: 'custom', message });
        return reviewers;
      }),
      /** Open records: decision deadline (the RFC comment deadline). Decided records: next periodic review. */
      reviewBy: z.coerce.date().nullish(),
      /** Last periodic review. */
      reviewed: z.coerce.date().nullish(),
      /** Review interval (`1 year`, `6 months`, `never`); overrides the project's and the site's. */
      reviewEvery: z.union([z.string().refine(isInterval, 'expected an interval like "1 year" or "never"'), z.literal(false)]).nullish(),
      /** `false` hides comments on this record, `true` shows them whatever its type or status. */
      comments: z.boolean().optional(),
      /** Where the conversation lives: a GitHub discussion, GitLab issue or merge request. */
      discussion: z.url({ protocol: /^https?$/ }).optional(),
      /** Sidebar position for non-record pages (guides, READMEs). */
      order: z.number().optional(),
      draft: z.boolean().default(false),
    }),
  }),

  /** One `_project.yml` per top-level folder defines a project / team space. */
  projects: defineCollection({
    loader: globs([
      { base: contentDir, pattern: '*/_project.{yml,yaml}', generateId: ({ entry }) => projectId(entry.split('/')[0]) },
      ...sources.map(({ project, contentDir: base }) => ({ base, pattern: '_project.{yml,yaml}', generateId: () => project })),
    ]),
    schema: z.object({
      name: z.string(),
      description: z.string().optional(),
      /** Icon name from the built-in set (see components/Icon.astro). */
      icon: z.string().optional(),
      /** Process ink for covers and accents: c, m, y, g, v or o. Assigned uniquely with the motif when absent. */
      ink: z.enum(['c', 'm', 'y', 'g', 'v', 'o']).optional(),
      /** Cover-art motif: a built-in or one a plugin registers. Assigned uniquely with the ink when absent. */
      motif: z.string().optional(),
      owners: z.array(z.string()).default([]),
      /** Review interval for the project's decided records (`1 year`, `never`); overrides `reviews.every`. */
      reviewEvery: z.union([z.string().refine(isInterval, 'expected an interval like "1 year" or "never"'), z.literal(false)]).nullish(),
      /** Lower comes first on the landing page and in the sidebar. */
      order: z.number().default(100),
      /** Custom fields for this project's records, on top of (or replacing) the site's `fields`. */
      fields: projectFieldsSchema.optional(),
      /** Only signed-in users see the project and its records (needs `authentication` in inkan.config). */
      protected: z.boolean().default(false),
      links: z.array(z.object({ label: z.string(), url: z.string().regex(/^(https?:\/\/|\/(?![/\\]))/i, 'link url must start with http://, https:// or /') })).default([]),
    }),
  }),

  /** Optional `_landing.md` rendered on the home page (section "content"). */
  landing: defineCollection({
    loader: landingFile ? glob({ base: contentDir, pattern: landingFile }) : empty('no-landing'),
    schema: z.looseObject({}),
  }),

  /**
   * The user's own Markdown pages (`pagesDir`), served at their file path through the docs route:
   * pages/handbook.md -> /handbook/, pages/guides/index.md -> /guides/
   */
  pages: defineCollection({
    loader: pagesDir && fs.existsSync(pagesDir) ? glob({ base: pagesDir, pattern: content }) : empty('no-pages'),
    schema: z.object({
      title: z.string(),
      description: z.string().optional(),
      draft: z.boolean().default(false),
    }),
  }),

  /** Optional author directory (`_authors.yml`). Unknown authors still work. */
  authors: defineCollection({
    loader: fs.existsSync(authorsFile) ? file(authorsFile) : empty('no-authors'),
    schema: z.object({
      name: z.string(),
      /** Git author e-mail, so commits map to this handle when `authors` is inferred from history. */
      email: z.string().optional(),
      github: z.string().optional(),
      gitlab: z.string().optional(),
      team: z.string().optional(),
      avatar: z.string().optional(),
    }),
  }),
};
