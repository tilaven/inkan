import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { docTypes, site } from '../lib/config';
import { getDecisions, statusInfo } from '../lib/decisions';

export const GET: APIRoute = async (context) => {
  const decisions = (await getDecisions()).slice(0, 50);
  return rss({
    title: `${site.title} – new records`,
    description: site.description,
    site: context.site ?? site.url,
    items: decisions.map((d) => ({
      title: `[${d.ref ?? docTypes[d.type!].label}] ${d.title}`,
      link: d.href,
      pubDate: d.date,
      description: [statusInfo(d.status)?.label, d.description].filter(Boolean).join(' – '),
      categories: [d.project, d.type!, ...d.tags],
      author: d.authors.join(', ') || undefined,
    })),
  });
};
