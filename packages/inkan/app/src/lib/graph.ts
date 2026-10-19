/** Decision graph: `supersedes` and `related` links between records, laid out in project lanes over time. */
import { fallbackStyle, type Ink, type ProjectStyle } from './inks';

export type EdgeKind = 'supersedes' | 'related';

/** The fields of a `Decision` the graph needs. */
export interface GraphRecord {
  id: string;
  href: string;
  title: string;
  project: string;
  ref: string | null;
  number: number | null;
  status?: string;
  date?: Date;
  supersedes: string[];
  supersededBy: string[];
  related: string[];
}

export interface GraphNode {
  id: string;
  href: string;
  title: string;
  project: string;
  ref: string | null;
  number: number | null;
  status?: string;
  /** `YYYY-MM-DD`. */
  date?: string;
  /** Number of edges touching the node. */
  degree: number;
}

/** `supersedes`: `from` is the newer record, `to` the one it replaces. `related`: undirected, `from` < `to`. */
export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface DecisionGraph {
  /** Records with at least one resolved edge. */
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Links with an end that is not a record; that end is the normalised reference as written. Directions as in `edges`. */
  dangling: GraphEdge[];
  /** Records without any link. */
  unlinked: number;
}

export interface Lane {
  project: string;
  name: string;
  ink: Ink;
  y: number;
  height: number;
}

export interface Column {
  /** `YYYY-MM`, or `undated`. */
  key: string;
  /** `MAR`, or `—` for undated. */
  label: string;
  /** Set on the first column of each year. */
  year?: string;
  x: number;
}

export interface PlacedNode extends GraphNode {
  x: number;
  y: number;
  ink: Ink;
}

export interface PlacedEdge extends GraphEdge {
  /** SVG path data; for `supersedes` it ends at the newer record so the marker points along time. */
  d: string;
}

export interface GraphLayout {
  width: number;
  height: number;
  nodeWidth: number;
  nodeHeight: number;
  lanes: Lane[];
  columns: Column[];
  nodes: PlacedNode[];
  edges: PlacedEdge[];
}

export interface LayoutOptions {
  colWidth?: number;
  rowHeight?: number;
  nodeWidth?: number;
  nodeHeight?: number;
  /** Space left of the first column for lane names. */
  gutter?: number;
  /** Space above the first lane for the month header. */
  header?: number;
  lanePad?: number;
}

/** `/sre/adr/0001-x.md` or `./SRE/adr/0001-x/` -> `sre/adr/0001-x`. */
export const normalizeRef = (ref: string) =>
  ref.trim().replace(/^(?:\.{1,2}\/|\/)+|\/+$/g, '').replace(/\.mdx?$/i, '').toLowerCase();

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const day = (d?: Date) => (d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : undefined);
const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en', { month: 'short', timeZone: 'UTC' }).toUpperCase();

/** Resolves the links of `records` into nodes and deduplicated edges; unresolved targets end up in `dangling`. */
export function buildGraph(records: GraphRecord[]): DecisionGraph {
  const byId = new Map(records.map((r) => [r.id, r]));
  const supersedes = new Map<string, GraphEdge>();
  const related = new Map<string, GraphEdge>();
  const dangling = new Map<string, GraphEdge>();
  const pair = (a: string, b: string) => `${a}\0${b}`;

  /** `newer`: whether `self` is the superseding end of a `supersedes` link. */
  const link = (self: string, ref: string, kind: EdgeKind, newer = true) => {
    const target = normalizeRef(ref);
    if (!target || target === self) return;
    if (kind === 'related') {
      if (!byId.has(target)) dangling.set(pair(self, target) + kind, { from: self, to: target, kind });
      else {
        const [from, to] = self < target ? [self, target] : [target, self];
        related.set(pair(from, to), { from, to, kind });
      }
      return;
    }
    const [from, to] = newer ? [self, target] : [target, self];
    (byId.has(target) ? supersedes : dangling).set(pair(from, to) + kind, { from, to, kind });
  };

  for (const r of records) {
    for (const ref of r.supersedes) link(r.id, ref, 'supersedes');
    for (const ref of r.supersededBy) link(r.id, ref, 'supersedes', false);
    for (const ref of r.related) link(r.id, ref, 'related');
  }

  const edges = [...supersedes.values()];
  for (const [key, e] of related) {
    if (!supersedes.has(pair(e.from, e.to) + 'supersedes') && !supersedes.has(pair(e.to, e.from) + 'supersedes')) edges.push(e);
    else related.delete(key);
  }
  edges.sort((a, b) => compare(a.kind, b.kind) || compare(a.from, b.from) || compare(a.to, b.to));

  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  const nodes = records
    .filter((r) => degree.has(r.id))
    .sort((a, b) => compare(a.id, b.id))
    .map<GraphNode>((r) => ({
      id: r.id,
      href: r.href,
      title: r.title,
      project: r.project,
      ref: r.ref,
      number: r.number,
      ...(r.status === undefined ? {} : { status: r.status }),
      ...(day(r.date) === undefined ? {} : { date: day(r.date) }),
      degree: degree.get(r.id)!,
    }));

  return {
    nodes,
    edges,
    dangling: [...dangling.values()].sort((a, b) => compare(a.from, b.from) || compare(a.to, b.to) || compare(a.kind, b.kind)),
    unlinked: records.length - nodes.length,
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** How far an edge between nodes of the same column bulges out to the right before coming back. */
const EDGE_LOOP_OFFSET = 48;
/** An edge leaves and enters its nodes horizontally; the control points sit at least this far out, else half the gap. */
const EDGE_CONTROL_MIN = 40;

/** Cubic curve from the side of `a` to the side of `b`, horizontal at both ends; a loop when the nodes share a column. */
function routeEdge(a: PlacedNode, b: PlacedNode, nodeWidth: number, nodeHeight: number): string {
  const ay = a.y + nodeHeight / 2;
  const by = b.y + nodeHeight / 2;
  if (b.x === a.x) {
    const x1 = a.x + nodeWidth;
    return `M${r1(x1)} ${r1(ay)}C${r1(x1 + EDGE_LOOP_OFFSET)} ${r1(ay)} ${r1(x1 + EDGE_LOOP_OFFSET)} ${r1(by)} ${r1(x1)} ${r1(by)}`;
  }
  const right = b.x > a.x;
  const x1 = right ? a.x + nodeWidth : a.x;
  const x2 = right ? b.x : b.x + nodeWidth;
  const off = Math.max(EDGE_CONTROL_MIN, Math.abs(x2 - x1) / 2) * (right ? 1 : -1);
  return `M${r1(x1)} ${r1(ay)}C${r1(x1 + off)} ${r1(ay)} ${r1(x2 - off)} ${r1(by)} ${r1(x2)} ${r1(by)}`;
}

/** Places the nodes of `graph` in project lanes (rows) and month columns and routes the edges between them. */
export function layoutGraph(graph: DecisionGraph, styles: Map<string, ProjectStyle>, order: string[], options: LayoutOptions = {}): GraphLayout {
  const { colWidth = 176, rowHeight = 56, nodeWidth = 152, nodeHeight = 44, gutter = 132, header = 48, lanePad = 12 } = options;

  const used = new Set(graph.nodes.map((n) => n.project));
  const projects = [...order.filter((p, i) => used.has(p) && order.indexOf(p) === i), ...[...used].filter((p) => !order.includes(p)).sort(compare)];

  const months = [...new Set(graph.nodes.flatMap((n) => (n.date ? [n.date.slice(0, 7)] : [])))].sort(compare);
  const keys = graph.nodes.some((n) => !n.date) ? [...months, 'undated'] : months;
  const columns: Column[] = [];
  const colIndex = new Map<string, number>();
  let lastYear = '';
  keys.forEach((key, i) => {
    colIndex.set(key, i);
    const col: Column = { key, label: key === 'undated' ? '—' : monthLabel(key), x: gutter + i * colWidth };
    const year = key.slice(0, 4);
    if (key !== 'undated' && year !== lastYear) {
      col.year = year;
      lastYear = year;
    }
    columns.push(col);
  });

  const cells = new Map<string, GraphNode[]>();
  for (const n of graph.nodes) {
    const k = `${n.project}\0${n.date ? n.date.slice(0, 7) : 'undated'}`;
    const cell = cells.get(k);
    if (cell) cell.push(n);
    else cells.set(k, [n]);
  }
  for (const cell of cells.values()) cell.sort((a, b) => compare(a.date ?? '', b.date ?? '') || compare(a.id, b.id));

  const lanes: Lane[] = [];
  const nodes: PlacedNode[] = [];
  const placed = new Map<string, PlacedNode>();
  let y = header;
  for (const project of projects) {
    const style = styles.get(project) ?? fallbackStyle(project);
    let rows = 1;
    for (const key of keys) rows = Math.max(rows, cells.get(`${project}\0${key}`)?.length ?? 0);
    const height = lanePad * 2 + rows * rowHeight - (rowHeight - nodeHeight);
    lanes.push({ project, name: style.name, ink: style.ink, y, height });
    for (const key of keys) {
      const x = columns[colIndex.get(key)!].x + (colWidth - nodeWidth) / 2;
      (cells.get(`${project}\0${key}`) ?? []).forEach((n, r) => {
        const p: PlacedNode = { ...n, x, y: y + lanePad + r * rowHeight, ink: style.ink };
        nodes.push(p);
        placed.set(n.id, p);
      });
    }
    y += height;
  }

  const edges = graph.edges.flatMap<PlacedEdge>((e) => {
    const [a, b] = e.kind === 'supersedes' ? [placed.get(e.to), placed.get(e.from)] : [placed.get(e.from), placed.get(e.to)];
    if (!a || !b) return [];
    return [{ ...e, d: routeEdge(a, b, nodeWidth, nodeHeight) }];
  });

  return {
    width: gutter + keys.length * colWidth + 24,
    height: y + 16,
    nodeWidth,
    nodeHeight,
    lanes,
    columns,
    nodes,
    edges,
  };
}
