---
title: "Sign-in and protected projects"
description: "Let signed-in people see more than the public: add authentication and protectedRoutes to the config, mark projects protected, and run `inkan serve`, which builds a public and a members' site and enforces sign-in on the server."
status: implemented
date: 2026-10-17
authors: [tilaven]
deciders: [tilaven]
tags: [deploy, security, auth, config]
related: [deploy/adr/0006-protect-the-site-at-the-edge, deploy/adr/0003-docker-and-nginx]
---

## Context

[Protect the site at the edge](0006-protect-the-site-at-the-edge.md) puts a login in front of the whole origin. That is
the simplest answer when everyone who may read one record may read all of them. It cannot express "the handbook is for
employees, the rest is public", or "SRE postmortems are for the SRE group only": the proxy sees paths, not projects,
and has nothing to hide from a signed-in user or to show to an anonymous one.

Some archives are mixed. A company publishes its architecture principles and its open RFCs, and keeps vendor
negotiations, security reviews and an internal handbook behind a login. Those teams want one site, one URL, search
that never leaks a title the reader may not open, and a sign-in that uses the identity provider they already have.

## Decision

The site can sign people in itself. You add an `authentication` option, in the same shape as
[Zudoku's](https://zudoku.dev/docs/configuration/authentication), and decide what is protected: whole projects with
`protected: true` in their `_project.yml`, and any other paths with `protectedRoutes`.

Because static hosting cannot tell visitors apart, the build produces two sites:

- `dist/` is the **public** site. Protected content is removed everywhere, not only hidden: the pages, the search
  index, `llms.txt` and `llms-full.txt`, `decisions.json`, RSS, the sitemap, the `.md` copy of every page and the
  related links of the records that remain. It is safe to publish anywhere.
- `dist-protected/` is the **members' site**: everything, with a lock mark on protected records and an account menu in
  the header. It also holds `_server.json` (the `authentication` settings without any secret, `base`, `url` and
  `protectedRoutes`), which tells the server what to enforce.

`inkan serve` is the small Node server that ties them together. It serves `dist/` to anonymous visitors and
`dist-protected/` to signed-in ones, and redirects an anonymous request for a protected page to sign-in. The check is
made on the server for every request, so there is nothing to bypass in the browser. A signed-in user who is not
allowed (see `allow`) gets a "no access" page and the public site.

Sign-in is OpenID Connect with the authorization code flow and PKCE (plain OAuth 2.0 for GitHub). The identity provider
stays the source of truth; Inkan keeps no user database.

### Edge or sign-in

| | [At the edge](0006-protect-the-site-at-the-edge.md) | Sign-in (this record) |
| --- | --- | --- |
| Granularity | Whole site | Per project and per path; the rest stays public |
| Hosting | Any static host plus a proxy or the host's access control | A Node process (`inkan serve`) |
| Search and agent files | Unreachable without a session | Public ones list public records only; members get the full ones |
| Who may enter | Whatever the proxy supports | `allow`: emails, domains, groups |
| Moving parts | A proxy or a dashboard setting; no change to Inkan | Config and one container |

Choose the edge when the answer is "all or nothing". Choose sign-in when part of the archive is public or when
projects have different audiences. They combine: nothing stops you from running `serve` behind an edge proxy.

## How to use it

### Configure

```ts title="inkan.config.ts"
import { defineConfig } from 'inkan';

export default defineConfig({
  url: 'https://decisions.acme.dev',
  authentication: {
    type: 'github',
    clientId: 'Iv1.0123456789abcdef',
    allow: { groups: ['acme'] },
  },
  protectedRoutes: ['/handbook/*'],
});
```

Mark a whole project protected in its `_project.yml`:

```yaml title="decisions/security/_project.yml"
name: Security
description: Reviews and incident follow-ups.
protected: true
```

`inkan check` reports `project-protected` when a project has `protected: true` but the config has no
`authentication`, because nobody could ever sign in to see it. Without `authentication` the options do nothing else:
the build is the usual single `dist/`.

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `type` | `'openid' \| 'auth0' \| 'entra' \| 'gitlab' \| 'github'` | required | The identity provider. |
| `clientId` | `string` | required | The OAuth application's client ID. Not secret; `INKAN_AUTH_CLIENT_ID` overrides it. |
| `issuer` | `string` | required for `openid` | The OpenID Connect issuer URL. |
| `domain` | `string` | required for `auth0` | The Auth0 tenant domain, e.g. `acme.eu.auth0.com`. |
| `tenantId` | `string` | required for `entra` | The Microsoft Entra tenant. |
| `url` | `string` | the public instance | Base URL of a self-managed GitLab or a GitHub Enterprise Server. |
| `scopes` | `string[]` | `openid email profile` (GitHub: `read:user user:email`) | Scopes requested. |
| `allow` | `{ emails?, domains?, groups? }` | everyone who can sign in | Any one match lets a user in. Email and domain rules only count for an address the provider confirmed as verified (see `trustEmail`). Comparison is case-insensitive. |
| `trustEmail` | `boolean` | `false` | Count email and domain rules even when the provider does not say whether the address is verified. For providers that never send `email_verified`; an address the provider flags as unverified still never counts. |
| `groupsClaim` | `string` | `groups` (GitLab: `groups_direct`) | Claim that holds the user's groups; dots reach into nested claims such as `realm_access.roles`. `openid` and `auth0` only. |
| `maxAge` | `number` (seconds) | `28800` (8 hours) | Session length; at least 60. |
| `redirectToAfterSignIn` | `string` | the page the user came from | Path to land on after signing in. |
| `redirectToAfterSignOut` | `string` | `/` | Path to land on after signing out. |

Unknown keys are an error, so a misspelled option cannot silently weaken the setup.

### Providers

Register an OAuth application with the provider and use this **callback URL**, exactly:

```text
<url><base>_auth/callback/
https://decisions.acme.dev/_auth/callback/            (served from the root)
https://acme.github.io/decisions/_auth/callback/      (base '/decisions/')
```

The client secret never goes into the config; see [Environment](#environment).

**GitHub.** Create an OAuth app (Settings > Developer settings). Groups are organisations: `allow.groups: ['acme']`
admits members of the `acme` organisation, and inkan then asks for the `read:org` scope on its own. For
organisations that restrict third-party apps, an owner must approve the app. For GitHub Enterprise Server set `url`.

```ts
authentication: { type: 'github', clientId: '...', allow: { groups: ['acme'] } }
// GitHub Enterprise Server
authentication: { type: 'github', url: 'https://github.acme.dev', clientId: '...', allow: { emails: ['ana@acme.dev'] } }
```

**GitLab.** Create an application with the `openid`, `profile` and `email` scopes. Groups come from the
`groups_direct` claim, so `allow.groups` lists group paths such as `acme/platform`. For a self-managed instance set `url`.

```ts
authentication: { type: 'gitlab', clientId: '...', allow: { groups: ['acme/platform'] } }
authentication: { type: 'gitlab', url: 'https://gitlab.acme.dev', clientId: '...', allow: { domains: ['acme.dev'] } }
```

**Microsoft Entra ID.** Register an app, add the callback as a **Web** redirect URI and create a client secret.
`tenantId` is required; the issuer is derived from it. Entra sends no `email_verified` claim, so email and domain
rules need one of two things: the optional `xms_edov` claim (Token configuration > Add optional claim), which Inkan
reads as the verification flag, or `trustEmail: true` when every account in the tenant is yours anyway.

```ts
authentication: { type: 'entra', tenantId: '00000000-0000-0000-0000-000000000000', clientId: '...', allow: { domains: ['acme.com'] } }
```

**Auth0.** Create a **Regular Web Application** and set its allowed callback URL. `domain` is the tenant domain. Auth0
sends groups only through a custom claim, so add a rule or action that writes them, and name the claim in `groupsClaim`.

```ts
authentication: { type: 'auth0', domain: 'acme.eu.auth0.com', clientId: '...', groupsClaim: 'https://acme.dev/groups', allow: { groups: ['docs'] } }
```

**Generic OpenID Connect.** Keycloak, Okta, Google, Dex and anything else with a discovery document at
`<issuer>/.well-known/openid-configuration`.

```ts
authentication: { type: 'openid', issuer: 'https://keycloak.acme.dev/realms/acme', clientId: 'decisions', groupsClaim: 'realm_access.roles', allow: { groups: ['staff'] } }
authentication: { type: 'openid', issuer: 'https://accounts.google.com', clientId: '...apps.googleusercontent.com', allow: { domains: ['acme.com'] } }
```

An `http://` issuer or provider URL is accepted only for `localhost`, `127.0.0.1` and `[::1]`, which is enough for a
local Keycloak or Dex while you try things out. Everything else must be `https://`.

**Verified addresses.** An `allow.emails` or `allow.domains` rule is only as good as the address it checks, and on
a provider where anyone can register with any address, an attacker could type yours. GitHub (verified addresses from
the API), GitLab, Auth0 and Google say whether an address is verified, and Inkan counts email rules only for an
address they vouched for. A provider that says nothing at all is treated as unverified: either make it send
`email_verified` (Keycloak and Okta do, Dex does for most connectors) or set `trustEmail: true` to accept its
addresses as they are. Group rules are not affected.

### What `protectedRoutes` matches

Patterns are paths relative to `base`:

| Pattern | Protects |
| --- | --- |
| `/handbook` | `/handbook/` only |
| `/handbook/*` | `/handbook/` and everything below it |
| `/*/rfc/*` | the `rfc/` folder of every project |
| `/sre/adr/0004-*` | `/sre/adr/0004-...` records |

`*` matches anything, slashes included. `/x/*` includes `/x` itself. A trailing slash and the `.md` copy of a page
do not matter: `/handbook/`, `/handbook` and `/handbook.md` are the same path. Matching ignores `base` and is
applied to URL-decoded paths.

### Environment

Secrets never go into the config or into `dist-protected/`; the server reads them from the environment.

| Variable | Required | What it is |
| --- | --- | --- |
| `INKAN_AUTH_SECRET` | yes | Random string of at least 32 characters; encrypts the session cookies. `openssl rand -base64 48` makes one. |
| `INKAN_AUTH_CLIENT_SECRET` | yes | The client secret of the OAuth application. |
| `INKAN_AUTH_CLIENT_ID` | no | Replaces `clientId` from the config, so one build can run in several environments. |
| `INKAN_PUBLIC_URL` | no | The address people open. Replaces `url`; the callback URL is derived from it. Must start with `http://` or `https://`. |
| `PORT` | no | Port to listen on. Default: 8080 (`--port` wins). |
| `BASE_PATH` | no | Sub-path for a site built without `authentication` (`--base` wins). With sign-in the base recorded in `_server.json` at build time is used. |

The server refuses to start when a required variable is missing.

### Docker

The image builds both variants and serves them with `inkan serve`. Compared with the [nginx image](0003-docker-and-nginx.md),
the last stage keeps Node, because the server is what decides who sees what.

```dockerfile title="Dockerfile"
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "node_modules/inkan/bin/cli.mjs", "serve"]
```

This is the Dockerfile of the nginx route with one stage and a different last line. `init` already lists `dist`,
`dist-protected` and `node_modules` in `.dockerignore` and `.gitignore`, so they are rebuilt inside the image. `node`
runs as PID 1 so `docker stop` reaches the server, which shuts down cleanly on `SIGTERM`. `npm run build` is `inkan build`, which writes `dist/`, `dist-protected/` and
`dist-protected/_server.json`; the server needs those and `node_modules` at run time, and nothing else (it does not
read the config or the Markdown). Single-stage keeps it simple. If image size matters, copy `dist`, `dist-protected`,
`package*.json` and a production-only `node_modules` into a second stage.

```bash
docker build -t decisions .
docker run --rm -p 8080:8080 \
  -e INKAN_AUTH_SECRET="$(openssl rand -base64 48)" \
  -e INKAN_AUTH_CLIENT_SECRET=... \
  -e INKAN_PUBLIC_URL=http://localhost:8080 \
  decisions
```

Put TLS in front (a load balancer or an ingress). Cookies are marked `Secure` when the public URL is `https://`, and
the OAuth providers require `https://` callbacks anyway outside localhost.

### Try it locally

- `inkan dev` shows everything, with lock marks on protected records; no sign-in is involved.
- `inkan dev --public` shows what an anonymous visitor sees, so you can check that nothing leaks.
- To try the real flow, build and run the preview with the secrets in the environment. `preview` notices
  `dist-protected/_server.json` and starts the sign-in server on `http://localhost:4321` instead of Astro's static preview:

```bash
inkan build
INKAN_AUTH_SECRET="$(openssl rand -base64 48)" \
INKAN_AUTH_CLIENT_SECRET=... \
INKAN_PUBLIC_URL=http://localhost:4321 \
inkan preview
```

Register `http://localhost:4321/_auth/callback/` with the provider (GitHub and most providers accept `localhost` over
`http`).

### Routes

`inkan serve` owns these paths under `<base>_auth/`, which is why they are reserved:

| Route | What it does |
| --- | --- |
| `_auth/login/` | Starts sign-in; `?redirect=` says where to land afterwards. |
| `_auth/callback/` | Where the provider sends the user back. |
| `_auth/logout/` | Clears the session. `POST` only, from the site's own sign-out form: the request's `Origin` must be the site (the `Host` the request came to, or the public `url` / `INKAN_PUBLIC_URL`, for a proxy that rewrites `Host`), so a link or a form on another site cannot sign people out. A `GET` answers 405. |
| `_auth/me/` | JSON with the signed-in user, for the account menu. |
| `_auth/denied/` | The page shown when sign-in fails or the user is not allowed. |

## Consequences

- One site can mix public and members-only content, per project or per path, with a single sign-in.
- Hosting changes: the public site alone is static, but sign-in needs the Node server (`inkan serve`, container
  or any Node host). GitHub Pages and GitLab Pages cannot enforce it; use them with the edge route or only for the
  public `dist/`.
- **What is protected.** Pages, `.md` copies, search, the decision graph (`/graph/`, `/graph.json`), `llms.txt`, `llms-full.txt`, `decisions.json`, RSS and the sitemap
  of the public site contain no protected content. The public build does not load protected projects at all, so the
  images their records embed are never copied into `dist/_astro/`; after the build, every file of a protected route
  goes whatever its type (a plugin's JSON, a generated image), and so does every hashed asset under `_astro/` that no
  remaining file references, which also covers the images of pages matched by `protectedRoutes`. `inkan notify`
  leaves protected records out as well: a chat channel is no members-only place. Related, superseded and tag links to protected records are dropped
  from public pages and from the decision graph, however the reference is written (any case, with or without `.md`
  or slashes). Links written by hand in the body of a record are **not** rewritten: a public record that links
  to a protected one keeps the link, and an anonymous reader following it is sent to sign-in. Avoid such links, or
  make the linking record protected too. The existence of a title can also leak through the link text itself.
- **Lock marks** in the members' site show which records the public cannot see, so authors do not paste them into
  public places by accident.
- **Caching.** The server sends `Vary: Cookie` on every response, and `Cache-Control: private, no-cache` for signed-in
  users. A CDN in front must respect `Vary: Cookie` or be bypassed for this origin, otherwise it may serve the members'
  page to an anonymous visitor.
- **Search.** The members' site has a search index with everything, the public one has the public records only.
  External providers (`algolia`, `meilisearch`, `typesense`) get `search.json` from the **public** variant, so protected
  records are never pushed to a service whose key lives in the browser. Members then do not find protected records
  through that provider.
- **Agents and exports.** `inkan export` and `inkan mcp` read the Markdown on disk, so they see protected
  records; run them only where the files are already trusted. A remote `mcp --url` sees what an anonymous visitor sees.
- **Signing out** is a `POST` to `_auth/logout/` from the form in the account menu, never a link: a `GET` is
  answered with 405, so a bookmark or a link to that path does nothing, and a request whose `Origin` is not the site
  is refused with 403 and keeps the session. Behind a proxy that rewrites `Host`, set `url` or `INKAN_PUBLIC_URL` to
  the address users open, which sign-in needs anyway.
- **Email rules and verification.** `allow.emails` and `allow.domains` admit a user only when the provider confirmed
  the address (`email_verified`, GitHub's verified addresses, Entra's `xms_edov`). A provider that sends no such
  claim admits nobody through these rules until `trustEmail: true` is set; group rules are unaffected. This is
  deliberate: on a provider where anyone can register with any address, an unverified address proves nothing.
- **Sessions.** The session is an encrypted cookie that carries the user's id, name, email and picture. The server keeps
  no session state, so it scales horizontally and a restart signs nobody out. Changing `INKAN_AUTH_SECRET`
  signs everybody out at once, which is also how you revoke sessions in an emergency. Access is checked when signing
  in, not on every request: a user removed from a group keeps access until the session expires (`maxAge`, 8 hours by
  default), so lower it when that matters.
- **Publishing.** `dist/` alone is safe to publish anywhere. `dist-protected/` contains every protected page and must
  never be uploaded to a static host or served by anything other than `inkan serve`. `_server.json` holds no
  secret, but the folder as a whole is as sensitive as the records.
- The identity provider and the Node process join the availability and security story of the archive: keep the
  package updated and the secrets in a secret store.
