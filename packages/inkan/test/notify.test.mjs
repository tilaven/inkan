import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { run as notify } from '../lib/commands/notify.mjs';
import { loadConfig } from '../lib/config.mjs';
import { DIGEST_AFTER, defaultSince, payloads, resolveChannels, statusChanges } from '../lib/notify.mjs';
import { configModule, git, tmpSite } from './helpers.mjs';

const record = (title, status, extra = '') => `---\ntitle: "${title}"\nstatus: ${status}\ndate: 2024-01-01\nauthors: [kim, sam]\n${extra}---\n\nText.\n`;

/** A git repository with two projects; `change` writes files and commits them. */
function repo(config = '{ url: "https://decisions.example.com", base: "/hub" }') {
  const root = tmpSite({
    'inkan.config.mjs': configModule(config),
    'decisions/_authors.yml': 'kim:\n  name: Kim Lee\n',
    'decisions/sre/_project.yml': 'name: SRE\n',
    'decisions/sre/adr/0001-use-slos.md': record('Use SLOs', 'proposed', 'description: "Alert on <burn rate> & budgets"\n'),
    'decisions/sre/adr/0002-use-slis.md': record('Use SLIs', 'accepted'),
    'decisions/payments/_project.yml': 'name: Payments\n',
    'decisions/payments/rfc/0001-ledger.md': record('Ledger', 'draft'),
  });
  git(['init', '-q', '-b', 'main'], root);
  git(['config', 'user.email', 'test@example.com'], root);
  git(['config', 'user.name', 'Test'], root);
  const change = (files) => {
    for (const [file, content] of Object.entries(files)) {
      const abs = path.join(root, 'decisions', file);
      if (content === null) fs.rmSync(abs);
      else {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content);
      }
    }
    git(['add', '-A'], root);
    git(['commit', '-q', '-m', 'change'], root);
  };
  change({});
  return { root, change };
}

/** A fetch stub that records every request. */
function recorder(status = 200) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
    return new Response(status === 200 ? 'ok' : 'invalid_token', { status, statusText: status === 200 ? 'OK' : 'Forbidden' });
  };
  return { calls, fetch };
}

const run = async (root, { flags = {}, env = {}, fetch } = {}) => {
  const log = [];
  const code = await notify({ args: [], flags: { since: 'HEAD~1', ...flags }, root, env, fetch, log: (l) => log.push(l) });
  return { code, log: log.join('\n') };
};

describe('statusChanges', () => {
  it('finds records that moved into a notified status, with labels, names and links', async () => {
    const { root, change } = repo();
    change({ 'sre/adr/0001-use-slos.md': record('Use SLOs', 'accepted', 'description: "Alert on <burn rate> & budgets"\n') });
    const config = await loadConfig(root);
    expect(statusChanges(config, { since: 'HEAD~1', statuses: ['accepted'] })).toEqual([
      {
        id: 'sre/adr/0001-use-slos',
        ref: 'SRE-ADR-0001',
        title: 'Use SLOs',
        description: 'Alert on <burn rate> & budgets',
        project: 'sre',
        projectName: 'SRE',
        type: 'adr',
        typeLabel: 'ADR',
        status: 'accepted',
        statusLabel: 'Accepted',
        previousStatus: 'proposed',
        previousStatusLabel: 'Proposed',
        authors: ['Kim Lee', 'sam'],
        tags: [],
        url: 'https://decisions.example.com/hub/sre/adr/0001-use-slos/',
        file: 'decisions/sre/adr/0001-use-slos.md',
      },
    ]);
  });

  it('counts added records, follows renames and ignores edits that keep the status', async () => {
    const { root, change } = repo();
    change({
      'sre/adr/0001-use-slos.md': null,
      'sre/adr/0001-define-slos.md': record('Use SLOs', 'proposed', 'description: "Alert on <burn rate> & budgets"\n'),
      'sre/adr/0002-use-slis.md': record('Use SLIs, renamed', 'accepted'),
      'payments/adr/0001-new.md': record('New', 'accepted'),
    });
    const config = await loadConfig(root);
    const events = statusChanges(config, { since: 'HEAD~1', statuses: ['accepted', 'proposed'] });
    expect(events.map((e) => [e.id, e.previousStatus, e.status])).toEqual([['payments/adr/0001-new', null, 'accepted']]);
  });

  it('reports a moved record that changed status with its old status', async () => {
    const { root, change } = repo();
    change({
      'sre/adr/0001-use-slos.md': null,
      'platform/adr/0001-use-slos.md': record('Use SLOs', 'accepted', 'description: "Alert on <burn rate> & budgets"\n'),
    });
    const events = statusChanges(await loadConfig(root), { since: 'HEAD~1', statuses: ['accepted'] });
    expect(events.map((e) => [e.id, e.previousStatus])).toEqual([['platform/adr/0001-use-slos', 'proposed']]);
  });

  it('sees uncommitted changes and links to the repository without a site URL', async () => {
    const { root } = repo('{ repo: { url: "https://gitlab.com/acme/decisions", provider: "gitlab" } }');
    fs.writeFileSync(path.join(root, 'decisions/payments/rfc/0001-ledger.md'), record('Ledger', 'accepted'));
    const [event] = statusChanges(await loadConfig(root), { since: 'HEAD', statuses: ['accepted'] });
    expect(event.url).toBe('https://gitlab.com/acme/decisions/-/blob/main/decisions/payments/rfc/0001-ledger.md');
  });

  it('leaves protected records out', async () => {
    const { root, change } = repo(
      '{ url: "https://decisions.example.com", base: "/hub", authentication: { type: "github", clientId: "app" }, protectedRoutes: ["/sre/adr/0001-*"] }',
    );
    change({
      'payments/_project.yml': 'name: Payments\nprotected: true\n',
      'payments/rfc/0001-ledger.md': record('Ledger', 'accepted'),
      'Secret Ops/_project.yml': 'name: Secret Ops\nprotected: true\n',
      'Secret Ops/adr/0001-plan.md': record('Plan', 'accepted'),
      'sre/adr/0001-use-slos.md': record('Use SLOs', 'accepted'),
      'sre/adr/0003-use-budgets.md': record('Use budgets', 'accepted'),
    });
    const events = statusChanges(await loadConfig(root), { since: 'HEAD~1', statuses: ['accepted'] });
    expect(events.map((e) => e.id)).toEqual(['sre/adr/0003-use-budgets']);
  });

  it('explains a commit that is not in the clone', async () => {
    const { root } = repo();
    expect(() => statusChanges({ repoRoot: root }, { since: 'deadbeef', statuses: [] })).toThrow(/no such commit in this clone.*fetch-depth: 0/);
  });
});

describe('defaultSince', () => {
  it('reads the pushed range from GitHub Actions and GitLab CI', () => {
    const dir = tmpSite({
      'push.json': JSON.stringify({ before: 'abc123' }),
      'new-branch.json': JSON.stringify({ before: '0000000000000000000000000000000000000000' }),
      'pr.json': JSON.stringify({ before: 'x', pull_request: { base: { sha: 'base1' } } }),
    });
    const gh = (file) => defaultSince({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_PATH: path.join(dir, file) });
    expect(gh('push.json')).toBe('abc123');
    expect(gh('new-branch.json')).toBeNull();
    expect(gh('pr.json')).toBe('base1');
    expect(defaultSince({ GITLAB_CI: 'true', CI_COMMIT_BEFORE_SHA: 'def456' })).toBe('def456');
    expect(defaultSince({ GITLAB_CI: 'true', CI_COMMIT_BEFORE_SHA: '0000000000000000000000000000000000000000', CI_MERGE_REQUEST_DIFF_BASE_SHA: 'mr1' })).toBe('mr1');
    expect(defaultSince({})).toBe('HEAD~1');
  });
});

describe('payloads', () => {
  const event = (n, extra = {}) => ({
    id: `sre/adr/000${n}-x`,
    ref: `SRE-ADR-000${n}`,
    title: `Record ${n}`,
    description: 'Use <b> & more',
    project: 'sre',
    projectName: 'SRE',
    type: 'adr',
    typeLabel: 'ADR',
    status: 'accepted',
    statusLabel: 'Accepted',
    previousStatus: 'proposed',
    previousStatusLabel: 'Proposed',
    authors: ['Kim Lee'],
    tags: [],
    url: `https://d.example.com/sre/adr/000${n}-x/`,
    file: `decisions/sre/adr/000${n}-x.md`,
    ...extra,
  });
  const site = { title: 'Acme decisions', url: 'https://d.example.com' };

  it('builds Slack Block Kit messages with escaped text', () => {
    const [body] = payloads({ type: 'slack' }, [event(1)], site);
    expect(body.text).toBe('SRE-ADR-0001: Record 1 is now Accepted');
    expect(body.blocks[0].text.text).toBe('*<https://d.example.com/sre/adr/0001-x/|SRE-ADR-0001: Record 1>*\nUse &lt;b&gt; &amp; more');
    expect(body.blocks[1].elements[0].text).toBe('SRE · ADR · Proposed → Accepted · Kim Lee');
  });

  it('builds a Teams Adaptive Card with a link button', () => {
    const [body] = payloads({ type: 'teams' }, [event(1, { previousStatus: null, previousStatusLabel: null, authors: [] })], site);
    const card = body.attachments[0].content;
    expect(body.type).toBe('message');
    expect(card.type).toBe('AdaptiveCard');
    expect(card.body.map((b) => b.text ?? b.facts)).toEqual(['SRE · ADR', 'SRE-ADR-0001: Record 1', 'Use <b> & more', [{ title: 'Status', value: 'Accepted' }]]);
    expect(card.actions).toEqual([{ type: 'Action.OpenUrl', title: 'Open record', url: 'https://d.example.com/sre/adr/0001-x/' }]);
  });

  it(`sends one digest above ${DIGEST_AFTER} records`, () => {
    const events = Array.from({ length: DIGEST_AFTER + 1 }, (_, i) => event(i + 1));
    const [slack, ...rest] = payloads({ type: 'slack' }, events, site);
    expect(rest).toEqual([]);
    expect(slack.text).toBe(`${events.length} records changed status in Acme decisions`);
    expect(slack.blocks[1].text.text.split('\n')).toHaveLength(events.length);
    expect(payloads({ type: 'teams' }, events, site)).toHaveLength(1);
    expect(payloads({ type: 'slack' }, events.slice(0, DIGEST_AFTER), site)).toHaveLength(DIGEST_AFTER);
  });

  it('sends webhooks one document, or what `body` returns', () => {
    expect(payloads({ type: 'webhook' }, [event(1)], site)).toEqual([{ site, events: [event(1)] }]);
    expect(payloads({ type: 'webhook', body: ({ events }) => ({ content: events[0].title }) }, [event(1)], site)).toEqual([{ content: 'Record 1' }]);
  });
});

describe('resolveChannels', () => {
  it('adds channels from the environment and names unnamed ones', () => {
    const channels = resolveChannels(
      { notify: { channels: [{ type: 'slack', url: 'https://a' }, { type: 'slack', url: '' }, { type: 'teams', url: 'https://t', name: 'ops' }] } },
      { INKAN_TEAMS_WEBHOOK: 'https://env' },
    );
    expect(channels.map((c) => [c.name, c.url])).toEqual([
      ['slack#1', 'https://a'],
      ['slack#2', null],
      ['ops', 'https://t'],
      ['inkan-teams-webhook', 'https://env'],
    ]);
  });
});

describe('inkan notify', () => {
  it('posts each change to every matching channel', async () => {
    const { root, change } = repo(`{
      url: 'https://decisions.example.com',
      notify: { channels: [
        { type: 'slack', name: 'sre', url: 'https://hooks.example.com/sre', projects: ['sre'] },
        { type: 'webhook', name: 'audit', url: 'https://audit.example.com', statuses: ['accepted', 'proposed'], headers: { authorization: 'Bearer x' } },
      ] },
    }`);
    change({ 'sre/adr/0001-use-slos.md': record('Use SLOs', 'accepted'), 'payments/rfc/0001-ledger.md': record('Ledger', 'proposed') });
    const { calls, fetch } = recorder();
    const { code, log } = await run(root, { env: { INKAN_SLACK_WEBHOOK: 'https://hooks.example.com/all' }, fetch });
    expect(code).toBe(0);
    expect(log).toBe(
      [
        'payments/rfc/0001-ledger: draft -> proposed',
        'sre/adr/0001-use-slos: proposed -> accepted',
        'sre: sent 1 message (1 record)',
        'audit: sent 1 message (2 records)',
        'inkan-slack-webhook: sent 1 message (1 record)',
      ].join('\n'),
    );
    expect(calls.map((c) => c.url)).toEqual(['https://hooks.example.com/sre', 'https://audit.example.com', 'https://hooks.example.com/all']);
    expect(calls[1].headers).toEqual({ 'content-type': 'application/json', authorization: 'Bearer x' });
    expect(calls[1].body.events.map((e) => e.id)).toEqual(['payments/rfc/0001-ledger', 'sre/adr/0001-use-slos']);
  });

  it('prints the bodies and sends nothing with --dry-run', async () => {
    const { root, change } = repo();
    change({ 'sre/adr/0001-use-slos.md': record('Use SLOs', 'accepted') });
    const { calls, fetch } = recorder();
    const { code, log } = await run(root, { flags: { 'dry-run': true }, env: { INKAN_TEAMS_WEBHOOK: 'https://t' }, fetch });
    expect(code).toBe(0);
    expect(calls).toEqual([]);
    expect(log).toContain('inkan-teams-webhook: would send 1 message [dry run]');
    expect(log).toContain('"type": "AdaptiveCard"');
  });

  it('skips channels without a URL, keeps going after a failure and never prints the URL', async () => {
    const { root, change } = repo(`{ notify: { channels: [{ type: 'slack', name: 'missing', url: process.env.NOPE }, { type: 'slack', url: 'https://hooks.example.com/secret' }] } }`);
    change({ 'sre/adr/0001-use-slos.md': record('Use SLOs', 'accepted') });
    const { calls, fetch: stub } = recorder(403);
    const fetch = async (url, init) => {
      await stub(url, init);
      return new Response(`invalid_token for ${url}`, { status: 403, statusText: 'Forbidden' });
    };
    const { code, log } = await run(root, { fetch });
    expect(code).toBe(1);
    expect(log).toContain('missing: skipped, no URL');
    expect(log).toContain('slack#2: failed, 403 Forbidden: invalid_token for <webhook URL>');
    expect(calls).toHaveLength(1);
    expect(log).not.toContain('hooks.example.com');
  });

  it('keeps the URL out of network errors', async () => {
    const { root, change } = repo(`{ notify: { channels: [{ type: 'teams', url: 'not a url/secret' }] } }`);
    change({ 'sre/adr/0001-use-slos.md': record('Use SLOs', 'accepted') });
    const { code, log } = await run(root);
    expect(code).toBe(1);
    expect(log).toMatch(/teams: failed, /);
    expect(log).not.toContain('not a url');
  });

  it('does nothing without changes, channels or a previous commit', async () => {
    const { root, change } = repo();
    change({ 'sre/adr/0002-use-slis.md': record('Use SLIs, edited', 'accepted') });
    expect((await run(root)).log).toBe('No records moved into accepted since HEAD~1.');
    change({ 'sre/adr/0001-use-slos.md': record('Use SLOs', 'accepted') });
    expect((await run(root)).log).toContain('No notification channels');
    const event = path.join(root, 'event.json');
    fs.writeFileSync(event, JSON.stringify({ before: '0'.repeat(40) }));
    const first = await run(root, { flags: { since: undefined }, env: { GITHUB_ACTIONS: 'true', GITHUB_EVENT_PATH: event } });
    expect(first).toEqual({ code: 0, log: 'No previous commit to compare with (first push of a branch); nothing to notify.' });
  });

  it('rejects unknown statuses in the config', async () => {
    const { root } = repo(`{ notify: { statuses: ['acepted'] } }`);
    await expect(run(root)).rejects.toThrow('notify: unknown status "acepted". Did you mean "accepted"?');
  });

  it('rejects webhook-only options on chat channels', async () => {
    const { root } = repo(`{ notify: { channels: [{ type: 'slack', url: 'https://x', headers: { a: 'b' } }] } }`);
    await expect(run(root)).rejects.toThrow('headers and body only apply to webhook channels');
  });
});
