---
title: "Protect the site at the edge"
description: "Keep a private archive private without touching the site: put oauth2-proxy, Cloudflare Access or the Pages access controls in front of the static output."
status: implemented
date: 2026-10-17
authors: [tilaven]
deciders: [tilaven]
tags: [deploy, security, auth]
related: [deploy/adr/0003-docker-and-nginx, deploy/adr/0002-github-and-gitlab-pages, deploy/adr/0007-sign-in-and-protected-projects]
---

## Context

Decision records are often internal: architecture trade-offs, security reviews, vendor choices. The site
Inkan builds is plain static files, so it has no notion of a user and no login of its own. Teams still
need "only people from our company can open this", and they need it without a second system to run for the docs.

## Decision

Authentication happens in front of the site, not inside it. Whatever serves `dist/` stays unchanged, and a layer
that already knows how to talk to an identity provider decides who gets through. Because the layer sits in front
of the whole origin, every file is covered the same way: pages, `/pagefind/` search indexes, `llms.txt`,
`decisions.json`, covers and RSS. There is no list of "protected paths" to forget to extend when a new output file
appears.

The repository ships a runnable example for the container route in `deploy/oauth2-proxy/`. The other routes are
configuration in someone else's product and are described here.

## How to use it

### oauth2-proxy in front of the nginx image

[oauth2-proxy](https://oauth2-proxy.github.io/oauth2-proxy/) is a reverse proxy that signs users in with GitHub,
Google or any OpenID Connect provider and forwards only authenticated requests to its upstream. The site
container is not published; the proxy is the only way in.

```yaml title="compose.yml"
services:
  site:
    build:
      context: ../..
      dockerfile: Dockerfile
    restart: unless-stopped

  oauth2-proxy:
    image: quay.io/oauth2-proxy/oauth2-proxy:v7.15.4
    restart: unless-stopped
    depends_on:
      - site
    ports:
      - "8080:4180"
    env_file:
      - path: .env
        required: false
    environment:
      OAUTH2_PROXY_HTTP_ADDRESS: 0.0.0.0:4180
      OAUTH2_PROXY_UPSTREAMS: http://site:80
      OAUTH2_PROXY_REVERSE_PROXY: "true"
      OAUTH2_PROXY_SKIP_PROVIDER_BUTTON: "true"
      OAUTH2_PROXY_COOKIE_SECURE: ${COOKIE_SECURE:-true}
      OAUTH2_PROXY_COOKIE_HTTPONLY: "true"
      OAUTH2_PROXY_COOKIE_SAMESITE: lax
      OAUTH2_PROXY_COOKIE_EXPIRE: 168h
      OAUTH2_PROXY_COOKIE_REFRESH: 1h
      OAUTH2_PROXY_PASS_ACCESS_TOKEN: "false"
      OAUTH2_PROXY_PASS_AUTHORIZATION_HEADER: "false"
      OAUTH2_PROXY_SET_XAUTHREQUEST: "false"
```

Every oauth2-proxy option is also an environment variable: prefix `OAUTH2_PROXY_`, upper-case, hyphens to
underscores. The example sets the rest from a `.env` file:

| Variable | Meaning |
| --- | --- |
| `OAUTH2_PROXY_PROVIDER` | `github`, `google` or `oidc`. |
| `OAUTH2_PROXY_CLIENT_ID`, `OAUTH2_PROXY_CLIENT_SECRET` | The OAuth application registered with the provider. |
| `OAUTH2_PROXY_COOKIE_SECRET` | Random secret that decodes to 16, 24 or 32 bytes; `openssl rand -base64 32 \| tr -- '+/' '-_'` gives 32. |
| `OAUTH2_PROXY_REDIRECT_URL` | `https://<host>/oauth2/callback`, exactly as registered with the provider. |
| `OAUTH2_PROXY_EMAIL_DOMAINS` | Allowed email domains, comma-separated. `*` allows any address, so use it only together with an organisation or group restriction. |
| `COOKIE_SECURE` | `true` (default) behind HTTPS; `false` only for `http://localhost`. |

Who gets in is decided per provider:

| Provider | Restriction |
| --- | --- |
| GitHub | `OAUTH2_PROXY_GITHUB_ORG=acme` limits sign-in to members of the organisation; add `OAUTH2_PROXY_GITHUB_TEAM=docs,platform` (team slugs) to narrow it further. |
| Google | `OAUTH2_PROXY_EMAIL_DOMAINS=acme.com` allows only that Google Workspace domain. |
| OIDC (Keycloak, Entra ID, Okta) | Set `OAUTH2_PROXY_OIDC_ISSUER_URL`, then restrict with `OAUTH2_PROXY_EMAIL_DOMAINS` or, if the provider sends a groups claim, `OAUTH2_PROXY_ALLOWED_GROUPS`. |

To try the whole flow without an external account, the folder includes a Dex override with a static test user:

```bash
cd deploy/oauth2-proxy
docker compose -f compose.yml -f compose.dex.yml up --build
# http://localhost:8080 redirects to Dex; sign in as admin@example.com / password
```

For real use, copy `.env.example` to `.env`, fill it in and run `docker compose up --build -d` behind TLS.

The proxy sees `/pagefind/`, `llms.txt` and `decisions.json` like any other path: an unauthenticated request for
any of them is redirected to sign-in. That is the intent, and it has one consequence for automation. An agent or
a CI job that fetches `llms.txt` has no browser session. Give it its own route, such as a service token (below)
or a network path that bypasses the proxy, rather than opening the file to everyone.

### Cloudflare Access

If the site is already behind Cloudflare, add a Zero Trust application on its hostname. In the dashboard open
**Zero Trust > Access controls > Applications**, create a **Self-hosted** application for the site's hostname and
attach an **Allow** policy. Access applications are deny-by-default, so only people matching a policy get in. A
policy can match emails ending in `@acme.com`, specific addresses or groups from the identity provider, and
the session duration is set on the application. The origin can be the nginx image behind a Cloudflare Tunnel or
a Cloudflare Pages project served on a custom domain.

For machines, create a service token and add a **Service Auth** policy to the same application. The client sends
the token in the `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers, which is how a pipeline or an agent
fetches `llms.txt` without a login. See the [Cloudflare Access documentation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/) and [service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/).

### GitLab Pages access control

On GitLab Pages no extra component is needed. In the project, open **Settings > General > Visibility, project
features, permissions**, turn on **Pages** and choose **Only project members**. Visitors are sent to GitLab to
sign in, and by default anyone with at least the Guest role on the project may view the site. It applies to
private, internal and public projects; internal projects can also allow every signed-in user. The setting must be
enabled for the instance by an administrator, and it can take about a minute to take effect. See [GitLab Pages access control](https://docs.gitlab.com/user/project/pages/pages_access_control/).

### GitHub Pages

A GitHub Pages site can be limited to people with read access to the repository only on GitHub Enterprise Cloud,
under the repository's Pages settings. Free, Pro and Team plans publish Pages publicly whatever the repository
visibility; use one of the other routes if you are on those plans.

### Other options

- **Netlify and Vercel:** password protection or team-only deployments, set in the project settings of their paid plans.
- **nginx `auth_request`:** have the existing nginx call an authentication service for every request; the oauth2-proxy `/oauth2/auth` endpoint is made for this.
- **Tailscale or a VPN:** publish the container only on the private network and skip authentication altogether.

## Consequences

- The site and the CLI are untouched; protection is one extra container or one dashboard setting, and can be removed the same way.
- Everything static is protected uniformly, including search indexes and agent files. There is no per-folder or per-project granularity: anyone who is let in sees every record.
- Search runs in the browser against files the proxy serves, so signed-in users get full search and signed-out users get nothing.
- Automated fetches of `llms.txt` and `decisions.json` need a service token or a bypass route.
- The proxy and the identity provider become part of the availability and security of the archive; keep oauth2-proxy updated and the cookie secret secret.
- Restricting what individual projects within one site can be seen by individual people is a different problem that this layer cannot solve; [Sign-in and protected projects](0007-sign-in-and-protected-projects.md) covers per-project protection inside the app.
