---
title: "Analytics with Plausible, Umami or Google Analytics"
description: "A built-in plugin that adds page views and a few site events (search queries, page actions) to Plausible, Umami and Google Analytics 4, in the built site only."
status: implemented
date: 2026-10-17
authors: [tilaven]
deciders: [tilaven]
tags: [analytics, plugins, privacy]
related: [extending/adr/0001-plugins-with-defineplugin, extending/adr/0002-override-components-and-fill-slots]
---

## Context

Teams want to know which decisions are read, what people search for and do not find, and whether the "Copy page" menu is used. A script tag in `HeadEnd` gives page views, but nothing from inside the site: the search palette and the page actions are client-side and a provider's script cannot see them. Pasting the same snippet into every config also means every team gets the loading details wrong in its own way, and the local dev server ends up in the statistics.

## Decision

Analytics is a plugin, `analytics()` from `inkan/analytics`, not a top-level `analytics` config key. The config schema stays closed, and the feature follows the same path as any other optional extra, see [Plugins with definePlugin](0001-plugins-with-defineplugin.md).

It is an Astro integration, not only `head` tags, because an integration can inject an inline script with `injectScript('head-inline')` and can see whether the command is `build` or `dev`. Plain tags would load in both. The script is injected only for `inkan build`, unless `dev: true`.

The app reports what happens on the page through one DOM event, `inkan:track`. The plugin listens for it and forwards it to every provider it loaded. Without the plugin nothing listens and the event is harmless.

## How to use it

```ts title="inkan.config.ts"
import { defineConfig } from 'inkan';
import { analytics } from 'inkan/analytics';

export default defineConfig({
  title: 'Acme Decisions',
  plugins: [
    analytics({
      plausible: { domain: 'decisions.acme.dev' },
      umami: { websiteId: '00000000-0000-0000-0000-000000000000' },
      google: { measurementId: 'G-XXXXXXXXXX' },
    }),
  ],
});
```

Use any combination of providers, but at least one. All options are validated when the config loads; a bad one throws `inkan analytics:` followed by one line per problem.

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `plausible.domain` | `string` | required | The site's domain as registered in Plausible. |
| `plausible.src` | `string` | `https://plausible.io/js/script.js` | Script URL, for a self-hosted instance. |
| `plausible.api` | `string` | Plausible's own | Event endpoint when proxied through your domain, for example `/stats/api/event`. |
| `umami.websiteId` | `string` | required | The website ID from Umami. |
| `umami.src` | `string` | `https://cloud.umami.is/script.js` | Script URL, for a self-hosted instance. |
| `umami.hostUrl` | URL | script origin | Where events are sent when that differs from the script's origin. |
| `umami.domains` | `string[]` | all | Only track on these hostnames. |
| `google.measurementId` | `string` | required | A GA4 ID, `G-` followed by capitals and digits. |
| `events` | `boolean` | `true` | Send the events below besides page views. |
| `dev` | `boolean` | `false` | Load the scripts in `inkan dev` too. |

### Page views

Each provider counts its own page view on every full page load. The site has no client-side router, so every navigation is a full load and nothing more is needed.

### Events

Unless `events: false`, the site sends two events:

| Event | Props | When |
| --- | --- | --- |
| `Search` | `query`, `results` | Once the reader settles on a query: 1 s after the last results, or when they click a result or close the palette. |
| `Page action` | `action`: `copy-markdown`, `copy-link`, `open-markdown`, `claude` or `chatgpt` | A successful "Copy page" (`copy-markdown`) or a choice in its menu. |

Google receives snake_case names, `search` and `page_action`; the other two get the names as written.

- **Plausible** shows custom events only after you create goals named `Search` and `Page action` in the dashboard and enable custom properties.
- **Umami** lists them under Events with no setup.
- **Google Analytics** collects them as custom events; register `query`, `results` and `action` as custom dimensions to report on them.

### Your own events

A component or MDX script can send an event with the same mechanism the app uses:

```ts
document.dispatchEvent(new CustomEvent('inkan:track', {
  detail: { name: 'Feedback', props: { helpful: true } },
}));
```

Props are flat values: strings, numbers or booleans. Plausible stores every prop as text, so `results` is filtered as a string there. The event reaches every provider that was loaded, and Plausible needs a goal for the new name just like for the built-in ones.

### Other tools

Matomo, PostHog, Google Tag Manager and the like are not part of the plugin. Add their snippet with `head` in the config or the `HeadEnd` slot, see [Override components and fill slots](0002-override-components-and-fill-slots.md).

> [!TIP]
> `inkan preview` serves the built site, so the scripts load there without `dev: true`. Open the network tab to check that the provider's script and events go out.

## Consequences

- Search queries are sent to the analytics provider, as typed. Set `events: false` if queries can contain anything sensitive, such as customer names or incident details.
- Plausible and Umami are cookieless. Google Analytics uses cookies, so in the EU it needs a consent banner before the plugin's script runs; the plugin does not ship one.
- The scripts load from the provider's servers on every page, so a strict `Content-Security-Policy` has to allow them. Self-hosting through `src` and `api` avoids third-party origins and most ad blockers.
- Local work never reaches the statistics, because `dev` is off by default. Turn it on only to test the setup, and expect the test traffic in the numbers.
- The events are fixed: two names and their props. Anything else is yours to send through `inkan:track`.
- Ad blockers hide a visitor from the numbers. Page counts are a floor, not an exact figure.
