import type { Badge } from './badge';
import { currentStatuses, docTypes } from './config';
import { getAllProjects, getDecisions } from './decisions';

export interface NamedBadge extends Badge {
  /** File name under /badges/ (`records`, `accepted` or a project id). */
  name: string;
}

/** One badge per site (all records, current decisions) and per project. A project named like a fixed badge is skipped. */
export async function getBadges(): Promise<NamedBadge[]> {
  const decisions = await getDecisions();
  const types = Object.values(docTypes);
  const fixed: NamedBadge[] = [
    { name: 'records', label: types.length === 1 ? types[0].plural : 'records', message: String(decisions.length), color: 'blue' },
    { name: 'accepted', label: 'accepted', message: String(decisions.filter((d) => d.status && currentStatuses.includes(d.status)).length), color: 'brightgreen' },
  ];
  const taken = new Set(fixed.map((b) => b.name));
  const projects = (await getAllProjects())
    .filter((p) => !taken.has(p.id))
    .map((p): NamedBadge => ({ name: p.id, label: p.name, message: String(decisions.filter((d) => d.project === p.id).length), color: 'blue' }));
  return [...fixed, ...projects];
}
