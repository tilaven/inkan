---
title: "MDX components without imports"
description: "Register a set of components once in the config and use them in every MDX record and page without an import line."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [markdown, components, extending]
options: [mdxComponents]
related: [extending/adr/0003-custom-pages, authoring/adr/0007-github-flavoured-markdown-with-diagrams-and-math]
---

## Context

MDX lets a record embed a component, for example a callout, a decision matrix or an embedded diagram viewer.
In plain MDX every file has to import the component, with a relative path that depends on how deep the file
sits in `decisions/`. Authors copy the import wrong, and a renamed component breaks dozens of records.

## Decision

The `mdxComponents` option names one module whose default export maps component names to components. The
app passes that map to every rendered MDX file: records, project intros, pages in `pagesDir` and
`_landing.mdx`. Inside those files the names are available as JSX tags with no import.

## How to use it

```ts title="inkan.config.ts"
export default defineConfig({
  mdxComponents: './components/mdx.ts',
});
```

| Option | Default | What it does |
| --- | --- | --- |
| `mdxComponents` | `null` | Path, relative to the config file, of a module whose default export is `{ Name: Component, ... }` |

### The module

```ts title="components/mdx.ts"
import Callout from './Callout.astro';

/** Components available in every .mdx record and page without importing them. */
export default { Callout };
```

```astro title="components/Callout.astro"
---
interface Props { title?: string }
const { title = 'Note' } = Astro.props;
---
<aside class="callout" role="note">
  <strong>{title}</strong>
  <slot />
</aside>

<style>
  .callout { margin: 1.5rem 0; padding: 1rem 1.25rem; border-left: 3px solid var(--inkan-accent); border-radius: var(--inkan-radius); background: var(--inkan-surface); }
  .callout strong { display: block; margin-bottom: 0.25rem; }
</style>
```

### Using a component

```mdx title="pages/on-call.mdx"
---
title: On-call for decisions
description: Who to ask when a record is unclear.
---

Every project folder has owners in its `_project.yml`.

<Callout title="Escalation">
  No owner within a day? Post in #architecture and tag the Platform Engineering lead.
</Callout>
```

The same works in `decisions/<project>/adr/0007-something.mdx`. Records may be `.md` or `.mdx`; the type and
number come from the folder and file name either way.

### Replacing HTML elements

The map can also override the components MDX uses for plain Markdown elements, which is standard MDX
behaviour. Keys are lowercase tag names:

```ts title="components/mdx.ts"
import Callout from './Callout.astro';
import Table from './Table.astro';

export default { Callout, table: Table };
```

Every table in every MDX file then renders through `Table.astro`. Markdown (`.md`) files are not affected.

### Where it applies

| File | Components available |
| --- | --- |
| `decisions/**/*.mdx` | yes |
| `decisions/<project>/index.mdx` (team intro) | yes |
| `decisions/_landing.mdx` | yes |
| `pages/**/*.mdx` | yes |
| any `.md` file | no, Markdown has no JSX |

Edits to the module or to a component hot-reload in the dev server. Changing the `mdxComponents` path itself
restarts it.

> [!NOTE]
> Nothing stops an MDX file from importing a component the usual way. The map is for the components every
> author should have at hand; one-off imports still work.

## Consequences

- Authors write `<Callout>` and nothing else. Renaming or moving a component is a one-line change in `mdx.ts`.
- Components are only available in MDX. Teams that write `.md` keep plain Markdown and the GitHub-flavoured extras.
- The whole map is loaded for every MDX page. A component with heavy dependencies slows every build, even when few records use it.
- MDX files render on GitHub and GitLab as plain text with unknown tags; the component content is still readable there, the frame is not.
