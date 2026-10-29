/**
 * Fixed chrome: hide-on-scroll header, the scroll-driven day clock ticker, scroll gauge, menu, anchor
 * scrolling, cursor. The header clock follows the page's "A Day in the Stack" time (09:00 at the top …
 * 23:30 at the footer, stack-map.ts); the footer clock stays real Bengaluru time.
 */
import type Lenis from 'lenis';
import { getDayClock } from './stack-map';

const IST_SHORT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });

export function initChrome({ lenis, motion }: { lenis: Lenis | null; motion: boolean }) {
  const chrome = document.querySelector<HTMLElement>('[data-chrome]');
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  const menuBtn = document.querySelector<HTMLButtonElement>('[data-menu-btn]');
  const ring = document.querySelector<SVGCircleElement>('[data-ring]');
  const gauge = document.querySelector<HTMLElement>('[data-gauge]');
  const gaugeNum = document.querySelector<HTMLElement>('[data-gauge-num]');
  const gaugeBar = document.querySelector<HTMLElement>('[data-gauge-bar]');

  /* ── Anchors: smooth through Lenis when it runs ── */
  const scrollTo = (hash: string) => {
    const target = hash === '#top' ? document.body : document.querySelector<HTMLElement>(hash);
    if (!target) return false;
    if (lenis) lenis.scrollTo(hash === '#top' ? 0 : target, { duration: 0.6 });
    else target.scrollIntoView({ behavior: motion ? 'smooth' : 'auto' });
    return true;
  };

  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a || a.getAttribute('href') === '#') return;
    const hash = a.getAttribute('href') ?? '';
    if (!scrollTo(hash)) return;
    e.preventDefault();
    history.replaceState(null, '', hash === '#top' ? location.pathname : hash);
    if (hash !== '#top') {
      const t = document.querySelector<HTMLElement>(hash);
      if (t && !t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t?.focus({ preventScroll: true });
    }
    closeMenu(false);
  });

  /* ── Menu ── */
  let menuOpen = false;
  function openMenu() {
    if (!menu || !menuBtn) return;
    menuOpen = true;
    menu.classList.add('open');
    menuBtn.setAttribute('aria-expanded', 'true');
    chrome?.classList.remove('hid');
    menu.querySelector<HTMLElement>('a')?.focus();
  }
  function closeMenu(returnFocus = true) {
    if (!menu || !menuBtn || !menuOpen) return;
    menuOpen = false;
    menu.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
    if (returnFocus) menuBtn.focus();
  }
  menuBtn?.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) closeMenu();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!menuOpen) return;
    const t = e.target as Node;
    if (!menu?.contains(t) && !menuBtn?.contains(t)) closeMenu(false);
  });
  menu?.addEventListener('focusout', (e) => {
    const next = e.relatedTarget as Node | null;
    if (menuOpen && next && !menu.contains(next) && !menuBtn?.contains(next)) closeMenu(false);
  });

  /* ── Ticker + clocks ── */
  const ticker = document.querySelector<HTMLElement>('[data-ticker]');
  const footClock = document.querySelector<HTMLElement>('[data-foot-clock]');
  const legendAct = document.querySelector<HTMLElement>('[data-legend-act]');
  const day = getDayClock();
  new ResizeObserver(() => day.refresh()).observe(document.body);
  let dayLabel = '';
  const messages = [() => `Bengaluru — ${dayLabel}`, () => 'Open to senior full-stack roles', () => 'Now — headless commerce, Astro + Laravel'];
  let msg = 0;
  let current = ticker?.querySelector<HTMLElement>('.ticker-item') ?? null;
  const paintDay = () => {
    const next = day.label(day.hour(window.scrollY));
    if (next === dayLabel) return;
    dayLabel = next;
    if (current && msg === 0) current.textContent = messages[0]();
    if (legendAct) legendAct.textContent = dayLabel;
  };
  paintDay();
  const paintFoot = () => {
    if (footClock) footClock.textContent = `${IST_SHORT.format(new Date())} IST`;
  };
  paintFoot();
  window.setInterval(paintFoot, 10000);

  if (ticker && current && motion) {
    window.setInterval(() => {
      if (document.hidden) return;
      msg = (msg + 1) % messages.length;
      const old = current;
      if (!old) return;
      const next = document.createElement('span');
      next.className = 'ticker-item';
      next.textContent = messages[msg]();
      next.style.transform = 'translateY(110%)';
      next.style.opacity = '0';
      ticker.appendChild(next);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          old.style.transform = 'translateY(-110%)';
          old.style.opacity = '0';
          next.style.transform = '';
          next.style.opacity = '';
        }),
      );
      window.setTimeout(() => old.remove(), 900);
      current = next;
    }, 3200);
  }

  /* ── Header hide/show + gauge (one rAF-throttled scroll handler) ── */
  let lastY = window.scrollY;
  let acc = 0;
  let queued = false;
  let lastPct = -1;
  const update = () => {
    queued = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    const dy = y - lastY;
    lastY = y;
    if (chrome && !menuOpen) {
      if (Math.sign(dy) !== Math.sign(acc)) acc = 0;
      acc += dy;
      if (y < vh * 0.6) chrome.classList.remove('hid');
      else if (acc > 60) chrome.classList.add('hid');
      else if (acc < -40) chrome.classList.remove('hid');
    }
    const max = document.documentElement.scrollHeight - vh;
    const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    const pct = Math.round(p * 100);
    if (pct !== lastPct) {
      lastPct = pct;
      if (gaugeNum) gaugeNum.textContent = String(pct).padStart(3, '0');
      if (ring) ring.style.strokeDashoffset = String(100 - pct);
    }
    if (gaugeBar) gaugeBar.style.transform = `scaleY(${p})`;
    gauge?.classList.toggle('on', y > vh * 0.3 && y < max - vh * 0.6);
    paintDay();
  };
  window.addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );
  update();

  /* ── Cursor (fine pointers, motion allowed) ── */
  const cursor = document.querySelector<HTMLElement>('[data-cursor-el]');
  const label = document.querySelector<HTMLElement>('[data-cursor-label]');
  if (cursor && label && motion && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.documentElement.classList.add('has-cursor');
    let x = -100;
    let y = -100;
    let tx = -100;
    let ty = -100;
    let raf = 0;
    const loop = () => {
      x += (tx - x) * 0.2;
      y += (ty - y) * 0.2;
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.1 ? requestAnimationFrame(loop) : 0;
    };
    window.addEventListener(
      'pointermove',
      (e) => {
        tx = e.clientX;
        ty = e.clientY;
        cursor.classList.remove('away');
        if (!raf) raf = requestAnimationFrame(loop);
        const t = e.target as Element | null;
        const labelled = t?.closest<HTMLElement>('[data-cursor]');
        const interactive = t?.closest('a, button, input, textarea, label, [role="button"]');
        cursor.classList.toggle('label', !!labelled);
        cursor.classList.toggle('hover', !labelled && !!interactive);
        if (labelled) label.textContent = labelled.dataset.cursor ?? '';
      },
      { passive: true },
    );
    document.documentElement.addEventListener('pointerleave', () => cursor.classList.add('away'));
  }
}
