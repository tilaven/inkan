import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveComments } from '../lib/comments.mjs';
import { loadConfig, validateConfig } from '../lib/config.mjs';
import { configModule, tmpSite } from './helpers.mjs';

const giscus = { provider: 'giscus', repoId: 'R_1', category: 'RFCs', categoryId: 'DIC_1' };
const resolve = (comments, repo = { url: '', provider: 'github' }) => resolveComments(comments, { repo, root: '/site' });

describe('comments option', () => {
  it('is off by default and with false', async () => {
    const off = { enabled: false, provider: null, types: [], statuses: null };
    expect((await loadConfig(tmpSite())).comments).toEqual(off);
    expect((await loadConfig(tmpSite({ 'inkan.config.mjs': configModule('{ comments: false }') }))).comments).toEqual(off);
  });

  it('fills giscus defaults and takes the repo from repo.url', () => {
    expect(resolve(giscus, { url: 'https://github.com/acme/decisions.git', provider: 'github' })).toEqual({
      issues: [],
      value: {
        enabled: true,
        types: ['rfc'],
        statuses: null,
        ...giscus,
        repo: 'acme/decisions',
        mapping: 'specific',
        strict: true,
        reactions: true,
        inputPosition: 'top',
        lang: 'en',
        theme: { light: 'light', dark: 'dark' },
      },
    });
    expect(resolve(giscus, { url: 'https://gitlab.com/acme/decisions', provider: 'gitlab' }).issues[0].path).toEqual(['repo']);
  });

  it('speaks the site language in giscus unless lang is set', () => {
    const lang = (locale, extra = {}) => resolveComments({ ...giscus, repo: 'a/b', ...extra }, { repo: { url: '' }, root: '/site', locale }).value.lang;
    expect([lang('pl'), lang('pl-PL'), lang('zh-CN'), lang('pl', { lang: 'de' })]).toEqual(['pl', 'pl', 'zh-CN', 'de']);
  });

  it('takes the GitLab host and project from repo.url', () => {
    const { value } = resolve({ provider: 'gitlab', statuses: ['proposed'] }, { url: 'https://git.acme.dev/platform/arch/decisions/', provider: 'gitlab' });
    expect(value).toMatchObject({ host: 'https://git.acme.dev', project: 'platform/arch/decisions', labels: [], statuses: ['proposed'] });
    expect(resolve({ provider: 'gitlab', project: 'a/b' }).value.host).toBe('https://gitlab.com');
    expect(resolve({ provider: 'gitlab' }).issues[0].path).toEqual(['project']);
    expect(resolve({ provider: 'gitlab' }, { url: 'ssh://git@git.acme.dev/platform/decisions.git', provider: 'gitlab' }).issues[0].path).toEqual(['project']);
  });

  it('resolves a custom component against the config folder', () => {
    expect(resolve({ provider: 'custom', component: './Comments.astro' }).value).toMatchObject({ component: path.resolve('/site', 'Comments.astro'), options: {} });
  });

  it('is idempotent', () => {
    for (const input of [giscus, { provider: 'gitlab', project: 'a/b' }, { provider: 'custom', component: 'C.astro' }, false]) {
      const once = resolve({ ...input, repo: input.provider === 'giscus' ? 'a/b' : undefined }).value;
      expect(resolve(once).value).toEqual(once);
    }
  });

  it('explains invalid options', async () => {
    expect(() => validateConfig({ comments: { provider: 'disqus' } })).toThrow('comments.provider: provider must be one of giscus, gitlab, custom');
    expect(() => validateConfig({ comments: { provider: 'giscus', repoId: 'R' } })).toThrow('comments.category');
    expect(() => validateConfig({ comments: { provider: 'gitlab', token: 'x' } })).toThrow('comments.token: unknown option');
    expect(() => validateConfig({ comments: { provider: 'gitlab', project: 'nogroup' } })).toThrow('comments.project: must be the project path');
    const root = tmpSite({ 'inkan.config.mjs': configModule(`{ comments: { provider: 'gitlab' } }`) });
    await expect(loadConfig(root)).rejects.toThrow('comments.project: set project');
    const typo = tmpSite({ 'inkan.config.mjs': configModule(`{ comments: { provider: 'gitlab', project: 'a/b', types: ['RFC'], statuses: ['proposd'] } }`) });
    await expect(loadConfig(typo)).rejects.toThrow(/comments\.types\.0: unknown record type "RFC" \(known: adr, rfc\)[\s\S]*comments\.statuses\.0: unknown status "proposd"/);
  });
});
