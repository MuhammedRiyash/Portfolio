/**
 * Colour themes (all dark). The palettes themselves live in src/styles/global.css
 * (`:root[data-theme=…]`); this list drives the switcher, the pre-paint head script and the
 * `theme-color` meta. `ground` must equal the theme's --bg, `accent` its --signal.
 */
export const THEMES = [
  { name: 'noir', label: 'Noir', ground: '#0B0B0C', accent: '#FF5B2E' },
  { name: 'midnight', label: 'Midnight', ground: '#0A0F1E', accent: '#6EA8FF' },
  { name: 'forest', label: 'Forest', ground: '#0D1A14', accent: '#C8F169' },
] as const;

export type ThemeName = (typeof THEMES)[number]['name'];

/** Always the starting theme; there is no OS light/dark mapping. */
export const DEFAULT_THEME: ThemeName = 'noir';
export const THEME_KEY = 'pf-theme';
