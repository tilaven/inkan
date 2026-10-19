---
title: "Front matter reference"
description: "Every field of a record, a page, a _project.yml and _authors.yml, with its type and meaning."
order: 5
---

Inkan reads metadata from YAML front matter and from two small YAML files. All of it is validated when the site is built, so a wrong value fails `inkan build` with the file name and the field. Fields that are not listed here are ignored.

## Records and pages in the content folder

Every `.md` or `.mdx` file under `contentDir` accepts these fields. Records (files in a type folder) use all of them; plain pages mostly need `title`, `description` and `order`.

| Field | Type | Meaning |
| --- | --- | --- |
| `title` | string, **required** | Title of the page. Quote it when it contains `:` or `#`. |
| `description` | string | One sentence shown in lists, cards, search results, `<meta description>` and `llms.txt`. |
| `status` | one of the configured statuses | Where the record is in its lifecycle. Default keys: `draft`, `proposed`, `in-review`, `accepted`, `implemented`, `rejected`, `withdrawn`, `deprecated`, `superseded`. Any other value fails the build. |
| `date` | date (`YYYY-MM-DD`) | When the decision was made or the RFC opened. Sorts the index and the timeline. When omitted, the date of the commit that added the file is used (`git.dates`, on by default). |
| `authors` | list of handles | Who wrote the record. A single string works too (`authors: ania`). When omitted, the author of the first commit is used, matched to `_authors.yml` by email, handle, name or `github`/`gitlab` login (`git.authors`, on by default). |
| `deciders` | list of handles | Who signed off. Shown as "decided" next to "authored" on the authors page. |
| `tags` | list of strings | Free-form tags, lowercase by convention. Each tag is a filter and a page. |
| `supersedes` | list of record paths | Records this one replaces, e.g. `platform/adr/0004-use-sqs-as-the-event-bus`. |
| `supersededBy` | list of record paths | The record that replaced this one. Set it together with `status: superseded`. |
| `related` | list of record paths | Other records worth reading. |
| `reviewBy` | date | On an open record: the decision deadline (for an RFC, the last day for comments); open records are sorted by it on the backlog. On a decided record: the date of the next periodic review. |
| `reviewed` | date | When a decided record was last reviewed. Written by `inkan reviewed`. The next review is `reviewEvery` after it. |
| `reviewEvery` | interval or `never` | How often a decided record comes up for review: `1 year`, `6 months`, `90 days`, `2 weeks` (short forms `1y`, `6m`, `90d`, `2w`). Overrides the project's `reviewEvery` and `reviews.every` in the config; `never` (or `false`) opts the record out. See [Review decisions on a schedule](authoring/adr/0011-review-decisions-on-a-schedule.md). |
| `reviewers` | list of handles, or map of handle to state | Who is asked to review. A list means everyone is `pending`; a map gives each handle `pending`, `approved` or `changes-requested`, or `{ state, date, note }`. List items may be one-key maps (`- bob: approved`). See [Review RFCs with reviewers](authoring/adr/0013-review-rfcs-with-reviewers.md). |
| `comments` | boolean | `false` hides the discussion section on this record; `true` shows it even when its type or status is not listed in the `comments` config. Has no effect while comments are off. |
| `discussion` | URL | Where the conversation lives: a GitHub discussion, a GitLab issue or merge request. giscus uses it when it belongs to the configured repository; GitLab uses that issue instead of searching. When it is the pull request (GitHub) or merge request (GitLab) that proposes the record, the review comments on the record's file are pinned next to the paragraphs they refer to and each paragraph gets a "Comment" link to the diff; this works in public repositories, with no config. See [Comments under RFCs](site/adr/0010-comments-under-rfcs.md). |
| `order` | number | Sidebar position of a plain page (not a record). Lower comes first; ties sort by title. |
| `draft` | boolean, default `false` | `true` hides the page from production builds. The dev server still shows it. |
| `slug` | string | Replaces the URL id derived from the path, e.g. `slug: sre/adr/slos`. Rarely needed. |

Values inferred from git are marked "From git history" on the record page and are not written back to the file; records fetched from a `repo` source and files in shallow clones keep no date or author. Turn the behaviour off with `git: { dates: false, authors: false }` in the config. See [Fill date and authors from git](authoring/adr/0009-fill-date-and-authors-from-git.md).

Record paths are the path of the file inside the content folder without the extension. They work across projects. Relative Markdown links in the body (`[see](../rfc/0001-x.md)`) are another way to link records; see [Link records by path](authoring/adr/0006-link-records-by-path.md).

The type and number are not front matter: they come from the folder (`adr`, `rfc`, or a key you added to `docTypes`) and from the leading digits of the file name. `sre/adr/0007-foo.md` has number 7 and the reference `SRE-ADR-0007`. See [Record type comes from the folder](authoring/adr/0002-record-type-comes-from-the-folder.md).

### Custom keys

Keys declared under `fields` in the config or in a `_project.yml` are also front matter keys: `risk: high`, `cost: 40`, `pci: true`. They are checked against their type and an invalid value or a missing `required` field fails the build. Any other unknown key is still ignored. A field cannot be named like a built-in key from the table above. See [Custom metadata fields](authoring/adr/0012-custom-metadata-fields.md).

### Full example

```yaml title="decisions/payments/adr/0003-use-stripe-as-the-primary-payment-provider.md"
---
title: "Use Stripe as the primary payment provider"
description: Stripe covers every market we sell in and its API fits our ledger model.
status: accepted
date: 2026-01-18
authors: [jules, noor]
deciders: [sam]
tags: [payments, vendor]
supersedes: [payments/adr/0001-build-our-own-card-gateway]
supersededBy: []
related: [dbre/adr/0001-standardize-on-postgresql-16]
reviewBy: 2026-11-15
reviewers:
  noor: approved
  sam:
    state: changes-requested
    date: 2026-11-02
    note: Needs a rollback plan
reviewEvery: 1 year
comments: false
discussion: https://github.com/acme/decisions/discussions/42
draft: false
---
```

On this accepted record `reviewBy` is the next review; once `inkan reviewed` writes a `reviewed` date on or after it, the record comes back every year from that date.

### Plain page example

```yaml title="decisions/sre/guides/on-call.md"
---
title: On-call guide
description: What to do when you are paged.
order: 10
---
```

The same three fields, `title`, `description` and `draft`, apply to Markdown and MDX files in `pagesDir`. `order` has no effect there because those pages are not in the sidebar.

More on the fields and the reasoning behind them: [Metadata in front matter](authoring/adr/0003-metadata-in-front-matter.md), [Configurable status lifecycle](authoring/adr/0004-configurable-status-lifecycle.md).

## Projects: `_project.yml`

One `_project.yml` (or `_project.yaml`) per top-level folder gives the project a name on the site. The folder name is the project id used in URLs, record paths and the `project` filter.

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | string, **required** | Display name in the sidebar, cards and breadcrumbs. |
| `description` | string | One line on the project card and the team page. |
| `icon` | string | Name from the built-in icon set: `activity`, `book`, `cloud`, `clock`, `credit-card`, `database`, `heart`, `home`, `inbox`, `layers`, `list`, `pencil`, `server`, `settings`, `shield`, `sparkles`, `tag`, `users` and a few UI icons. Unknown names show `book`. |
| `ink` | `c`, `m`, `y`, `g`, `v` or `o` | Process ink for covers and accents: cyan, magenta, yellow, green, violet, orange. Assigned when absent, so that no other project has the same (ink, motif) pair. |
| `motif` | string | Cover-art pattern of the project's records: one of the seventy-six built-in motifs (abstract prints `rings`, `ticker`, `lattice`, `discs`, `arcs`, `chevrons`, `waves`, `sunburst`, `bricks`, `bars`, `orbit`, `contour`, `checker`, `cubes`, `crescent`, `dots`, `triangles`; infrastructure `shield`, `key`, `mesh`, `cloud`, `pipeline`, `gear`, `rack`, `queue`, `lens`, `terminal`; product `browser`, `phone`, `neural`, `card`, `cart`, `pen`, `flask`, `globe`, `bell`, `chat`; operations and data `gauge`, `siren`, `lifebuoy`, `funnel`, `lake`, `chip`, `plug`, `hourglass`, `flag`, `compass`, `chain`, `eye`; business `book`, `people`, `scales`, `magnet`, `megaphone`, `gamepad`, `truck`, `coins`, `sparkle`, `a11y`, `trophy`, `leaf`; finance `bank`, `vault`, `calculator`, `percent`, `passport`, `pie`, `handshake`; company functions `wrench`, `puzzle`, `brackets`, `headset`, `clipboard`, `cap`, `laptop`, `target`) or a motif a plugin registers. When absent, a motif whose keywords appear in the folder name or `name` is preferred (`security` gets `shield`, `frontend` gets `browser`, `dbre` gets `discs`), otherwise one is assigned together with the ink; an unknown name fails the build and lists the available ones. |
| `owners` | list of handles, default `[]` | People shown on the team page as owners. |
| `reviewEvery` | interval or `never` | Review interval for the project's decided records, e.g. `6 months`. Overrides `reviews.every` in the config; a record's own `reviewEvery` overrides it. `never` opts the project out. See [Review decisions on a schedule](authoring/adr/0011-review-decisions-on-a-schedule.md). |
| `order` | number, default `100` | Position on the landing page and in the sidebar. Lower comes first, ties sort by name. |
| `links` | `{ label, url }[]`, default `[]` | Buttons on the team page. `url` must start with `http://`, `https://` or `/`. |
| `fields` | `Record<string, FieldConfig \| false>` | Custom front matter fields for this project's records. Adds to the site's `fields`, replaces one of the same name, or removes it with `false`. See [Custom metadata fields](authoring/adr/0012-custom-metadata-fields.md). |

```yaml title="decisions/sre/_project.yml"
name: "SRE"
description: "Reliability, on-call and the numbers we promise."
icon: activity
ink: c
motif: rings
owners: [marek, ania]
reviewEvery: 1 year
order: 10
links:
  - label: Runbooks
    url: https://runbooks.acme.dev
```

A folder without `_project.yml` is still a project; it is shown by its folder name and takes part in the ink and motif assignment like any other. See [One folder per project](authoring/adr/0001-one-folder-per-project.md) and [Generated record covers](theming/adr/0005-generated-record-covers.md).

## Authors: `_authors.yml`

An optional list at `<contentDir>/_authors.yml`. Each entry's `id` is the handle used in `authors`, `deciders` and `owners`. Handles that are not listed still work and are shown as written.

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string, **required** | The handle. |
| `name` | string, **required** | Full name shown on the site. Initials are derived from it for avatars. |
| `team` | string | Team name. When it equals a project's id or name, the author takes that project's ink. |
| `github` | string | GitHub user name, linked from the authors page. Also used to match git commit authors. |
| `gitlab` | string | GitLab user name, linked when there is no `github`. Also used to match git commit authors. |
| `email` | string | Git commit email, the most reliable way to match inferred authors to this handle. Not shown on the site. |
| `avatar` | string | Image URL used instead of initials. |

```yaml title="decisions/_authors.yml"
- id: ania
  name: "Ania Kowal"
  team: sre
  github: aniak
- id: jules
  name: "Jules Marchand"
  team: payments
  avatar: https://avatars.example.com/jules.png
```

See [Optional author directory](authoring/adr/0005-optional-author-directory.md).

## Landing extra: `_landing.md`

`<contentDir>/_landing.md` (or `_landing.mdx`) is rendered in the `content` section of the home page. Its front matter is not validated and not used; the body is what counts. See [Landing page from config](site/adr/0001-landing-page-from-config.md).

## Validation

- `title` and `name` are required; everything else is optional.
- `status` must be a key of `statuses` in the config. When you replace that map, old values fail until you update them.
- `reviewers` entries must be handles with a state of `pending`, `approved` or `changes-requested`.
- `date`, `reviewBy` and `reviewed` must be dates. Unquoted `2026-01-18` is a YAML date and works; so does the same text in quotes.
- `reviewEvery`, on a record or in `_project.yml`, must be an interval (`1 year`, `6 months`, `90 days`, `2 weeks`, or the short forms `1y`, `6m`, `90d`, `2w`) or `never` / `false`.
- List fields accept a single value or a list.
- `links[].url` in `_project.yml` must be absolute or start with `/`.
- Custom fields must match their declared type; a field with `required: true` must have a value. `fields` in `_project.yml` must be valid field definitions, and one field name may not have two types across projects.

A failed check stops `inkan build` and names the file and field. The dev server reports the same error when it loads the file. Details: [Validate config and content at build time](cli/adr/0004-validate-config-and-content-at-build-time.md).
