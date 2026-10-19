import { describe, expect, it } from 'vitest';
import { loadConfig } from '../lib/config.mjs';
import { definePlugin } from '../lib/index.mjs';
import { configModule, tmpSite } from './helpers.mjs';

describe('plugins', () => {
  it('runs config hooks in order on the resolved config', async () => {
    const root = tmpSite({
      'inkan.config.mjs': configModule(`{
        title: 'Base',
        plugins: [
          { name: 'one', config: (c) => ({ ...c, title: c.title + ' +1' }) },
          { name: 'two', config: async (c) => { c.title += ' +2'; } },
          { name: 'three', config: (c) => ({ ...c, title: c.title + ' +3', seenRoot: c.root }) },
        ],
      }`),
    });
    const config = await loadConfig(root);
    expect(config.title).toBe('Base +1 +2 +3');
    expect(config.seenRoot).toBe(root);
  });

  it('appends plugin head tags and navigation after the user ones', async () => {
    const root = tmpSite({
      'inkan.config.mjs': configModule(`{
        head: [{ tag: 'meta', attrs: { name: 'user' } }],
        navigation: [{ label: 'User', href: '/u/' }],
        plugins: [
          { name: 'a', head: [{ tag: 'meta', attrs: { name: 'a' } }], navigation: [{ label: 'A', href: '/a/' }] },
          { name: 'b', navigation: [{ label: 'B', href: '/b/' }] },
        ],
      }`),
    });
    const config = await loadConfig(root);
    expect(config.head.map((h) => h.attrs.name)).toEqual(['user', 'a']);
    expect(config.navigation.map((n) => n.label)).toEqual(['User', 'A', 'B']);
  });

  it('warns about unknown plugin keys when loading', async () => {
    const root = tmpSite({ 'inkan.config.mjs': configModule(`{ plugins: [{ name: 'p', colour: 'red' }] }`) });
    const warnings = [];
    await loadConfig(root, { warn: (m) => warnings.push(m) });
    expect(warnings).toEqual(['inkan: plugin "p": unknown key "colour"']);
  });

  it('re-validates head and navigation after the hooks ran', async () => {
    const root = tmpSite({
      'inkan.config.mjs': configModule(`{ plugins: [{ name: 'p', config: (c) => { c.navigation.push({ label: 'X' }); } }] }`),
    });
    await expect(loadConfig(root)).rejects.toThrow(/after plugin hooks:\n {2}inkan.config.mjs: navigation.0.href: expected string/);
  });

  it('keeps plugin objects on the resolved config', async () => {
    const root = tmpSite({ 'inkan.config.mjs': configModule(`{ plugins: [{ name: 'p', remarkPlugins: [1] }] }`) });
    const config = await loadConfig(root);
    expect(config.plugins).toHaveLength(1);
    expect(config.plugins[0].name).toBe('p');
  });

  it('definePlugin returns the plugin unchanged', () => {
    const plugin = { name: 'x' };
    expect(definePlugin(plugin)).toBe(plugin);
  });
});
