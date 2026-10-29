# AGENTS.md — Muhammed Riyash J · Portfolio

Handoff notes for anyone (human or agent) picking this repo up. Keep this file short and current.

## What this is
- Cinematic personal portfolio of **Muhammed Riyash J — Senior Full-Stack Developer, Bengaluru, India**.
  Audience: hiring managers, agencies and freelance clients. A fast printable CV lives at `/cv`.
- Live: **https://md-riyash-portfolio.vercel.app/** (printed on the resume and the showcase READMEs — the URL must keep working).
- Deploy: Vercel project builds on push to `main`; `vercel.json` sets `{"framework":"astro"}`. Output is static `dist/`.

## Stack
- Astro 7 (static output, TypeScript strict), no UI framework.
- Motion: GSAP 3 + ScrollTrigger, Lenis (driven from `gsap.ticker`; `lerp .15`, `wheelMultiplier 1.15`, native touch momentum), CSS transitions.
- 3D: three.js (named imports + `three/addons` RoundedBoxGeometry/RoomEnvironment), **one renderer, one fixed canvas**, dynamically imported after the UI is wired (`src/scripts/gl.ts` → `gl-scene.ts`).
- Fonts: self-hosted via Astro Fonts API (`astro.config.mjs`) from `@fontsource-variable/inter-tight` (display), `@fontsource-variable/geist` (body), `@fontsource-variable/geist-mono` (labels); metric-matched fallbacks are generated automatically.
- Images: `astro:assets` (`<Image>`), sources in `src/assets/`.
- Node 22+ (developed on Node 24). Package manager: npm.

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static build into dist/ (also writes sitemap)
npm run check     # astro check (types + .astro diagnostics)
npm run preview   # serves dist/ (Astro 7 runs it in the background; stop with `npx astro preview stop`)
```

## Folder map
```
src/
  pages/index.astro      cinematic one-pager; holds the single shared <canvas class="gl" data-gl>
  pages/cv.astro         printable CV (no 3D, print CSS for A4 — 2 pages)
  layouts/Base.astro     <head>: SEO meta, OG/Twitter, JSON-LD Person, fonts, boot watchdog script
  components/            Loader, Header (chrome, menu, gauge, cursor), Hero, Stack ("One developer, the whole
                         product." layer stack), Statement, Reel, Work (chapters) + Mock (content-filled HTML
                         UI renders), Freelance (Grid rail/Index), Experience, Toolbox (skills + velocity
                         marquee), Finale (contact + form), Footer (flood, "MD Riyash." wordmark)
  data/site.ts           ALL copy: identity, bio, chapters, layers, freelance, experience, skills, education
  scripts/main.ts        entry: Lenis+ScrollTrigger, wires UI, runs loader, lead watcher, then boots WebGL
  scripts/chrome.ts      header hide/show, IST ticker, gauge, menu, anchors (Lenis scrollTo 0.6 s), cursor
  scripts/sections.ts    scrubbed choreography: split-word headings, stack labels + CSS stack, statement words,
                         reel, chapter clip-path wipes, freelance rail, velocity marquee, timeline, flood, magnetic
  scripts/stack-map.ts   scroll mappings shared by 3D, DOM and header: stack phase (layer the camera is at) + day clock
  scripts/ui.ts          reveals, Grid/Index toggle (emits `layoutchange`) + peek, Formspree form
  scripts/loader.ts      intro counter driven by real milestones (fonts, hero still, scene)
  scripts/gl.ts          tiny lazy boot (main bundle); everything below is the lazy `gl-scene` chunk
  scripts/gl-scene.ts    renderer, zones (IntersectionObserver), gsap.ticker frame, act switching, hero clip
  scripts/gl-world.ts    "A Day in the Stack": camera director, time-of-day light; gl-desk/gl-city/gl-cars build the parts
  scripts/gl-devices.ts  project plinths: laptop + phone (gl-models.ts) with the chapter's screen pair on the project's
                         table, toy cars, frustum-solved framing, per-stage scissoring (see "A Day in the Stack" below)
  scripts/gl-props.ts    per-project tables (wood slab + desk mat) and themed miniature props, merged per table
  data/props.ts          prop keys + labels per chapter (hover tag in 3D and the sr-only list in Work.astro)
  scripts/lead-watch.ts  pop-up triggers (main bundle, tiny); scripts/popup.ts + styles/popup.css = lazy chunk
  styles/global.css      tokens, reset, reveal + split-word system, shared canvas, grain, Lenis CSS
  assets/                real screenshots: 360homehealthcare-{1440,390}, gd-farm-fresh-{desktop,mobile},
                         young-onion-woo-{desktop,mobile}, komaki/sgr777/taabi-desktop,
                         jr-builders (old portfolio card), taskify; {fiomis,inventra,ai-saas}-{desktop,mobile} renders; portrait.jpg
public/stills/           per-theme WebP stills of the 3D (DayStill.astro): desk-am, city, plinth, street, desk-pm
public/                  og.png (1200×630), favicon.svg/-32.png, apple-touch-icon.png, robots.txt,
                         Muhammed_Riyash_J_Resume.pdf (Download CV)
```

## Content rules (non-negotiable)
- The resume is the source of truth. Copy lives in `src/data/site.ts`; reuse it, don't invent.
- No testimonials, client counts, ratings, awards, prices or stats that are not on the resume. Metrics allowed: 3+ years, 20+ sites, 79/168 PRs, 110 PRs, 146 tests, 251 KB / 19 files, ~0.6 s, 36 PRs, 30 tags / 6 triggers, 12+ freelance sites, +25% organic, ~10% conversion, +12% AOV, PageSpeed 85+.
- **Framing rule (Muhammed, 2026-10-30): outside the Experience section and /cv, frame everything around his skills and the evolution of his stack — never around employer vs clients.** "Zethic"/"Zethic Technologies" appears ONLY in the Experience timeline and the /cv experience entries (`experience`, `timeline`, `projects` in `site.ts`); no "client", "freelance", "full-time", "firm", "employer", "internship" wording in hero, about, stack, work, range, ticker/legend, 3D labels, meta, OG or JSON-LD (no `worksFor`). Exception: none needed — the Finale/Footer link to the Website reads "Web development services → muhammedriyash.github.io/Website". Chapter `context` is a capability + tech line ("Headless storefront · Astro SSR + Preact", "Secure booking platform · Next.js · AES-256-GCM"…); the Work intro is "Six builds. One evolving stack." with the `evolution` strip (resume tech only); the rail is "The range — 2023 to now" (`range` in `site.ts`) with tech-tag card meta only. Never relabel full-time work as freelance or vice versa — simply don't label it. Check: `grep -rniE "zethic|client|freelanc|full-time|firm" src` hits only Experience/cv data, code identifiers (`#freelance`, `freelanceRail`, `clientX`…) and comments.
- Fiomis, Doc2Home (live as **360 Home Healthcare**, https://360homehealthcare.in/), Inventra and the AI content-repurposing SaaS are **freelance client projects from 2026** — never call them his own products (on /cv and in Experience they say so; elsewhere they are just builds).
  - 360 Home Healthcare: chapter title "360 Home Healthcare" with "Doc2Home" as the codename; links "Visit live site ↗" (rel noopener) plus the showcase repo. Never reuse the client's marketing stats (review counts, ratings) in our copy.
  - Fiomis and Inventra have no live URLs: link only to the public showcase repos (`github.com/MuhammedRiyash/{fiomis,doc2home,inventra}-showcase`), labelled "Case study / Request source access". Never link the private repos.
  - AI content SaaS: "Unreleased", no link.
- Freelance runs **Sep 2023 – Present** (shown in Experience and /cv).
- Employer work is listed under its company in Experience and /cv only — elsewhere every build is framed by capability and stack, never by who it was for.
- Freelance client names are plain text (no logos). **Real screenshots only for live public sites**: 360 Home Healthcare (labelled "Live site"), GD Farm Fresh, the youngonion.in Woo store, KOMAKI, SGR777, TAABI and the range sites — plus Taskify. Unreleased client work (Fiomis, Inventra, the AI SaaS) never shows real captures, not even dev builds: its laptop is an HTML mockup and its phone an illustrative render (`src/assets/{fiomis,inventra,ai-saas}-mobile.png`, built from HTML at 390×844 @2x), both labelled "Illustrative · sample data".
  - The range rail (15 cards, `range` in `site.ts`, rendered by `Freelance.astro` in `#freelance`; the old "Also built for" text list and the `clients` export are gone — every site has a card, every card a real homepage screenshot or Mock). Captured 2026-10-29/30: Eleenova and Botticelli (Shopify — `powered-by: Shopify`; Botticelli's site is **https://botticelliri.com/**, plain HTTP fetches get 429 so use headless Chrome, close the newsletter pop-ups), Transworld Academy, HMJ Developers and Srishti Construction (WordPress + Elementor generator meta; Srishti's site is **https://srishticonstruction.co.in/** — the `.com` is a parked GoDaddy domain; botticellishoes.com is dead too), Morca Pumps (the live site is a Next.js app → tagged Next.js) — all with "Visit site ↗".
- Canonical identity line: **Muhammed Riyash J · Senior Full-Stack Developer · Bengaluru, India** · thisismd.riyash@gmail.com · +91 70948 36267 · linkedin.com/in/muhammedriyash · github.com/MuhammedRiyash · https://wa.me/917094836267.
- Repo is public: no secrets, tokens, private-repo contents or personal data beyond those public contact details.

## Design system
- Colours: **three dark themes** on `<html data-theme>` — `noir` (default; ink `#0B0B0C`, bone `#ECE8E1`, muted `#8C877F`, signal `#FF5B2E`), `midnight` (`#0A0F1E` / `#E6EAF5` / `#8E98B5` / ice blue `#6EA8FF`), `forest` (`#0D1A14` / `#E6EFE8` / `#93A79A` / lime `#C8F169`). Tokens (global.css): `--bg` (= `--ink`, the ground), `--surface`(`--ink-2`), `--surface-2`, `--bone` (foreground), `--bone-2`, `--muted`, `--muted-on-bone`, `--signal`, `--signal-ink` (text on signal), `--signal-text` (small accent text), `--signal-on-bone` (accent on inverted bone fills — footer, reel card, solid pills; ≥ 3:1), `--shadow`, `--grain-opacity`; derived with color-mix: `--line`, `--line-strong`, `--line-on-bone`, `--glass`, `--signal-soft`, `--focus`; `--device` (graphite hardware, all themes). Never hard-code colours in components; the only literals are the palettes, the mock-render product palettes (pinned on `.mock-win`, they illustrate client UIs) and `/cv` print.
- Theme runtime: pre-paint inline script in `Base.astro` (localStorage `pf-theme`, unknown/retired values such as `paper` migrate to Noir, sets `theme-color`); `src/scripts/theme.ts` wires every `ThemeSwitch.astro` radiogroup (header compact ≥ 768, menu, `/cv` bar; arrows/Home/End, roving tabindex, aria-checked), crossfades with View Transitions and dispatches `pf:theme` `{detail:{name}}` after the attribute changes (the WebGL world re-themes on it). `/cv` follows the theme on screen and always prints black on white.
- **Add a theme**: add `{name,label,ground,accent}` to `src/data/themes.ts`, a `:root[data-theme='<name>']` palette block in `global.css` (all palette tokens; check AA: `--muted` ≥ 4.5 on `--bg`/`--surface`, `--muted-on-bone` ≥ 4.5 on `--bone`, `--signal-on-bone` ≥ 3 on `--bone`), the checked-state selectors in `ThemeSwitch.astro`, and the scene palette/stills on the WebGL side.
- Type: **Inter Tight** variable (display, weight 560, tracking `--track` −0.022em — tighter makes r·o / f·i / F·r touch at 60–120 px; the velocity marquee uses 0 because of y·w / x·t; −0.02em on the giant footer wordmark; lh ≈ .95; `font-kerning: normal`, `font-optical-sizing: auto`), Geist (body 16px/1.55), Geist Mono (labels, uppercase, `[01]` brackets). Emphasis is colour/weight only — no italics.
- Short brand mark: **MD Riyash** (header wordmark, "MD" monogram, footer "MD Riyash."). Full name "Muhammed Riyash J" everywhere else (body copy, /cv, JSON-LD, meta, copyright).
- Spacing: gutter `--g: clamp(20px, 4.4vw, 72px)`; radius `--r: 18px` (14 on phones); header height 76/64.
- Easing: `--ease: cubic-bezier(.16,1,.3,1)`; curtain `cubic-bezier(.7,0,.2,1)`.
- Motion model: pinned sections are CSS `position: sticky` inside tall wrappers; GSAP/ScrollTrigger only scrubs values (reversible, no pin-spacers). Pins stay short (stack 250vh, reel 250vh, chapters 250vh overlapping by 150vh with a 50vh clip-path wipe, freelance rail min(half its travel, 150vh) + 100vh — 15 cards hit the cap, so the rail moves ≈ 4 px sideways per px of scroll at 1440, flood 160vh; ≤ 200vh below 1024 px) — pinned travel ≤ 150vh desktop, ≤ 100vh below 1024. Section h2s are split into words and scrubbed (`[data-split]`); `.fade` paragraphs reveal once via IntersectionObserver.
- Shared WebGL canvas (`gl-scene.ts`): world act (hero → stack, canvas behind `<main>`, clipped to the hero frame) and devices act (`html.gl-top`, canvas above `<main>`, transparent, scissored per chapter stage; `html.gl-dev` = devices own the mockups). Renders only while a 3D zone is visible and the tab is visible. Devices on every width: pinned chapters (≥1024×700) get full tables; unpinned chapters (<1024 or short viewports) get lite tables that scroll with the media column (lite laptop/phone, 2 props, 1 car). Without WebGL / reduced motion `.ch-phone` shows the phone capture over the HTML mockup (360: the plinth still).
- Boot classes on `<html>` (set by the inline head script in `Base.astro`):
  - `js` – JS ran. Reveal start states only apply under `html.js`.
  - `motion` – no reduced-motion preference. **All pinned/scrubbed layouts are gated on `html.motion:not(.boot-fail)`**; without it sections render static and stacked.
  - `skip-intro` – repeat visit (sessionStorage `mr:intro`) or reduced motion → no loader.
  - `nogl` – no WebGL2 or context lost → hero shows `hero-still.jpg`, the stack shows its CSS layers, chapters their HTML mockups.
  - `gl-live` / `gl-dev` / `gl-top` – set by the lazy WebGL module (see above).
  - `boot-fail` – watchdog fired (main module not done in 8 s) → everything visible, static.
- Reduced motion: no Lenis, no loader, no grain, no ticker roll, no pins (static stacked sections), the canvas moves into the hero frame and renders one still frame, no devices.
- No JS: loader hidden via `<noscript>`, all content visible, form posts to Formspree directly.
- Mobile (<768): same story, lighter — fewer 3D instances, DPR cap 1.25 (desktop 1.75), chapters unpinned (pins need ≥1024×700), reel shorter.
- Breakpoints verified: 360, 390, 768, 1024, 1280, 1440, 1920.

## How to…
- **Add a work chapter**: append to `chapters` in `src/data/site.ts` (id, title, kicker, context, role, stack, year, outcomes, link, optional `live`). Add its screen pair to `screens` in `Work.astro`: a 1440×900 desktop image + a 780×1688 phone image of the SAME product (real captures only for live public sites, banners closed; otherwise illustrative renders from HTML, labelled "Illustrative · sample data"). Numbering, pinning and the 3D plinth are automatic.
- **Add / change a project plinth** (`src/scripts/gl-devices.ts` + `gl-props.ts`): every chapter with `[data-ch-media]` gets a laptop (screen = `data-tex-desktop`, loaded as the chapter nears), a phone (`data-tex-phone`) and its table from `TABLES[chapter.id]` in `gl-props.ts`: `wood` tint (shared `woodTexture`), desk-mat colour (`grid: true` = cutting mat; ~5 % pulled to the theme accent, accent piping), `props` placements `[x, z, yaw]` in laptop widths (laptop base x −0.5…0.5, z 0…0.64; phone ≈ x 0.57…0.74; keep props in the left column x ≈ −0.72 or the front band z ≈ 0.95) and 1–2 `cars` `[kind, hue, x, z, heading]` (kinds `muscle|jdm|wedge|van|rally|openwheel` from `gl-cars.ts`, hue index into `HUES`). Layout is checked at build: a console warning fires if the phone, a prop or a car (at both ends of its roll) intersects a device or another prop, or a prop leaves the table — keep the console clean. Framing is solved per frame from the camera (safe frame = media column; pinned: inside the viewport), so no pixel offsets.
- **Add a prop to a plinth**: (1) add the key + label to `src/data/props.ts` — label = "thing · product/skill/technology" from the chapter copy, never an employer or "client/freelance/full-time" framing; list order = priority (lite tables keep the first two; put the prop with the idle loop there). (2) Add its builder to `DEFS` in `gl-props.ts`: procedural, rounded (`rbox`, lathe, tube…), no logos/trademarks, modelled in prop space (base on y = 0, centred, front = +z, ~real size next to a 1-unit laptop; drawn at `PROP_SCALE` 1.4); `size` = [half x, half z, height]; `reveal` = `drop|slide|unfold|subs`; parts go to channel `satin` (default; per-part `rough`/`metal`), `paper` (canvas atlas region — add one to `REGIONS` + a painter in `createAtlas`) or `glow` (unlit); `accent: 1` follows the theme. Moving parts call `sub(pivot)` and are driven by `animate()` (idle loops scale with `a.idle`, which is 0 under reduced motion). Max 16 slots per table (props + subs + the static slot). (3) Place it in the chapter's `TABLES` entry. Everything of a table is merged, so a prop costs no extra draw calls.
- **Re-render the stills** (after changing the scene; `public/stills/<noir|midnight|forest>/<desk-am|city|plinth|street|desk-pm>-{1600,800}.webp`): serve `dist/`, motion allowed (NOT emulated reduced motion — that skips WebGL and captures blank frames), per theme at a 16:10 desktop viewport: hide `main, header, .gauge, .grain, [data-agent-tags], [data-city-tags]` with `visibility: hidden` and drop `.gl` clip-path; screenshot at the top (desk-am), at 97% of the stack (city), at 23% of the rail's scroll travel (`[data-rail]` top + 0.23 × (height − viewport); street, rail mode only, 1600×1000 @2x → frames KOMAKI / SGR777 / TAABI) and just inside the flood with `[data-flood-disc]` hidden (desk-pm). Keep the capture tab in front (a background tab stops rendering and captures stale frames) and re-issue `scrollTo` for ~2 s so Lenis settles. Measure section anchors once at scrollY 0 — Lenis is still easing after a jump, so re-measuring mid-scroll gives wrong targets. Plinth: scroll 0.95 viewport heights past the top of `#doc2home` (props settled), transparent `html, body`, `omitBackground`, crop to the alpha bounds + 4 % padded to 1016:791 (Puppeteer `clip` is document-relative: add `scrollY`). Convert with PIL (or `sharp` from node_modules) to WebP q≈78–82 (plinth 1016×791 / 508×396 RGBA, others 1600×1000 / 800×500).
- **Add a freelance item**: append to `freelance` with a `poster` — a real screenshot (drop it in `src/assets/`, add the key and an import + `shots` entry in `Freelance.astro`; add it to `streetTex` and a shop in `gl-street.ts` `SHOPS` if it should get a 20:00 shopfront) or, for private work, a `Mock` kind. No text-only or empty posters.
- **Edit experience/skills/metrics/education**: edit the matching export in `site.ts`; `/cv` reads the same data (full bullets from `experience`, short highlights from `timeline`).
- **Replace the resume PDF**: overwrite `public/Muhammed_Riyash_J_Resume.pdf` (keep the filename; links point to it).
- **Lead pop-up**: `lead-watch.ts` (triggers: ≥50% scrolled + ≥8 s, top-edge exit after 8 s, fast upward touch flick past 40%; once per session `mr:lead`, 30 days quiet after a sent pop-up `mr:lead-sent`; never during loader/menu or after the inline form was focused). `popup.ts` builds a native modal `<dialog>` (Formspree `_source=portfolio-popup`), loaded only by dynamic import.
- **Day clock**: `stack-map.ts` `createDayClock()` maps scroll to 09:00 → 23:30 using the section anchors (hero, stack, work, freelance, flood); the header ticker, the hero legend (`[data-legend-act]`) and the 3D lighting all read the one `getDayClock()`.

### "A Day in the Stack" (WebGL) architecture
- `gl.ts` (main bundle) lazy-imports `gl-scene.ts` unless reduced motion / no WebGL2 → then the `DayStill` images are the experience.
- `gl-scene.ts`: renderer, PMREM room env, ACES; acts per frame: **day** (`gl-world` hero + stack, canvas behind `<main>`, clipped to the hero frame), **devices** (`gl-devices` + `gl-props`, `html.gl-top`, scissored per chapter; lite tables when unpinned), **night** (`gl-world` desk at 23:30 behind the transparent flood stage). Zones via IntersectionObserver; ticks only while visible and the tab is visible. `pf:theme` → `readPalette()` (CSS tokens) → `theme()` on world/devices/garage, one frame redrawn. `window.__glStats` = last frame's draw calls/triangles + mean CPU frame ms.
- `gl-world.ts`: camera director (hero → pull back → floor by floor → whole; night pose), the three-point light rig keyed to the clock (`RIG`: warm key, cool fill, rim, hemisphere, env, **tone-mapping exposure** — `world.exposure`, applied by gl-scene — and the backdrop light pool from `gl-kit` `createBackdrop()`), code drops, responsive framing via `setViewOffset`, CSS-px picking for agents/cars, tag anchors (label + key-prop point → DOM leader lines `.gl-lead`). `gl-desk.ts`: light wood desk (`woodTexture`), slate felt, laptop drawn at 0.46 scale with a **light-theme editor** (1024×640 canvas, 30 px mono, ≤ 12 lines of ≤ 46 chars — keep it that short), morning window-light gobo, phone, mug/notebook/plant in a triangle, charging cradle, agents with desk glow rings + contact shadows, night window with city lights. `gl-city.ts`: the dollhouse building — charcoal poché cut, per-floor accent wall/side/floor colours, sign atlas, ceiling strips, one `PointLight` per floor (focused floor brighter), all repeated props instanced; the rocket is scene-owned (rides the CI lift by day, lifts off the desk corner at night). `gl-street.ts`: Act 4, 20:00 street behind the freelance rail (own scene + dusk rig; window atlas from `data-street-tex` = real homepage captures for all nine shops; sign atlas with names as plain text; lamps, light pools, die-cast muscle car + van on the pavement). `gl-cars.ts`, `gl-models.ts`, `gl-kit.ts` (now also `MINI` palette — sage, terracotta, cream, slate, butter, wood — `woodTexture`, `createBackdrop`) as before.
- Street act: gl-scene renders it while `#freelance[data-mode=rail]` (desktop rail, Grid view) and the rail is on screen; `html.gl-street` hides the `DayStill name="street"` (which is the full-bleed rail backdrop without WebGL and a 16:6 banner where the rail is off: mobile, Index view, reduced motion). Nine shopfronts (KOMAKI → Morca Pumps); the camera trucks first → last shop with the rail progress; `setViewOffset` keeps the shopfronts above the cards (Freelance.astro: cards ride low, `.fl-shade` scrims title + captions). Windows are one 3×3 atlas (warm lit interior until each screenshot decodes). Per-shop parts are instanced/atlased, so adding shops costs no draw calls.
- Budget (measured, headless Chrome on this Mac, 1440×900): hero 66 draw calls / 45k tris, city 39 / 38k, devices 35–41 / 41–47k per chapter (76 during a wipe, two tables), unpinned lite tables 21–25 per table, ≤ 33 at 390 and ≤ 29 at 1000×800, street 19–34 / 12–18k (9 shops), night 65 / 46k; mean CPU frame ≈ 1.2–2.4 ms. 390 px phone: ≈ 47 calls at night (the street never runs below 1024). DPR caps 1.75 / 1.25. No DOF pass, no shadow maps.

## Open work (round 2 → next agent)
Done and committed on `redesign`: Inter Tight type, single-renderer WebGL, choreography, mock renders, real screenshots, lazy pop-up, faster scroll, MD Riyash mark, three themes, **"A Day in the Stack"** (desk + agents + city cross-section + night desk/rocket, toy cars, day clock, per-theme stills), chapter screen pairs on plinths.
Still to do, in Muhammed's priority order:
1. World polish gaps: the camera does not fly between chapter plinths inside the city (each plinth is its own scissored vignette); no tilt-shift DOF. Night act: the rocket + desk show for ~20% of the flood before the disc grows (`sections.ts` flood `win(0.22, …)`).
2. ~~Phone screens for every chapter~~ — done: `phones` in `Work.astro` covers every chapter (Fiomis/Inventra/AI SaaS are illustrative renders; ZetStore shows GD Farm Fresh on the ZetStore API; Young Onion shows youngonion.in, the Woo store, captioned as such).
3. ~~Three themes~~ done (Noir/Midnight/Forest, see Design system). Paper was rejected (light page vs dark 3D).
4. ~~Static pre-rendered 360 plinth~~ — done (`DayStill name="plinth"` in the 360 chapter whenever `html:not(.gl-dev)`).
5. Verification (final pass, all green): overflow sweep 360–1920 × 3 themes on `/` and `/cv/`, no console errors / failed requests, pre-paint theme (probe in `<body>` reads the stored theme), switcher keyboard, AA over the 3D for hero kicker/legend/meta and the stack list (measured against rendered pixels), no touching display glyphs at 1440/1920, pop-up triggers/trap/Esc/backdrop/close/mock Formspree per theme, `/cv` prints 2 A4 pages black on white from every theme, reduced-motion / no-WebGL / no-JS. Still open: phone reel slit sits a touch high of the eye line at 390 (check `EYE` in `sections.ts` reel()). Reel: desktop opens from an eye-line slit (`sections.ts` reel(), `EYE` = eye position in `portrait.jpg`), <1024 a no-pin portrait reveal.

## SEO
- Per-page `title`/`description` props on `Base.astro`; canonical from `site` in `astro.config.mjs` + page `path`.
- OG/Twitter image: `public/og.png` (1200×630, generated from the hero still with the site fonts). Regenerate if the headline changes.
- JSON-LD `Person` built in `Base.astro` from `person`/`skills`.
- Sitemap: `@astrojs/sitemap` → `/sitemap-index.xml`; `public/robots.txt` points to it.

## Verify before shipping
1. `npm run build` and `npm run check` — both clean (no errors, no warnings).
2. `npm run preview`, then check `/` and `/cv/` at 360, 390, 768, 1024, 1440, 1920 widths:
   - no horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`),
   - zero console errors, mobile menu opens/closes (Esc, outside click), form markup present,
   - hero canvas renders (`.hero-live` on the hero) and the `.nogl` still looks right,
   - emulate `prefers-reduced-motion: reduce`: no loader, static sections, all content visible,
   - `/cv/` print preview fits A4 cleanly.
3. Stop the preview server (`npx astro preview stop`).

## Git / workflow
- Branch from `main` for every change (e.g. `git switch -c feature/x`); `main` deploys to production.
- Commit with Muhammed's personal identity (repo-local git config); push over the `github-coding` SSH alias.
- **Never push, merge to `main` or deploy without Muhammed's explicit OK.**
