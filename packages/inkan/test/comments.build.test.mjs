import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { configModule, tmpSite } from './helpers.mjs';

const cli = fileURLToPath(new URL('../bin/cli.mjs', import.meta.url));
const record = (title, extra = '') => `---\ntitle: ${title}\nstatus: proposed\ndate: 2026-01-02\n${extra}---\n## Context\n${title}\n`;
const records = {
  'decisions/sre/_project.yml': 'name: SRE\n',
  'decisions/sre/rfc/0001-error-budgets.md': record('Error budgets'),
  'decisions/sre/rfc/0002-quiet.md': record('Quiet', 'comments: false\n'),
  'decisions/sre/rfc/0003-linked.md': record('Linked', 'discussion: https://github.com/acme/decisions/discussions/42\n'),
  'decisions/sre/adr/0001-slos.md': record('SLOs'),
  'decisions/sre/adr/0002-open.md': record('Open', 'comments: true\n'),
};

function build(comments, files = {}) {
  const root = tmpSite({
    'inkan.config.mjs': configModule(`{ url: 'https://decisions.acme.dev', search: false, repo: { url: 'https://github.com/acme/decisions' }, comments: ${comments} }`),
    ...records,
    ...files,
  });
  const result = spawnSync(process.execPath, [cli, 'build', '--root', root], { encoding: 'utf8' });
  expect(result.status, result.stderr + result.stdout).toBe(0);
  return (id) => fs.readFileSync(path.join(root, 'dist', id, 'index.html'), 'utf8');
}

const giscusAttrs = (html) => JSON.parse(/data-giscus="([^"]+)"/.exec(html)[1].replaceAll('&quot;', '"'));

describe('build with comments', () => {
  it('embeds giscus under RFCs and follows front matter', { timeout: 180_000 }, () => {
    const page = build(`{ provider: 'giscus', repoId: 'R_1', category: 'RFCs', categoryId: 'DIC_1' }`);
    expect(giscusAttrs(page('sre/rfc/0001-error-budgets'))).toMatchObject({
      'data-repo': 'acme/decisions',
      'data-mapping': 'specific',
      'data-term': 'sre/rfc/0001-error-budgets',
      'data-strict': '1',
    });
    expect(giscusAttrs(page('sre/rfc/0003-linked'))).toMatchObject({ 'data-mapping': 'number', 'data-term': '42' });
    expect(page('sre/rfc/0001-error-budgets')).toContain('id="comments-h"');
    expect(page('sre/rfc/0002-quiet')).not.toContain('id="comments-h"');
    expect(page('sre/adr/0001-slos')).not.toContain('id="comments-h"');
    expect(page('sre/adr/0002-open')).toContain('data-giscus=');
  });

  it('links GitLab issues for the browser to fill in', { timeout: 180_000 }, () => {
    const page = build(`{ provider: 'gitlab', project: 'platform/decisions', host: 'https://git.acme.dev', labels: ['rfc'] }`);
    const html = page('sre/rfc/0001-error-budgets');
    expect(html).toContain('data-project="platform/decisions"');
    expect(html).toContain('data-ref="SRE-RFC-0001"');
    const href = /<a class="pill" href="([^"]+)"[^>]*>Start the discussion on GitLab/.exec(html)[1].replaceAll('&amp;', '&');
    const url = new URL(href);
    expect(url.origin + url.pathname).toBe('https://git.acme.dev/platform/decisions/-/issues/new');
    expect(url.searchParams.get('issue[title]')).toBe('SRE-RFC-0001 Error budgets');
    expect(url.searchParams.get('issue[description]')).toBe('https://decisions.acme.dev/sre/rfc/0001-error-budgets/\n\n/label ~"rfc"');
  });

  it('marks record blocks with source lines and pins reviews from a pull request', { timeout: 180_000 }, () => {
    const page = build('false', {
      'decisions/sre/rfc/0004-reviewed.md': record('Reviewed', 'discussion: https://github.com/acme/decisions/pull/12\n') + '\nSecond paragraph\nwraps.\n',
    });
    const html = page('sre/rfc/0004-reviewed');
    expect(html).toMatch(/<h2 data-line="7" data-line-end="7"[^>]*>/);
    expect(html).toMatch(/<p data-line="8" data-line-end="8"[^>]*>Reviewed<\/p>/);
    expect(html).toMatch(/<p data-line="10" data-line-end="11"[^>]*>Second paragraph/);
    expect(html).toContain('data-discussion="https://github.com/acme/decisions/pull/12" data-file="decisions/sre/rfc/0004-reviewed.md"');
    expect(page('sre/rfc/0003-linked')).not.toContain('data-review-pins');
  });

  it('renders a custom provider component with its options', { timeout: 180_000 }, () => {
    const page = build(`{ provider: 'custom', component: './Talk.astro', options: { room: 'arch' }, types: ['adr'] }`, {
      'Talk.astro': '---\nconst { options, title, pageUrl } = Astro.props;\n---\n<p class="talk">{options.room} {title} {pageUrl}</p>\n',
    });
    expect(page('sre/adr/0001-slos')).toContain('<p class="talk">arch SRE-ADR-0001 SLOs https://decisions.acme.dev/sre/adr/0001-slos/</p>');
    expect(page('sre/rfc/0001-error-budgets')).not.toContain('class="talk"');
  });
});
