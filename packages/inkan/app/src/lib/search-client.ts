/**
 * The search palette: results from the configured provider (`virtual:inkan/search`), arrow keys to move the active
 * hit, Enter to open it, Escape to close. The markup lives in components/Search.astro.
 */
import createProvider, { options } from 'virtual:inkan/search';
import { el } from './dom';
import { t } from './i18n';
import { track } from './track';
import type { SearchHit } from '../search/types';

interface Hit extends SearchHit {
  project: string;
  ink: string;
}

export function setupSearch(dialog: HTMLDialogElement): void {
  const input = dialog.querySelector<HTMLInputElement>('[data-pal-input]')!;
  const list = dialog.querySelector<HTMLElement>('[data-pal-list]')!;
  const msg = dialog.querySelector<HTMLElement>('[data-pal-msg]')!;
  const count = dialog.querySelector<HTMLElement>('[data-pal-count]')!;
  // The one live region of the palette: it says what the footer count or the empty message shows.
  const live = dialog.querySelector<HTMLElement>('[data-pal-live]')!;
  const base = dialog.dataset.base!;
  const limit = Number(dialog.dataset.limit);
  const projects: Record<string, { name: string; ink: string }> = JSON.parse(dialog.dataset.projects!);
  const statusLabels: Record<string, string> = JSON.parse(dialog.dataset.statuses!);
  const recent: Hit[] = JSON.parse(dialog.dataset.recent!);
  const stickers = new Map(
    [...dialog.querySelectorAll<HTMLTemplateElement>('template[data-pal-sticker]')].map((t) => [t.dataset.palSticker!, t]),
  );

  const provider = createProvider(options);
  let selected = 0;
  let pending: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unreported: (() => void) | undefined;
  let report: ReturnType<typeof setTimeout> | undefined;

  const isMac = /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  document.querySelectorAll('[data-pal-key]').forEach((k) => (k.textContent = isMac ? '⌘K' : 'Ctrl K'));

  const rows = () => [...list.querySelectorAll<HTMLElement>('.hit')];

  function select(n: number) {
    const all = rows();
    if (!all.length) return;
    selected = (n + all.length) % all.length;
    all.forEach((r, i) => r.setAttribute('aria-selected', String(i === selected)));
    all[selected].scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', all[selected].id);
  }

  function highlight(text: string, tokens: string[]) {
    const frag = document.createDocumentFragment();
    if (!tokens.length) {
      frag.append(text);
      return frag;
    }
    const re = new RegExp(`(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig');
    text.split(re).forEach((part, i) => {
      if (i % 2) {
        const m = document.createElement('mark');
        m.textContent = part;
        frag.append(m);
      } else frag.append(part);
    });
    return frag;
  }

  const decode = (html: string) => new DOMParser().parseFromString(html, 'text/html').documentElement.textContent ?? '';

  function markedText(html: string) {
    const frag = document.createDocumentFragment();
    html.split(/<\/?mark>/).forEach((part, i) => {
      if (i % 2) frag.append(el('mark', undefined, decode(part)));
      else frag.append(decode(part));
    });
    return frag;
  }

  /** An option is named by its title, project and status (its content); the excerpt and the ref describe it. */
  function renderHit(hit: Hit, i: number, tokens: string[]) {
    const a = el('a', 'hit');
    a.id = `pal-hit-${i}`;
    a.href = hit.url;
    a.tabIndex = -1;
    a.setAttribute('role', 'option');
    a.setAttribute('aria-selected', String(i === 0));
    a.style.setProperty('--ink', `var(--inkan-ink-${hit.ink})`);

    const sticker = stickers.get(hit.status ?? '')?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
    const slot = el('span', 'hit__stk');
    if (sticker) {
      sticker.removeAttribute('title');
      slot.append(sticker);
    }

    const body = el('span', 'hit__body');
    const title = el('b');
    title.append(highlight(hit.title, tokens));
    const meta = el('span', 'hit__meta', [hit.project, hit.type?.toUpperCase()].filter(Boolean).join(' · '));
    const status = el('span', 'pal-sr', hit.status ? t('search.status', { status: statusLabels[hit.status] ?? hit.status }) : '');
    const excerpt = el('small');
    excerpt.id = `${a.id}-excerpt`;
    excerpt.setAttribute('aria-hidden', 'true');
    if (hit.marked) excerpt.append(markedText(hit.excerpt ?? ''));
    else excerpt.append(highlight(hit.excerpt ?? '', tokens));
    body.append(title, meta, status, excerpt);
    const ref = el('span', 'hit__id', hit.ref ?? '');
    ref.id = `${a.id}-ref`;
    ref.setAttribute('aria-hidden', 'true');
    a.setAttribute('aria-describedby', `${excerpt.id} ${ref.id}`);

    a.append(slot, body, ref);
    return a;
  }

  function show(hits: Hit[], tokens: string[], heading: string, empty = '') {
    list.removeAttribute('aria-busy');
    list.replaceChildren(...hits.map((h, i) => renderHit(h, i, tokens)));
    msg.textContent = hits.length ? '' : empty;
    msg.hidden = hits.length > 0;
    input.setAttribute('aria-expanded', String(hits.length > 0));
    count.textContent = heading;
    live.textContent = hits.length ? heading : empty;
    selected = 0;
    if (hits.length) input.setAttribute('aria-activedescendant', 'pal-hit-0');
    else input.removeAttribute('aria-activedescendant');
  }

  function showMessage(...content: (string | Node)[]) {
    list.removeAttribute('aria-busy');
    list.replaceChildren();
    msg.replaceChildren(...content);
    msg.hidden = false;
    live.textContent = msg.textContent;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function showUnavailable(message: string) {
    showMessage(...message.split('`').map((part, i) => (i % 2 ? el('code', undefined, part) : part)));
    count.textContent = t('search.unavailable');
  }

  /** Hits from an external index link only to web pages, never to `javascript:` and the like. */
  const safe = (hit: SearchHit) => {
    try {
      return !!hit.url && /^https?:$/.test(new URL(hit.url, location.href).protocol);
    } catch {
      return false;
    }
  };

  function present(hit: SearchHit): Hit {
    const project = hit.project ? projects[hit.project] : undefined;
    return { ...hit, project: project?.name ?? hit.project ?? '', ink: project?.ink ?? 'c' };
  }

  async function run(query: string, tokens: string[], signal: AbortSignal) {
    try {
      const { hits, total } = await provider.search(query, { limit, signal, base });
      if (signal.aborted) return;
      const shown = hits.filter(safe).slice(0, limit).map(present);
      const heading =
        total > shown.length ? t('search.countOf', { shown: shown.length, total }) : t('search.count', { count: shown.length });
      show(shown, tokens, heading, t('search.empty', { query }));
      // Only the query the reader settled on, not every keystroke.
      unreported = () => track('Search', { query, results: total });
      report = setTimeout(flushReport, 1000);
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof Error && error.name === 'SearchUnavailableError') return showUnavailable(error.message);
      showMessage(t('search.failed'));
      count.textContent = '';
    }
  }

  function flushReport() {
    clearTimeout(report);
    unreported?.();
    unreported = undefined;
  }

  function render() {
    const query = input.value.trim();
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    pending?.abort();
    clearTimeout(timer);
    clearTimeout(report);
    unreported = undefined;
    if (!tokens.length) return show(recent, [], t('search.recent'));
    list.setAttribute('aria-busy', 'true');
    const controller = (pending = new AbortController());
    timer = setTimeout(() => void run(query, tokens, controller.signal), 120);
  }

  const trigger = document.querySelector<HTMLElement>('[data-pal-open]');
  let opener: HTMLElement | undefined;

  function open() {
    if (dialog.open) return;
    const active = document.activeElement;
    opener = active instanceof HTMLElement && active !== document.body ? active : undefined;
    input.value = '';
    dialog.showModal();
    input.focus();
    render();
    void provider.preload?.({ base });
  }

  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown') (e.preventDefault(), select(selected + 1));
    else if (e.key === 'ArrowUp') (e.preventDefault(), select(selected - 1));
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (list.getAttribute('aria-busy') !== 'true') rows()[selected]?.click();
    }
  });
  list.addEventListener('mousemove', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.hit');
    if (row) select(rows().indexOf(row));
  });
  dialog.addEventListener('mousedown', (e) => {
    if (e.target === dialog) dialog.close();
  });
  list.addEventListener('click', flushReport);
  dialog.addEventListener('close', () => {
    flushReport();
    pending?.abort();
    clearTimeout(timer);
    // Browsers restore focus on close themselves; the fallback covers the shortcut path, where nothing was focused.
    (opener?.isConnected ? opener : trigger)?.focus();
  });
  dialog.querySelector('[data-pal-close]')!.addEventListener('click', () => dialog.close());
  document.querySelectorAll('[data-pal-open]').forEach((b) => b.addEventListener('click', () => open()));
  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      open();
    }
  });
}
