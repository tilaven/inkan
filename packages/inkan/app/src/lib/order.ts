/** Sidebar order of records within a type group, see the `sidebar.sort` option. */
export type SidebarSort = 'newest' | 'oldest' | 'number';

interface Sortable {
  id: string;
  number: number | null;
  date?: Date | null;
}

export const byNumber = (a: Sortable, b: Sortable) => (a.number ?? 0) - (b.number ?? 0) || a.id.localeCompare(b.id);

/** By date (undated records last), then by number in the same direction. */
export function recordOrder(sort: SidebarSort) {
  if (sort === 'number') return byNumber;
  const dir = sort === 'oldest' ? 1 : -1;
  const time = (r: Sortable) => (r.date && !Number.isNaN(r.date.getTime()) ? r.date.getTime() : null);
  return (a: Sortable, b: Sortable) => {
    const ta = time(a);
    const tb = time(b);
    if ((ta === null) !== (tb === null)) return ta === null ? 1 : -1;
    return dir * ((ta ?? 0) - (tb ?? 0) || byNumber(a, b));
  };
}
