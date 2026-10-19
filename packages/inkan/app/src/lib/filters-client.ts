/**
 * The records index in the browser: facet chips, ranges and the text filter over the rows the page rendered,
 * the cards/table switch, the active-filter pills, the URL in sync with the state, and card chunks mounted
 * on demand. The markup lives in pages/decisions.astro; the pure parts (matching, state parsing) in ./list.
 */
import { t } from './i18n';
import { FACETS, isFiltered, matches, parseState, serializeState, type Facet, type FieldSpec, type ListRecord, type ListState, type Range, type View } from './list';

export function setupFilters(): void {
  const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
  const EASE = 'cubic-bezier(.16,.9,.12,1)';
  const FLIP_LIMIT = 150;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Table rows carry the filter data for every record; cards may still be waiting in a chunk.
  const rows = [...document.querySelectorAll<HTMLTableRowElement>('#tbl tbody tr')];
  const records: ListRecord[] = rows.map((r) => ({
    id: r.dataset.id!,
    project: r.dataset.project!,
    type: r.dataset.type!,
    status: r.dataset.status!,
    authors: JSON.parse(r.dataset.authors!),
    tags: JSON.parse(r.dataset.tags!),
    fields: JSON.parse(r.dataset.fields!),
    text: r.dataset.text!,
  }));
  const cardsEl = $('#cards');
  const cells = new Map<string, HTMLElement>();
  const registerCells = (root: ParentNode) => {
    for (const c of root.querySelectorAll<HTMLElement>('.cell')) cells.set(c.dataset.id!, c);
  };
  registerCells(cardsEl);
  const chunks = [...cardsEl.querySelectorAll<HTMLTemplateElement>('.cards__chunk')];
  const sentinel = document.getElementById('cards-sentinel');
  const chips = [...document.querySelectorAll<HTMLButtonElement>('.fgroup .chip[data-value]')];
  const mores = [...document.querySelectorAll<HTMLButtonElement>('.fgroup .chip--more')];
  const bounds = [...document.querySelectorAll<HTMLInputElement>('.fgroup--range input[data-bound]')];
  const views = [...document.querySelectorAll<HTMLButtonElement>('.seg2 [data-view]')];
  const input = $<HTMLInputElement>('#qin');
  const toggle = $<HTMLButtonElement>('#ftoggle');
  const facetsEl = $('#facets');
  const active = $('#factive');
  const fcount = $('#fcount');

  const specs: FieldSpec[] = JSON.parse($('#filters').dataset.fields!);
  const state: ListState = parseState(location.search, specs);
  // URLs written by hand or by scripts may not match a chip's case (`?risk=HIGH`).
  for (const [name, set] of Object.entries(state.chips)) {
    const known = [...document.querySelectorAll<HTMLElement>(`.fgroup[data-field="${name}"] .chip[data-value]`)].map((c) => c.dataset.value!);
    state.chips[name] = new Set([...set].map((v) => known.find((k) => k.toLowerCase() === v.toLowerCase()) ?? v));
  }
  const total = records.length;
  const groupOf = (el: HTMLElement) => el.closest<HTMLElement>('.fgroup')!;
  const groupFor = (key: { facet: Facet } | { field: string }) =>
    document.querySelector<HTMLElement>('facet' in key ? `.fgroup[data-facet="${key.facet}"]` : `.fgroup[data-field="${key.field}"]`)!;
  /** The chosen values of a chip group: a built-in facet or a chip field. */
  const setOf = (group: HTMLElement) => (group.dataset.facet ? state.facets[group.dataset.facet as Facet] : state.chips[group.dataset.field!]);
  const inViewport = (r: DOMRect) => r.bottom > 0 && r.top < innerHeight;

  function mountChunk(chunk: HTMLTemplateElement, matched: Set<string>) {
    const content = chunk.content;
    for (const c of content.querySelectorAll<HTMLElement>('.cell')) c.hidden = !matched.has(c.dataset.id!);
    registerCells(content);
    chunk.replaceWith(content);
    chunks.splice(chunks.indexOf(chunk), 1);
    if (!chunks.length) sentinel?.remove();
  }

  function showExtra(more: HTMLButtonElement, open: boolean) {
    const extra = [...groupOf(more).querySelectorAll<HTMLButtonElement>('.chip[data-extra]')];
    more.setAttribute('aria-expanded', String(open));
    const group = groupOf(more).getAttribute('aria-label')!;
    more.textContent = open ? t('filters.fewer') : t('filters.more', { count: extra.length });
    more.setAttribute('aria-label', open ? t('filters.fewerLabel', { group }) : t('filters.moreLabel', { count: extra.length, group }));
    for (const c of extra) c.hidden = !open;
  }

  function showFacets(open: boolean) {
    toggle.setAttribute('aria-expanded', String(open));
    facetsEl.hidden = !open;
  }

  const spokenText = (el: Element) =>
    [...el.childNodes].filter((n) => !(n instanceof Element && n.getAttribute('aria-hidden') === 'true')).map((n) => n.textContent).join('').trim();
  const button = (text: string) => Object.assign(document.createElement('button'), { type: 'button', className: 'chip', textContent: text });

  /** An active-filter pill: a copy of the chip when there is one, else a plain one with `text`. */
  function pill(group: HTMLElement, text: string, remove: () => void, from = button(text)) {
    const pill = from.cloneNode(true) as HTMLButtonElement;
    pill.querySelector('em')?.remove();
    pill.removeAttribute('aria-pressed');
    pill.hidden = false;
    pill.classList.add('chip--on');
    pill.setAttribute('aria-label', t('filters.remove', { facet: group.getAttribute('aria-label')!, value: from.parentElement ? from.title || spokenText(pill) : text }));
    pill.insertAdjacentHTML('beforeend', '<i class="chip__x" aria-hidden="true">×</i>');
    pill.addEventListener('click', () => {
      const at = [...active.children].indexOf(pill);
      remove();
      apply(true);
      const next = active.children[Math.min(at, active.children.length - 1)];
      (next instanceof HTMLElement ? next : toggle).focus();
    });
    return pill;
  }

  function chipPill(group: HTMLElement, value: string) {
    const chip = [...group.querySelectorAll<HTMLButtonElement>('.chip[data-value]')].find((c) => c.dataset.value === value);
    const out = pill(group, group.dataset.facet === 'tag' ? `#${value}` : value, () => setOf(group).delete(value), chip);
    // Field values like "high" or "Yes" need their field's name to make sense on their own.
    if (group.dataset.field) out.insertAdjacentText('afterbegin', `${group.getAttribute('aria-label')}: `);
    return out;
  }

  function rangeText({ min, max }: Range, unit = '') {
    const u = unit && ` ${unit}`;
    if (min && max) return min === max ? `${min}${u}` : `${min}–${max}${u}`;
    return min ? t('filters.rangeFrom', { min: `${min}${u}` }) : t('filters.rangeTo', { max: `${max}${u}` });
  }

  function rangePill(field: string, range: Range) {
    const group = groupFor({ field });
    const text = rangeText(range, group.dataset.unit);
    return pill(group, text, () => {
      state.ranges[field] = { min: '', max: '' };
      syncBounds();
    }, button(`${group.getAttribute('aria-label')}: ${text}`));
  }

  function syncBounds() {
    for (const b of bounds) b.value = state.ranges[groupOf(b).dataset.field!][b.dataset.bound as keyof Range];
  }

  function renderActive() {
    const pills = [
      ...FACETS.flatMap((f) => [...state.facets[f]].map((v) => chipPill(groupFor({ facet: f }), v))),
      ...specs.flatMap((f) => {
        if (f.kind === 'chips') return [...state.chips[f.name]].map((v) => chipPill(groupFor({ field: f.name }), v));
        const r = state.ranges[f.name];
        return r.min || r.max ? [rangePill(f.name, r)] : [];
      }),
    ];
    active.replaceChildren(...pills);
    active.hidden = !pills.length;
    fcount.textContent = String(pills.length);
    fcount.hidden = !pills.length;
  }

  function apply(animate: boolean) {
    const cardsView = state.view === 'cards';
    const flip = animate && !reduced && cardsView;
    const before = new Map<HTMLElement, DOMRect>();
    if (flip) {
      const visible = [...cells.values()].filter((c) => !c.hidden);
      if (visible.length <= FLIP_LIMIT) for (const c of visible) before.set(c, c.getBoundingClientRect());
    }

    const matched = new Set<string>();
    rows.forEach((row, i) => {
      const ok = matches(records[i], state);
      row.hidden = !ok;
      if (ok) matched.add(records[i].id);
    });
    // A filtered cards view must show every match, so chunks holding one are mounted now.
    if (cardsView && isFiltered(state)) {
      for (const chunk of [...chunks]) if (chunk.dataset.ids!.split('\n').some((id) => matched.has(id))) mountChunk(chunk, matched);
    }
    for (const [id, c] of cells) c.hidden = !matched.has(id);
    cardsEl.hidden = !cardsView;
    $('#tbl').hidden = cardsView;
    $('#empty').hidden = matched.size > 0;

    if (flip && before.size) {
      for (const c of cells.values()) {
        if (c.hidden) continue;
        const was = before.get(c);
        const now = c.getBoundingClientRect();
        if (!inViewport(now) && !(was && inViewport(was))) continue;
        if (!was) c.animate([{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE });
        else {
          const dx = was.left - now.left;
          const dy = was.top - now.top;
          if (dx || dy) c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 560, easing: EASE });
        }
      }
    }

    const qs = serializeState(state, specs);
    const filtered = isFiltered(state);
    $('#count').textContent = filtered ? t('filters.countOf', { shown: matched.size, total }) : t('filters.count', { count: total });
    $('#reset').hidden = !filtered;
    for (const c of chips) c.setAttribute('aria-pressed', String(setOf(groupOf(c)).has(c.dataset.value!)));
    renderActive();
    for (const b of views) b.setAttribute('aria-pressed', String(b.dataset.view === state.view));
    history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
  }

  for (const c of chips) {
    c.addEventListener('click', () => {
      const set = setOf(groupOf(c));
      const v = c.dataset.value!;
      if (set.has(v)) set.delete(v);
      else set.add(v);
      apply(true);
    });
  }
  for (const b of views) {
    b.addEventListener('click', () => {
      state.view = b.dataset.view as View;
      apply(false);
    });
  }
  $('#reset').addEventListener('click', () => {
    for (const f of FACETS) state.facets[f].clear();
    for (const s of Object.values(state.chips)) s.clear();
    for (const f of Object.keys(state.ranges)) state.ranges[f] = { min: '', max: '' };
    syncBounds();
    state.q = '';
    input.value = '';
    apply(true);
    input.focus();
  });
  toggle.addEventListener('click', () => showFacets(toggle.getAttribute('aria-expanded') !== 'true'));
  for (const m of mores) m.addEventListener('click', () => showExtra(m, m.getAttribute('aria-expanded') !== 'true'));

  let debounce: ReturnType<typeof setTimeout>;
  const applyLater = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => apply(true), 120);
  };
  input.addEventListener('input', () => {
    state.q = input.value.trim();
    applyLater();
  });
  for (const b of bounds) {
    b.addEventListener('input', () => {
      state.ranges[groupOf(b).dataset.field!][b.dataset.bound as keyof Range] = b.value.trim();
      applyLater();
    });
  }

  $('#tbl tbody').addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const row = target.closest('tr');
    if (!row || target.closest('a')) return;
    row.querySelector('a')?.click();
  });

  if (sentinel) {
    // Unfiltered browsing: the next chunk of cards mounts as the end of the grid scrolls into view.
    new IntersectionObserver((entries, io) => {
      if (!entries.some((e) => e.isIntersecting) || !chunks.length) return;
      const matched = new Set(records.filter((r) => matches(r, state)).map((r) => r.id));
      mountChunk(chunks[0], matched);
      if (!chunks.length) return io.disconnect();
      // Re-observe so a sentinel still inside the margin after the mount reports again.
      io.unobserve(sentinel);
      io.observe(sentinel);
    }, { rootMargin: '600px' }).observe(sentinel);
  }

  input.value = state.q;
  syncBounds();
  for (const m of mores) if (chips.some((c) => c.dataset.extra && groupOf(c) === groupOf(m) && setOf(groupOf(c)).has(c.dataset.value!))) showExtra(m, true);
  apply(false);
}
