/**
 * Theme switching. The pre-paint script in Base.astro already set <html data-theme> before first
 * paint; this wires every `[data-theme-switch]` radiogroup (header, menu, /cv bar), persists the choice
 * in localStorage `pf-theme`, updates `<meta name="theme-color">` and announces each change with
 * `pf:theme` ({ detail: { name } }) after the attribute is set — the WebGL world re-themes on it.
 */
import { THEMES, THEME_KEY, DEFAULT_THEME, type ThemeName } from '../data/themes';

const isTheme = (v: unknown): v is ThemeName => THEMES.some((t) => t.name === v);

export const currentTheme = (): ThemeName => {
  const v = document.documentElement.dataset.theme;
  return isTheme(v) ? v : DEFAULT_THEME;
};

function sync(name: ThemeName) {
  for (const opt of document.querySelectorAll<HTMLElement>('[data-theme-opt]')) {
    const on = opt.dataset.themeOpt === name;
    opt.setAttribute('aria-checked', String(on));
    opt.tabIndex = on ? 0 : -1;
  }
}

function apply(name: ThemeName) {
  const root = document.documentElement;
  root.dataset.theme = name;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const t = THEMES.find((x) => x.name === name);
  if (meta && t) meta.content = t.ground;
  sync(name);
  document.dispatchEvent(new CustomEvent('pf:theme', { detail: { name } }));
}

export function setTheme(name: ThemeName) {
  try {
    localStorage.setItem(THEME_KEY, name);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  if (name === currentTheme()) return sync(name);
  const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (motion && typeof document.startViewTransition === 'function') document.startViewTransition(() => apply(name));
  else apply(name);
}

export function initTheme() {
  const groups = document.querySelectorAll<HTMLElement>('[data-theme-switch]');
  sync(currentTheme());

  for (const group of groups) {
    const opts = [...group.querySelectorAll<HTMLElement>('[data-theme-opt]')];
    group.addEventListener('click', (e) => {
      const opt = (e.target as Element | null)?.closest<HTMLElement>('[data-theme-opt]');
      if (opt && isTheme(opt.dataset.themeOpt)) setTheme(opt.dataset.themeOpt);
    });
    // Radio-group keyboard model: arrows move focus and select (wrapping), Home/End jump.
    group.addEventListener('keydown', (e) => {
      const i = opts.indexOf(document.activeElement as HTMLElement);
      if (i < 0) return;
      let next = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % opts.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + opts.length) % opts.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = opts.length - 1;
      if (next < 0) return;
      e.preventDefault();
      const name = opts[next].dataset.themeOpt;
      opts[next].focus();
      if (isTheme(name)) setTheme(name);
    });
  }
}
