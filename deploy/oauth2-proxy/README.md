# Protect the site with oauth2-proxy

Puts [oauth2-proxy](https://oauth2-proxy.github.io/oauth2-proxy/) in front of the nginx image built from the
repository `Dockerfile`. Every request, including `/pagefind/`, `llms.txt` and `decisions.json`, needs a signed-in
user. The site itself is unchanged.

Needs Docker Compose v2.24 or newer (for the optional `env_file`).

## Try it locally

No external accounts needed; this starts a local [Dex](https://dexidp.io/) identity provider.

```bash
docker compose -f compose.yml -f compose.dex.yml up --build
```

Open http://localhost:8080, sign in as `admin@example.com` with password `password`.

## Use your own provider

```bash
cp .env.example .env
```

Fill in the client ID and secret, a cookie secret, the redirect URL and the restriction for your provider
(GitHub organisation, Google domain or OIDC issuer; examples are in `.env.example`), then:

```bash
docker compose up --build -d
```

Put TLS in front of port 8080 (a load balancer, Caddy, Traefik) and keep `COOKIE_SECURE=true`. The redirect URL
registered with the provider must be `https://<your-host>/oauth2/callback`.

The Dex files are for local trials only. Do not use the static client secret or user anywhere else.
