/**
 * Boots the shared WebGL canvas after the rest of the page is wired.
 * three.js and every scene module are only fetched here (dynamic import), so a failed download
 * costs only the 3D: every act keeps its themed still (src/components/DayStill.astro) and the chapters
 * their framed screens. Reduced motion never loads three.js: the stills are the designed experience.
 */
type Options = {
  reduced: boolean;
  mobile: boolean;
};

/** Resolves true when the canvas is live, false when we stay on the stills. */
export async function bootGL({ reduced, mobile }: Options): Promise<boolean> {
  const root = document.documentElement;
  const canvas = document.querySelector<HTMLCanvasElement>('[data-gl]');
  if (!canvas || reduced || root.classList.contains('nogl')) return false;
  try {
    // Deliberately lazy: keeps three.js (~140 KB gz) out of the first-paint bundle.
    const { startGL } = await import('./gl-scene');
    // The watchdog already gave up on us: stay on the designed fallbacks.
    if (root.classList.contains('boot-fail')) return false;
    startGL({ canvas, mobile });
    return true;
  } catch (err) {
    console.warn('[gl] WebGL unavailable, showing the stills.', err);
    root.classList.add('nogl');
    root.classList.remove('gl-live', 'gl-dev', 'gl-top');
    return false;
  }
}
