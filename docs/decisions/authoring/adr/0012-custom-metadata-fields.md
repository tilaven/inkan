---
title: "Custom metadata fields"
description: "Declare your own front matter fields per site or per project (risk, cost, data class), with types, validation, filters on the record index and values in decisions.json and the MCP server."
status: implemented
date: 2026-10-17
authors: [tilaven]
deciders: [tilaven]
tags: [content, config, markdown]
options: [fields]
related: [authoring/adr/0003-metadata-in-front-matter, authoring/adr/0001-one-folder-per-project, site/adr/0002-filterable-record-index, cli/adr/0007-check-records-in-ci, cli/adr/0003-number-records-with-inkan-new, cli/adr/0004-validate-config-and-content-at-build-time, ai/adr/0002-decisions-json, ai/adr/0005-mcp-server-for-agents]
---

## Context

The built-in front matter covers what every team shares: status, dates, people, tags, links. Teams also track things only they care about: the risk of a change, the yearly cost, whether the payment card scope is touched, the compliance regime. Today those end up as tags (`risk-high`), which cannot be validated, sorted or compared, or in the body, where nothing can read them. Unknown front matter keys are ignored by the site, so inventing a key does not help either.

## Decision

A `fields` map declares extra front matter keys. Each field has a type, and the build checks every record against it. Declared fields appear in the record header, as filters on `/decisions/`, in `decisions.json`, in `llms-full.txt` and in the MCP server. `fields` in `inkan.config.ts` applies to every project. A project adds its own fields, or redefines or removes a site field, under `fields` in its `_project.yml`.

Values are top-level keys in the record's front matter (`risk: high`), not a nested object. Keys that are not declared are still ignored. A value that does not fit its type, or a missing value on a `required` field, stops the build.

## How to use it

### Declare fields for the site

```ts title="inkan.config.ts"
export default defineConfig({
  fields: {
    risk: { type: 'enum', values: ['low', 'medium', 'high'], column: true, default: 'medium' },
    cost: { type: 'number', unit: 'k€/year', description: 'Expected yearly run cost.' },
    decided: { type: 'date', label: 'Decided on' },
    runbook: { type: 'url' },
  },
});
```

### Add, change or remove fields in a project

```yaml title="decisions/payments/_project.yml"
name: Payments
owners: [jules, noor]
fields:
  pci:
    type: boolean
    label: PCI scope
    required: true
  risk:
    type: enum
    values: [low, medium, high, critical]   # replaces the site's definition
  cost: false                                # Payments does not track cost
```

A project's field with the name of a site field replaces it completely (the definition is not merged). `false` removes the site field for that project: its records may still carry the key, but it is ignored. A project without `fields` gets the site's.

### Set values on a record

```yaml title="decisions/payments/adr/0004-store-card-tokens.md"
---
title: Store card tokens in the vault
status: accepted
date: 2026-10-01
tags: [payments, security]
risk: high
pci: true
---
```

### Options of a field

| Option | Applies to | What it does |
| --- | --- | --- |
| `type` | all | One of the types below. Default `text`. |
| `label` | all | Name in the record header, the filters and the table. Default: the key in sentence case (`dataClass` becomes `Data class`). |
| `description` | all | What the field means. Returned by the MCP `list_fields` tool. |
| `values` | `enum`, `list` | Allowed values. Required for `enum`, optional for `list`. Also the order of the filter chips. |
| `required` | all | A record without a value fails the build and `inkan check`. Default `false`. |
| `filter` | all except `url` | Show a filter on `/decisions/`. Default `true`. |
| `column` | all | Add a column to the table view. Default `false`. |
| `unit` | `number` | Printed after the value (`40 k€/year`). |
| `default` | all | Written into new records by `inkan new`. Must be valid for the type. |

Field names start with a letter and use letters, digits, `-` and `_`. They are front matter keys and URL parameters, so they cannot be a built-in key: `title`, `description`, `status`, `date`, `authors`, `deciders`, `tags`, `supersedes`, `supersededBy`, `related`, `reviewBy`, `reviewed`, `reviewEvery`, `order`, `draft`, `slug`, the index's own `project`, `type`, `author`, `tag`, `q`, `view` (and `fields`), or a key records already carry in `decisions.json` and the MCP server: `id`, `ref`, `number`, `url`, `markdown`, `source`, `file`, `body`, `current`, `currentRecord`, `codeRefs`, `review`.

### Types

| Type | Front matter | Normalised to | Filter on the index |
| --- | --- | --- | --- |
| `text` | `owner: platform` | trimmed string | chips, one per distinct value |
| `number` | `cost: 40` or `cost: "40"` | number | min-max range |
| `boolean` | `pci: true` (`"true"` and `"false"` are accepted) | boolean, shown as Yes or No | chips Yes and No |
| `date` | `decided: 2026-01-18` | `YYYY-MM-DD` | min-max range |
| `enum` | `risk: High` | the spelling in `values` (`high`); matching ignores case | chips, in the order of `values` |
| `list` | `regions: [eu, us]` or `regions: eu` | list of strings without duplicates, checked against `values` when set | chips, one per item |
| `url` | `runbook: https://...` | the URL; `http://`, `https://` or a path starting with `/` | none |

An empty value (`risk:`, `risk: ""`, `risk: "  "`, `regions: []`) counts as missing. Dates must be real calendar days (`2026-02-30` is rejected), and `text` values are kept on one line.

### What the site shows

- **Record header**: each field with a value is listed with its label. Values of chip types (`text`, `enum`, `list`, `boolean`) link to the index filtered by that value; numbers print with their `unit`, URLs are links.
- **Filters**: `/decisions/` gets a facet group per field with `filter` on that at least one record sets. Chips work like the built-in facets: OR inside a group, AND between groups, and each chip shows how many records have that value in total. Values in the URL match chips regardless of case. A `number` or `date` field shows a min and a max input; a bound that is not a number or a `YYYY-MM-DD` date is ignored.
- **Table**: a field with `column: true` adds a column to the table view.

The filters are part of the URL, named after the field:

| Query parameter | Example | Meaning |
| --- | --- | --- |
| chip field | `?risk=high,medium` | `risk` is high or medium. |
| boolean field | `?pci=true` | `pci` is Yes. `false` selects No. |
| number range | `?cost=10..50` | `cost` between 10 and 50, both included. |
| open range | `?cost=..50` or `?cost=10..` | At most 50, or at least 10. |
| date range | `?decided=2025-01-01..` | `decided` on or after 2025-01-01. |

Records without a value never match a filter on that field. Because the key is the parameter name, a field cannot be called `project`, `type`, `author`, `tag`, `q` or `view`.

### Validation

```text
Invalid fields in decisions/payments/adr/0004-store-card-tokens.md: risk: "severe" is not one of low, medium, high, critical; pci is required
```

The build stops with a line like this for every record with problems. `inkan check` reports the same problems with the rule `field`, and a bad `fields` block in a `_project.yml` with the rule `project-fields`. An unknown option, a missing `values` on an `enum`, a `default` that does not fit the type or a reserved name is an error in the config or in `_project.yml`.

One name may not have different types in different projects: `cost` as a number in Payments and as text in SRE would give the index one filter with two meanings, so the build stops. The same goes for different units. Give the second field another name. Enum and list values of the same field are merged across projects for the filter, the label of the first definition is used for it, and the filter is left out when any project sets `filter: false`.

### Where agents get the values

- `decisions.json` has a `fields` object on every record, with normalised values: `"fields": { "risk": "high", "cost": 40, "pci": true }`.
- `llms-full.txt` has a `name: value` line per field in each record's header block (`risk: high`, lists comma-separated).
- The MCP server includes `fields` in its records. `search_records` takes `field: "risk=high"` to keep records whose field has that value, and `list_fields` returns the declared fields with their types, allowed values and descriptions, so an agent can ask for the right values. `list_fields` needs the config, so it works with `inkan mcp --root` but not `--url`.

### New records

`inkan new` writes every field that has a `default` into the front matter of the new record. Fields without a default are not written; add them by hand, or mark the field `required` so `check` reminds you.

## Consequences

- Teams get typed, filterable metadata without a plugin or a custom component, and the values reach `decisions.json` and agents the same way as the built-in fields.
- Values are validated, so a typo in `risk` fails the build instead of producing a filter chip nobody notices. The price is that adding `required: true` to a field fails every older record until it has a value. Add the field as optional first, fill it in, then require it.
- Fields are flat. There is no nesting, no computed field and no cross-field rule.
- Declared keys live next to the built-in ones in the front matter, so the set of reserved names cannot grow without risk: a new built-in key would collide with a field of the same name in someone's config. The build reports the collision.
- Removing a field from the config does not touch the records; the key stays in the files and is ignored.
- Filters on a field with many distinct values (free `text`) produce many chips. Use `enum` or `list` with `values` when the set is known.
