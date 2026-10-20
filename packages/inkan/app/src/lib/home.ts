import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { currentStatuses, site } from './config';
import { url, type Decision, type Review } from './decisions';
import { t } from './i18n';

/** Date of the last commit in the repository, so rebuilds of the same tree show the same date; now outside git. */
export function buildDate(): Date {
  const r = spawnSync('git', ['log', '-1', '--format=%ct'], { cwd: site.repoRoot, encoding: 'utf8' });
  const ts = Number(r.stdout?.trim());
  return ts ? new Date(ts * 1000) : new Date();
}

/** The title with its last word as the accent, e.g. "Acme Decisions" -> accent "Decisions". */
export function titleAccent(title: string) {
  const words = title.trim().split(/\s+/);
  return words[words.length - 1] ?? title;
}

export const isCurrent = (d: Decision) => d.status !== undefined && currentStatuses.includes(d.status);

/**
 * Due dates (`YYYY-MM-DD`) of the records on /reviews/: decided records with a periodic review, as `getReviews` lists them.
 * "Review overdue" on the landing is `overdueCount` of these, on the server and again in the browser.
 */
export const reviewDueDates = (reviews: { review: Review }[]) => reviews.map((d) => d.review.due);

export interface Endpoint {
  path: string;
  href: string;
  note: string;
}

/** The repo's AGENTS.md, from the content folder or the site root, if there is one. */
export function agentsFile(): string | undefined {
  return [site.contentDir, site.root].map((dir) => path.join(dir, 'AGENTS.md')).find((f) => fs.existsSync(f));
}

/** Machine-readable outputs of the build, in the order the landing lists them. */
export function agentEndpoints(): Endpoint[] {
  const list: Endpoint[] = [
    { path: '/llms.txt', href: url('llms.txt'), note: t('landing.endpointLlms') },
    { path: '/llms-full.txt', href: url('llms-full.txt'), note: t('landing.endpointLlmsFull') },
    { path: '/decisions.json', href: url('decisions.json'), note: t('landing.endpointJson') },
    { path: '/graph.json', href: url('graph.json'), note: t('landing.endpointGraph') },
  ];
  if (agentsFile()) list.push({ path: '/AGENTS.md', href: url('AGENTS.md'), note: t('landing.endpointAgents') });
  list.push({ path: '/rss.xml', href: url('rss.xml'), note: t('landing.endpointRss') });
  return list;
}

/** Href of a landing link: a path gets the base prefixed, a URL with a scheme stays as it is. */
export const landingHref = (link: string) => (/^[a-z]+:/.test(link) ? link : url(link));

/** Button class of a landing action, see `landing.actions` in the config. */
export const actionClass = (variant?: string) => ({ primary: 'btn--p', secondary: 'btn--s', ghost: 'btn--g' })[variant ?? 'secondary'] ?? 'btn--s';
