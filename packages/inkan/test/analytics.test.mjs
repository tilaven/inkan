import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { analytics } from '../lib/analytics.mjs';

/** Runs the head script the plugin injects for `command` against a stub DOM. */
function inject(options, command = 'build') {
  const scripts = [];
  analytics(options).integrations[0].hooks['astro:config:setup']({ command, injectScript: (stage, code) => scripts.push({ stage, code }) });
  return scripts;
}

function run(code) {
  const appended = [];
  const listeners = {};
  const document = {
    head: { append: (el) => appended.push(el) },
    createElement: () => ({
      attrs: {},
      on: {},
      setAttribute(k, v) { this.attrs[k] = v; },
      addEventListener(type, fn) { this.on[type] = fn; },
    }),
    addEventListener: (type, fn) => (listeners[type] = fn),
  };
  const window = {};
  vm.runInNewContext(code, { window, document, Date });
  const fire = (name, props) => listeners['inkan:track']?.({ detail: { name, props } });
  return { appended, window, fire, listeners };
}

describe('analytics plugin', () => {
  it('rejects bad options with one line per problem', () => {
    expect(() => analytics({})).toThrow('set at least one of plausible, umami or google');
    expect(() => analytics({ google: { measurementId: 'UA-1' }, umami: {} })).toThrow(
      /inkan analytics:\n {2}umami.websiteId: .*\n {2}google.measurementId: must look like G-XXXXXXX/,
    );
    expect(() => analytics({ plausible: { domain: 'a.dev', colour: 'red' } })).toThrow(/plausible: .*colour/);
  });

  it('injects into builds only, unless dev is set', () => {
    expect(inject({ plausible: { domain: 'a.dev' } }, 'dev')).toEqual([]);
    expect(inject({ plausible: { domain: 'a.dev' }, dev: true }, 'dev')).toHaveLength(1);
    const [script] = inject({ plausible: { domain: 'a.dev' } });
    expect(script.stage).toBe('head-inline');
  });

  it('escapes the options so they cannot close the script tag', () => {
    const [{ code }] = inject({ plausible: { domain: '</script><b>' } });
    expect(code).not.toContain('</script>');
    expect(run(code).appended[0].attrs['data-domain']).toBe('</script><b>');
  });

  it('loads every configured provider', () => {
    const [{ code }] = inject({
      plausible: { domain: 'a.dev', api: '/stats/event' },
      umami: { websiteId: 'abc', src: 'https://stats.a.dev/u.js', domains: ['a.dev', 'www.a.dev'] },
      google: { measurementId: 'G-ABC123' },
    });
    const { appended, window } = run(code);
    expect(appended.map((s) => [s.src, s.attrs])).toEqual([
      ['https://plausible.io/js/script.js', { 'data-domain': 'a.dev', 'data-api': '/stats/event' }],
      ['https://stats.a.dev/u.js', { 'data-website-id': 'abc', 'data-domains': 'a.dev,www.a.dev' }],
      ['https://www.googletagmanager.com/gtag/js?id=G-ABC123', {}],
    ]);
    expect(appended.every((s) => s.defer)).toBe(true);
    expect([...window.dataLayer].map((args) => args[0])).toEqual(['js', 'config']);
  });

  it('forwards site events to each provider', () => {
    const [{ code }] = inject({ plausible: { domain: 'a.dev' }, umami: { websiteId: 'abc' }, google: { measurementId: 'G-ABC123' } });
    const { window, fire } = run(code);
    const umami = [];
    window.umami = { track: (...args) => umami.push(args) };
    fire('Page action', { action: 'copy-link' });
    expect([...window.plausible.q[0]]).toEqual(['Page action', { props: { action: 'copy-link' } }]);
    expect(umami).toEqual([['Page action', { action: 'copy-link' }]]);
    expect([...window.dataLayer.at(-1)]).toEqual(['event', 'page_action', { action: 'copy-link' }]);
  });

  it('holds Umami events until its script has loaded', () => {
    const [{ code }] = inject({ umami: { websiteId: 'abc' } });
    const { appended, window, fire } = run(code);
    fire('Search', { query: 'kafka', results: 2 });
    const umami = [];
    window.umami = { track: (...args) => umami.push(args) };
    appended[0].on.load();
    fire('Page action', { action: 'copy-link' });
    expect(umami).toEqual([['Search', { query: 'kafka', results: 2 }], ['Page action', { action: 'copy-link' }]]);
  });

  it('keeps sending when one provider throws', () => {
    const [{ code }] = inject({ umami: { websiteId: 'abc' }, google: { measurementId: 'G-ABC123' } });
    const { window, fire } = run(code);
    window.umami = { track: () => { throw new Error('blocked'); } };
    fire('Search', { query: 'kafka', results: 2 });
    expect([...window.dataLayer.at(-1)]).toEqual(['event', 'search', { query: 'kafka', results: 2 }]);
  });

  it('sends page views only when events are off', () => {
    const [{ code }] = inject({ plausible: { domain: 'a.dev' }, events: false });
    expect(run(code).listeners).toEqual({});
  });
});
