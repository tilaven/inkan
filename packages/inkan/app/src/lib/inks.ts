import { closest } from '../../../lib/config.mjs';
import { hash } from './rng';
import { motifKeywords, motifNames } from './motif-registry';
import { sameWord, teamWords } from './words';

export const INKS = ['c', 'm', 'y', 'g', 'v', 'o'] as const;
export type Ink = (typeof INKS)[number];
export type Motif = string;

export interface ProjectStyle {
  id: string;
  name: string;
  ink: Ink;
  motif: Motif;
}

export interface ProjectStyleInput {
  id: string;
  name?: string;
  /** From `_project.yml`; an unknown motif throws. */
  ink?: Ink | null;
  motif?: string | null;
}

export interface StylePalette {
  inks?: readonly Ink[];
  motifs?: readonly Motif[];
  keywords?: Readonly<Record<Motif, readonly string[]>>;
}


/** Fails the build for a `motif:` nobody registered, naming the available ones. */
export function checkMotif(id: string, motif: string, motifs: readonly string[]) {
  if (motifs.includes(motif)) return;
  const hint = closest(motif, [...motifs]);
  throw new Error(
    `inkan: project "${id}": unknown motif "${motif}"${hint ? `, did you mean "${hint}"?` : ''} (available: ${[...motifs].sort().join(', ')})`,
  );
}

const key = (ink: Ink, motif: Motif) => `${ink}:${motif}`;
/** Code-unit order, so the allocation is the same on every machine. */
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Gives every project an (ink, motif) pair no other project has, as long as pairs remain. Values pinned in
 * `_project.yml` are reserved first and always kept; the rest is allocated in id order from a per-project
 * preference list (a stable hash), so adding an unpinned project later in id order changes nobody else's style.
 * A pinned project is reserved before every unpinned one, so adding a pin can move earlier unpinned projects.
 * Half pins avoid the motifs and inks other half pins need; two projects pinning the same pair share it.
 * A project without a pinned motif prefers motifs whose keywords appear in its id or name (`security` → shield)
 * while that motif still has a free ink; after that the next free pair is used.
 */
export function assignStyles(projects: ProjectStyleInput[], { inks = INKS, motifs = motifNames(), keywords = motifKeywords() }: StylePalette = {}): Map<string, ProjectStyle> {
  const taken = new Set<string>();
  const styles = new Map<string, ProjectStyle>();
  const settle = (p: ProjectStyleInput, ink: Ink, motif: Motif) => {
    taken.add(key(ink, motif));
    styles.set(p.id, { id: p.id, name: p.name ?? p.id, ink, motif });
  };
  const pick = (p: ProjectStyleInput, ink?: Ink, motif?: Motif) => {
    const contested = (c: { ink: Ink; motif: Motif }) => (ink ? needMotif.has(c.motif) : motif ? needInk.has(c.ink) : false);
    const own = teamWords(`${p.id} ${p.name ?? ''}`);
    const fits = (m: Motif) => (keywords[m] ?? []).some((k) => own.some((w) => sameWord(w, k)));
    const rank = (c: { ink: Ink; motif: Motif }) => Number(contested(c)) * 2 + Number(!fits(c.motif));
    const candidates = (ink ? [ink] : inks)
      .flatMap((i) => (motif ? [motif] : motifs).map((m) => ({ ink: i, motif: m, order: hash(`style:${p.id}:${i}:${m}`) })))
      .sort((a, b) => rank(a) - rank(b) || a.order - b.order || compare(key(a.ink, a.motif), key(b.ink, b.motif)));
    const best = candidates.find((c) => !taken.has(key(c.ink, c.motif))) ?? candidates[0];
    settle(p, best.ink, best.motif);
  };

  const queue = [...projects]
    .sort((a, b) => compare(a.id, b.id))
    .map((p) => {
      if (p.motif) checkMotif(p.id, p.motif, motifs);
      return { p, ink: p.ink || undefined, motif: p.motif || undefined };
    });
  const needMotif = new Set(queue.filter((q) => q.motif && !q.ink).map((q) => q.motif));
  const needInk = new Set(queue.filter((q) => q.ink && !q.motif).map((q) => q.ink));
  const pinnedCount = ({ ink, motif }: { ink?: Ink; motif?: Motif }) => Number(Boolean(ink)) + Number(Boolean(motif));
  for (const wanted of [2, 1, 0]) {
    for (const { p, ink, motif } of queue) {
      if (pinnedCount({ ink, motif }) !== wanted) continue;
      if (ink && motif) settle(p, ink, motif);
      else pick(p, ink, motif);
    }
  }
  return styles;
}

/** Style of a project the allocation does not know (not collision-free): a stable pick from the id. */
export function fallbackStyle(id: string, name = id, motifs = motifNames()): ProjectStyle {
  return { id, name, ink: INKS[hash(`ink:${id}`) % INKS.length], motif: motifs[hash(`motif:${id}`) % motifs.length] };
}
