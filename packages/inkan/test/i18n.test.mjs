import { describe, expect, it } from 'vitest';
import { loadConfig } from '../lib/config.mjs';
import en from '../lib/i18n/en.mjs';
import pl from '../lib/i18n/pl.mjs';
import { resolveMessages, translator } from '../lib/i18n/index.mjs';
import { configModule, tmpSite } from './helpers.mjs';

const placeholders = (m) => [...new Set((typeof m === 'string' ? [m] : Object.values(m)).flatMap((s) => s.match(/\{\w+\}/g) ?? []))].sort();

describe('dictionaries', () => {
  it('translate every English key to Polish with the same placeholders', () => {
    expect(Object.keys(pl).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en)) expect(placeholders(pl[key]), key).toEqual(placeholders(en[key]));
  });

  it('give Polish plurals every form Polish uses', () => {
    for (const [key, m] of Object.entries(pl)) {
      if (typeof m !== 'string') expect(Object.keys(m).sort(), key).toEqual(['few', 'many', 'one', 'other']);
    }
  });
});

describe('translator', () => {
  const t = translator('pl', { n: { one: '{count} rekord', few: '{count} rekordy', many: '{count} rekordów', other: '{count} rekordu' }, hi: 'Cześć, {name}' });

  it('picks the plural form by count', () => {
    expect([1, 3, 5, 22, 1.5].map((count) => t('n', { count }))).toEqual(['1 rekord', '3 rekordy', '5 rekordów', '22 rekordy', '1.5 rekordu']);
  });

  it('fills placeholders and keeps unknown ones and unknown keys', () => {
    expect(t('hi', { name: 'Ola' })).toBe('Cześć, Ola');
    expect(t('hi')).toBe('Cześć, {name}');
    expect(t('missing.key')).toBe('missing.key');
  });

  it('falls back to other for a form the message lacks', () => {
    expect(translator('en', { n: { other: '{count} items' } })('n', { count: 1 })).toBe('1 items');
  });
});

describe('resolveMessages', () => {
  it('layers English, the language, the region and translations in order', () => {
    const m = resolveMessages('pl-PL', [{ pl: { 'nav.backlog': 'Plugin' } }, { 'pl-PL': { 'nav.backlog': 'Config' } }]);
    expect(m['nav.timeline']).toBe(pl['nav.timeline']);
    expect(m['nav.backlog']).toBe('Config');
  });

  it('falls back to English for languages without a dictionary', () => {
    const m = resolveMessages('de', [{ de: { 'nav.timeline': 'Zeitleiste' } }]);
    expect(m['nav.timeline']).toBe('Zeitleiste');
    expect(m['nav.records']).toBe(en['nav.records']);
  });
});

describe('locale in the config', () => {
  it('defaults to English', async () => {
    const config = await loadConfig(tmpSite());
    expect(config.locale).toBe('en');
    expect(config.messages['nav.timeline']).toBe('Timeline');
  });

  it('localizes the default labels but keeps what the user wrote', async () => {
    const root = tmpSite({
      'inkan.config.mjs': configModule(`{ locale: 'pl-pl', tagline: 'Nasze decyzje', translations: { pl: { 'nav.backlog': 'Do przeglądu' } } }`),
    });
    const config = await loadConfig(root);
    expect(config.locale).toBe('pl-PL');
    expect(config.tagline).toBe('Nasze decyzje');
    expect(config.description).toBe(pl['site.description']);
    expect(config.statuses.accepted).toEqual({ label: 'Przyjęty', current: true });
    expect(config.docTypes.adr).toEqual({ label: 'ADR', plural: 'Decyzje', description: pl['docType.adr.description'] });
    expect(config.landing.actions.map((a) => a.text)).toEqual([pl['landing.browse'], pl['nav.timeline'], 'Do przeglądu']);
    expect(config.messages['nav.backlog']).toBe('Do przeglądu');
  });

  it('applies plugin translations under the config ones', async () => {
    const root = tmpSite({
      'inkan.config.mjs': configModule(`{
        locale: 'de',
        plugins: [{ name: 'de', translations: { de: { 'nav.records': 'Einträge', 'nav.timeline': 'Zeitleiste' } } }],
        translations: { de: { 'nav.timeline': 'Chronik' } },
      }`),
    });
    const config = await loadConfig(root);
    expect(config.messages['nav.records']).toBe('Einträge');
    expect(config.messages['nav.timeline']).toBe('Chronik');
    expect(config.statuses.accepted.label).toBe('Accepted');
  });

  it('rejects an invalid tag, also from a plugin hook', async () => {
    await expect(loadConfig(tmpSite({ 'inkan.config.mjs': configModule(`{ locale: 'not a tag' }`) }))).rejects.toThrow(/locale: must be a BCP 47 language tag/);
    const root = tmpSite({ 'inkan.config.mjs': configModule(`{ plugins: [{ name: 'p', config: (c) => { c.locale = '!'; } }] }`) });
    await expect(loadConfig(root)).rejects.toThrow(/after plugin hooks:\n {2}inkan.config.mjs: locale: must be a BCP 47/);
  });

  it('rejects plural forms that are not plural categories', async () => {
    const root = tmpSite({ 'inkan.config.mjs': configModule(`{ translations: { pl: { x: { single: 'a' } } } }`) });
    await expect(loadConfig(root)).rejects.toThrow(/translations\.pl\.x/);
  });
});
