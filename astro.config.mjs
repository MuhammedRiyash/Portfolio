// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://md-riyash-portfolio.vercel.app',
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  integrations: [sitemap()],
  // The only large chunk is the lazily imported three.js scene (~140 KB gzip), never on the critical path.
  vite: { build: { chunkSizeWarningLimit: 800 } },
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Inter Tight',
      cssVariable: '--font-display',
      fallbacks: ['Arial', 'sans-serif'],
      options: {
        variants: [
          { weight: '100 900', style: 'normal', src: ['./node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2'] },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Geist',
      cssVariable: '--font-sans',
      fallbacks: ['Arial', 'sans-serif'],
      options: {
        variants: [
          { weight: '100 900', style: 'normal', src: ['./node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2'] },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Geist Mono',
      cssVariable: '--font-mono',
      fallbacks: ['Courier New', 'monospace'],
      options: {
        variants: [
          { weight: '100 900', style: 'normal', src: ['./node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2'] },
        ],
      },
    },
  ],
});
