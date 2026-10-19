import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.env.INKAN_SITE ?? 'examples/company-decisions', 'dist');

/** Site paths from the built sitemap, e.g. `/sre/adr/0001-define-slos/`. */
export function sitemapPaths(): string[] {
  const files = fs.readdirSync(dist).filter((f) => /^sitemap-\d+\.xml$/.test(f));
  if (!files.length) throw new Error(`No sitemap-*.xml in ${dist}. Run \`npm run build\` first.`);
  const paths = files.flatMap((f) =>
    [...fs.readFileSync(path.join(dist, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname),
  );
  return [...new Set(paths)].sort();
}
