import { availableParallelism } from 'node:os';
import path from 'node:path';
import { docTypes, site, statuses } from './config';
import { getAllProjects, getDecisions, getProjectStyles, projectStyle, url, type Decision } from './decisions';
import { pad } from './nav';
import { t } from './i18n';
import { ogPng, type OgCard } from './og';
import { stickerFor } from './stickers';

export const ogEnabled = site.og !== false;
const theme = site.og === false ? 'light' : (site.og.theme ?? 'light');

/** Where a card is served: `/og/<record id>.png`, `/og/<project>.png`, and the site's `/og/index.png` without an id. */
export const ogUrl = (id = 'index') => (ogEnabled ? url(`og/${id}.png`) : undefined);

const options = { theme, fontsDir: path.join(site.appDir, 'src/og/fonts'), cacheDir: path.join(site.root, 'node_modules/.inkan/og') };
/** Keyed by content: endpoint props may be copies of the cards handed to `warmOg`. */
const warming = new Map<string, Promise<unknown>>();
const claimed = new Set<string>();

/** The card as a PNG; when `warmOg` is drawing it, waits for that and reads it from the cache. */
export async function renderOg(card: OgCard) {
  const key = JSON.stringify(card);
  claimed.add(key);
  await warming.get(key)?.catch(() => {});
  warming.delete(key);
  return ogPng(card, options);
}

/**
 * Starts drawing cards into the cache ahead of the endpoint that serves them, one per core on the rasteriser's
 * worker threads: Astro renders endpoints one at a time, so a big archive would otherwise use a single core.
 * Finished cards live on disk, not in memory, however far ahead of the endpoint the lanes get.
 */
export function warmOg(cards: OgCard[]) {
  const queue = cards.values();
  const lane = async () => {
    for (const card of queue) {
      const key = JSON.stringify(card);
      if (claimed.has(key)) continue;
      const job = ogPng(card, options).then(() => undefined);
      warming.set(key, job);
      await job.catch(() => {});
    }
  };
  for (let i = 0; i < availableParallelism(); i++) void lane();
}

export async function recordCards(): Promise<{ id: string; card: OgCard }[]> {
  const [decisions, projects, styles] = await Promise.all([getDecisions(), getAllProjects(), getProjectStyles()]);
  const names = new Map(projects.map((p) => [p.id, p.name]));
  return decisions
    .filter((d): d is Decision & { type: string } => !!d.type)
    .map((d) => {
      const style = styles.get(d.project) ?? projectStyle(d.project);
      const info = d.status && Object.hasOwn(statuses, d.status) ? (statuses[d.status] as { label: string; sticker?: string; color?: string }) : undefined;
      return {
        id: d.id,
        card: {
          kind: 'record',
          site: site.title,
          project: names.get(d.project) ?? d.project,
          type: docTypes[d.type]?.label ?? d.type,
          number: d.number !== null ? pad(d.number) : undefined,
          title: d.title,
          status: d.status ? { status: d.status, label: info?.label ?? d.status, sticker: stickerFor(d.status, info?.sticker), color: info?.color } : undefined,
          date: d.date?.toISOString().slice(0, 10),
          cover: { id: d.id, ink: style.ink, motif: style.motif, project: style.id, status: d.status },
        },
      };
    });
}

function counts(decisions: Decision[]) {
  return Object.entries(docTypes)
    .map(([type, t]) => [decisions.filter((d) => d.type === type).length, t.label] as const)
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}`)
    .join(' · ');
}

export async function projectCards(): Promise<{ id: string; card: OgCard }[]> {
  const [decisions, projects, styles] = await Promise.all([getDecisions(), getAllProjects(), getProjectStyles()]);
  return projects.map((p) => {
    const style = styles.get(p.id) ?? projectStyle(p.id);
    const own = decisions.filter((d) => d.project === p.id);
    return {
      id: p.id,
      card: {
        kind: 'project',
        site: site.title,
        eyebrow: t('og.project'),
        name: p.name,
        description: p.data?.description,
        counts: counts(own) || t('project.recordCount', { count: own.length }),
        cover: { id: p.id, ink: style.ink, motif: style.motif, project: p.id },
      },
    };
  });
}

/**
 * `landing.image` for the site card, as PNG: the rasteriser reads only PNG, JPEG and GIF. The conversion uses sharp,
 * which Astro installs for its image service; without it the card falls back to the covers.
 */
async function landingArt() {
  const image = site.landing.image;
  if (!image) return undefined;
  const file = theme === 'dark' && image.dark ? image.dark : image.src;
  try {
    const { default: sharp } = await import('sharp');
    const { data, info } = await sharp(file).resize({ width: 1040, height: 1040, fit: 'inside', withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
    return { src: `data:image/png;base64,${data.toString('base64')}`, width: info.width, height: info.height };
  } catch (error) {
    console.warn(`[inkan] landing.image is not on the Open Graph card: ${(error as Error).message}`);
    return undefined;
  }
}

/** The site's card, with `landing.image` or else the covers of its three busiest projects. */
export async function siteCard(): Promise<OgCard> {
  const [decisions, projects, styles] = await Promise.all([getDecisions(), getAllProjects(), getProjectStyles()]);
  const size = (id: string) => decisions.filter((d) => d.project === id).length;
  const top = [...projects].sort((a, b) => size(b.id) - size(a.id)).slice(0, 3);
  return {
    kind: 'site',
    title: site.landing.title ?? site.title,
    tagline: site.landing.tagline ?? site.tagline,
    // Like the landing, the card leaves the numbers out without 'stats' and names the site's host instead.
    counts: site.landing.sections.includes('stats') || !site.url
      ? `${t('og.projectCount', { count: projects.length })} · ${t('project.recordCount', { count: decisions.length })}`
      : new URL(site.url).host,
    covers: top.map((p) => {
      const style = styles.get(p.id) ?? projectStyle(p.id);
      return { id: p.id, ink: style.ink, motif: style.motif, project: p.id };
    }),
    art: await landingArt(),
  };
}
