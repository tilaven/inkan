import fs from 'node:fs';
import path from 'node:path';

/** Components that `config.components` may replace; the last six are empty slots. See ComponentName in index.d.ts. */
export const componentNames = [
  'Header',
  'Footer',
  'Banner',
  'Sidebar',
  'RecordHeader',
  'RecordFooter',
  'RecordHistory',
  'RecordCard',
  'PageActions',
  'LandingHero',
  'HeadEnd',
  'HeaderEnd',
  'SidebarTop',
  'SidebarBottom',
  'RecordTop',
  'RecordBottom',
];

/**
 * File that `virtual:inkan/components/<name>` resolves to: the user's override,
 * else the built-in `app/src/components/<name>.astro`, else an empty component.
 * @param {string} name
 * @param {Record<string, string>} overrides absolute paths from the resolved config
 * @param {string} appDir
 */
export function resolveComponent(name, overrides, appDir) {
  if (overrides[name]) return overrides[name];
  const builtIn = path.join(appDir, 'src/components', `${name}.astro`);
  return fs.existsSync(builtIn) ? builtIn : path.join(appDir, 'src/components/slots/Empty.astro');
}
