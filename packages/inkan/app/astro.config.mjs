// @ts-check
/**
 * The Astro app behind `inkan dev|build`. Users never edit this file:
 * everything comes from inkan.config.* in their repository.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import expressiveCode from 'astro-expressive-code';
import mermaid from 'astro-mermaid';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import remarkAdmonitions, { ADMONITION_TYPES, remarkContainerDirectives, remarkRestoreDirectives } from './src/lib/remark-admonitions.mjs';
import remarkMdLinks from './src/lib/remark-md-links.mjs';
import remarkIssueLinks from './src/lib/remark-issue-links.mjs';
import remarkLiteralTags from './src/lib/remark-literal-tags.mjs';
import rehypeTaskLabels from './src/lib/rehype-task-labels.mjs';
import rehypeHeadingAnchors from './src/lib/rehype-heading-anchors.mjs';
import rehypePagefindIgnore from './src/lib/rehype-pagefind-ignore.mjs';
import rehypeSourceLines from './src/lib/rehype-source-lines.mjs';
import rehypeScrollRegions from './src/lib/rehype-scroll-regions.mjs';
import { pluginCodeLabels } from './src/lib/code-labels.mjs';
import { codeTheme, codeStyleOverrides } from './src/lib/code-theme.mjs';
import { loadConfig } from '../lib/config.mjs';
import { t } from '../lib/i18n/index.mjs';
import { resolveComponent } from '../lib/components.mjs';
import { pluginMotifs as resolvePluginMotifs } from '../lib/motifs.mjs';
import { assertNoCollisions, discoverPages, pluginPages as resolvePluginPages } from '../lib/pages.mjs';
import { resolveRedirects } from '../lib/redirects.mjs';
import { loadProjects } from '../lib/records.mjs';
import { builtRoute, keepInPublic, orphanedAssets, protectedMatcher, protectedProjects, unprotectableMessage, unprotectableProjects } from '../lib/auth/protect.mjs';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const config = await loadConfig(process.env.INKAN_ROOT || process.cwd());
config.appDir = appDir;
// With `authentication` the CLI builds the site twice: the public one (protected pages left out) and the one members see.
/** @type {'public' | 'protected' | null} */
const variant = !config.authentication ? null : process.env.INKAN_VARIANT === 'protected' ? 'protected' : 'public';
config.variant = variant;
{
  const message = unprotectableMessage(unprotectableProjects(config));
  if (message) throw new Error(`inkan: ${message}`);
}
const protectedIds = protectedProjects(config);
const isProtected = protectedMatcher(config, protectedIds);
/** Left out of the public site. */
const hidden = (/** @type {string} */ pathname) => variant === 'public' && isProtected(pathname);
// Read by src/content.config.ts, which cannot import virtual modules.
process.env.INKAN_CONTENT_DIR = config.contentDir;
process.env.INKAN_PAGES_DIR = config.pagesDir;
process.env.INKAN_STATUSES = JSON.stringify(Object.keys(config.statuses));
process.env.INKAN_SOURCES = JSON.stringify(config.sources.map(({ project, contentDir }) => ({ project, contentDir })));
// The public build never loads a protected project: its records would be filtered out of every page, but the
// images they embed would still be copied into dist/_astro/.
process.env.INKAN_EXCLUDED_PROJECTS = JSON.stringify(
  variant === 'public' ? [...loadProjects(config).values()].filter((p) => protectedIds.includes(p.id)).map((p) => p.folder) : [],
);

const base = config.base || '/';
const redirects = resolveRedirects(config.redirects, base);
const plugins = config.plugins;
const pluginPages = resolvePluginPages(plugins);
const pluginMotifs = resolvePluginMotifs(plugins);
const userPages = discoverPages(config.pagesDir);
assertNoCollisions({ pages: userPages, pluginPages, redirects: config.redirects, contentDir: config.contentDir, sources: config.sources, appDir, root: config.root });
config.pages = userPages.map(({ route, kind }) => ({ route, kind }));

/** Overridable components and empty slots, see ComponentName in lib/index.d.ts. */
const COMPONENT_PREFIX = 'virtual:inkan/components/';
const componentPath = (/** @type {string} */ name) => resolveComponent(name, config.components, appDir);

/** Providers whose index lives elsewhere; the build writes `search.json` to feed it. */
const EXTERNAL_SEARCH = new Set(['algolia', 'meilisearch', 'typesense', 'custom']);

/** Virtual modules that hand the user's config, assets and CSS to the app. */
const modules = {
  // `notify` holds webhook URLs (secrets) and functions: it stays out of the site.
  'virtual:inkan/config': () => `export default ${JSON.stringify({ ...config, plugins: undefined, notify: undefined })};`,
  'virtual:inkan/assets': () =>
    [
      config.logo ? `export { default as logo } from ${JSON.stringify(config.logo + '?url')};` : 'export const logo = null;',
      config.favicon ? `export { default as favicon } from ${JSON.stringify(config.favicon + '?url')};` : 'export const favicon = null;',
    ].join('\n'),
  'virtual:inkan/search': () => {
    const { enabled, type, maxResults, module, options, ...rest } = config.search;
    const file = type === 'custom' ? module : path.join(appDir, 'src/search', `${type}.ts`);
    return `export { default } from ${JSON.stringify(file)};\nexport const options = ${JSON.stringify(type === 'custom' ? (options ?? {}) : rest)};`;
  },
  'virtual:inkan/comments': () => {
    const { enabled, provider, types, statuses, component, options, ...rest } = config.comments;
    if (!provider) return 'export default null;\nexport const options = {};';
    const file = provider === 'custom' ? component : path.join(appDir, 'src/comments', `${provider}.astro`);
    return `export { default } from ${JSON.stringify(file)};\nexport const options = ${JSON.stringify(provider === 'custom' ? options : { provider, ...rest })};`;
  },
  'virtual:inkan/user-css': () => config.customCss.map((f) => `import ${JSON.stringify(f)};`).join('\n'),
  'virtual:inkan/mdx-components': () =>
    config.mdxComponents ? `export { default } from ${JSON.stringify(config.mdxComponents)};` : 'export default {};',
  'virtual:inkan/motifs': () =>
    [
      ...pluginMotifs.map((m, i) => `import m${i} from ${JSON.stringify(m.entrypoint)};`),
      `export default { ${pluginMotifs.map((m, i) => `${JSON.stringify(m.name)}: m${i}`).join(', ')} };`,
    ].join('\n'),
};
const virtualModules = {
  name: 'inkan-virtual',
  /** @param {string} id */
  resolveId: (id) => {
    if (id.startsWith(COMPONENT_PREFIX)) return componentPath(id.slice(COMPONENT_PREFIX.length));
    return id in modules ? `\0${id}` : undefined;
  },
  /** @param {string} id */
  load: (id) => (id.startsWith('\0') && id.slice(1) in modules ? modules[/** @type {keyof typeof modules} */ (id.slice(1))]() : undefined),
};

/** @type {import('astro').AstroIntegration} */
const inkan = {
  name: 'inkan',
  hooks: {
    'astro:config:setup': ({ addWatchFile, injectRoute }) => {
      // Restart the dev server when the config changes; the files it points at (components, CSS, MDX components) hot-reload on their own.
      if (config.configFile) addWatchFile(config.configFile);
      addWatchFile(config.pagesDir);
      for (const { pattern, entrypoint } of pluginPages) injectRoute({ pattern, entrypoint });
      if (config.search.enabled && EXTERNAL_SEARCH.has(config.search.type)) {
        injectRoute({ pattern: '/search.json', entrypoint: path.join(appDir, 'src/routes/search.json.ts') });
      }
      for (const { route, file, kind } of userPages) {
        if (kind === 'astro' && !hidden(`/${route}/`)) injectRoute({ pattern: `/${route}`, entrypoint: file });
      }
      if (variant) injectRoute({ pattern: '/_auth/denied', entrypoint: path.join(appDir, 'src/routes/denied.astro') });
    },
    // A page added to or removed from pagesDir needs new routes. Astro restarts only on events for files given to
    // addWatchFile and has no restart API, so the event is raised for pagesDir itself.
    'astro:server:setup': ({ server }) => {
      server.watcher.add(config.pagesDir);
      const restart = (/** @type {string} */ file) => {
        if (file.startsWith(config.pagesDir + path.sep)) server.watcher.emit('change', config.pagesDir);
      };
      server.watcher.on('add', restart).on('unlink', restart);
    },
    // Full-text search index (Pagefind) over the generated HTML.
    'astro:build:done': async ({ dir, logger }) => {
      const outDir = fileURLToPath(dir);
      // Plugin pages and the user's .astro pages render whatever they like; in the public site every protected route
      // goes, whatever the file type, and with it every hashed asset (images, fonts, chunks) nothing public uses.
      if (variant === 'public') {
        let removed = 0;
        for (const entry of fs.readdirSync(outDir, { recursive: true, withFileTypes: true })) {
          if (!entry.isFile()) continue;
          const file = path.join(entry.parentPath, entry.name);
          const rel = path.relative(outDir, file).split(path.sep).join('/');
          if (keepInPublic(rel) || !isProtected(builtRoute(rel))) continue;
          fs.rmSync(file);
          removed++;
        }
        if (removed) logger.info(`Public site: ${removed} protected page${removed === 1 ? '' : 's'} removed`);
        const orphans = orphanedAssets(outDir);
        for (const file of orphans) fs.rmSync(file);
        if (orphans.length) logger.info(`Public site: ${orphans.length} unused asset${orphans.length === 1 ? '' : 's'} removed`);
      }
      if (!config.search.enabled || config.search.type !== 'pagefind') return;
      const pagefind = await import('pagefind');
      const { index } = await pagefind.createIndex({});
      if (!index) throw new Error('Pagefind failed to start');
      const { page_count } = await index.addDirectory({ path: outDir });
      await index.writeFiles({ outputPath: path.join(outDir, 'pagefind') });
      await pagefind.close();
      logger.info(`Search index: ${page_count} pages`);
    },
  },
};

/** Mermaid diagrams drawn as ink on paper: thin strokes in the page's own colours, so they follow the theme. */
const MERMAID_CSS = `
  .node rect, .node polygon, .node circle, .node ellipse, .node path, .actor, .cluster rect, .note { fill: var(--inkan-surface); stroke: var(--inkan-fg); stroke-width: 1.6px; }
  .cluster rect { fill: var(--inkan-bg-2); stroke-dasharray: 4 3; }
  .edgePath .path, .flowchart-link, .messageLine0, .messageLine1, .relation, .transition { stroke: var(--inkan-fg); stroke-width: 1.6px; }
  .actor-line { stroke: var(--inkan-rule-strong); }
  .arrowheadPath, .marker, #arrowhead path, marker path { fill: var(--inkan-fg); stroke: var(--inkan-fg); }
  .label, .label text, .nodeLabel, .edgeLabel, .messageText, .actor text, .noteText, text { fill: var(--inkan-fg); color: var(--inkan-fg); stroke: none; }
  .edgeLabel, .edgeLabel rect, .labelBox { background-color: var(--inkan-bg); fill: var(--inkan-bg); stroke: none; }
  .edgeLabel p { background-color: var(--inkan-bg); }
`;

export default defineConfig({
  root: appDir,
  site: config.url,
  base,
  trailingSlash: 'always',
  redirects,
  outDir: path.join(config.root, variant === 'protected' ? 'dist-protected' : 'dist'),
  // Each variant keeps its own content store, so the public build never reads what the protected one cached.
  cacheDir: path.join(config.root, 'node_modules', '.inkan', variant ?? ''),
  publicDir: path.join(appDir, 'public'),
  devToolbar: { enabled: false },
  telemetry: false,
  markdown: {
    // GitHub/GitLab extras on top of GFM: > [!NOTE] alerts and :::note callouts, $math$, relative links to .md files, issue keys.
    processor: unified({
      remarkPlugins: [
        remarkContainerDirectives,
        [remarkAdmonitions, { labels: Object.fromEntries(ADMONITION_TYPES.map((type) => [type, t(`admonition.${type}`)])) }],
        remarkMath,
        [remarkMdLinks, { contentDir: config.contentDir, base, sources: config.sources }],
        [remarkIssueLinks, { rules: config.issueLinks }],
        remarkLiteralTags,
        ...plugins.flatMap((p) => p.remarkPlugins ?? []),
        remarkRestoreDirectives,
      ],
      rehypePlugins: [
        rehypeSourceLines,
        rehypeKatex,
        [rehypeScrollRegions, { table: t('markdown.table'), equation: t('markdown.equation'), inRecord: t('markdown.inRecord') }],
        [rehypeTaskLabels, { done: t('markdown.taskDone'), notDone: t('markdown.taskNotDone') }],
        rehypeSlug,
        [rehypeHeadingAnchors, { label: t('markdown.sectionLink') }],
        rehypePagefindIgnore,
        ...plugins.flatMap((p) => p.rehypePlugins ?? []),
      ],
    }),
  },
  vite: {
    plugins: [virtualModules, ...plugins.flatMap((p) => p.vitePlugins ?? [])],
    cacheDir: path.join(config.root, 'node_modules', variant ? `.vite-inkan-${variant}` : '.vite-inkan'),
    // Mermaid is large but only loaded on pages with diagrams.
    build: { chunkSizeWarningLimit: 4000 },
    // Content, images and CSS live in the user's repo, outside this package.
    server: { fs: { allow: [config.root, appDir, path.resolve(appDir, '..'), config.repoRoot, ...config.sources.map((s) => s.root)] } },
  },
  integrations: [
    inkan,
    // Must come before the code highlighter so ```mermaid blocks are not turned into code blocks.
    mermaid({
      autoTheme: true,
      mermaidConfig: {
        fontFamily: '"Martian Mono", ui-monospace, Menlo, monospace',
        themeVariables: { fontSize: '12px' },
        htmlLabels: false,
        flowchart: { padding: 14 },
        // Inline SVG inherits the page's custom properties, so Day and Stage need no second palette.
        themeCSS: MERMAID_CSS,
      },
    }),
    expressiveCode({
      themes: [codeTheme],
      plugins: [pluginLineNumbers(), pluginCodeLabels({ label: t('markdown.codeBlock') })],
      defaultProps: { showLineNumbers: true, wrap: false },
      useDarkModeMediaQuery: false,
      styleOverrides: codeStyleOverrides,
    }),
    mdx(),
    // The print/export document is reachable from the footer but is no page to index; neither is anything sign-in related.
    sitemap({ filter: (page) => !page.endsWith('/export/') && !page.includes('/_auth/') && !hidden(new URL(page).pathname) }),
    ...plugins.flatMap((p) => p.integrations ?? []),
  ],
});
