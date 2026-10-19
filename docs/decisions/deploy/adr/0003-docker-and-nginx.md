---
title: "Docker and nginx"
description: "The Dockerfile and nginx.conf that init writes: a two-stage image that builds the site and serves dist/ with the right redirects, 404 and cache headers."
status: implemented
date: 2026-10-16
authors: [tilaven]
deciders: [tilaven]
tags: [deploy, docker, ci]
related: [deploy/adr/0001-static-html-output, deploy/adr/0006-protect-the-site-at-the-edge, deploy/adr/0004-serve-from-a-sub-path, cli/adr/0002-scaffold-with-init-and-npm-create]
---

## Context

Not every archive can live on GitHub or GitLab Pages. Internal platforms run containers, and a static site in
a container is a solved problem as long as the web server gets three things right: trailing slashes, the 404
page and cache headers for hashed assets. Writing that nginx configuration from memory is where mistakes
happen.

## Decision

`inkan init` copies a `Dockerfile`, an `nginx.conf` and a `.dockerignore` into the repository. The
image builds the site in a Node stage and copies `dist/` into an `nginx:alpine` stage. The nginx configuration
redirects slash-less URLs to the canonical form, serves `404.html` for unknown paths, compresses text and caches
content-hashed assets (`/_astro/` and Pagefind's index chunks) forever.

## How to use it

```bash
docker build -t decisions .
docker run --rm -p 8080:80 decisions
# http://localhost:8080
```

### The Dockerfile

```dockerfile title="Dockerfile"
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

`npm ci` needs a committed `package-lock.json`; run `npm install` once and commit the lock file, or change the
line to `npm install`. Both base images are multi-arch, so the same Dockerfile builds on arm64 and amd64.

### The .dockerignore

```text title=".dockerignore"
node_modules
dist
.astro
.git
Dockerfile
.dockerignore
```

The build context is the repository without its dependencies and previous output. Note that `.git` is
excluded: inside the image there is no git history, so "Last updated" dates are not shown on pages built this
way. Remove `.git` from the list if you want them, at the cost of a larger context.

### The nginx configuration

```nginx title="nginx.conf"
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  absolute_redirect off;
  error_page 404 /404.html;

  gzip on;
  gzip_vary on;
  gzip_min_length 256;
  gzip_types text/plain text/css text/xml application/json application/javascript application/xml application/rss+xml image/svg+xml;

  location / {
    rewrite ^([^.]*[^/])$ $1/ permanent;
    try_files $uri $uri/index.html $uri/ =404;
    add_header Cache-Control "no-cache";
  }

  location = /404.html {
    internal;
  }

  location /_astro/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }

  # Pagefind's entry files keep their names between builds; only the index chunks are content-hashed.
  location /pagefind/ {
    add_header Cache-Control "no-cache";
    try_files $uri =404;
  }

  location ~ /pagefind/((index|fragment|filter)/|.*\.pf_meta$) {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }
}
```

| Directive | Why |
| --- | --- |
| `rewrite ^([^.]*[^/])$ $1/ permanent` | `/sre/adr/0001-x` becomes `/sre/adr/0001-x/`, the only form the site links to. Paths with a dot (`.md`, `.json`, `.txt`) are left alone. |
| `absolute_redirect off` | The redirect keeps the host and scheme the client used, which matters behind a reverse proxy or on a non-80 port. |
| `try_files $uri $uri/index.html $uri/ =404` | A folder request serves its `index.html`; anything else is a 404. |
| `error_page 404 /404.html` + `internal` | The site's own 404 page, not nginx's; the file is not reachable by direct request. |
| `Cache-Control "no-cache"` on pages | HTML is revalidated on every request, so a deploy is visible at once. |
| `immutable` on `/_astro/` and Pagefind's index chunks | File names change with content; browsers may keep them for a year. |
| `no-cache` on the rest of `/pagefind/` | `pagefind-entry.json`, `pagefind.js` and the WASM files keep their names, so they are revalidated to find the new index after a deploy. |
| `gzip_types` | Compresses HTML, CSS, JS, JSON, the text files for agents, RSS and SVG covers. |

### Behind a proxy or on a sub-path

The configuration assumes the site is at `/`. For `BASE_PATH=/decisions`, build with that variable and move
the files into a matching folder in the image, for example `COPY --from=build /app/dist /usr/share/nginx/html/decisions`,
and prefix the two prefix locations (`/decisions/_astro/`, `/decisions/pagefind/`); the Pagefind regex location matches under any prefix. See
[Serve from a sub-path](0004-serve-from-a-sub-path.md).

To put a login in front of the image, for example with oauth2-proxy, see [Protect the site at the edge](0006-protect-the-site-at-the-edge.md).

### Other servers

The same three rules translate to any server: redirect to the trailing slash, serve `index.html` for folders,
serve `404.html` for misses. On Caddy that is `file_server` with `try_files {path} {path}/index.html` and
`handle_errors`; on S3 and CloudFront, an index document of `index.html` and a custom error response for 404.

## Consequences

- One `docker build` produces a self-contained image of a few tens of megabytes with no Node runtime inside.
- The image is immutable; a new record means a new image. That matches how the CI pipelines treat the site.
- Without `.git` in the build context, pages have no "Last updated" date. Trade context size for dates by removing the line.
- Cache headers rely on hashed file names. The HTML itself is `no-cache`, so a CDN in front must honour that or purge on deploy.
- The files are copied once by `init` and are yours; later improvements to the starter do not reach existing repositories.
