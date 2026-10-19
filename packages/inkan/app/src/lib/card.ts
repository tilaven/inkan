import { rng } from './rng';
import { escapeXml } from './xml';

/** Record number as four digits (`0007`); `empty` stands in for a record without one. A dash keeps number columns from collapsing. */
export const pad4 = (num: number | null, empty = '—') => (num == null ? empty : String(num).padStart(4, '0'));

/** Up to two initials from a display name, a handle like `anna.kowalska` or an email. Safe to import from browser scripts. */
export const initials = (name: string) =>
  name
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .map((s) => s[0]!.toUpperCase())
    .slice(0, 2)
    .join('');

/** Decorative data-matrix (17×17 modules), deterministic from the id. */
export function matrixSvg(id: string): string {
  const r = rng(`mx:${id}`);
  const n = 17;
  const finder = (x: number, y: number) => (x < 5 && y < 5) || (x > n - 6 && y < 5) || (x < 5 && y > n - 6);
  let rects = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let on: boolean;
      if (finder(x, y)) {
        const fx = x < 5 ? x : x - (n - 5);
        const fy = y < 5 ? y : y - (n - 5);
        on = fx === 0 || fx === 4 || fy === 0 || fy === 4 || (fx === 2 && fy === 2);
      } else on = r() < 0.48;
      if (on) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`;
    }
  }
  return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${rects}</svg>`;
}

export interface CardRecord {
  id: string;
  type: string;
  status: string;
  date: string;
  tags: string[];
  supersedes: string[];
  supersededBy: string[];
  url: string;
}

/** The JSON on the back of the card, highlighted with `.k` / `.s` spans; the text is valid JSON. */
export function jsonHtml(rec: CardRecord): string {
  const S = (v: string) => `<span class="s">${escapeXml(JSON.stringify(v))}</span>`;
  const A = (a: string[]) => `[${a.map(S).join(', ')}]`;
  const rows: [string, string][] = [
    ['id', S(rec.id)],
    ['type', S(rec.type)],
    ['status', `<b>${S(rec.status)}</b>`],
    ['date', S(rec.date)],
    ['tags', A(rec.tags)],
  ];
  if (rec.supersedes.length) rows.push(['supersedes', A(rec.supersedes)]);
  if (rec.supersededBy.length) rows.push(['superseded_by', A(rec.supersededBy)]);
  rows.push(['url', S(rec.url)]);
  const body = rows.map(([k, v], i) => `  <span class="k">"${k}"</span>: ${v}${i < rows.length - 1 ? ',' : ''}`).join('\n');
  return `{\n${body}\n}`;
}
