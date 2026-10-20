import { getAuthorDirectory, getDecisions, getPeople, getProjectStyles, person, projectForTeam, type Decision, type Person, type ProjectStyle } from './decisions';

export interface Member extends Person {
  teamProject?: ProjectStyle;
  avatar?: string;
  profile?: { label: string; href: string };
  authored: number;
  decided: number;
  records: Decision[];
}

function profileLink(info?: { github?: string; gitlab?: string }) {
  if (info?.github) return { label: `GitHub @${info.github}`, href: `https://github.com/${encodeURIComponent(info.github)}` };
  if (info?.gitlab) return { label: `GitLab @${info.gitlab}`, href: `https://gitlab.com/${encodeURIComponent(info.gitlab)}` };
  return undefined;
}

/** Everyone in the author directory plus anyone named in a record, busiest first. */
export async function getMembers(): Promise<Member[]> {
  const [decisions, directory, people, styles] = await Promise.all([getDecisions(), getAuthorDirectory(), getPeople(), getProjectStyles()]);
  const authored = new Map<string, Decision[]>();
  const decided = new Map<string, Decision[]>();
  const push = (map: Map<string, Decision[]>, id: string, d: Decision) => map.set(id, [...(map.get(id) ?? []), d]);
  for (const d of decisions) {
    for (const id of new Set(d.authors)) push(authored, id, d);
    for (const id of new Set(d.deciders)) push(decided, id, d);
  }
  const ids = new Set([...directory.keys(), ...authored.keys(), ...decided.keys()]);
  return [...ids]
    .map((id) => {
      const info = directory.get(id);
      const p = person(people, id);
      const mine = authored.get(id) ?? [];
      const signed = decided.get(id) ?? [];
      const involved = new Set([...mine, ...signed]);
      return {
        ...p,
        teamProject: projectForTeam(p.team, styles.values()),
        avatar: info?.avatar,
        profile: profileLink(info),
        authored: mine.length,
        decided: signed.length,
        records: decisions.filter((d) => involved.has(d)),
      };
    })
    .sort((a, b) => b.records.length - a.records.length || a.name.localeCompare(b.name));
}
