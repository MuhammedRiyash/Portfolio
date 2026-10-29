/**
 * Entry point. Order matters:
 *   1. wire every non-3D behaviour (menu, reveals, index, form, scroll choreography),
 *   2. run the intro curtain against real milestones,
 *   3. only then fetch three.js for the shared WebGL canvas.
 * If any later step fails, the page is already fully usable.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initChrome } from './chrome';
import { initSections } from './sections';
import { initReveals, initWorkIndex, initForm } from './ui';
import { createIntro } from './loader';
import { bootGL } from './gl';
import { watchLead } from './lead-watch';

declare global {
  interface Window {
    __lift?: (why?: string) => void;
    __lifted?: string;
    __booted?: boolean;
  }
}

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const motion = root.classList.contains('motion') && !root.classList.contains('boot-fail');
const mobile = matchMedia('(max-width: 767px), (pointer: coarse) and (max-width: 1023px)').matches;

/* Smooth scroll, driven from GSAP's ticker so ScrollTrigger and Lenis share one clock. */
let lenis: Lenis | null = null;
if (motion) {
  // Snappy, not floaty: follows the wheel closely; touch keeps native momentum.
  lenis = new Lenis({ lerp: 0.15, wheelMultiplier: 1.15, touchMultiplier: 1.4, smoothWheel: true, syncTouch: false, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis?.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

initChrome({ lenis, motion });
initReveals();
initWorkIndex();
initForm();
if (motion) initSections();
window.__booted = true;
/* Lead pop-up: tiny trigger watcher; popup.ts is fetched only when a trigger fires. */
watchLead(lenis);

const heroTitle = document.querySelector<HTMLElement>('[data-hero-title]');
const skip = root.classList.contains('skip-intro') || !!window.__lifted;
const intro = createIntro(skip);
if (!skip) lenis?.stop();

/* Milestones */
const withPatience = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<void>((r) => window.setTimeout(r, ms))]);

withPatience(document.fonts?.ready ?? Promise.resolve(), 2500).then(() => {
  intro.mark('fonts');
  ScrollTrigger.refresh();
});

// the themed hero still that is actually displayed (the other themes' images are display:none and never load)
const still = [...document.querySelectorAll<HTMLImageElement>('[data-hero-stage] [data-still] img')].find((img) => img.offsetParent !== null);
withPatience(still?.decode?.().catch(() => undefined) ?? Promise.resolve(), 2500).then(() => intro.mark('still'));

intro.done.then(() => {
  lenis?.start();
  heroTitle?.classList.add('in');
  ScrollTrigger.refresh();
});

/* three.js last: dynamically imported after the UI above is live. */
bootGL({ reduced, mobile })
  .catch(() => false)
  .finally(() => intro.mark('scene'));
