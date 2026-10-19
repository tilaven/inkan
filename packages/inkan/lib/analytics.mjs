import { z } from 'astro/zod';

const url = z.string().url();
const options = z
  .object({
    plausible: z.object({ domain: z.string().min(1), src: z.string().min(1).optional(), api: z.string().min(1).optional() }).strict().optional(),
    umami: z
      .object({ websiteId: z.string().min(1), src: z.string().min(1).optional(), hostUrl: url.optional(), domains: z.array(z.string().min(1)).optional() })
      .strict()
      .optional(),
    google: z.object({ measurementId: z.string().regex(/^G-[A-Z0-9]+$/, 'must look like G-XXXXXXX') }).strict().optional(),
    events: z.boolean().optional(),
    dev: z.boolean().optional(),
  })
  .strict()
  .refine((o) => o.plausible || o.umami || o.google, { message: 'set at least one of plausible, umami or google' });

/**
 * Runs in the browser; `c` is the validated options. Loads each provider and forwards `inkan:track` events to it.
 * @param {z.infer<typeof options>} c
 */
function loader(c) {
  const w = /** @type {any} */ (window);
  const load = (src, attrs = {}) => {
    const s = document.createElement('script');
    s.defer = true;
    s.src = src;
    for (const [k, v] of Object.entries(attrs)) if (v) s.setAttribute(k, v);
    document.head.append(s);
    return s;
  };
  const send = [];
  if (c.plausible) {
    load(c.plausible.src ?? 'https://plausible.io/js/script.js', { 'data-domain': c.plausible.domain, 'data-api': c.plausible.api });
    w.plausible ??= function () { (w.plausible.q ??= []).push(arguments); };
    send.push((name, props) => w.plausible(name, { props }));
  }
  if (c.umami) {
    const { websiteId, src, hostUrl, domains } = c.umami;
    const script = load(src ?? 'https://cloud.umami.is/script.js', { 'data-website-id': websiteId, 'data-host-url': hostUrl, 'data-domains': domains?.join(',') });
    // Umami has no command queue: hold events until its script has run.
    const early = [];
    script.addEventListener('load', () => early.splice(0).forEach((args) => w.umami?.track(...args)));
    send.push((name, props) => (w.umami ? w.umami.track(name, props) : early.push([name, props])));
  }
  if (c.google) {
    const id = c.google.measurementId;
    load(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
    w.dataLayer ??= [];
    w.gtag ??= function () { w.dataLayer.push(arguments); };
    w.gtag('js', new Date());
    w.gtag('config', id);
    send.push((name, props) => w.gtag('event', name.toLowerCase().replace(/\W+/g, '_'), props));
  }
  if (c.events !== false) {
    document.addEventListener('inkan:track', (/** @type {any} */ e) => {
      for (const fn of send) {
        try { fn(e.detail.name, e.detail.props); } catch {}
      }
    });
  }
}

/**
 * Page views and site events (search queries, page actions) for Plausible, Umami and Google Analytics 4.
 * Scripts load in `inkan build` output only, unless `dev: true`.
 */
export function analytics(input) {
  const result = options.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.length ? `${i.path.join('.')}: ` : ''}${i.message}`);
    throw new Error(`inkan analytics:\n  ${issues.join('\n  ')}`);
  }
  const config = result.data;
  return {
    name: 'analytics',
    integrations: [
      {
        name: 'inkan:analytics',
        hooks: {
          'astro:config:setup': ({ command, injectScript }) => {
            if (command !== 'build' && !config.dev) return;
            injectScript('head-inline', `(${loader})(${JSON.stringify(config).replace(/</g, '\\u003c')});`);
          },
        },
      },
    ],
  };
}
