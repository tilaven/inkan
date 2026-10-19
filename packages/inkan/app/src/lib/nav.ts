/** Builds the sidebar from the content itself: no config needed for new files or projects. */
import { pad4 } from './card';
import { docTypes, openStatuses } from './config';
import { buildGraph } from './graph';
import { introOf } from './team';
import { t } from './i18n';
import type { Ink } from './inks';
import { getAllProjects, getDocs, getProjectStyles, projectHref, projectStyle, toDecision, url, type Decision } from './decisions';

export interface Crumb {
  label: string;
  href?: string;
}
export interface HubLink {
  label: string;
  href: string;
  count?: number;
}
export interface RecordLink {
  href: string;
  title: string;
  number: string;
  status?: string;
}
export interface PageLink {
  href: string;
  title: string;
}
export interface TypeGroup {
  type: string;
  label: string;
  items: RecordLink[];
}
export interface ProjectNav {
  id: string;
  name: string;
  href: string;
  ink: Ink;
  count: number;
  groups: TypeGroup[];
  pages: PageLink[];
}
export interface Nav {
  hub: HubLink[];
  /** Markdown pages at the root of the content folder. */
  pages: PageLink[];
  projects: ProjectNav[];
}

/** `pad4` with nothing for an unnumbered record: titles, breadcrumbs and the tree read better without a dash. */
export const pad = (n: number | null) => pad4(n, '');

const byNumber = (a: Decision, b: Decision) => (a.number ?? 0) - (b.number ?? 0) || a.id.localeCompare(b.id);
const byOrder = (a: Decision, b: Decision) =>
  (a.entry.data.order ?? 0) - (b.entry.data.order ?? 0) || a.title.localeCompare(b.title);

let cache: Nav | undefined;

export async function getNav(): Promise<Nav> {
  if (cache && import.meta.env.PROD) return cache;
  const docs = (await getDocs()).map(toDecision);
  const records = docs.filter((d) => d.type !== null);
  const projects = await getAllProjects();
  const styles = await getProjectStyles();

  const inReview = records.filter((d) => d.rfcReview.status !== 'none' && d.status && openStatuses.includes(d.status));
  const linked = buildGraph(records).nodes.length;
  const hub: HubLink[] = [
    { label: t('shell.home'), href: url('/') },
    { label: t('shell.allDecisions'), href: url('decisions/'), count: records.length },
    { label: t('nav.timeline'), href: url('timeline/') },
    { label: t('nav.graph'), href: url('graph/'), count: linked },
    { label: t('nav.backlog'), href: url('backlog/'), count: records.filter((d) => d.status && openStatuses.includes(d.status)).length },
    ...(records.some((d) => d.review) ? [{ label: t('nav.reviews'), href: url('reviews/'), count: records.filter((d) => d.review).length }] : []),
    ...(inReview.length ? [{ label: t('nav.rfcReviews'), href: url('rfc-reviews/'), count: inReview.length }] : []),
    { label: t('shell.authors'), href: url('authors/'), count: new Set(records.flatMap((d) => [...d.authors, ...d.deciders])).size },
    { label: t('shell.tags'), href: url('tags/'), count: new Set(records.flatMap((d) => d.tags)).size },
  ];

  const projectNavs: ProjectNav[] = projects.map(({ id, name }) => {
    const mine = docs.filter((d) => d.project === id && !introOf(d.id));
    const groups = Object.keys(docTypes)
      .map((type) => ({
        type,
        label: docTypes[type].label,
        items: mine
          .filter((d) => d.type === type)
          .sort(byNumber)
          .map((d) => ({ href: d.href, title: d.title, number: pad(d.number), status: d.status })),
      }))
      .filter((g) => g.items.length > 0);
    return {
      id,
      name,
      href: projectHref(id),
      ink: (styles.get(id) ?? projectStyle(id)).ink,
      count: mine.filter((d) => d.type !== null).length,
      groups,
      pages: mine.filter((d) => d.type === null).sort(byOrder).map((d) => ({ href: d.href, title: d.title })),
    };
  });

  cache = {
    hub,
    pages: docs.filter((d) => !d.id.includes('/')).sort(byOrder).map((d) => ({ href: d.href, title: d.title })),
    projects: projectNavs,
  };
  return cache;
}

const norm = (p: string) => (p.endsWith('/') ? p : `${p}/`);
export const isCurrent = (href: string, pathname: string) => norm(href) === norm(pathname);

/** Previous/next record of the same project and type, in number order. */
export function prevNext(nav: Nav, pathname: string) {
  for (const project of nav.projects) {
    for (const group of project.groups) {
      const i = group.items.findIndex((l) => isCurrent(l.href, pathname));
      if (i === -1) continue;
      return { project, group, prev: group.items[i - 1], next: group.items[i + 1] };
    }
  }
  return {};
}
