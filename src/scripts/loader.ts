/**
 * Intro curtain. The counter chases a target built from real milestones
 * (fonts → hero still decoded → WebGL scene compiled), never a fake timer.
 * It has a minimum duration for feel and a patience cap so it can never trap the page.
 */

const MIN_MS = 1400;
const PATIENCE_MS = 6000;
const WEIGHTS = { base: 6, fonts: 34, still: 24, scene: 36 } as const;
type Step = Exclude<keyof typeof WEIGHTS, 'base'>;

export type Intro = {
  mark(step: Step): void;
  done: Promise<void>;
};

export function createIntro(skip: boolean): Intro {
  const root = document.documentElement;
  const el = document.getElementById('loader');
  const finish = () => {
    window.__lift?.('intro');
    try {
      sessionStorage.setItem('mr:intro', '1');
    } catch {
      /* private mode: the intro simply plays again next time */
    }
  };

  if (skip || !el || window.__lifted) {
    finish();
    return { mark() {}, done: Promise.resolve() };
  }

  const digits = [...el.querySelectorAll<HTMLElement>('.digit > span')];
  const bar = el.querySelector<HTMLElement>('[data-bar]');
  const curtain = el.querySelector<HTMLElement>('[data-curtain]');
  const marked = new Set<Step>();
  let target: number = WEIGHTS.base;
  let shown = 0;
  let drawn = -1;
  let lastDraw = 0;
  const t0 = performance.now();

  const drawDigits = (value: number) => {
    const s = String(value).padStart(3, '0');
    digits.forEach((d, i) => {
      if (d.textContent === s[i]) return;
      d.textContent = s[i];
      d.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], {
        duration: 320,
        easing: 'cubic-bezier(.16,1,.3,1)',
      });
    });
  };

  let resolveDone: () => void = () => {};
  // Executor form on purpose: Promise.withResolvers is missing on Safari < 17.4.
  const done = new Promise<void>((r) => (resolveDone = r));
  let exiting = false;

  const exit = async () => {
    exiting = true;
    root.classList.add('intro-anim');
    const ease = 'cubic-bezier(.7,0,.2,1)';
    const content = [...el.querySelectorAll<HTMLElement>('.loader-top, .loader-mid, .loader-bottom')];
    content.forEach((c, i) =>
      c.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-24px)' }], {
        duration: 420,
        delay: 160 + i * 40,
        easing: ease,
        fill: 'forwards',
      }),
    );
    const lift = curtain?.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], {
      duration: 900,
      delay: 380,
      easing: ease,
      fill: 'forwards',
    });
    // Reveal the page as the curtain starts moving.
    window.setTimeout(resolveDone, 520);
    try {
      await lift?.finished;
    } catch {
      /* animation cancelled: lift anyway */
    }
    finish();
    resolveDone();
  };

  const tick = (now: number) => {
    if (exiting) return;
    const cap = ((now - t0) / MIN_MS) * 100;
    const goal = Math.min(target, cap);
    shown = Math.min(goal, shown + (goal - shown) * 0.12 + 0.35);
    const v = Math.floor(shown);
    if (v !== drawn && now - lastDraw > 70) {
      drawn = v;
      lastDraw = now;
      drawDigits(v);
    }
    if (bar) bar.style.transform = `scaleX(${shown / 100})`;
    if (shown >= 99.9) {
      drawDigits(100);
      window.setTimeout(exit, 220);
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const mark = (step: Step) => {
    if (marked.has(step)) return;
    marked.add(step);
    el.querySelector(`[data-step="${step}"]`)?.classList.add('done');
    target = WEIGHTS.base + [...marked].reduce((sum, s) => sum + WEIGHTS[s], 0);
  };

  // Never trap the page: after the patience window, everything counts as arrived.
  window.setTimeout(() => (['fonts', 'still', 'scene'] as Step[]).forEach(mark), PATIENCE_MS);

  return { mark, done };
}
