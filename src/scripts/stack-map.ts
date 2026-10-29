/**
 * "A Day in the Stack" — the shared scroll mappings, used by the WebGL world, the DOM labels and the header clock
 * so 3D, copy and clock always agree.
 *
 * - stackPhase(p): the cross-section act. `p` is the stack section's progress from "top enters the bottom of the
 *   viewport" (0) to "bottom leaves the bottom of the viewport" (1).
 * - createDayClock(): scroll position → time of day (09:00 at the top … 23:30 at the footer), anchored to the
 *   sections, plus the beat name shown next to it.
 */
export const LAYERS = 5;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, p: number) => {
  const t = clamp((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export type StackPhase = {
  /** 0 = at the desk, 1 = pulled back over the city (code drops) */
  pull: number;
  /** continuous index of the layer the camera is at, 0 (storefront) … 4 (CI) */
  active: number;
  /** 0 = layer by layer, 1 = the whole cross-section */
  assemble: number;
  /** layer tag visibility, 0…1 */
  labels: number;
};

export function stackPhase(p: number): StackPhase {
  return {
    pull: smooth(0.02, 0.3, p),
    active: clamp(((p - 0.32) / 0.5) * LAYERS - 0.5, 0, LAYERS - 1),
    assemble: smooth(0.84, 0.96, p),
    labels: smooth(0.26, 0.34, p) * (1 - smooth(0.9, 0.98, p)),
  };
}

/* ───────────── day clock ───────────── */
type Anchor = { y: number; h: number };

const BEATS: [number, string][] = [
  [10.4, 'At the desk'],
  [13.6, 'Code ships'],
  [18.5, 'The work'],
  [21.5, 'The range, after hours'],
  [23.1, 'Wrapping up'],
  [24, 'Ship it'],
];

export type DayClock = {
  /** hour of day (9 … 23.5) for a scroll position */
  hour(scrollY: number): number;
  /** "09:00 · At the desk" */
  label(hour: number): string;
  /** re-measure the section anchors (resize, layout changes) */
  refresh(): void;
};

export function createDayClock(): DayClock {
  let anchors: Anchor[] = [];
  const top = (sel: string) => {
    const el = document.querySelector<HTMLElement>(sel);
    return el ? el.getBoundingClientRect().top + window.scrollY : null;
  };
  const bottom = (sel: string) => {
    const el = document.querySelector<HTMLElement>(sel);
    return el ? el.getBoundingClientRect().bottom + window.scrollY : null;
  };
  const refresh = () => {
    const H = window.innerHeight;
    const end = document.documentElement.scrollHeight - H;
    const list: [number | null, number][] = [
      [0, 9],
      [top('[data-stack]'), 10.5],
      [(bottom('[data-stack]') ?? 0) - H, 13],
      [top('#work'), 14],
      [(bottom('#work') ?? 0) - H, 17.5],
      [top('#freelance'), 19.5],
      [(bottom('#freelance') ?? 0) - H, 20.5],
      [(top('[data-flood]') ?? end) - H, 23],
      [end, 23.5],
    ];
    anchors = list.filter((a): a is [number, number] => a[0] !== null).map(([y, h]) => ({ y, h }));
    anchors.sort((a, b) => a.y - b.y);
    // keep hours monotonic even if a section is missing or collapsed
    for (let i = 1; i < anchors.length; i++) anchors[i].h = Math.max(anchors[i].h, anchors[i - 1].h);
  };
  refresh();
  return {
    refresh,
    hour(y) {
      if (!anchors.length) return 9;
      if (y <= anchors[0].y) return anchors[0].h;
      for (let i = 1; i < anchors.length; i++) {
        const a = anchors[i - 1];
        const b = anchors[i];
        if (y <= b.y) return a.h + (b.h - a.h) * clamp((y - a.y) / Math.max(1, b.y - a.y));
      }
      return anchors[anchors.length - 1].h;
    },
    label(hour) {
      const m = Math.round((hour * 60) / 5) * 5;
      const hh = String(Math.floor(m / 60) % 24).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      const beat = BEATS.find(([h]) => hour < h)?.[1] ?? 'Ship it';
      return `${hh}:${mm} · ${beat}`;
    },
  };
}

let shared: DayClock | null = null;
/** One clock for the header, the hero legend and the WebGL lighting. */
export function getDayClock() {
  shared ??= createDayClock();
  return shared;
}
