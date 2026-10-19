/** Every cover motif the site can draw: the built-ins, overridden or extended by the plugins' `motifs`. */
import pluginMotifs from 'virtual:inkan/motifs';
import { BUILTIN_MOTIFS, type MotifFn } from './motifs';
import { BUSINESS_KEYWORDS, BUSINESS_MOTIFS } from './motifs-business';
import { FINANCE_KEYWORDS, FINANCE_MOTIFS } from './motifs-finance';
import { INFRA_KEYWORDS, INFRA_MOTIFS } from './motifs-infra';
import { OPS_KEYWORDS, OPS_MOTIFS } from './motifs-ops';
import { PRODUCT_KEYWORDS, PRODUCT_MOTIFS } from './motifs-product';
import { WORK_KEYWORDS, WORK_MOTIFS } from './motifs-work';
import { teamWords } from './words';

for (const [name, fn] of Object.entries(pluginMotifs)) {
  if (typeof fn !== 'function') throw new Error(`inkan: plugin motif "${name}" must default-export a function`);
}

const registry: Record<string, MotifFn> = {
  ...BUILTIN_MOTIFS,
  ...INFRA_MOTIFS,
  ...PRODUCT_MOTIFS,
  ...OPS_MOTIFS,
  ...BUSINESS_MOTIFS,
  ...FINANCE_MOTIFS,
  ...WORK_MOTIFS,
  ...pluginMotifs,
};

const keywords: Record<string, string[]> = {
  ...INFRA_KEYWORDS,
  ...PRODUCT_KEYWORDS,
  ...OPS_KEYWORDS,
  ...BUSINESS_KEYWORDS,
  ...FINANCE_KEYWORDS,
  ...WORK_KEYWORDS,
};
for (const [name, fn] of Object.entries(pluginMotifs) as [string, MotifFn & { keywords?: unknown }][]) {
  if (Array.isArray(fn.keywords)) keywords[name] = fn.keywords.flatMap((k) => teamWords(String(k)));
}

export const motifNames = () => Object.keys(registry);

/** Team words that make each motif the natural pick for a project (`security` → shield). */
export const motifKeywords = (): Readonly<Record<string, readonly string[]>> => keywords;

export const getMotif = (name: string): MotifFn | undefined =>
  Object.hasOwn(registry, name) ? registry[name] : undefined;
