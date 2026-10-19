import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config.mjs';
import { tmpSite } from '../../test/helpers.mjs';
import { builtRoute, escapeGlob, keepInPublic, protectedMatcher, protectedProjects, unprotectableMessage, unprotectableProjects } from './protect.mjs';

const auth = { type: 'github', clientId: 'x' };
const site = (config, files = {}) =>
  loadConfig(
    tmpSite({
      'inkan.config.mjs': `export default ${JSON.stringify(config)};\n`,
      'decisions/sre/_project.yml': 'name: SRE\n',
      'decisions/ops/_project.yml': 'name: Ops\nprotected: true\n',
      'decisions/ops/adr/0001-x.md': '---\ntitle: X\n---\n',
      ...files,
    }),
  );

describe('protectedProjects', () => {
  it('lists the projects whose _project.yml says protected: true, sources included', async () => {
    const config = await site(
      { authentication: auth },
      { 'other/_project.yml': 'name: Other\nprotected: true\n', 'other/adr/0001-y.md': '---\ntitle: Y\n---\n', 'decisions/Ops Plans/_project.yml': 'name: Ops Plans\nprotected: true\n' },
    );
    config.sources = [{ project: 'other', contentDir: `${config.root}/other` }];
    expect(protectedProjects(config)).toEqual(['ops-plans', 'ops', 'other']);
  });

  it('names the protected projects when nobody could sign in', async () => {
    expect(unprotectableProjects(await site({ authentication: auth }))).toEqual([]);
    const ids = unprotectableProjects(await site({}));
    expect(ids).toEqual(['ops']);
    expect(unprotectableMessage(ids)).toBe('project "ops" is protected (protected: true in _project.yml) but `authentication` is not set in inkan.config, so nobody could sign in to see it');
    expect(unprotectableMessage(['a', 'b'])).toMatch(/^projects "a", "b" are protected .* see them$/);
    expect(unprotectableMessage([])).toBeNull();
  });
});

describe('protectedMatcher', () => {
  const isProtected = protectedMatcher({ protectedRoutes: ['/handbook/*', '/plans/2026'], base: '/hub/' }, ['ops']);

  it('covers the protected projects, their team page and records, with or without the base', () => {
    expect(isProtected('/hub/ops/')).toBe(true);
    expect(isProtected('/ops/adr/0001-x/')).toBe(true);
    expect(isProtected('/hub/ops/adr/0001-x.md')).toBe(true);
    expect(isProtected('ops.md')).toBe(true);
    expect(isProtected('/hub/sre/adr/0001-x/')).toBe(false);
    expect(isProtected('/hub/opsy/')).toBe(false);
    expect(isProtected('/hub/')).toBe(false);
  });

  it('covers the routes', () => {
    expect(isProtected('/hub/handbook/')).toBe(true);
    expect(isProtected('/hub/handbook/onboarding/')).toBe(true);
    expect(isProtected('/hub/plans/2026/')).toBe(true);
    expect(isProtected('/hub/plans/2027/')).toBe(false);
    expect(isProtected('/hub/handbooks/')).toBe(false);
  });

  it('ignores case, as page URLs are lowercased', () => {
    const upper = protectedMatcher({ protectedRoutes: ['/Handbook/*'], base: '/' }, ['Secret']);
    expect(upper('/secret/adr/0001-x/')).toBe(true);
    expect(upper('/Secret/ADR/0001-x.MD')).toBe(true);
    expect(upper('/handbook/onboarding/')).toBe(true);
    expect(isProtected('/hub/OPS/')).toBe(true);
  });

  it('matches a folder that is no slug both as named and as the slug its records get', () => {
    const spaced = protectedMatcher({ protectedRoutes: [], base: '/' }, ['Secret Ops']);
    expect(spaced('/secret-ops/adr/0001-x/')).toBe(true);
    expect(spaced('/Secret Ops/')).toBe(true);
    expect(spaced('/Secret%20Ops/')).toBe(true);
    expect(spaced('/secret-ops.md')).toBe(true);
    expect(spaced('/secret/adr/0001-x/')).toBe(false);
    expect(spaced('/ops/')).toBe(false);
  });

  it('protects nothing without projects and routes', () => {
    const none = protectedMatcher({ protectedRoutes: [], base: '/' }, []);
    expect(none('/ops/')).toBe(false);
    expect(none('/')).toBe(false);
  });
});

describe('built files', () => {
  it('maps built files back to routes', () => {
    expect(builtRoute('index.html')).toBe('/');
    expect(builtRoute('ops/adr/0001-x/index.html')).toBe('/ops/adr/0001-x/');
    expect(builtRoute('ops\\adr\\0001-x\\index.html')).toBe('/ops/adr/0001-x/');
    expect(builtRoute('handbook.md')).toBe('/handbook.md');
    expect(builtRoute('legacy.html')).toBe('/legacy');
  });

  it('keeps the error and sign-in pages in the public site', () => {
    expect(keepInPublic('404.html')).toBe(true);
    expect(keepInPublic('_auth/denied/index.html')).toBe(true);
    expect(keepInPublic('ops/index.html')).toBe(false);
  });
});

describe('escapeGlob', () => {
  it('keeps a folder name literal inside a pattern', () => {
    expect(escapeGlob('secret')).toBe('secret');
    expect(escapeGlob('Secret Ops')).toBe('Secret Ops');
    expect(escapeGlob('q[1]*{a,b}?!')).toBe('q\\[1\\]\\*\\{a,b\\}\\?\\!');
  });
});
