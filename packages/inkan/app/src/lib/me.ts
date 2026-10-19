/** The reader's identity in the browser, used to mark records that wait on them. Nothing leaves the device. */

const KEY = 'inkan-me';
const EVENT = 'inkan-me-change';

const clean = (handle: string | null | undefined) => (handle ?? '').trim().replace(/^@/, '').toLowerCase();

function read(): string {
  try {
    return clean(localStorage.getItem(KEY));
  } catch {
    return '';
  }
}

let current: string | undefined;

/**
 * The reader's handle: `?me=<handle>` for this page only (a shared link never changes what the reader has
 * remembered), else the one remembered in storage; empty when unknown.
 */
export function getMe(): string {
  if (current !== undefined) return current;
  let fromUrl: string | null = null;
  try {
    fromUrl = new URLSearchParams(location.search).get('me');
  } catch {}
  return (current = fromUrl === null ? read() : clean(fromUrl));
}

/** Remembers who the reader is (`''` forgets), drops `?me=` from the address and tells the page. */
export function setMe(handle: string): void {
  current = clean(handle);
  try {
    const url = new URL(location.href);
    if (url.searchParams.has('me')) {
      url.searchParams.delete('me');
      history.replaceState(history.state, '', url);
    }
  } catch {}
  try {
    if (current) localStorage.setItem(KEY, current);
    else localStorage.removeItem(KEY);
  } catch {}
  document.dispatchEvent(new CustomEvent(EVENT, { detail: current }));
}

/**
 * Shows the "Waiting on you" badge (`[data-you]`) inside every `[data-waiting-on]` element whose handle
 * list names the reader, and marks it `is-waiting`. Returns how many elements wait on the reader.
 */
export function markWaiting(root: ParentNode = document): number {
  const me = getMe();
  let count = 0;
  for (const el of root.querySelectorAll<HTMLElement>('[data-waiting-on]')) {
    let handles: unknown = [];
    try {
      handles = JSON.parse(el.dataset.waitingOn ?? '[]');
    } catch {}
    const waiting = Boolean(me) && Array.isArray(handles) && handles.some((h) => clean(String(h)) === me);
    el.classList.toggle('is-waiting', waiting);
    for (const badge of el.querySelectorAll<HTMLElement>('[data-you]')) badge.hidden = !waiting;
    if (waiting) count++;
  }
  return count;
}

/** Runs `markWaiting` now and again whenever the identity changes; `onCount` gets the number each time. */
export function watchWaiting(root: ParentNode = document, onCount?: (count: number) => void): void {
  const run = () => {
    const count = markWaiting(root);
    onCount?.(count);
  };
  run();
  document.addEventListener(EVENT, run);
  addEventListener('storage', (e) => {
    if (e.key === KEY) {
      current = undefined;
      run();
    }
  });
}
