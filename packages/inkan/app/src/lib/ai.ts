import { site, docTypes, statuses } from './config';
import { formatDate, getDecisions, getProjects, sourcePath, type Decision } from './decisions';
import { markdownUrl } from './markdown';
import { getPages } from './pages';

export const absolute = (href: string) => new URL(href, site.url).toString();

export function metaLines(d: Decision) {
  return [
    d.ref && `ref: ${d.ref}`,
    `type: ${d.type}`,
    `project: ${d.project}`,
    d.status && `status: ${d.status}`,
    d.date && `date: ${formatDate(d.date)}`,
    d.authors.length && `authors: ${d.authors.join(', ')}`,
    d.deciders.length && `deciders: ${d.deciders.join(', ')}`,
    d.rfcReview.reviewers.length && `reviewers: ${d.rfcReview.reviewers.map((r) => `${r.handle} (${r.state})`).join(', ')}`,
    d.rfcReview.reviewers.length && `rfc_review: ${d.rfcReview.status}${d.rfcReview.waitingOn.length ? `, waiting on ${d.rfcReview.waitingOn.join(', ')}` : ''}`,
    d.tags.length && `tags: ${d.tags.join(', ')}`,
    ...Object.entries(d.fields).map(([name, value]) => `${name}: ${Array.isArray(value) ? value.join(', ') : value}`),
    d.supersedes.length && `supersedes: ${d.supersedes.join(', ')}`,
    d.supersededBy.length && `superseded_by: ${d.supersededBy.join(', ')}`,
    d.review && `next_review: ${d.review.due}`,
    `url: ${absolute(d.href)}`,
    `markdown: ${absolute(markdownUrl(d))}`,
    `source: ${sourcePath(d.entry)}`,
  ].filter(Boolean) as string[];
}

export async function llmsIndex() {
  const decisions = await getDecisions();
  const projects = await getProjects();
  const out = [
    `# ${site.title}`,
    '',
    `> ${site.description}`,
    '',
    `Types: ${Object.entries(docTypes).map(([k, v]) => `${k} (${v.description})`).join(', ')}.`,
    `Statuses: ${Object.keys(statuses).join(', ')}. Only "accepted"/"implemented" records describe the current state; "superseded" ones point to their replacement.`,
    `Full text of every record: ${absolute('llms-full.txt')}. Machine-readable index: ${absolute('decisions.json')}, link graph: ${absolute('graph.json')}.`,
    'Every link below points to the raw Markdown of the record; drop the ".md" suffix and add "/" for the HTML page.',
  ];
  for (const p of projects) {
    const mine = decisions.filter((d) => d.project === p.id);
    out.push('', `## ${p.data.name} (${p.id})`, '');
    if (p.data.description) out.push(p.data.description, '');
    for (const d of mine) {
      out.push(`- [${d.ref ?? d.title}: ${d.title}](${absolute(markdownUrl(d))}) [${d.status ?? 'n/a'}]${d.description ? `: ${d.description}` : ''}`);
    }
  }
  const pages = await getPages();
  if (pages.length) {
    out.push('', '## Pages', '');
    for (const p of pages) out.push(`- [${p.data.title}](${absolute(markdownUrl(p))})${p.data.description ? `: ${p.data.description}` : ''}`);
  }
  return out.join('\n') + '\n';
}

export async function llmsFull() {
  const decisions = await getDecisions();
  return decisions
    .map((d) => [`# ${d.title}`, '', '```yaml', ...metaLines(d), '```', '', (d.entry.body ?? '').trim()].join('\n'))
    .join('\n\n---\n\n') + '\n';
}

export async function decisionsJson() {
  const decisions = await getDecisions();
  return decisions.map((d) => ({
    id: d.id,
    ref: d.ref,
    title: d.title,
    description: d.description ?? null,
    type: d.type,
    project: d.project,
    status: d.status ?? null,
    date: d.date ? formatDate(d.date) : null,
    authors: d.authors,
    deciders: d.deciders,
    reviewers: d.rfcReview.reviewers,
    rfcReview: {
      status: d.rfcReview.status,
      approved: d.rfcReview.approved,
      required: d.rfcReview.required,
      waitingOn: d.rfcReview.waitingOn,
    },
    tags: d.tags,
    fields: d.fields,
    supersedes: d.supersedes,
    supersededBy: d.supersededBy,
    related: d.related,
    review: d.review && { due: d.review.due, reviewed: d.review.reviewed, every: d.review.every },
    codeRefs: d.codeRefs,
    history: d.history.map((h) => ({ status: h.status ?? null, date: h.date.toISOString(), author: h.author, commit: h.commit, url: h.href ?? null })),
    url: absolute(d.href),
    markdown: absolute(markdownUrl(d)),
    source: sourcePath(d.entry),
  }));
}
