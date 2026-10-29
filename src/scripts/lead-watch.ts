/**
 * Lead pop-up watcher (main bundle, kept tiny). The dialog itself lives in popup.ts and is fetched
 * with a dynamic import only when one of these triggers fires (first wins, once per session):
 *   1. scroll intent  — past 50% of the page and ≥ 8 s on the page,
 *   2. desktop exit   — the pointer leaves through the top edge, after ≥ 8 s,
 *   3. touch exit     — a fast upward flick (≥ 25% of the viewport in 300 ms) after passing 40% of the page.
 * Never while the loader or menu is open, never after the inline contact form was used,
 * and not for 30 days after a successful pop-up submit.
 */
import type Lenis from 'lenis';

export const LEAD_SEEN = 'mr:lead';
export const LEAD_SENT = 'mr:lead-sent';
const MIN_MS = 8000;
const QUIET_DAYS = 30;

export function watchLead(lenis: Lenis | null) {
  const root = document.documentElement;
  try {
    const sent = Number(localStorage.getItem(LEAD_SENT) || 0);
    if (sessionStorage.getItem(LEAD_SEEN) || Date.now() - sent < QUIET_DAYS * 864e5) return;
  } catch {
    return; // storage blocked: we could not honour "once", so never show it
  }

  const t0 = performance.now();
  let engaged = false;
  let done = false;
  let deepest = 0;
  let last = { t: 0, y: 0 };
  const form = document.querySelector('[data-form]');
  const engage = () => (engaged = true);
  form?.addEventListener('focusin', engage);
  form?.addEventListener('submit', engage);

  const aged = () => performance.now() - t0 >= MIN_MS;
  const blocked = () =>
    engaged ||
    !root.classList.contains('intro-done') ||
    !!document.querySelector('[data-menu-btn][aria-expanded="true"], dialog[open]');

  const fire = (why: string) => {
    if (done || blocked()) return;
    done = true;
    removeEventListener('scroll', onScroll);
    document.removeEventListener('mouseout', onOut);
    try {
      sessionStorage.setItem(LEAD_SEEN, '1');
    } catch {
      /* ignore */
    }
    import('./popup').then((m) => m.openLeadPopup({ lenis, trigger: why })).catch(() => undefined);
  };

  const coarse = matchMedia('(pointer: coarse)').matches;
  const onScroll = () => {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? y / max : 0;
    deepest = Math.max(deepest, p);
    if (p >= 0.5 && aged()) return fire('scroll');
    if (!coarse) return;
    const now = performance.now();
    if (now - last.t > 300) last = { t: now, y };
    else if (last.y - y >= innerHeight * 0.25 && deepest >= 0.4) fire('touch-exit');
  };
  const onOut = (e: MouseEvent) => {
    if (e.relatedTarget === null && e.clientY <= 0 && aged()) fire('exit');
  };
  addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('mouseout', onOut);
}
