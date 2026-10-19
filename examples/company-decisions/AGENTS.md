# Instructions for AI agents

This repository is the source of truth for architecture decisions (ADR) and proposals (RFC).

## Reading
- Records live in `decisions/<project>/<adr|rfc>/NNNN-slug.md`. Project metadata is in `decisions/<project>/_project.yml`.
- Front matter `status` tells you whether a record is current: only `accepted` and `implemented` describe how
  things are done today. `superseded` records name their replacement in `supersededBy`.
- `decisions.json` / `llms-full.txt` on the published site contain the same data in one file.

## Writing
- Create records with `npx inkan new <adr|rfc> <project> "<title>"`, then fill in the template.
- Use `status: proposed` (ADR) or `draft` (RFC). Never mark a record `accepted` yourself.
- When a record replaces another, set `supersedes` on the new one and `supersededBy` + `status: superseded` on the old one.
- Link other records with relative Markdown links to the `.md` file.
- Run `npm run build` to validate front matter before committing.
