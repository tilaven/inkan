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
  const dir = sort === 'newest' ? -1 : 1;
  return (a: Sortable, b: Sortable) => {
    if (!a.date !== !b.date) return a.date ? -1 : 1;
    return dir * ((a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0) || byNumber(a, b));
  };
}
