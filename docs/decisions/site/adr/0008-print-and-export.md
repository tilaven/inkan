---
title: "Print and export"
description: "The /export/ page that prints every current decision as one document, the export option, and inkan export for a self-contained HTML file or an A4 PDF."
status: implemented
date: 2026-10-17
authors: [tilaven]
deciders: [tilaven]
tags: [site, cli, config, deploy]
options: [export]
related: [site/adr/0006-header-banner-footer-and-redirects, authoring/adr/0004-configurable-status-lifecycle, deploy/adr/0001-static-html-output]
---

## Context

An audit, a vendor review or a new hire's reading list asks for "the decisions" as one document, not as a web site. Printing pages one by one loses the order and the table of contents, and a PDF made from the browser carries the sidebar and header. The document must be reproducible from the repository so it can be attached to a release or an audit ticket.

## Decision

Every site has a page at `/export/` with a cover, a table of contents and the full text of every record whose status is "current", grouped by project. It prints to A4 from the browser with the site chrome removed, in the Day theme. The `export` option chooses the statuses and the cover title.

`inkan export` builds the site and turns that page into one self-contained `decisions.html`, or with `--pdf` into an A4 PDF with page numbers. Diagrams and the PDF need a Chromium that playwright-core can launch.

## How to use it

### The page

Open `/export/` or follow "Print / export" in the footer of every page. The page has no sidebar and is left out of the search index and the sitemap. It contains, in order:

- A cover with the title, the generation date, the number of records and projects, and the count per status.
- A table of contents, one section per project, listing number, title and status of each record.
- Every record in full: project and type, status sticker, title, date, authors, deciders, tags, the "Supersedes" and "Superseded by" lines, the body, and the record's URL. `related` is not repeated.

Records are sorted by project (same order as the sidebar), then by record type in the order of `docTypes`, then by number. Links to records inside the document jump within the page; links to other records go to the site.

"Print or save as PDF" opens the browser's print dialog. The print stylesheet sets A4 with 16 mm, 14 mm and 18 mm margins, puts the cover and the table of contents on their own pages and starts every record on a new page. A reader in the Stage theme is switched to Day for the print and back afterwards. Code blocks print as black on white.

### Options

```ts title="inkan.config.ts"
export default defineConfig({
  export: {
    statuses: ['accepted', 'implemented', 'deprecated'],
    title: 'Acme architecture decisions',
  },
});
```

| Option | Default | What it does |
| --- | --- | --- |
| `export.statuses` | every status with `current: true` | Records with one of these statuses are exported. An empty list means the default. |
| `export.title` | `'<title>: decisions'` | Heading on the cover, `<title>` of the page and the left side of the PDF footer. |

With the default statuses (see [Configurable status lifecycle](../../authoring/adr/0004-configurable-status-lifecycle.md)) the document holds `accepted` and `implemented` records. Open proposals are not exported unless you list their status. When no record matches, the page says so instead of a table of contents.

### The command

```bash
npx inkan export                        # dist/ is rebuilt, writes decisions.html
npx inkan export --pdf                  # writes decisions.pdf
npx inkan export --out docs/decisions-2026-10.pdf
npx inkan export --no-build --out out/decisions.html
```

| Flag | Default | What it does |
| --- | --- | --- |
| `--out <file>` | `decisions.html`, or `decisions.pdf` with `--pdf` | Output path, relative to the current folder. Folders are created. A `.pdf` extension implies `--pdf`. |
| `--pdf` | off | Write an A4 PDF instead of HTML. |
| `--no-build` | off | Reuse `dist/export/index.html` from the last `inkan build`. Fails when there is none. |
| `--root <dir>` | current folder | Folder with `inkan.config.*`, like every command. |

The command prints what it wrote: `Wrote decisions.pdf (412 kB, 37 pages)`.

### What the HTML file contains

The export page is cut out of the built site between two markers and wrapped in a minimal document: every stylesheet is inlined, fonts and images become `data:` URIs, scripts are dropped, the theme is fixed to Day, and site links such as `/sre/adr/0001-define-slos/` are made absolute with the `url` option. The file opens offline and can be attached to a ticket or an e-mail.

### Chromium, diagrams and the PDF

The HTML export of a site without Mermaid diagrams needs nothing but Node. Two cases launch a headless Chromium through `playwright-core`, an optional peer dependency that is not installed with Inkan:

- Mermaid diagrams are rendered in the browser, so the HTML file gets them as SVG. Without a browser the command warns and leaves the diagram source in the file.
- `--pdf` always needs the browser. Without one the command fails with a message that tells you how to install it.

Install the package next to Inkan; it ships no browser, so install one too, or point the command at a Chrome or Chromium you have:

```bash
npm install playwright-core
npx playwright-core install chromium
# or
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npx inkan export --pdf
```

The PDF is printed from the built site served on a local port, so fonts and scripts load as on the deployed site. Pages are A4 with the same margins as the browser print, with backgrounds, and a footer that shows the export title on the left and `page / total` on the right. Rendering waits for every diagram (30 s limit) and for the fonts.

> [!TIP]
> In CI, run `npm install playwright-core && npx playwright-core install --with-deps chromium` before the export, and upload the PDF as a job artifact or attach it to the release.

## Consequences

- One URL and one command give the same document, so "send me the decisions" has a reproducible answer.
- The page renders every current record in full, so it is the heaviest page of the site. Sites with hundreds of records should export in CI rather than ask readers to open it on a phone.
- The PDF needs a browser binary that is not installed with the package. The HTML export does not, unless the records contain diagrams.
- Only `supersedes` and `supersededBy` are shown per record; `related` and code references are left to the site.
- The generation date is the build time, so the page changes on every build even when no record did.
