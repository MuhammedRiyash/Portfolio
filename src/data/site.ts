/**
 * Single source of truth for every piece of copy on the site.
 * Everything here is taken from Muhammed's resume and the public showcase READMEs.
 * Do not add testimonials, client counts, prices, awards or metrics that are not on the resume.
 */

export const person = {
  name: 'Muhammed Riyash J',
  shortName: 'Riyash',
  title: 'Senior Full-Stack Developer',
  location: 'Bengaluru, India',
  email: 'thisismd.riyash@gmail.com',
  phone: '+91 70948 36267',
  phoneHref: 'tel:+917094836267',
  whatsapp: 'https://wa.me/917094836267',
  linkedin: 'https://www.linkedin.com/in/muhammedriyash',
  github: 'https://github.com/MuhammedRiyash',
  url: 'https://md-riyash-portfolio.vercel.app/',
  resume: '/Muhammed_Riyash_J_Resume.pdf',
  formspree: 'https://formspree.io/f/xgokrkbd',
  languages: ['English (professional)', 'Tamil (native)', 'Arabic (conversational)'],
} as const;

export const summary =
  'Senior full-stack developer with 3+ years building headless storefronts, Laravel commerce back ends and WooCommerce stores, with 20+ sites shipped to production. Works across Astro, React, Next.js, TypeScript and PHP/Laravel, tests builds end-to-end against the live store, and recently shipped an AI content SaaS on the Claude and GPT APIs.';

export const bio = [
  'I’m a senior full-stack developer in Bengaluru building headless commerce: an Astro and Preact storefront for Young Onion, the multi-store Laravel platform behind it, and fast Astro marketing sites.',
  'Since September 2023 the stack has kept widening: 12+ WordPress and Shopify sites, then in 2026 full-stack builds — 360 Home Healthcare, Fiomis, Inventra and an AI content SaaS. I test against the live site with Playwright, and I care about Core Web Vitals and accessibility as much as the feature list.',
];

export type Chapter = {
  id: string;
  title: string;
  kicker: string;
  context: string;
  role: string;
  stack: string[];
  year: string;
  outcomes: string[];
  link: { href: string; label: string; note?: string };
  /** Public production URL, when the site is live. */
  live?: { href: string; label: string };
};

/** Illustrative HTML mockups (range-rail posters) for unreleased work. Chapter screens live in Work.astro. */
export type MockKind = 'fiomis' | 'inventra' | 'ai';

const mail = (subject: string) => `mailto:${person.email}?subject=${encodeURIComponent(subject)}`;

export const chapters: Chapter[] = [
  {
    id: 'young-onion',
    title: 'Young Onion storefront',
    kicker: 'Headless storefront',
    context: 'Headless storefront · Astro SSR + Preact',
    role: 'Top contributor',
    stack: ['Astro SSR', 'Preact', 'TypeScript', 'Playwright'],
    year: '2026',
    outcomes: [
      'New Astro SSR + Preact storefront replacing the WordPress store at youngonion.in.',
      'Top contributor: 79 of 168 merged pull requests across product pages, cart, checkout, accounts and SEO schema.',
      'On the old WooCommerce store: re-enabled Cloudflare page caching, dropped 19 unused files (251 KB) per page and ~0.6 s of Meta API calls.',
    ],
    link: { href: mail('Young Onion storefront: walkthrough'), label: 'Ask for a walkthrough', note: 'Private repository' },
  },
  {
    id: 'zetstore',
    title: 'ZetStore',
    kicker: 'Multi-store commerce platform',
    context: 'Commerce platform · Laravel 13 · GST',
    role: 'Full-stack developer',
    stack: ['Laravel 13', 'PHP', 'MySQL', 'REST'],
    year: '2026',
    outcomes: [
      'Extended the Laravel 13 platform behind GD Farm Fresh and Young Onion: GSTR-1 reports with CSV export, coupon- and shipping-aware GST, back-in-stock waitlist.',
      'Hardened inventory and purchasing with server-side checks on purchase orders, returns, stock transfers, counts, warehouses and supplier imports — across 110 pull requests.',
      'Shipped the live GD Farm Fresh headless storefront over the ZetStore API, with fixes covered by Playwright tests.',
    ],
    link: { href: mail('ZetStore: walkthrough'), label: 'Ask for a walkthrough', note: 'Internal platform' },
  },
  {
    id: 'fiomis',
    title: 'Fiomis',
    kicker: 'Headless clothing store · “Choose Better”',
    context: 'Headless commerce · Astro + Medusa v2',
    role: 'Full-stack developer',
    stack: ['Astro', 'React', 'Medusa v2', 'PostgreSQL 16', 'Redis 7', 'Razorpay'],
    year: '2026',
    outcomes: [
      'Razorpay orders completed by a server-side webhook, with an append-only stock ledger and GST-aware pricing and invoicing.',
      'Admin OTP + 2FA + RBAC; CI runs Playwright across five viewports with 40+ test files.',
      'A scroll-driven 3D brand story with a shared motion system — plus focus trapping, skip link and 44 px touch targets.',
    ],
    link: { href: 'https://github.com/MuhammedRiyash/fiomis-showcase', label: 'Case study / Request source access' },
  },
  {
    id: 'doc2home',
    title: '360 Home Healthcare',
    kicker: 'Doc2Home — home-healthcare platform, Chennai',
    context: 'Secure booking platform · Next.js · AES-256-GCM',
    role: 'Full-stack developer',
    stack: ['Next.js', 'Prisma', 'PostgreSQL', 'Auth.js v5', 'Tailwind v4', 'Nginx'],
    year: '2026',
    outcomes: [
      'Live at 360homehealthcare.in: patients request a doctor online or at home, physiotherapy, diagnostics, nursing or home care; a consultant calls back and assigns a verified provider.',
      'A five-step, OTP-verified booking wizard and provider onboarding with KYC and admin verification.',
      'AES-256-GCM encryption at rest with blind-indexed phone and licence numbers; encrypted document storage; admin console for bookings, verification, lead matching and reports.',
    ],
    link: { href: 'https://github.com/MuhammedRiyash/doc2home-showcase', label: 'Case study / Request source access' },
    live: { href: 'https://360homehealthcare.in/', label: 'Visit live site' },
  },
  {
    id: 'inventra',
    title: 'Inventra',
    kicker: 'Inventory that compounds',
    context: 'Inventory SaaS · Next.js 16 · RBAC',
    role: 'Full-stack developer',
    stack: ['Next.js 16', 'TypeScript', 'Prisma', 'PostgreSQL', 'NextAuth v5', 'shadcn/ui'],
    year: '2026',
    outcomes: [
      'A procure-to-bill flow: vendors, purchase orders, warehouses, JIT stock and billing.',
      '15+ effectiveness ratios plus an EOQ widget, behind 4 roles — admin, manager, clerk, accountant.',
      'Core maths unit-tested in Vitest; Playwright covers login → vendor → PO → bill end to end.',
    ],
    link: { href: 'https://github.com/MuhammedRiyash/inventra-showcase', label: 'Case study / Request source access' },
  },
  {
    id: 'ai-saas',
    title: 'AI Content SaaS',
    kicker: 'One-click content repurposing',
    context: 'AI product · Claude + GPT APIs · Agents',
    role: 'Full-stack developer',
    stack: ['Next.js', 'Claude API', 'OpenAI GPT'],
    year: '2026',
    outcomes: [
      'A one-click micro-SaaS that turns blog posts and videos into X threads and LinkedIn carousels.',
      'Built on the Claude and GPT APIs with a Next.js front end.',
    ],
    link: { href: mail('AI content SaaS: walkthrough'), label: 'Ask for a walkthrough', note: 'Unreleased' },
  },
];

/** Work intro strip: how the stack grew, oldest → newest (resume tech only). */
export const evolution = [
  { when: '2023', what: 'React + Laravel' },
  { when: '2023–25', what: 'WordPress · WooCommerce · Shopify' },
  { when: '2026', what: 'Astro · Preact · headless commerce' },
  { when: '2026', what: 'Laravel 13 commerce platforms' },
  { when: '2026', what: 'Next.js 16 · Prisma · encryption' },
  { when: '2026', what: 'Medusa v2' },
  { when: '2026', what: 'AI agents · Claude/GPT APIs' },
];

export type RangeItem = {
  name: string;
  what: string;
  /** Tech tags (plus the year where it places the build on the stack's timeline). */
  stack: string;
  href?: string;
  /** Poster: a real homepage screenshot (src/assets) or, with no public site, an illustrative HTML mockup. */
  poster:
    | { image: 'taskify' | 'h360' | 'komaki' | 'sgr777' | 'taabi' | 'jr-builders' | 'eleenova' | 'botticelli' | 'transworld' | 'hmj' | 'srishti' | 'morca' }
    | { mock: MockKind };
  hue: number;
};

/** "The range" rail (Freelance.astro): every site and product, framed by its stack — no employer/client labels. */
export const range: RangeItem[] = [
  { name: '360 Home Healthcare', what: 'Next.js platform for at-home doctors, physio, diagnostics and nursing in Chennai (Doc2Home)', stack: 'Next.js · Prisma · PostgreSQL · 2026', href: 'https://360homehealthcare.in/', poster: { image: 'h360' }, hue: 170 },
  { name: 'Fiomis', what: 'Astro storefront on a Medusa v2 back end, with Razorpay and a stock ledger', stack: 'Astro · Medusa v2 · PostgreSQL · 2026', poster: { mock: 'fiomis' }, hue: 36 },
  { name: 'Inventra', what: 'Procure-to-bill inventory dashboard with 15+ ratios and 4 roles', stack: 'Next.js 16 · Prisma · PostgreSQL · 2026', poster: { mock: 'inventra' }, hue: 200 },
  { name: 'AI content SaaS', what: 'AI content repurposing SaaS — unreleased', stack: 'Next.js · Claude · GPT · 2026', poster: { mock: 'ai' }, hue: 14 },
  { name: 'KOMAKI', what: 'Campaign lead-capture WordPress plugin with an admin dashboard', stack: 'WordPress · PHP', href: 'https://komaki.in', poster: { image: 'komaki' }, hue: 150 },
  { name: 'SGR777 Foods', what: 'WooCommerce referral plugin + phone-verified first-order discount', stack: 'WooCommerce · PHP', href: 'https://www.sgr777foods.com', poster: { image: 'sgr777' }, hue: 32 },
  { name: 'TAABI AI', what: 'Responsive interfaces for an AI SaaS platform', stack: 'React', href: 'https://taabi.ai', poster: { image: 'taabi' }, hue: 220 },
  { name: 'JR Builders', what: 'Responsive website for a construction company', stack: 'Website', poster: { image: 'jr-builders' }, hue: 18 },
  { name: 'Taskify', what: 'Task-management web app', stack: 'React · Laravel · 2023', poster: { image: 'taskify' }, hue: 250 },
  { name: 'Eleenova', what: 'Custom Shopify storefront built with Liquid and metafields — performance, clean UI and conversion-ready layouts', stack: 'Shopify · Liquid · Metafields', href: 'https://eleenova.com/', poster: { image: 'eleenova' }, hue: 215 },
  { name: 'Botticelli', what: 'Shopify migration for a women’s fashion boutique, then store structure, product pages and speed optimised', stack: 'Shopify · Migration', href: 'https://botticelliri.com/', poster: { image: 'botticelli' }, hue: 28 },
  { name: 'Transworld Academy', what: 'Educational website with structured course listings and clear navigation for admissions', stack: 'WordPress · Education', href: 'https://transworldacademy.com/', poster: { image: 'transworld' }, hue: 210 },
  { name: 'HMJ Developers', what: 'Real-estate corporate website with project showcases and conversion-focused layouts', stack: 'WordPress · Real estate', href: 'https://hmjdevelopers.com/', poster: { image: 'hmj' }, hue: 40 },
  { name: 'Srishti Construction', what: 'Website for real-estate developers, builders and contractors: projects, services and company profile', stack: 'WordPress · Construction', href: 'https://srishticonstruction.co.in/', poster: { image: 'srishti' }, hue: 120 },
  { name: 'Morca Pumps', what: 'Corporate website for a solar water-pump manufacturer with structured product information', stack: 'Next.js · Manufacturing', href: 'https://morcapumps.com/', poster: { image: 'morca' }, hue: 200 },
];

export type Role = {
  company: string;
  role: string;
  period: string;
  place: string;
  bullets: string[];
};

export const experience: Role[] = [
  {
    company: 'Zethic Technologies LLP',
    role: 'Senior Full-Stack Developer',
    period: 'Feb 2026 – Present',
    place: 'Bengaluru, India',
    bullets: [
      'Built the new Young Onion storefront (Astro SSR, Preact, TypeScript) that replaces the WordPress store at youngonion.in; top contributor with 79 of 168 merged pull requests across product pages, cart, checkout, accounts and SEO schema.',
      'Extended ZetStore, the company’s multi-store Laravel 13 commerce platform behind GD Farm Fresh and Young Onion: GSTR-1 reports with CSV export, coupon- and shipping-aware GST, and a back-in-stock waitlist.',
      'Hardened ZetStore’s inventory and purchasing with server-side checks on purchase orders, returns, stock transfers, stock counts, warehouses and supplier imports, across 110 pull requests.',
      'Developed the live GD Farm Fresh headless storefront (Astro, Preact, Tailwind CSS on Cloudflare, over the ZetStore API), shipping 8 catalog, routing and layout fixes covered by Playwright tests.',
      'Built a Mystery Box fulfilment plugin for Young Onion’s WooCommerce store that fills orders automatically on payment, replacing a manual coupon-and-child-order process; custom tables, REST endpoints, WP-CLI and 146 automated tests.',
      'Sped up Young Onion’s WooCommerce store: re-enabled Cloudflare page caching a payment plugin had blocked, dropped 19 unused CSS/JS files (251 KB) per page and took ~0.6 s of Meta API calls off each page load.',
      'Shipped 36 pull requests to the company website, zethic.com (Astro, React, Tailwind CSS, Cloudflare): a rebuilt Careers page with a cached LinkedIn feed, 8 multilingual pages, 12 city landing pages, new service and portfolio pages, and sitemap tests.',
      'Implemented OneTrust consent gating for Odessa Inc. (US) on Divi WordPress: 6 Google Tag Manager consent triggers covering 30 tags, GA4 moved from the theme header into GTM, and 2 SSL and crawler-blocking issues traced.',
      'Owned three Laravel 8 and static HTML/CSS/JavaScript marketing websites (190+ commits), shipping reCAPTCHA middleware, a multi-step lead-capture form with source attribution, SEO redirects and a Mailchimp signup fix.',
    ],
  },
  {
    company: 'Freelance',
    role: 'Full-Stack, WordPress and Shopify Developer',
    period: 'Sep 2023 – Present',
    place: 'Remote',
    bullets: [
      '2026 client projects: 360 Home Healthcare (Doc2Home), a live Next.js home-healthcare platform at 360homehealthcare.in; Fiomis, a headless clothing store on Astro and Medusa v2; Inventra, a Next.js 16 inventory dashboard; and an AI content-repurposing SaaS on the Claude and GPT APIs.',
      'Delivered 12+ WordPress and Shopify websites for SMEs and startups, lifting organic traffic by 25% on average.',
      'Built 3 custom plugins: a lead-management dashboard with forms, filters, CSV export and user roles; a WooCommerce order-tracking system with notifications; and a WooCommerce referral engine with points and analytics.',
      'Optimized 3 Shopify stores with Liquid, JavaScript and metafields, adding sticky CTAs, bundles and upsells that raised conversion by about 10% and average order value by 12%, with PageSpeed scores of 85+ on mobile and desktop.',
    ],
  },
  {
    company: 'Besant Technologies',
    role: 'Full-Stack Developer Intern',
    period: 'Jan 2023 – Aug 2023',
    place: 'Chennai, India',
    bullets: [
      'Built Taskify, a task-management web app, over 6 months with React, Material UI, Redux Toolkit and Laravel REST APIs.',
    ],
  },
];

/** Short highlights used on the cinematic timeline (full bullets, with the numbers, live on /cv). */
export const timeline = [
  {
    period: 'Feb 2026 — Now',
    company: 'Zethic Technologies',
    role: 'Senior Full-Stack Developer · Bengaluru',
    lines: [
      'The new Young Onion storefront in Astro SSR + Preact — product pages, cart, checkout, accounts and SEO schema.',
      'ZetStore (Laravel 13): GSTR-1 reports, GST-aware coupons and shipping, a back-in-stock waitlist and server-side inventory checks.',
      'A Mystery Box fulfilment plugin for WooCommerce, the GD Farm Fresh headless storefront and zethic.com.',
    ],
  },
  {
    period: 'Sep 2023 — Now',
    company: 'Freelance',
    role: 'Full-Stack, WordPress and Shopify Developer · Remote',
    lines: [
      '2026 client builds: 360 Home Healthcare (live), Fiomis, Inventra and an AI content SaaS.',
      'WordPress and Shopify sites for SMEs and startups, with technical SEO built in.',
      'Custom plugins: lead management, WooCommerce order tracking and WooCommerce referrals.',
      'Shopify store optimisation with Liquid and metafields: sticky CTAs, bundles and upsells.',
    ],
  },
  {
    period: 'Jan — Aug 2023',
    company: 'Besant Technologies',
    role: 'Full-Stack Developer Intern · Chennai',
    lines: ['Built Taskify over 6 months with React, Material UI, Redux Toolkit and Laravel REST APIs.'],
  },
];

export const skills: { group: string; items: string[] }[] = [
  { group: 'Languages', items: ['JavaScript (ES6+)', 'TypeScript', 'PHP', 'HTML5', 'CSS3', 'SQL', 'Python (scripting)'] },
  { group: 'Frontend', items: ['React', 'Preact', 'Astro (SSR/SSG)', 'Next.js', 'Tailwind CSS', 'Vite', 'Material UI', 'Redux Toolkit', 'Responsive Design'] },
  { group: 'Backend and Data', items: ['Laravel', 'Node.js', 'REST APIs', 'Medusa v2', 'Prisma', 'MySQL', 'PostgreSQL', 'LLM APIs (Claude, OpenAI GPT)'] },
  { group: 'WordPress and E-commerce', items: ['WordPress (plugins, themes)', 'WooCommerce (REST API, WP-CLI)', 'Shopify (Liquid)', 'Elementor'] },
  { group: 'Testing and Performance', items: ['Playwright', 'Vitest', 'PHPUnit', 'axe-core', 'Lighthouse', 'Core Web Vitals', 'Cross-Browser QA'] },
  { group: 'SEO and Tools', items: ['Technical SEO', 'Google Tag Manager', 'GA4', 'OneTrust', 'Git', 'Cloudflare', 'Docker', 'Coolify', 'Jira', 'Agile/Scrum'] },
];

export type Layer = {
  id: string;
  name: string;
  what: string;
  detail: string;
  /** Real project names. */
  tags: { name: string }[];
};

/** "One developer, the whole product." Each layer of a product he builds, with the projects where he built it. */
export const layers: Layer[] = [
  {
    id: 'ui',
    name: 'UI layer',
    what: 'Storefronts & admin UIs',
    detail: 'Astro SSR and Preact storefronts, Next.js dashboards and admin consoles.',
    tags: [{ name: 'Young Onion' }, { name: 'GD Farm Fresh' }, { name: 'Fiomis' }, { name: 'Inventra' }],
  },
  {
    id: 'api',
    name: 'API layer',
    what: 'REST APIs & business rules',
    detail: 'Laravel and Medusa back ends: GST logic, purchase orders, returns and stock transfers.',
    tags: [{ name: 'ZetStore' }, { name: 'Mystery Box' }, { name: 'Fiomis' }, { name: 'Inventra' }],
  },
  {
    id: 'data',
    name: 'Data layer',
    what: 'PostgreSQL/MySQL schemas',
    detail: 'Prisma and SQL schemas, an append-only stock ledger, encrypted records with blind indexes.',
    tags: [{ name: '360 Home Healthcare' }, { name: 'Fiomis' }, { name: 'Inventra' }, { name: 'ZetStore' }],
  },
  {
    id: 'pay',
    name: 'Payments & auth',
    what: 'Razorpay, OTP & 2FA',
    detail: 'Razorpay orders completed by a server-side webhook; OTP, 2FA and role-based access.',
    tags: [{ name: 'Fiomis' }, { name: '360 Home Healthcare' }, { name: 'Inventra' }, { name: 'SGR777 Foods' }],
  },
  {
    id: 'infra',
    name: 'Infra & deploy',
    what: 'Cloudflare, CI & tests',
    detail: 'Cloudflare caching, Playwright CI across viewports, Vitest and PHPUnit suites, Nginx.',
    tags: [{ name: 'Young Onion' }, { name: 'GD Farm Fresh' }, { name: 'Fiomis' }, { name: '360 Home Healthcare' }],
  },
];

export const education = [
  { school: 'SRM University, Sikkim', degree: 'Master of Computer Applications (MCA), Online', period: 'Apr 2025 – Aug 2027 (expected)' },
  { school: 'RDB College of Arts and Science, Papanasam', degree: 'Bachelor of Commerce (B.Com)', period: 'Oct 2019 – Sep 2022' },
];

export const certifications = ['Java Full-Stack Development (Besant Technologies)', 'Web Development Masterclass (YouAccel)'];

/** 2026 freelance client projects, as listed on /cv. */
export const projectsCv = [
  { name: '360 Home Healthcare (Doc2Home)', year: '2026', href: 'https://360homehealthcare.in/', text: 'Client project, live: home-healthcare platform on Next.js and Prisma/PostgreSQL — patient booking, provider onboarding, admin analytics. Case study: github.com/MuhammedRiyash/doc2home-showcase.' },
  { name: 'Fiomis — Headless Clothing Store', year: '2026', href: 'https://github.com/MuhammedRiyash/fiomis-showcase', text: 'Client project: Astro storefront (SSR/SSG, islands) on a Medusa v2 back end in a TypeScript monorepo; in development.' },
  { name: 'Inventra — Inventory Dashboard', year: '2026', href: 'https://github.com/MuhammedRiyash/inventra-showcase', text: 'Client project: Next.js 16 / TypeScript inventory dashboard for retailers — vendors, purchase orders, warehouses, JIT stock, billing, 15+ KPIs.' },
  { name: 'AI Content Repurposing SaaS', year: '2026', text: 'Client project, unreleased: one-click micro-SaaS that turns blog posts and videos into X threads and LinkedIn carousels; Next.js, Claude and GPT APIs.' },
];
