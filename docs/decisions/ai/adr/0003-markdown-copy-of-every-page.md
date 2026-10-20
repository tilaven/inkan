---
title: "Markdown copy of every page"
description: "Every record and page is also served as its original Markdown at the page URL plus .md, so people and agents can fetch the source without the HTML."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [ai, markdown, content]
related: [ai/adr/0001-llms-txt-and-llms-full-txt, authoring/adr/0006-link-records-by-path, extending/adr/0003-custom-pages]
---

## Context

The HTML page of a record is for reading in a browser. Someone who wants to quote a record in a pull request,
feed one record to an assistant or diff it against a copy wants the Markdown, with its front matter, exactly as
committed. Linking to the file on GitHub works only for people with access to the repository and gives
agents a rendered page or an API detour.

## Decision

For every record, every project intro and every Markdown page in `pagesDir`, the build also writes the raw
source file next to the HTML page: the page URL without the trailing slash, plus `.md`. The content is the file
as it is in the repository, front matter included, served as `text/markdown`.

## How to use it

Nothing to configure. The mapping is:

| Page | Markdown copy |
| --- | --- |
| `/sre/adr/0001-define-slos/` | `/sre/adr/0001-define-slos.md` |
| `/sre/` (team page with `decisions/sre/index.md` as intro) | `/sre/index.md` |
| `/handbook/` (from `pages/handbook.md`) | `/handbook.md` |
| `/guides/` (from `pages/guides/index.md`) | `/guides.md` |

The copy of a record is linked from four places on the site:

- the "Copy page" menu in the record header (`PageActions`),
- the "Raw Markdown" button under the record (`RecordFooter`),
- the "Machine-readable" block in the record's right rail, which also links `decisions.json` and `llms.txt`,
- every record line in `llms.txt` and the `markdown` field in `decisions.json` and in the `llms-full.txt`
  metadata.

### The Copy page menu

Every record page has a **Copy page** split button next to its title. The main button copies the record's
Markdown to the clipboard, ready to paste into a chat or an issue. The menu next to it offers:

| Item | What it does |
| --- | --- |
| Copy link to page | Copies the page URL. |
| Open Markdown page | Opens the `.md` copy in a new tab. |
| Use in Claude | Opens claude.ai with a prompt asking it to read the `.md` URL. |
| Use in ChatGPT | The same for chatgpt.com. |

The menu is keyboard accessible (arrow keys, Home, End, Escape) and appears only when JavaScript runs.
The assistants fetch the Markdown from your public URL, so these two items only help on sites they can reach.
To change the items or drop the menu, override the `PageActions` component (see
[Override components and fill slots](../../extending/adr/0002-override-components-and-fill-slots.md)):

```ts title="inkan.config.ts"
export default defineConfig({
  components: { PageActions: './components/Empty.astro' }, // an empty file hides the menu
});
```

### What you get back

```bash
curl -s https://decisions.acme.dev/payments/adr/0001-use-stripe.md
```

```md
---
title: Use Stripe as the primary payment provider
description: One provider for cards and wallets.
status: accepted
date: 2026-01-18
authors: [piotr.nowak]
tags: [payments, vendor]
---

## Context
...
```

The file is byte for byte what is in the repository. Relative links such as `../rfc/0001-x.md` stay relative;
the HTML page rewrites them, the copy does not. A reader who has the record's URL can resolve them the same way
the repository does.

### In your own pages and components

`markdownUrl()` from `@tilaven/inkan/data` builds the link for any entry:

```astro
---
import { getDecisions, markdownUrl } from '@tilaven/inkan/data';
const latest = (await getDecisions())[0];
---
<a href={markdownUrl(latest)}>Source of {latest.title}</a>
```

The route behind it is the package's `[...slug].md.ts` endpoint, which enumerates the same entries as the HTML
route: all docs plus all pages, drafts excluded in production.

### For agents

The `llms.txt` header says it in one line: every link points to the raw Markdown; drop the `.md` and add a `/`
for the HTML page. An agent can therefore list the archive once and fetch exactly the records it needs, with
their front matter, instead of reading `llms-full.txt` in full.

> [!NOTE]
> The copy is static output like everything else. A static host serves `0001-use-stripe.md` as a file next to
> the `0001-use-stripe/` folder; no rewrite rule is needed. The starter `nginx.conf` leaves paths with an
> extension alone for exactly this reason.

## Consequences

- One canonical, fetchable source per page, in the format authors wrote it, with no dependency on repository access.
- Front matter is public. Anything in it is published; `draft: true` is the only way to keep a record out of a production build.
- Relative links inside the copy are not rewritten. Consumers that follow links must resolve them against the record's own path.
- The copy roughly doubles the number of files in `dist/`. For a static host this is a non-issue; for a size-limited bucket it is worth knowing.
