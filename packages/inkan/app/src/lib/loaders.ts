/**
 * One collection fed by several folders (the content dir plus every configured source).
 * Astro's glob loader removes every store entry it did not visit, so two of them sharing a store
 * would wipe each other's records. Each glob here gets a view of the store limited to its own entries.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'astro/loaders';
import type { Loader, LoaderContext } from 'astro/loaders';

type Store = LoaderContext['store'];

/** The optional home page section in the content folder, if there is one. */
export const landingFile = (contentDir: string) => ['_landing.md', '_landing.mdx'].find((f) => fs.existsSync(path.join(contentDir, f)));
export type GlobOptions = Parameters<typeof glob>[0];

/**
 * The store outlives the process but `owner` does not, so an entry nobody has claimed yet (first run after a restart)
 * belongs to the glob whose folder contains its file.
 */
function scopedStore(store: Store, owner: Map<string, number>, index: number, claimedBy: (id: string) => number | undefined): Store {
  const mine = (id: string) => (owner.has(id) ? owner.get(id) === index : claimedBy(id) === index);
  return {
    ...store,
    keys: () => store.keys().filter(mine),
    entries: () => store.entries().filter(([id]) => mine(id)),
    values: () => store.values().filter((e) => mine(e.id)),
    has: (id) => mine(String(id)) && store.has(id),
    set: (entry) => {
      const changed = store.set(entry);
      owner.set(String(entry.id), index);
      return changed;
    },
    delete: (id) => {
      if (!mine(String(id))) return;
      store.delete(id);
      owner.delete(String(id));
    },
    clear: () => {
      for (const id of store.keys().filter(mine)) store.delete(id);
      for (const id of [...owner.keys()].filter(mine)) owner.delete(id);
    },
  };
}

const basePath = (base: GlobOptions['base']) => path.resolve(base instanceof URL ? fileURLToPath(base) : (base ?? '.'));

/** Runs one glob loader per options object against the same collection. */
export function globs(parts: GlobOptions[]): Loader {
  const loaders = parts.map(glob);
  const owner = new Map<string, number>();
  const bases = parts.map((p) => basePath(p.base));
  return {
    name: 'inkan-globs',
    load: async (context) => {
      const root = fileURLToPath(context.config.root);
      const claimedBy = (id: string) => {
        const file = context.store.get(id)?.filePath;
        if (!file) return undefined;
        const abs = path.resolve(root, file);
        let best: number | undefined;
        for (const [i, base] of bases.entries()) {
          if ((abs === base || abs.startsWith(base + path.sep)) && (best === undefined || base.length > bases[best].length)) best = i;
        }
        return best;
      };
      for (const [index, loader] of loaders.entries()) {
        await loader.load({ ...context, store: scopedStore(context.store, owner, index, claimedBy) });
      }
    },
  };
}
