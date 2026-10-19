---
title: "Interface in your language"
description: "The locale option, the built-in English and Polish interface, translations for any other language from the config or a plugin, and the t() helper for your own components."
status: implemented
date: 2026-10-17
tags: [site, configuration, extending]
related: [extending/adr/0001-plugins-with-defineplugin, extending/adr/0002-override-components-and-fill-slots, authoring/adr/0004-configurable-status-lifecycle]
---

## Context

A decision archive is read by everyone in the company, not only by engineers who are comfortable with English. Teams often write their records in their own language, and a site whose buttons, filters and dates are in English around a Polish record reads as two products glued together. Translating the interface must not mean forking the app or overriding every component, and adding a third language must not wait for a release.

## Decision

The interface text lives in dictionaries, one per language, keyed by stable ids such as `nav.timeline` or `filters.clear`. `locale` in the config picks the language for the whole site; one build serves one language. English and Polish ship with the package. Any other language, and any single wording you want changed, comes from `translations` in the config or in a plugin. Keys missing from a language fall back to English, so a partial translation never breaks the build.

## How to use it

### Pick the language

```ts title="inkan.config.ts"
export default defineConfig({
  title: 'Decyzje Acme',
  locale: 'pl',
});
```

`locale` is a BCP 47 tag: `'en'`, `'pl'`, `'pl-PL'`, `'pt-BR'`. A regional tag uses the text of its language (`pl-PL` gets the Polish dictionary) plus anything you add under the regional tag. An invalid tag fails the build.

The language also decides:

- `<html lang>`, which screen readers and the Pagefind search index use;
- how dates and month names are written;
- the default `tagline` and `description`;
- the default labels of the built-in statuses and the plural names and descriptions of the ADR and RFC types;
- the text of the default landing buttons.

What you set yourself in the config (`statuses`, `docTypes`, `landing.actions`, `tagline`, navigation labels) is shown as written, in whatever language you wrote it.

### Change or add text

`translations` maps a language to keys and their text. Your entries win over the built-in ones:

```ts title="inkan.config.ts"
export default defineConfig({
  locale: 'pl',
  translations: {
    pl: { 'nav.backlog': 'Do przeglądu' },
  },
});
```

A language that is not built in needs only the keys you want translated; everything else stays in English:

```ts title="inkan.config.ts"
export default defineConfig({
  locale: 'de',
  translations: {
    de: {
      'nav.records': 'Einträge',
      'nav.timeline': 'Zeitleiste',
      'nav.backlog': 'Offen',
    },
  },
});
```

The full list of keys, with the English text, is `lib/i18n/en.mjs` in the `inkan` package. `lib/i18n/pl.mjs` is a complete translation to start a new language from.

### Placeholders and plurals

`{name}` in a message is replaced with a value, for example `{count}` or `{date}`. Text that depends on a number is an object with one entry per plural form of the language, as defined by `Intl.PluralRules`:

```ts
translations: {
  pl: {
    'filters.count': { one: '{count} rekord', few: '{count} rekordy', many: '{count} rekordów', other: '{count} rekordu' },
  },
}
```

English needs `one` and `other`; Polish uses `one`, `few`, `many` and `other`. A form the language does not use is ignored, and a missing one falls back to `other`.

### Ship a language in a plugin

A plugin can carry `translations` in the same shape, to add a language or to translate the text of its own pages. Plugins are applied in order, then the config's `translations` on top:

```ts title="plugins/german.ts"
import { definePlugin } from 'inkan';
import de from './de.json';

export default definePlugin({ name: 'german', translations: { de } });
```

### Use it in your components

Overridden components, slots and custom pages can use the same dictionary, so they switch language together with the rest of the site:

```astro title="components/HeaderEnd.astro"
---
import { t } from 'inkan/i18n';
---
<a href="/on-call/">{t('nav.timeline')}</a>
```

`t(key, params)` works in the page frontmatter and in browser `<script>` blocks. `locale` is exported next to it for `Intl` formatting. Keys of your own go into `translations` for every language you serve.

### What is not translated

The records themselves, project names, author names and everything else from your content are shown as written. Machine-facing output (`llms.txt`, `decisions.json`, `AGENTS.md`, the RSS feed, badges and the MCP server) stays in English, because tools and agents read it. The CLI speaks English.
