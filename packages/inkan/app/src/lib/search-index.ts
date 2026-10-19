import { plainText, recordId, type SearchRecord } from '../search/record';
import { formatDate, getDocs, toDecision, url } from './decisions';
import { getPages } from './pages';

export async function searchRecords(): Promise<SearchRecord[]> {
  const docs = (await getDocs()).map(toDecision).map((d): SearchRecord => {
    const id = recordId(d.id);
    return {
      id,
      objectID: id,
      url: d.href,
      title: d.title,
      description: d.description ?? null,
      content: plainText(d.entry.body ?? ''),
      project: d.id.includes('/') ? d.project : null,
      type: d.type,
      status: d.status ?? null,
      ref: d.ref,
      tags: d.tags,
      authors: d.authors,
      date: d.date ? formatDate(d.date) : null,
    };
  });
  const pages = (await getPages()).map((p): SearchRecord => {
    const id = recordId(`page/${p.id}`);
    return {
      id,
      objectID: id,
      url: url(`${p.id}/`),
      title: p.data.title,
      description: p.data.description ?? null,
      content: plainText(p.body ?? ''),
      project: null,
      type: null,
      status: null,
      ref: null,
      tags: [],
      authors: [],
      date: null,
    };
  });
  return [...docs, ...pages];
}
