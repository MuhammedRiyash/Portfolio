/**
 * Scroll choreography. Every effect is scrubbed by ScrollTrigger (reversible, never timer-driven) and only
 * built when html.motion is set; otherwise the CSS keeps sections static and stacked.
 * Desktop gets the full set; below 1024 px the pins that need room (chapters, range rail) stay off.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LAYERS, stackPhase } from './stack-map';

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** smoothstep window: 0 before a, 1 after b */
const win = (a: number, b: number, p: number) => {
  const t = clamp((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const PINNED = '(min-width: 1024px) and (min-height: 700px)';

export function initSections() {
  splitHeadings();
  stackLayers();
  statementWords();
  reel();
  chapters();
  freelanceRail();
  velocityMarquee();
  timeline();
  flood();
  magnetic();
}

/* Section headings: each word rises out of its own mask, staggered, scrubbed with scroll. */
function splitHeadings() {
  const heads = document.querySelectorAll<HTMLElement>('h2[data-reveal], h3.ch-title[data-reveal]');
  heads.forEach((head) => {
    const words: HTMLElement[] = [];
    head.querySelectorAll<HTMLElement>('.ln > span').forEach((line) => {
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      const texts: Text[] = [];
      while (walker.nextNode()) texts.push(walker.currentNode as Text);
      texts.forEach((text) => {
        const frag = document.createDocumentFragment();
        (text.textContent ?? '').split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.append(part);
            return;
          }
          const mask = document.createElement('span');
          mask.className = 'sw';
          const inner = document.createElement('span');
          inner.textContent = part;
          mask.append(inner);
          frag.append(mask);
          words.push(inner);
        });
        text.replaceWith(frag);
      });
    });
    if (!words.length) return;
    head.dataset.split = '';
    gsap.fromTo(
      words,
      { yPercent: 118, rotate: 4 },
      {
        yPercent: 0,
        rotate: 0,
        ease: 'none',
        stagger: 0.06,
        scrollTrigger: { trigger: head, start: 'top 94%', end: 'top 56%', scrub: true },
      },
    );
  });
}

/* "Whole product" stack: highlights the layer the 3D camera is at (same mapping as the city cross-section). */
function stackLayers() {
  const section = document.querySelector<HTMLElement>('[data-stack]');
  if (!section) return;
  const items = [...section.querySelectorAll<HTMLElement>('[data-layer]')];
  let current = -1;
  const render = (p: number) => {
    const idx = Math.min(LAYERS - 1, Math.round(stackPhase(p).active));
    if (idx !== current) {
      current = idx;
      items.forEach((it, i) => it.classList.toggle('on', i === idx));
    }
  };
  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom bottom',
    onUpdate: (self) => render(self.progress),
    onRefresh: (self) => render(self.progress),
  });
  render(0);
}

/* Statement: words light up as the line crosses the viewport. */
function statementWords() {
  const line = document.querySelector<HTMLElement>('[data-words]');
  if (!line) return;
  const words = [...line.querySelectorAll<HTMLElement>('.w')];
  ScrollTrigger.create({
    trigger: line,
    start: 'top 85%',
    end: 'bottom 45%',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress * words.length;
      words.forEach((w, i) => w.style.setProperty('--o', String(lerp(0.16, 1, clamp(p - i)))));
    },
  });
}

/* Reel. Desktop (≥ 1024): the section opens as a letterbox slit cut exactly on the portrait's eye line,
   the slit opens vertically to the full portrait, then the card grows to the window. The inner layout is
   scaled about the eye point, so the gaze never moves on screen. The words flank the slit, then ride to
   the card's corners; the inverted copy shares the card's clip, so they switch colour exactly where the
   card covers them. Below 1024 there is no pin: the portrait itself opens from the eye line (≤ 100vh). */
/** Eye line in src/assets/portrait.jpg (fractions of the image), used with the img's object-fit math. */
const EYE = { x: 0.51, y: 0.415 };

/** Eye point of an object-fit: cover image, in viewport pixels. */
function eyePoint(img: HTMLImageElement) {
  const r = img.getBoundingClientRect();
  const iw = img.naturalWidth || 998;
  const ih = img.naturalHeight || 1024;
  const k = Math.max(r.width / iw, r.height / ih);
  const [px, py] = getComputedStyle(img).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
  const dw = iw * k;
  const dh = ih * k;
  return { x: r.left + (r.width - dw) * px + EYE.x * dw, y: r.top + (r.height - dh) * py + EYE.y * dh, rect: r };
}

function reel() {
  const section = document.querySelector<HTMLElement>('[data-reel]');
  const card = section?.querySelector<HTMLElement>('[data-reel-card]');
  const inner = section?.querySelector<HTMLElement>('[data-reel-inner]');
  const inv = section?.querySelector<HTMLElement>('[data-reel-inv]');
  const figure = section?.querySelector<HTMLElement>('[data-reel-portrait]');
  const img = figure?.querySelector<HTMLImageElement>('img');
  const tc = section?.querySelector<HTMLElement>('[data-timecode]');
  if (!section || !card || !inner || !inv || !figure || !img) return;
  const a = [...section.querySelectorAll<HTMLElement>('[data-rw="a"]')];
  const b = [...section.querySelectorAll<HTMLElement>('[data-rw="b"]')];
  const mm = gsap.matchMedia();

  mm.add('(min-width: 1024px)', () => {
    // Final-layout geometry, in card (= viewport while pinned) pixels; measured with no transform.
    let geo = { ex: 0, ey: 0, pl: 0, pr: 0, pt: 0, pb: 0, aw: 0, ah: 0, bw: 0, bh: 0 };
    const measure = () => {
      inner.style.transform = '';
      const c = card.getBoundingClientRect();
      const e = eyePoint(img);
      const i = inner.getBoundingClientRect();
      geo = {
        ex: e.x - c.left,
        ey: e.y - c.top,
        pl: e.rect.left - c.left,
        pr: e.rect.right - c.left,
        pt: e.rect.top - c.top,
        pb: e.rect.bottom - c.top,
        aw: a[0].offsetWidth,
        ah: a[0].offsetHeight,
        bw: b[0].offsetWidth,
        bh: b[0].offsetHeight,
      };
      inner.style.transformOrigin = `${e.x - i.left}px ${e.y - i.top}px`;
    };

    let live = false;
    const render = (p: number) => {
      const VW = card.clientWidth;
      const VH = card.clientHeight;
      const g = Math.max(10, Math.min(36, VW * 0.022));
      const { ex, ey } = geo;
      const open = easeOut(win(0, 0.3, p));
      const grow = win(0.3, 0.78, p);
      const k = lerp(1.15, 1, grow);
      // portrait rect after scaling the inner layout about the eye point
      const pl = ex + (geo.pl - ex) * k;
      const pr = ex + (geo.pr - ex) * k;
      const pt = ey + (geo.pt - ey) * k;
      const pb = ey + (geo.pb - ey) * k;
      const half = VH * 0.045; // slit ≈ 9vh
      const x0 = lerp(pl, g, grow);
      const x1 = lerp(pr, VW - g, grow);
      const y0 = lerp(lerp(ey - half, pt, open), 76, grow);
      const y1 = lerp(lerp(ey + half, pb, open), VH - 16, grow);
      const clip = `inset(${y0}px ${VW - x1}px ${VH - y1}px ${x0}px round ${lerp(12 * k, 22, grow)}px)`;
      card.style.clipPath = clip;
      inv.style.clipPath = clip;
      inner.style.transform = `scale(${k})`;

      // words: beside the slit on the eye line → the card's opposite inner corners
      const s = lerp(0.78, 1, grow);
      const gap = 26;
      const pad = 30;
      const ax = lerp(x0 - geo.aw * s - gap, x0 + pad, grow);
      const ay = lerp(ey - (geo.ah * s) / 2, y0 + pad, grow);
      const bx = lerp(x1 + gap, x1 - pad - geo.bw, grow);
      const by = lerp(ey - (geo.bh * s) / 2, y1 - pad - geo.bh, grow);
      const ta = `translate3d(${ax}px, ${ay}px, 0) scale(${s})`;
      const tb = `translate3d(${bx}px, ${by}px, 0) scale(${s})`;
      a.forEach((el) => (el.style.transform = ta));
      b.forEach((el) => (el.style.transform = tb));

      if (tc) {
        const f = Math.round(p * 24 * 12);
        tc.textContent = `00:00:${String(Math.floor(f / 24)).padStart(2, '0')}:${String(f % 24).padStart(2, '0')}`;
      }
      setLive(p > 0.6);
    };

    // `live` (marquee running, gauge stepped aside) from 60 % until the section has left the screen.
    let late = false;
    let onScreen = false;
    const setLive = (v: boolean) => {
      late = v;
      const next = late && onScreen;
      if (next !== live) section.classList.toggle('live', (live = next));
    };
    ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => {
        onScreen = self.isActive;
        setLive(late);
      },
    });

    const st = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => render(self.progress),
      onRefresh: (self) => {
        measure();
        render(self.progress);
      },
    });
    measure();
    render(st.progress);
    if (!img.complete) img.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => {
      for (const el of [card, inv, inner, ...a, ...b]) el.removeAttribute('style');
      section.classList.remove('live');
    };
  });

  // Below 1024: no pin. The portrait opens from a slit on its eye line as it scrolls in.
  mm.add('(max-width: 1023px)', () => {
    let eye = 0.4;
    const measure = () => {
      const r = figure.getBoundingClientRect();
      eye = r.height ? clamp((eyePoint(img).y - r.top) / r.height, 0.1, 0.9) : 0.4;
    };
    const render = (q: number) => {
      const t = win(0, 1, q);
      const top = lerp(eye - 0.05, 0, t) * 100;
      const bottom = lerp(1 - eye - 0.05, 0, t) * 100;
      figure.style.clipPath = `inset(${top}% 0 ${bottom}% 0 round 12px)`;
    };
    ScrollTrigger.create({
      trigger: figure,
      // from "the eye line enters the lower fifth" to "the portrait is centred": well under 100vh
      start: () => {
        measure();
        return `top+=${Math.round(eye * figure.offsetHeight)} 80%`;
      },
      end: 'center 50%',
      onUpdate: (self) => render(self.progress),
      onRefresh: (self) => render(self.progress),
    });
    ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => section.classList.toggle('live', self.isActive),
    });
    return () => {
      figure.removeAttribute('style');
      section.classList.remove('live');
    };
  });
}

/* Work chapters (desktop): sticky stages that overlap; each new chapter wipes in over the last with a
   clip-path (--wipe), the outgoing one dims, the background hue drifts.
   With live WebGL the 3D laptop + phone own the screens (gl-devices.ts); otherwise the framed screen gets CSS 3D parallax. */
function chapters() {
  const mm = gsap.matchMedia();
  const root = document.documentElement;
  const all = [...document.querySelectorAll<HTMLElement>('[data-chapter]')];
  const wipeLen = () => `+=${Math.round(window.innerHeight * 0.5)}`;

  mm.add(PINNED, () => {
    all.forEach((chapter, i) => {
      const stage = chapter.querySelector<HTMLElement>('[data-ch-stage]');
      const media = chapter.querySelector<HTMLElement>('[data-ch-screen]');
      const bar = chapter.querySelector<HTMLElement>('[data-ch-bar]');
      const num = chapter.querySelector<HTMLElement>('[data-ch-num]');
      if (!stage || !media) return;
      const pin = { trigger: chapter, start: 'top top', end: 'bottom bottom', scrub: true } as const;
      const enter = i === 0
        ? ({ trigger: chapter, start: 'top bottom', end: 'top top', scrub: true } as const)
        : { trigger: chapter, start: 'top top', end: wipeLen, scrub: true, invalidateOnRefresh: true };

      if (i > 0) gsap.fromTo(stage, { '--wipe': 1 }, { '--wipe': 0, ease: 'none', scrollTrigger: enter });
      const next = all[i + 1];
      if (next) {
        gsap.fromTo(
          stage,
          { opacity: 1 },
          { opacity: 0.45, ease: 'none', immediateRender: false, scrollTrigger: { trigger: next, start: 'top top', end: wipeLen, scrub: true, invalidateOnRefresh: true } },
        );
      }
      gsap.fromTo(stage, { '--gx': '80%' }, { '--gx': '36%', ease: 'none', scrollTrigger: pin });

      if (!root.classList.contains('gl-live')) {
        gsap.fromTo(
          media,
          { yPercent: 18, rotateX: 14, rotateY: -8, scale: 0.9, opacity: 0.35 },
          { yPercent: 0, rotateX: 0, rotateY: 0, scale: 1, opacity: 1, ease: 'none', scrollTrigger: enter },
        );
      }
      if (num) {
        gsap.fromTo(num, { yPercent: 30 }, { yPercent: -16, ease: 'none', scrollTrigger: { ...pin, start: 'top bottom' } });
      }
      if (bar) gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: pin });
    });
  });

  // Phones and tablets: stacked chapters, a light parallax on each mockup.
  mm.add('(max-width: 1023px)', () => {
    all.forEach((chapter) => {
      const media = chapter.querySelector<HTMLElement>('[data-ch-media]');
      if (!media) return;
      gsap.fromTo(
        media,
        { yPercent: 8 },
        { yPercent: -6, ease: 'none', scrollTrigger: { trigger: chapter, start: 'top bottom', end: 'bottom top', scrub: true } },
      );
    });
  });
}

/* The range (desktop, Grid view): the cards ride a pinned rail that scrolls sideways. */
function freelanceRail() {
  const section = document.querySelector<HTMLElement>('#freelance');
  const rail = section?.querySelector<HTMLElement>('[data-rail]');
  const pinEl = section?.querySelector<HTMLElement>('[data-rail-pin]');
  const track = section?.querySelector<HTMLElement>('[data-idx]');
  const bar = section?.querySelector<HTMLElement>('[data-rail-bar]');
  if (!section || !rail || !pinEl || !track) return;

  const mm = gsap.matchMedia();
  mm.add(PINNED, () => {
    let tween: gsap.core.Tween | null = null;
    const distance = () => {
      const pad = parseFloat(getComputedStyle(pinEl).paddingLeft) || 0;
      return Math.max(0, track.scrollWidth - (pinEl.clientWidth - pad * 2));
    };
    const size = () => {
      // the rail moves ≥ 2 px sideways per px of scroll; pinned travel is capped at 150vh however many cards ride it
      if (section.dataset.mode === 'rail') rail.style.height = `${Math.min(distance() * 0.5, window.innerHeight * 1.5) + window.innerHeight}px`;
    };
    const build = () => {
      tween?.scrollTrigger?.kill();
      tween?.kill();
      tween = null;
      gsap.set(track, { clearProps: 'transform' });
      if (track.dataset.layout === 'list') {
        delete section.dataset.mode;
        rail.style.removeProperty('height');
      } else {
        section.dataset.mode = 'rail';
        size();
        tween = gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: rail,
            start: 'top top',
            end: 'bottom bottom',
            scrub: true,
            invalidateOnRefresh: true,
            onUpdate: (self) => bar && (bar.style.transform = `scaleX(${self.progress.toFixed(4)})`),
          },
        });
      }
      ScrollTrigger.refresh();
    };
    const onLayout = () => build();
    track.addEventListener('layoutchange', onLayout);
    ScrollTrigger.addEventListener('refreshInit', size);
    build();
    return () => {
      track.removeEventListener('layoutchange', onLayout);
      ScrollTrigger.removeEventListener('refreshInit', size);
      tween?.scrollTrigger?.kill();
      tween?.kill();
      gsap.set(track, { clearProps: 'transform' });
      delete section.dataset.mode;
      rail.style.removeProperty('height');
    };
  });
}

/* Stack marquee: position follows the scroll, skew follows its speed. */
function velocityMarquee() {
  const band = document.querySelector<HTMLElement>('[data-vmarquee]');
  const tracks = band ? [...band.querySelectorAll<HTMLElement>('[data-vm-track]')] : [];
  if (!band || !tracks.length) return;
  const skew = tracks.map((t) => gsap.quickTo(t, 'skewX', { duration: 0.5, ease: 'power3.out' }));
  const travel = window.innerWidth < 1024 ? 22 : 32;
  ScrollTrigger.create({
    trigger: band,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => {
      const p = self.progress;
      gsap.set(tracks[0], { xPercent: -p * travel });
      if (tracks[1]) gsap.set(tracks[1], { xPercent: -50 + p * travel });
      const v = clamp(self.getVelocity() / 260, -10, 10);
      skew.forEach((s, i) => s(i ? v : -v));
    },
  });
  // velocity is only sampled while scrolling: let the skew settle once the scroll stops
  ScrollTrigger.addEventListener('scrollEnd', () => skew.forEach((s) => s(0)));
}

/* Experience: a line fills as you scroll; each role lights up as the dot reaches it. */
function timeline() {
  const tl = document.querySelector<HTMLElement>('[data-tl]');
  const line = tl?.querySelector<HTMLElement>('.tl-line');
  if (!tl || !line) return;
  const items = [...tl.querySelectorAll<HTMLElement>('[data-tl-item]')];
  ScrollTrigger.create({
    trigger: tl,
    start: 'top 70%',
    end: 'bottom 60%',
    scrub: true,
    onUpdate: (self) => {
      line.style.setProperty('--p', self.progress.toFixed(4));
      const lineBox = line.getBoundingClientRect();
      const dotY = lineBox.top + lineBox.height * self.progress;
      items.forEach((it) => it.classList.toggle('on', it.getBoundingClientRect().top - 40 <= dotY));
    },
  });
}

/* Finale: after a beat of the 23:30 desk (WebGL, behind the stage), a disc floods the screen and becomes the footer. */
function flood() {
  const wrap = document.querySelector<HTMLElement>('[data-flood]');
  const disc = wrap?.querySelector<HTMLElement>('[data-flood-disc]');
  if (!wrap || !disc) return;
  const paint = (p: number) => {
    const f = easeOut(win(0.22, 0.78, p));
    if (f >= 0.999) {
      disc.style.clipPath = 'none';
      return;
    }
    // Grow from the middle of whatever part of the stage is on screen, so the disc is seen from the start.
    const r = disc.getBoundingClientRect();
    const visMid = (Math.max(0, r.top) + Math.min(window.innerHeight, r.bottom)) / 2;
    const cy = clamp((visMid - r.top) / r.height) * 100;
    disc.style.clipPath = `circle(${(f * 75).toFixed(2)}% at 50% ${cy.toFixed(2)}%)`;
  };
  ScrollTrigger.create({
    trigger: wrap,
    start: 'top bottom',
    end: 'bottom bottom',
    onUpdate: (self) => paint(self.progress),
    onRefresh: (self) => paint(self.progress),
  });
}

/* Primary buttons lean towards the pointer (desktop, fine pointers only). */
function magnetic() {
  const mm = gsap.matchMedia();
  mm.add('(min-width: 1024px) and (hover: hover) and (pointer: fine)', () => {
    const offs = [...document.querySelectorAll<HTMLElement>('[data-magnetic]')].map((el) => {
      const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
      const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * 0.32);
        y((e.clientY - (r.top + r.height / 2)) * 0.4);
      };
      const leave = () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)', overwrite: true });
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      return () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
        gsap.set(el, { clearProps: 'transform' });
      };
    });
    return () => offs.forEach((off) => off());
  });
}
