/**
 * The single WebGL renderer behind the whole page (lazy chunk, loaded by gl.ts) — "A Day in the Stack".
 *
 * One fixed canvas, one context, acts chosen by what is on screen:
 *   - world, day (gl-world.ts): hero desk → pull back → city cross-section. Canvas behind <main>, theme clear
 *     colour, clipped to the hero's rounded frame until the stack section takes over.
 *   - devices (gl-devices.ts): laptop + phone + themed props + toy cars on a table per work chapter (gl-props.ts).
 *     Canvas lifted above <main> (html.gl-top), transparent clear, scissored per chapter; lite when unpinned.
 *   - world, night: the desk at 23:30 behind the footer flood (the stage there is transparent).
 * Frames are drawn from gsap.ticker, after Lenis and ScrollTrigger, so 3D and DOM move in the same frame.
 * Nothing renders while no 3D zone is visible or the tab is hidden. Themes: `pf:theme` → re-colour in place.
 */
import { gsap } from 'gsap';
import { ACESFilmicToneMapping, PMREMGenerator, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createGarage } from './gl-cars';
import { createDevices, type Devices } from './gl-devices';
import { readPalette, type Palette } from './gl-kit';
import { createModels } from './gl-models';
import { createStreet, type Street } from './gl-street';
import { createWorld, type Hit } from './gl-world';
import { getDayClock } from './stack-map';

export type GLOptions = {
  canvas: HTMLCanvasElement;
  mobile: boolean;
};

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

declare global {
  interface Window {
    /** renderer stats for verification: draw calls / triangles of the last frame, mean CPU frame time */
    __glStats?: { act: string; calls: number; triangles: number; frameMs: number; frames: number };
  }
}

export function startGL({ canvas, mobile }: GLOptions) {
  const root = document.documentElement;
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const heroStage = document.querySelector<HTMLElement>('[data-hero-stage]');
  const stack = document.querySelector<HTMLElement>('[data-stack]');
  const work = document.getElementById('work');
  const flood = document.querySelector<HTMLElement>('[data-flood]');
  const floodStage = flood?.querySelector<HTMLElement>('.flood-stage') ?? flood;
  const freelance = document.getElementById('freelance');
  const rail = freelance?.querySelector<HTMLElement>('[data-rail]') ?? null;
  const chapters = [...document.querySelectorAll<HTMLElement>('[data-chapter]')];
  if (!hero) throw new Error('hero missing');

  const renderer = new WebGLRenderer({ canvas, antialias: !mobile, alpha: true, stencil: false, powerPreference: 'high-performance' });
  renderer.toneMapping = ACESFilmicToneMapping;
  const dprCap = mobile ? 1.25 : 1.75;
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();

  const kit = createModels();
  const garage = createGarage(mobile);
  const world = createWorld(kit, garage, env, mobile);
  const devMQ = matchMedia('(min-width: 1024px) and (min-height: 700px)');
  let devices: Devices | null = null;
  /* 20:00 street: only behind the pinned horizontal rail (desktop, Grid view); built on first need */
  let street: Street | null = null;
  let streetOn = false;
  let pal: Palette = readPalette();
  const clock = getDayClock();

  /* DOM tags: five layer tags in the stack, one agent label in the hero */
  const cityTags = document.querySelector<HTMLElement>('[data-city-tags]');
  const agentTags = document.querySelector<HTMLElement>('[data-agent-tags]');
  const layerNames = [...document.querySelectorAll<HTMLElement>('[data-stack] .stk-what')].map((el) => el.textContent?.trim() ?? '');
  const layerTags = layerNames.map((name, i) => {
    const el = document.createElement('span');
    el.className = 'gl-tag';
    el.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b>`;
    el.append(name);
    // thin leader line from the tag to the floor's key prop, with a dot at the prop end
    const lead = document.createElement('i');
    lead.className = 'gl-lead';
    cityTags?.append(lead, el);
    return { el, lead, w: 0 };
  });
  const agentTag = document.createElement('span');
  agentTag.className = 'gl-tag gl-tag--agent';
  agentTags?.append(agentTag);

  const theme = () => {
    pal = readPalette();
    renderer.setClearColor(pal.bg, 1);
    world.theme(pal);
    garage.theme(pal);
    devices?.theme(pal);
    street?.theme(pal);
  };
  theme();

  let W = 1;
  let H = 1;
  let radius = 18;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(W, H, false);
    world.resize(W, H);
    street?.resize(W, H);
    if (heroStage) radius = parseFloat(getComputedStyle(heroStage).borderTopLeftRadius) || 0;
    clock.refresh();
    layerTags.forEach((t) => (t.w = 0));
  };
  resize();
  renderer.compile(world.scene, world.camera);

  let running = false;
  const tick = (_time: number, deltaMs: number) => frame(Math.min(0.05, deltaMs / 1000));
  const stop = () => {
    if (running) gsap.ticker.remove(tick);
    running = false;
    canvas.classList.remove('on');
    root.classList.remove('gl-top');
  };

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    stop();
    root.classList.add('nogl');
    root.classList.remove('gl-live', 'gl-dev', 'gl-top');
  });

  /* Devices on every width: full tables where the chapters pin (desktop with enough height), lite tables
     (2 props, 1 car, lite models) where they scroll by; rebuilt when the layout crosses the breakpoint. */
  const syncDevices = () => {
    const lite = !devMQ.matches;
    if (devices && devices.lite !== lite) {
      devices.dispose();
      devices = null;
    }
    if (!devices && chapters.length) {
      devices = createDevices(renderer, chapters, kit, garage, env, lite);
      devices.theme(pal);
    }
    root.classList.toggle('gl-dev', !!devices);
    // The 3D frame now owns the screens' transform; drop the CSS-only parallax tweens.
    if (devices) {
      chapters.forEach((c) => {
        const screen = c.querySelector('[data-ch-screen]');
        if (screen) {
          gsap.killTweensOf(screen);
          gsap.set(screen, { clearProps: 'all' });
        }
      });
    }
  };
  syncDevices();

  /* Street: lives while the freelance section is a pinned rail (sections.ts sets data-mode="rail"). */
  const syncStreet = () => {
    streetOn = devMQ.matches && freelance?.dataset.mode === 'rail';
    if (streetOn && !street) {
      street = createStreet(garage, env, mobile);
      street.theme(pal);
      street.resize(W, H);
    }
    root.classList.toggle('gl-street', streetOn);
  };
  if (freelance) {
    new MutationObserver(() => {
      syncStreet();
      sync();
    }).observe(freelance, { attributes: true, attributeFilter: ['data-mode'] });
  }
  devMQ.addEventListener('change', () => {
    syncDevices();
    syncStreet();
    sync();
  });

  /* stats (cheap): the last frame's draw calls and a running mean of the CPU-side frame time */
  const stats = { act: 'idle', calls: 0, triangles: 0, frameMs: 0, frames: 0 };
  window.__glStats = stats;
  renderer.info.autoReset = false;

  const showTags = (heroP: number) => {
    const t = world.tags();
    layerTags.forEach((tag, i) => {
      const { el, lead } = tag;
      const l = t.layers[i];
      const o = l ? l.o.toFixed(3) : '0';
      el.style.opacity = o;
      lead.style.opacity = o;
      if (l && l.o > 0.01) {
        el.style.transform = `translate3d(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px, 0)`;
        // the tag hangs left of its anchor; the line leaves from its left edge (width measured once per resize)
        tag.w ||= el.offsetWidth;
        const x0 = l.x - tag.w;
        const dx = l.px - x0;
        const dy = l.py - l.y;
        lead.style.width = `${Math.hypot(dx, dy).toFixed(1)}px`;
        lead.style.transform = `translate3d(${x0.toFixed(1)}px, ${l.y.toFixed(1)}px, 0) rotate(${Math.atan2(dy, dx).toFixed(4)}rad)`;
      }
      el.classList.toggle('on', !!l && l.on > 0.5);
      lead.classList.toggle('on', !!l && l.on > 0.5);
    });
    if (t.agent && heroP < 0.3) {
      if (agentTag.textContent !== t.agent.text) agentTag.textContent = t.agent.text;
      const hr = agentTags?.getBoundingClientRect();
      agentTag.style.transform = `translate3d(${(t.agent.x - (hr?.left ?? 0)).toFixed(1)}px, ${(t.agent.y - (hr?.top ?? 0)).toFixed(1)}px, 0)`;
      agentTag.style.opacity = '1';
    } else agentTag.style.opacity = '0';
  };

  function frame(dt: number) {
    const t0 = performance.now();
    renderer.info.reset();
    let act = 'idle';
    const hr = hero!.getBoundingClientRect();
    const sr = stack?.getBoundingClientRect();
    const fr = floodStage?.getBoundingClientRect();
    const rr = streetOn && streetZone && rail ? rail.getBoundingClientRect() : null;
    const stackOn = !!sr && sr.top < H && sr.bottom > 0;
    const hour = clock.hour(window.scrollY);

    if (hr.bottom > 0 || stackOn) {
      const heroP = clamp(-hr.top / Math.max(1, hr.height));
      const stackP = sr ? clamp((H - sr.top) / Math.max(1, sr.height)) : 0;
      world.update(dt, { hero: heroP, stack: stackP, flood: 0, hour });
      renderer.setScissorTest(false);
      renderer.setClearColor(pal.bg, 1);
      renderer.toneMappingExposure = world.exposure;
      renderer.render(world.scene, world.camera);
      // Hero: the canvas wears the hero frame's rounded inset, opening to full bleed as the stack arrives.
      if (heroStage) {
        const st = heroStage.getBoundingClientRect();
        const k = sr ? clamp((H - sr.top) / H) : 0;
        const side = Math.max(0, st.left) * (1 - k);
        canvas.style.clipPath = `inset(${Math.max(0, st.top).toFixed(1)}px ${side.toFixed(1)}px ${side.toFixed(1)}px round ${(radius * (1 - k)).toFixed(1)}px)`;
      }
      showTags(heroP);
      act = 'day';
    } else if (workZone && devices && devices.render(W, H)) {
      canvas.style.clipPath = 'none';
      act = 'devices';
    } else if (street && rr && rr.top < H && rr.bottom > 0) {
      // 20:00: the rail's progress trucks the camera along the street; the canvas shows inside the rail only
      const p = clamp(-rr.top / Math.max(1, rr.height - H));
      street.update(dt, p, clamp((H - rr.top) / H));
      renderer.setScissorTest(false);
      renderer.setClearColor(pal.bg, 1);
      renderer.toneMappingExposure = street.exposure;
      renderer.render(street.scene, street.camera);
      canvas.style.clipPath = `inset(${Math.max(0, rr.top).toFixed(1)}px 0 ${Math.max(0, H - rr.bottom).toFixed(1)}px 0)`;
      act = 'street';
    } else if (fr && fr.top < H && fr.bottom > 0) {
      // the stage enters from below; the night desk shows in it until the footer floods over
      const p = clamp((H - fr.top) / (fr.height + H * 0.6));
      world.update(dt, { hero: 1, stack: 1, flood: Math.max(0.001, p), hour, viewTop: clamp(fr.top / H) });
      renderer.setScissorTest(false);
      renderer.setClearColor(pal.bg, 1);
      renderer.toneMappingExposure = world.exposure;
      renderer.render(world.scene, world.camera);
      canvas.style.clipPath = `inset(${Math.max(0, fr.top).toFixed(1)}px 0 0 0)`;
      act = 'night';
    }
    canvas.classList.toggle('on', act !== 'idle');
    root.classList.toggle('gl-top', act === 'devices');

    stats.act = act;
    stats.calls = renderer.info.render.calls;
    stats.triangles = renderer.info.render.triangles;
    if (act !== 'idle') {
      stats.frames++;
      stats.frameMs += (performance.now() - t0 - stats.frameMs) / Math.min(stats.frames, 120);
    }
  }

  /* Zones: only tick while a 3D section is near the viewport and the tab is visible. */
  let worldZone = false;
  let workZone = false;
  let streetZone = false;
  let pageVisible = document.visibilityState === 'visible';
  const flags = new Map<Element, boolean>();
  const sync = () => {
    const want = pageVisible && (worldZone || (workZone && !!devices) || (streetZone && streetOn));
    if (want && !running) {
      running = true;
      gsap.ticker.add(tick);
      frame(0.016);
    } else if (!want && running) {
      stop();
    }
  };
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => flags.set(e.target, e.isIntersecting));
      worldZone = !!flags.get(hero) || (!!stack && !!flags.get(stack)) || (!!flood && !!flags.get(flood));
      workZone = !!work && !!flags.get(work);
      streetZone = !!rail && !!flags.get(rail);
      sync();
    },
    { rootMargin: '160px 0px' },
  );
  [hero, stack, work, rail, flood].forEach((el) => el && io.observe(el));

  document.addEventListener('visibilitychange', () => {
    pageVisible = document.visibilityState === 'visible';
    sync();
  });

  let resizeQueued = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(resizeQueued);
    resizeQueued = requestAnimationFrame(() => {
      resize();
      if (running) frame(0);
    });
  }).observe(canvas);

  // Theme switch (dispatched inside the view-transition callback): re-colour and draw one frame now.
  document.addEventListener('pf:theme', () => {
    theme();
    if (running) frame(0);
  });

  /* Pointer: camera lean, agent + toy-car hover/click on the desk, toy cars on the plinths. */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let hit: Hit | null = null;
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      world.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      const interactive = (e.target as Element).closest('a, button, h1, p, dl');
      hit = interactive ? null : world.pick(e.clientX, e.clientY);
      world.hover(hit);
      hero.style.cursor = hit ? 'pointer' : '';
    });
    hero.addEventListener('pointerleave', () => {
      world.setPointer(0, 0);
      world.hover(null);
      hit = null;
    });
    hero.addEventListener('click', (e) => {
      if (hit && !(e.target as Element).closest('a, button')) world.click(hit);
    });
    work?.addEventListener('pointermove', (e) => {
      const over = !!devices && devices.pointer(e.clientX, e.clientY);
      work.style.cursor = over ? 'pointer' : '';
    });
    work?.addEventListener('click', (e) => {
      if (devices && !(e.target as Element).closest('a, button')) devices.click(e.clientX, e.clientY);
    });
  }

  // First frame right away when the hero is on screen, so the still hands over without a gap.
  const hr = hero.getBoundingClientRect();
  worldZone = hr.bottom > 0 && hr.top < H;
  syncStreet();
  sync();
  root.classList.add('gl-live');
}
