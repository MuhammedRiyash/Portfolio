/**
 * Miniature props on each work chapter's 3D table (src/scripts/gl-props.ts builds them, gl-devices.ts places and
 * animates them). One source for the hover tooltip in the canvas and the screen-reader list in Work.astro.
 * Labels: "<thing> · <product / skill / technology>" — grounded in the chapter copy in site.ts; never name an
 * employer or frame the work as client / freelance / full-time.
 * Order = priority: the first two stay on the lite tables (unpinned chapters, < 1024 px or short viewports).
 */
export type PropKey =
  | 'pens'
  | 'highlighters'
  | 'washi'
  | 'notepad'
  | 'eraser'
  | 'invoices'
  | 'calculator'
  | 'jar'
  | 'parcel'
  | 'stethoscope'
  | 'pills'
  | 'firstaid'
  | 'callback'
  | 'tees'
  | 'swatches'
  | 'hanger'
  | 'tape'
  | 'sizetag'
  | 'cartons'
  | 'scanner'
  | 'clipboard'
  | 'pallet'
  | 'mic'
  | 'headphones'
  | 'prompt'
  | 'orb';

export type TableProp = { key: PropKey; label: string };

export const tableProps: Record<string, TableProp[]> = {
  'young-onion': [
    { key: 'eraser', label: 'Onion eraser · Young Onion' },
    { key: 'pens', label: 'Gel pens · Astro SSR product pages' },
    { key: 'washi', label: 'Washi tape · Preact cart' },
    { key: 'notepad', label: 'Sticky notes · 79 of 168 PRs' },
    { key: 'highlighters', label: 'Highlighters · Playwright checks' },
  ],
  zetstore: [
    { key: 'invoices', label: 'GST invoices · Laravel 13' },
    { key: 'parcel', label: 'Parcel · shipping-aware GST' },
    { key: 'calculator', label: 'Calculator · GSTR-1 CSV export' },
    { key: 'jar', label: 'Millets · GD Farm Fresh' },
  ],
  doc2home: [
    { key: 'stethoscope', label: 'Stethoscope · doctor at home' },
    { key: 'callback', label: 'Callback · consultant assigns a provider' },
    { key: 'pills', label: 'Pill organiser · five-step booking' },
    { key: 'firstaid', label: 'First aid · Next.js + Prisma' },
  ],
  fiomis: [
    { key: 'tees', label: 'Tees · Medusa v2 catalogue' },
    { key: 'tape', label: 'Measuring tape · GST-aware pricing' },
    { key: 'swatches', label: 'Swatches · Astro + React' },
    { key: 'hanger', label: 'Hanger · Razorpay webhook orders' },
    { key: 'sizetag', label: 'Size tag · append-only stock ledger' },
  ],
  inventra: [
    { key: 'cartons', label: 'Cartons · purchase order to bill' },
    { key: 'scanner', label: 'Barcode scanner · Inventra RBAC' },
    { key: 'clipboard', label: 'Stock count · Vitest-tested maths' },
    { key: 'pallet', label: 'Pallet · JIT stock + EOQ' },
  ],
  'ai-saas': [
    { key: 'mic', label: 'Mic · videos to X threads' },
    { key: 'orb', label: 'AI agent · Claude + GPT APIs' },
    { key: 'headphones', label: 'Headphones · Next.js front end' },
    { key: 'prompt', label: 'prompt v3 · one-click repurposing' },
  ],
};
