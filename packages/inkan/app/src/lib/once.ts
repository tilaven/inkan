import path from 'node:path';

/** Runs `fn` on the first call and returns that result (also `null`/`undefined`) from then on. */
export function once<T>(fn: () => T): () => T {
  let done = false;
  let value: T;
  return () => {
    if (!done) {
      value = fn();
      done = true;
    }
    return value;
  };
}

/** Path of `file` relative to `root` with `/` separators, or undefined when it lies outside `root`. */
export function relativeInside(root: string, file: string): string | undefined {
  const rel = path.relative(root, file);
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) return undefined;
  return rel.split(path.sep).join('/');
}
