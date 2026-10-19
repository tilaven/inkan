# create-inkan

Starts a new [Inkan](https://www.npmjs.com/package/inkan) site: a docs site for Architecture Decision Records and
RFCs, built from Markdown in your repo.

```bash
npm create inkan@latest my-decisions
cd my-decisions
npm install
npm run dev          # http://localhost:4321
```

The folder (default `decisions-site`) gets `inkan.config.ts`, a sample project in `decisions/`, an `AGENTS.md`,
CI files for GitHub Actions and GitLab CI, a `Dockerfile` with `nginx.conf`, and a `package.json` with the `inkan`
scripts. Files that already exist are left alone, so it also works in an existing repository.

It is the same as `npx inkan init [dir]`. See the [`inkan`](https://www.npmjs.com/package/inkan) package for the
documentation.
