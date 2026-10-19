import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { blobUrl } from './coderefs.mjs';
import { realpath } from './git.mjs';
import { defaults } from './defaults.mjs';
import { asList, loadAuthors, loadProjects, loadRecords, parseFrontMatter, repoSourceOf } from './records.mjs';
import { protectedMatcher, protectedProjects } from './auth/protect.mjs';

/** Above this many changes in one run, chat channels get a single digest instead of one message per record. */
export const DIGEST_AFTER = 5;
const DIGEST_LINES = 20;
const ZERO_SHA = /^0+$/;

/** Webhooks that need no config entry: the URL comes from the environment (a CI secret). */
export const ENV_CHANNELS = [
  ['slack', 'INKAN_SLACK_WEBHOOK'],
  ['teams', 'INKAN_TEAMS_WEBHOOK'],
  ['webhook', 'INKAN_WEBHOOK'],
];

const git = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024 });

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

/**
 * The commit a CI run should compare against: the push's previous head on GitHub Actions and GitLab CI,
 * the base of a pull or merge request, `HEAD~1` elsewhere. Null when the pipeline has no previous commit (a new branch).
 */
export function defaultSince(env = process.env) {
  if (env.GITHUB_ACTIONS === 'true' && env.GITHUB_EVENT_PATH) {
    const event = readJson(env.GITHUB_EVENT_PATH);
    const sha = event?.pull_request?.base?.sha ?? event?.before;
    if (sha) return ZERO_SHA.test(sha) ? null : sha;
  }
  if (env.GITLAB_CI === 'true') {
    const sha = env.CI_MERGE_REQUEST_DIFF_BASE_SHA || env.CI_COMMIT_BEFORE_SHA;
    if (sha) return ZERO_SHA.test(sha) ? null : sha;
  }
  return 'HEAD~1';
}

/** Files changed since `since` (working tree included), as absolute new path → repository-relative old path (null when added). */
function changedFiles(repoRoot, since) {
  const verify = git(['rev-parse', '--verify', '--quiet', `${since}^{commit}`], repoRoot);
  if (verify.status !== 0) {
    throw new Error(`Cannot compare with "${since}": no such commit in this clone. Fetch more history (actions/checkout fetch-depth: 0, GIT_DEPTH: 0) or pass --since <ref>.`);
  }
  const r = git(['diff', '--name-status', '-z', '-M', since, '--'], repoRoot);
  if (r.status !== 0) throw new Error(`git diff ${since} failed: ${r.stderr.trim()}`);
  const tokens = r.stdout.split('\0');
  const changed = new Map();
  for (let i = 0; i < tokens.length - 1; ) {
    const status = tokens[i++];
    if (status.startsWith('R') || status.startsWith('C')) {
      const from = tokens[i++];
      changed.set(path.join(repoRoot, tokens[i++]), status.startsWith('R') ? from : null);
    } else {
      const file = tokens[i++];
      if (status !== 'D') changed.set(path.join(repoRoot, file), status === 'A' ? null : file);
    }
  }
  return changed;
}

const text = (v) => (v == null || v === '' ? null : String(v));

/** The configured public URL, or null while it is still the localhost default. */
export const siteUrl = (config) => (config.url && config.url !== defaults.url ? config.url : null);

/** Public link to a record: the site when `url` is set, else the file in the repository, else null. */
export function recordUrl(config, record, file) {
  const site = siteUrl(config);
  if (site) return new URL(`${config.base.replace(/\/+$/, '')}/${record.id}/`, site.replace(/\/*$/, '/')).toString();
  return blobUrl(config.repo, file) ?? null;
}

/**
 * Records whose status changed since `since` into one of `statuses`, with everything a message needs.
 * Records added in that range count as changed from no status. Records of `repo` sources are skipped:
 * their history lives in their own repository. So are protected records (a protected project or a
 * `protectedRoutes` match): a chat channel is not a place only members can see.
 */
export function statusChanges(config, { since, statuses }) {
  const changed = changedFiles(config.repoRoot, since);
  const projects = loadProjects(config);
  const authors = loadAuthors(config.contentDir);
  const isProtected = protectedMatcher(config, protectedProjects(config));
  const label = (status) => (status ? (config.statuses[status]?.label ?? status) : null);
  const events = [];
  for (const record of loadRecords(config)) {
    if (repoSourceOf(config, record.file) || isProtected(`/${record.id}/`)) continue;
    const file = realpath(record.file);
    if (!changed.has(file)) continue;
    const status = text(record.data.status);
    if (!status || !statuses.includes(status)) continue;
    const old = changed.get(file);
    const before = old ? git(['show', `${since}:${old}`], config.repoRoot) : null;
    const previous = before?.status === 0 ? text(parseFrontMatter(before.stdout).data.status) : null;
    if (previous === status) continue;
    const rel = path.relative(config.repoRoot, file).split(path.sep).join('/');
    events.push({
      id: record.id,
      ref: record.ref,
      title: text(record.data.title) ?? record.id,
      description: text(record.data.description),
      project: record.project,
      projectName: text(projects.get(record.project)?.data?.name) ?? record.project,
      type: record.type,
      typeLabel: config.docTypes[record.type]?.label ?? record.type,
      status,
      statusLabel: label(status),
      previousStatus: previous,
      previousStatusLabel: label(previous),
      authors: asList(record.data.authors).map((handle) => text(authors[handle]?.name) ?? handle),
      tags: asList(record.data.tags),
      url: recordUrl(config, record, rel),
      file: rel,
    });
  }
  return events.sort((a, b) => a.id.localeCompare(b.id));
}

/** Configured channels plus the ones named by environment variables; channels without a URL stay in the list, marked `url: null`. */
export function resolveChannels(config, env = process.env) {
  const channels = (config.notify?.channels ?? []).map((c) => ({ ...c, url: c.url || null }));
  for (const [type, name] of ENV_CHANNELS) {
    if (env[name]) channels.push({ type, name: name.toLowerCase().replaceAll('_', '-'), url: env[name] });
  }
  return channels.map((c, i) => ({ ...c, name: c.name ?? `${c.type}${channels.filter((o) => o.type === c.type).length > 1 ? `#${i + 1}` : ''}` }));
}

/** The events one channel receives: its own `statuses` replace the global list, `projects` and `types` narrow it down. */
export const eventsFor = (channel, events, statuses) =>
  events.filter(
    (e) =>
      (channel.statuses?.length ? channel.statuses : statuses).includes(e.status) &&
      (!channel.projects?.length || channel.projects.includes(e.project)) &&
      (!channel.types?.length || channel.types.includes(e.type)),
  );

const heading = (e) => (e.ref ? `${e.ref}: ${e.title}` : e.title);
/** Long descriptions are cut: Slack rejects sections over 3000 characters. */
const summary = (s) => (s.length > 500 ? `${s.slice(0, 499).trimEnd()}…` : s);
const transition = (e) => (e.previousStatusLabel ? `${e.previousStatusLabel} → ${e.statusLabel}` : e.statusLabel);
const digestTitle = (events, site) => `${events.length} records changed status${site.title ? ` in ${site.title}` : ''}`;

/** Slack mrkdwn: `&`, `<` and `>` are the only characters with a meaning that must be escaped. */
const slackEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slackLink = (url, label) => (url ? `<${url}|${slackEscape(label)}>` : slackEscape(label));

function slackRecord(e) {
  const meta = [e.projectName, e.typeLabel, transition(e), e.authors.join(', ')].filter(Boolean).map(slackEscape).join(' · ');
  return {
    text: `${heading(e)} is now ${e.statusLabel}`,
    unfurl_links: false,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `*${slackLink(e.url, heading(e))}*${e.description ? `\n${slackEscape(summary(e.description))}` : ''}` } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: meta }] },
    ],
  };
}

function slackDigest(events, site) {
  const lines = events.slice(0, DIGEST_LINES).map((e) => `• ${slackLink(e.url, heading(e))} · ${slackEscape(transition(e))}`);
  if (events.length > DIGEST_LINES) lines.push(`…and ${events.length - DIGEST_LINES} more${site.url ? ` on ${slackLink(site.url, site.title || site.url)}` : ''}`);
  return {
    text: digestTitle(events, site),
    unfurl_links: false,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `*${slackEscape(digestTitle(events, site))}*` } },
      { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
    ],
  };
}

/** Teams Workflows (and classic incoming webhooks) take an Adaptive Card wrapped in a message. */
const teamsCard = (body, actions = []) => ({
  type: 'message',
  attachments: [
    {
      contentType: 'application/vnd.microsoft.card.adaptive',
      contentUrl: null,
      content: { $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.4', msteams: { width: 'Full' }, body, actions },
    },
  ],
});

function teamsRecord(e) {
  const facts = [
    { title: 'Status', value: transition(e) },
    e.authors.length && { title: 'Authors', value: e.authors.join(', ') },
  ].filter(Boolean);
  return teamsCard(
    [
      { type: 'TextBlock', text: `${e.projectName} · ${e.typeLabel}`, size: 'Small', isSubtle: true, wrap: true },
      { type: 'TextBlock', text: heading(e), size: 'Medium', weight: 'Bolder', wrap: true },
      e.description && { type: 'TextBlock', text: summary(e.description), wrap: true },
      { type: 'FactSet', facts },
    ].filter(Boolean),
    e.url ? [{ type: 'Action.OpenUrl', title: 'Open record', url: e.url }] : [],
  );
}

function teamsDigest(events, site) {
  const lines = events.slice(0, DIGEST_LINES).map((e) => `- ${e.url ? `[${heading(e).replace(/[[\]]/g, '\\$&')}](${e.url.replace(/\)/g, '%29')})` : heading(e)} · ${transition(e)}`);
  if (events.length > DIGEST_LINES) lines.push(`- …and ${events.length - DIGEST_LINES} more`);
  return teamsCard(
    [
      { type: 'TextBlock', text: digestTitle(events, site), size: 'Medium', weight: 'Bolder', wrap: true },
      { type: 'TextBlock', text: lines.join('\n'), wrap: true },
    ],
    site.url ? [{ type: 'Action.OpenUrl', title: 'Open site', url: site.url }] : [],
  );
}

/**
 * Request bodies for one channel: one per record for Slack and Teams (a digest above `DIGEST_AFTER`),
 * a single `{ site, events }` document for `webhook`, or whatever its `body` function returns.
 */
export function payloads(channel, events, site) {
  if (channel.type === 'webhook') return [channel.body ? channel.body({ site, events }) : { site, events }];
  const [one, digest] = channel.type === 'slack' ? [slackRecord, slackDigest] : [teamsRecord, teamsDigest];
  return events.length > DIGEST_AFTER ? [digest(events, site)] : events.map(one);
}

/** POSTs one JSON body. Errors never include the URL: webhook URLs are secrets. */
export async function post(channel, body, { fetch = globalThis.fetch, timeout = 10_000 } = {}) {
  let res;
  try {
    res = await fetch(channel.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...channel.headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    const e = /** @type {{ name?: string, message?: string, cause?: { message?: string } }} */ (error ?? {});
    const message = e.name === 'TimeoutError' ? `no answer within ${timeout / 1000}s` : (e.cause?.message ?? e.message ?? String(error));
    throw new Error(message.replaceAll(channel.url, '<webhook URL>'));
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).replaceAll(channel.url, '<webhook URL>').trim().slice(0, 200);
    throw new Error(`${res.status} ${res.statusText}${detail ? `: ${detail}` : ''}`);
  }
}
