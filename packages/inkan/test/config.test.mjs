import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { configSchema, knownKeysAt, loadConfig, unknownPluginKeys, validateConfig } from '../lib/config.mjs';
import { defaults } from '../lib/defaults.mjs';
import { configModule, tmpSite } from './helpers.mjs';

describe('loadConfig', () => {
  it('uses the defaults without a config file', async () => {
    const root = tmpSite();
    const config = await loadConfig(root);
    expect(config.title).toBe(defaults.title);
    expect(config.configFile).toBeNull();
    expect(config.contentDir).toBe(path.join(root, 'decisions'));
    expect(config.pagesDir).toBe(path.join(root, 'pages'));
    expect(config.statuses).toEqual(defaults.statuses);
    expect(config.banner).toBeNull();
    expect(config.plugins).toEqual([]);
  });

  it('merges nested objects but replaces statuses and docTypes', async () => {
    const root = tmpSite({
      'inkan.config.mjs': configModule(`{
        title: 'Mine',
        repo: { url: 'https://example.com/r' },
        landing: { sections: ['stats'] },
        statuses: { live: { label: 'Live', current: true } },
        docTypes: { pm: { label: 'PM', plural: 'Postmortems', description: 'Postmortem' } },
      }`),
    });
    const config = await loadConfig(root);
    expect(config.title).toBe('Mine');
    expect(config.repo).toEqual({ url: 'https://example.com/r', branch: 'main', provider: 'github' });
    expect(config.landing.sections).toEqual(['stats']);
    expect(config.landing.actions).toEqual(defaults.landing.actions);
    expect(Object.keys(config.statuses)).toEqual(['live']);
    expect(Object.keys(config.docTypes)).toEqual(['pm']);
  });

  it('resolves paths relative to the config file and reads JSON configs', async () => {
    const root = tmpSite({
      'inkan.config.json': JSON.stringify({
        contentDir: 'records',
        logo: './brand/logo.svg',
        customCss: ['./brand/theme.css'],
        components: { Footer: './parts/Footer.astro' },
        mdxComponents: './parts/mdx.ts',
        landing: { image: { src: './brand/hero.webp', dark: './brand/hero-dark.webp', alt: 'Hero' } },
      }),
    });
    const config = await loadConfig(root);
    expect(config.contentDir).toBe(path.join(root, 'records'));
    expect(config.logo).toBe(path.join(root, 'brand/logo.svg'));
    expect(config.customCss).toEqual([path.join(root, 'brand/theme.css')]);
    expect(config.components).toEqual({ Footer: path.join(root, 'parts/Footer.astro') });
    expect(config.mdxComponents).toBe(path.join(root, 'parts/mdx.ts'));
    expect(config.landing.image).toEqual({ src: path.join(root, 'brand/hero.webp'), dark: path.join(root, 'brand/hero-dark.webp'), alt: 'Hero' });
  });

  it('does not share default objects between loads', async () => {
    const config = await loadConfig(tmpSite());
    config.navigation.push({ label: 'x', href: '/x/' });
    config.landing.sections.push('extra');
    const again = await loadConfig(tmpSite());
    expect(again.navigation).toEqual([]);
    expect(again.landing.sections).toEqual(defaults.landing.sections);
  });

  it('defaults banner.dismissible to false', async () => {
    const root = tmpSite({ 'inkan.config.mjs': configModule(`{ banner: { message: 'Hi' } }`) });
    expect((await loadConfig(root)).banner).toEqual({ message: 'Hi', dismissible: false });
  });

  it('resolves search to a provider', async () => {
    const search = async (value) =>
      (await loadConfig(tmpSite({ 'inkan.config.mjs': configModule(`{ search: ${value} }`) }))).search;
    expect((await loadConfig(tmpSite())).search).toEqual({ enabled: true, type: 'pagefind', maxResults: 8 });
    expect(await search('false')).toEqual({ enabled: false, type: 'pagefind', maxResults: 8 });
    expect(await search('{ enabled: false }')).toEqual({ enabled: false, type: 'pagefind', maxResults: 8 });
    expect(await search(`{ type: 'algolia', appId: 'A', apiKey: 'k', indexName: 'i', maxResults: 5 }`)).toEqual({
      enabled: true,
      type: 'algolia',
      appId: 'A',
      apiKey: 'k',
      indexName: 'i',
      maxResults: 5,
    });
    const root = tmpSite({ 'inkan.config.mjs': configModule(`{ search: { type: 'custom', module: './search.ts' } }`) });
    expect((await loadConfig(root)).search.module).toBe(path.join(root, 'search.ts'));
  });

  it('validates search set by a plugin', async () => {
    const plugin = `{ name: 'p', config: (c) => ({ ...c, search: { type: 'meilisearch' } }) }`;
    const root = tmpSite({ 'inkan.config.mjs': configModule(`{ plugins: [${plugin}] }`) });
    await expect(loadConfig(root)).rejects.toThrow('search.host');
  });

  it('lets BASE_PATH override base', async () => {
    const root = tmpSite({ 'inkan.config.mjs': configModule(`{ base: '/a' }`) });
    process.env.BASE_PATH = '/b';
    try {
      expect((await loadConfig(root)).base).toBe('/b');
    } finally {
      delete process.env.BASE_PATH;
    }
  });

  it('prefers the user templates over the built-in ones', async () => {
    const root = tmpSite({ 'templates/adr.md': 'mine', 'templates/pm.md': 'pm' });
    const config = await loadConfig(root);
    expect(config.templates.adr).toBe('mine');
    expect(config.templates.pm).toBe('pm');
    expect(config.templates.rfc).toContain('title');
  });

  it('is JSON-serialisable apart from plugins', async () => {
    const root = tmpSite({ 'inkan.config.mjs': configModule(`{ plugins: [{ name: 'p', config: () => {} }] }`) });
    const config = await loadConfig(root);
    const json = JSON.parse(JSON.stringify({ ...config, plugins: undefined }));
    expect(json.title).toBe(defaults.title);
    expect(fs.existsSync(json.contentDir)).toBe(false);
  });
});

describe('validateConfig', () => {
  const file = '/site/inkan.config.ts';
  const errorOf = (user) => {
    try {
      validateConfig(user, file);
    } catch (e) {
      return e.message;
    }
    throw new Error('expected validation to fail');
  };

  it('names the config file and the key path', () => {
    expect(errorOf({ statuses: { accepted: { label: 3 } } })).toContain('inkan.config.ts: statuses.accepted.label: expected string, received number');
    expect(errorOf({ repo: { url: 1 } })).toContain('repo.url: expected string');
    expect(errorOf({ theme: { default: 'blue' } })).toContain('theme.default: expected one of "system"|"light"|"dark"');
  });

  it('rejects unknown keys with a hint', () => {
    expect(errorOf({ titel: 'x' })).toContain('titel: unknown option, did you mean "title"?');
    expect(errorOf({ components: { Sidebr: 'x.astro' } })).toContain('components.Sidebr: unknown option, did you mean "Sidebar"?');
    expect(errorOf({ repo: { url: 'x', brach: 'main' } })).toContain('repo.brach: unknown option, did you mean "branch"?');
    expect(errorOf({ zzzz: 1 })).toMatch(/zzzz: unknown option$/m);
  });

  it('reports every problem at once', () => {
    const message = errorOf({ title: 1, url: 2 });
    expect(message).toContain('title: expected string');
    expect(message).toContain('url: expected string');
  });

  it('derives hints from the schema for nested objects and plugin keys', () => {
    expect(errorOf({ landing: { actions: [{ text: 'a', link: 'b', varian: 'x' }] } })).toContain('landing.actions.0.varian: unknown option, did you mean "variant"?');
    expect(errorOf({ statuses: { x: { label: 'X', opne: true } } })).toContain('statuses.x.opne: unknown option, did you mean "open"?');
    expect(errorOf({ plugins: [{ name: 'p', pages: [{ pattern: '/x', entrypiont: '/x.astro' }] }] })).toContain('plugins.0.pages.0.entrypiont: unknown option, did you mean "entrypoint"?');
    expect(knownKeysAt(configSchema, ['plugins', 0])).toContain('remarkPlugins');
  });

  it('validates the landing image, command and features', () => {
    expect(() => validateConfig({ landing: { command: 'npx inkan new adr', features: [{ title: 'A', text: 'B', link: '/a/' }] } })).not.toThrow();
    expect(errorOf({ landing: { image: { src: './a.webp' } } })).toContain('landing.image.alt');
    expect(errorOf({ landing: { features: [{ title: 'A', txt: 'B' }] } })).toContain('did you mean "text"?');
  });

  it('keeps unknown plugin keys but lists them', () => {
    expect(() => validateConfig({ plugins: [{ name: 'p', extra: 1 }] })).not.toThrow();
    expect(unknownPluginKeys([{ name: 'p', extra: 1, head: [] }])).toEqual(['plugin "p": unknown key "extra"']);
  });

  it('allows $schema in JSON configs and drops it', () => {
    expect(validateConfig({ $schema: 'https://example.com/schema.json', title: 'T' })).toEqual({ title: 'T' });
  });

  it('rejects empty folders', () => {
    expect(errorOf({ pagesDir: '' })).toContain('pagesDir: must not be empty');
    expect(errorOf({ contentDir: '' })).toContain('contentDir: must not be empty');
  });

  it('validates plugins', () => {
    expect(errorOf({ plugins: [{ config: () => {} }] })).toContain('plugins.0.name: expected string');
    expect(errorOf({ plugins: [{ name: 'p', config: 1 }] })).toContain('plugins.0.config: expected a function');
    expect(errorOf({ plugins: [{ name: 'p', pages: [{ pattern: '/x' }] }] })).toContain('plugins.0.pages.0.entrypoint');
    expect(() => validateConfig({ plugins: [{ name: 'p', pages: [{ pattern: '/x', entrypoint: new URL('file:///x.astro') }] }] })).not.toThrow();
  });

  it('accepts og: false or a theme for the Open Graph cards', () => {
    expect(() => validateConfig({ og: false })).not.toThrow();
    expect(() => validateConfig({ og: { theme: 'dark' } })).not.toThrow();
    expect(errorOf({ og: { theme: 'blue' } })).toContain('og:');
    expect(errorOf({ og: true })).toContain('og:');
  });

  it('accepts newest, oldest or number as the sidebar order', () => {
    for (const sort of ['newest', 'oldest', 'number']) expect(() => validateConfig({ sidebar: { sort } })).not.toThrow();
    expect(errorOf({ sidebar: { sort: 'date' } })).toContain('sidebar.sort');
    expect(errorOf({ sidebar: { order: 'newest' } })).toContain('sidebar');
  });

  it('requires an object', () => {
    expect(errorOf([])).toContain('default export must be an object');
    expect(errorOf(null)).toContain('default export must be an object');
  });

  it('explains invalid search options', () => {
    expect(() => validateConfig({ search: { type: 'elastic' } })).toThrow('search.type: type must be one of pagefind, algolia');
    expect(() => validateConfig({ search: { type: 'algolia', appId: 'A' } })).toThrow('search.apiKey');
    expect(() => validateConfig({ search: { type: 'pagefind', apiKey: 'k' } })).toThrow('search.apiKey: unknown option');
  });

  it('accepts a full config', () => {
    expect(() =>
      validateConfig({
        title: 'T',
        banner: null,
        head: [{ tag: 'meta', attrs: { name: 'a', content: 'b' } }],
        navigation: [{ label: 'A', href: '/a/' }],
        redirects: { '/a': '/b' },
        search: { enabled: false },
        landing: { title: null, actions: [{ text: 'x', link: '/x', variant: 'ghost' }] },
        plugins: [{ name: 'p', head: [], remarkPlugins: [() => {}] }],
      }),
    ).not.toThrow();
  });
});
