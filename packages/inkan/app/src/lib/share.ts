import { t } from './i18n';

let timer: ReturnType<typeof setTimeout>;
let hide: ReturnType<typeof setTimeout>;

/** Shows the layout's toast for a moment. */
export function toast(text: string) {
  const el = document.querySelector<HTMLElement>('[data-toast]');
  if (!el) return;
  el.hidden = false;
  // The live region must be in the accessibility tree before its text changes, or the change is not announced.
  requestAnimationFrame(() => {
    el.textContent = text;
    el.classList.add('is-on');
  });
  clearTimeout(timer);
  clearTimeout(hide);
  timer = setTimeout(() => {
    el.classList.remove('is-on');
    hide = setTimeout(() => {
      el.hidden = true;
      el.textContent = '';
    }, 260);
  }, 2400);
}

export async function copyPageLink() {
  try {
    await navigator.clipboard.writeText(location.origin + location.pathname);
    toast(t('shell.linkCopied'));
  } catch {
    toast(t('shell.copyBlocked'));
  }
}
