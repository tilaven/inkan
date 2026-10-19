---
title: "Plugins with definePlugin"
description: "How to package config changes, Markdown plugins, Vite plugins, Astro integrations, extra pages, cover motifs, head tags and navigation links into one reusable plugin."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [plugins, config, extending]
options: [plugins]
related: [extending/adr/0003-custom-pages, extending/adr/0002-override-components-and-fill-slots, theming/adr/0005-generated-record-covers]
---

## Context

`inkan.config.ts` covers the common cases, but some teams need more: a remark plugin for an in-house
Markdown syntax, a Vite plugin, an Astro integration, a page that only one company wants, a cover motif, or a set of head tags
and links that every decision site in the organisation should share. Copying these into every config file does
not scale, and a config schema that rejects unknown keys cannot grow a field for every such need.

## Decision

A plugin is a plain object with a `name` and a few optional hooks, wrapped in `definePlugin()` for type hints.
Plugins are listed in `plugins` in the config. Each hook is appended to what Inkan already does: the
built-in remark and rehype plugins, Vite plugins and integrations run first, then the plugins' in list order.

A `config` hook can rewrite the resolved config before the site is built. It runs on every config load, which
includes every dev-server restart, so it has to be idempotent.

## How to use it

### A complete plugin

This is the plugin from `examples/company-decisions/plugins/acme.ts`, extended with every hook:

```ts title="plugins/acme.ts"
import { definePlugin } from 'inkan';
import remarkAcmeTerms from './remark-acme-terms.mjs';

/** Tags every page with the owning team, links the on-call page from the header and adds a cover motif. */
export default definePlugin({
  name: 'acme',
  // Receives the resolved config (defaults applied, paths absolute). Return a new object or mutate and return nothing.
  config: (config) => ({ ...config, description: `${config.description} Maintained by Platform Engineering.` }),
  remarkPlugins: [remarkAcmeTerms],
  rehypePlugins: [],
  vitePlugins: [],
  integrations: [],
  pages: [{ pattern: '/on-call-rota', entrypoint: new URL('./rota.astro', import.meta.url) }],
  motifs: { stamp: new URL('./stamp.ts', import.meta.url) },
  head: [{ tag: 'meta', attrs: { name: 'acme:owner', content: 'platform-engineering' } }],
  navigation: [{ label: 'On-call', href: '/on-call/' }],
});
```

```ts title="inkan.config.ts"
import { defineConfig } from 'inkan';
import acmePlugin from './plugins/acme.ts';

export default defineConfig({
  title: 'Acme Decisions',
  plugins: [acmePlugin],
});
```

### Hooks

| Hook | Type | What it does |
| --- | --- | --- |
| `name` | `string` | Required. Used in warnings and errors. |
| `config` | `(config: ResolvedConfig) => ResolvedConfig \| void \| Promise<...>` | Rewrites the resolved config. Runs after validation and path resolution, before `head` and `navigation` are merged. |
| `remarkPlugins` | `unknown[]` | Appended after the built-in remark plugins (callouts, math, `.md` links, issue links). Applies to every Markdown and MDX file. |
| `rehypePlugins` | `unknown[]` | Appended after the built-in rehype plugins (KaTeX, task labels, heading slugs and anchors). |
| `vitePlugins` | `VitePlugin[]` | Appended to Astro's `vite.plugins`, after Inkan's own virtual-module plugin. |
| `integrations` | `AstroIntegration[]` | Appended after the built-in integrations (Mermaid, Expressive Code, MDX, sitemap). |
| `pages` | `{ pattern, entrypoint }[]` | Extra routes. `entrypoint` is an absolute path, a `file:` URL or a `URL` of an `.astro` page or a `.ts` endpoint. |
| `motifs` | `Record<string, string \| URL>` | Cover motifs: a name (`/^[a-z][a-z0-9-]*$/`) to a module whose default export is a `MotifFn`. Projects pick it with `motif:` in `_project.yml`, or get it through the motif's `keywords` when their id or name contains one. A later plugin wins over an earlier one and over a built-in of the same name. |
| `head` | `HeadTag[]` | Tags added to every page's `<head>`, after the ones from `head` in the config. |
| `navigation` | `NavLink[]` | Links appended to the top navigation and the sidebar's links block, after the ones from the config. |
| `translations` | `Record<string, Record<string, Message>>` | Interface text by language: new languages, or the text of the plugin's own pages. The config's `translations` win. See [Interface in your language](../../site/adr/0015-interface-in-your-language.md). |

### The config hook

The hook sees the resolved config: every path is absolute (`contentDir`, `pagesDir`, `customCss`, `logo`,
`components`, `mdxComponents`), defaults are filled in, `BASE_PATH` has already replaced `base`, and
`root`, `configFile`, `repoRoot`, `contentPath` and `templates` are set. Return a new object or mutate the
argument and return nothing.

> [!WARNING]
> The hook runs on every load, including each restart of the dev server. Appending to a list or a string
> inside the hook must not grow it twice. The example above is safe because Inkan starts from a fresh
> copy of the defaults on each load; a hook that reads state from outside the config is not.

After all hooks ran, `head`, `navigation`, `locale` and `translations` are validated once more. A hook that puts a malformed entry
there fails the build with `Invalid inkan config after plugin hooks:` and one line per problem.

### Pages

Plugin pages go through the same collision check as the pages in `pagesDir`: a pattern that matches a built-in
page, a record, a redirect or another page fails the build. A pattern with a parameter (`/rota/[team]`) only
warns, because Astro gives the more specific route priority. A missing entrypoint fails with
`plugin "acme" page /on-call-rota: entrypoint not found: ...`. See [Custom pages](0003-custom-pages.md) for the
layouts and data helpers a page can use.

### Motifs

A motif module default-exports a drawing function wrapped in `defineMotif`. It receives the
canvas and two seeded generators, one per record and one per project. The optional second argument lists the
`keywords` that make the motif the natural pick for a team:

```ts title="plugins/stamp.ts"
import { defineMotif } from 'inkan';
import { circle, n } from 'inkan/covers';

export default defineMotif((c, record, project) => {
  const cx = c.w * (project() < 0.5 ? 0.3 : 0.7);
  const cy = c.h * (0.3 + record() * 0.1);
  c.halftone({ spacing: 5, angle: 0.6, maxR: 2.6, cls: 'a', field: { cx, cy, r: c.w, pow: 1.3, amp: 1.1 } });
  c.add(circle(cx, cy, c.w * 0.3, ' class="b x"'));
  c.add(`<path class="sk n" stroke-width="2" d="M${n(cx - 40)} ${n(cy)}H${n(cx + 40)}"/>`);
}, { keywords: ['audit', 'controls', 'sox'] });
```

The plugin registers it with `motifs: { stamp: new URL('./stamp.ts', import.meta.url) }`. A team pins it
with `motif: stamp`, and a project whose folder name or `name` contains `audit`, `controls` or `sox`
(as a whole word, plural `s` ignored) gets it without pinning, as long as the motif still has a free ink.
`keywords` must be an array of strings or `defineMotif` throws
`inkan: defineMotif keywords must be an array of strings`. A bad name fails config validation, a missing
module fails with `plugin "acme" motif "stamp": module not found: ...`, and a module that does not
default-export a function fails with `plugin motif "stamp" must default-export a function`. The canvas API,
the ink classes, the `inkan/covers` helpers and the matching rules are described in
[Generated record covers](../../theming/adr/0005-generated-record-covers.md).

### Unknown keys

The config schema rejects unknown top-level options, but plugin objects keep unknown keys, because a newer
plugin may carry fields an older Inkan does not know. Every such key is reported once per load:

```text
inkan: plugin "acme": unknown key "navigaton"
```

Treat the warning as a typo until proven otherwise.

### Where plugins live

Plugins are TypeScript or JavaScript modules imported by the config file, so they work in
`inkan.config.ts`, `.mjs` and `.js`. A `inkan.config.json` cannot hold a plugin, because hooks are
functions. Plugins can also be published to npm and imported like any other package.

## Consequences

- One plugin object replaces a growing config schema; every hook is additive and keeps its position after the built-ins. Only `motifs` can replace something built in, by reusing a name.
- The `config` hook has full power over the resolved config, including paths, which also means it can break the site. Keep hooks small and idempotent.
- Plugins are stripped from the config that reaches the browser build (`virtual:inkan/config`), so a plugin cannot hand data to components that way. Use `head`, a page or a Vite virtual module instead.
- Remark and rehype plugins run after the built-in ones; a plugin cannot run before callouts, math or link rewriting.
- Unknown plugin keys only warn. A misspelled hook does nothing until you read the warning.
