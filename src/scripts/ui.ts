/**
 * Small, framework-free UI behaviours: reveal-once, Grid/Index toggle with cursor peek
 * and the progressively enhanced contact form.
 */

/** Adds `.in` once to [data-reveal] and .fade elements as they enter (never re-hides). */
export function initReveals() {
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]:not([data-hero-title]), .fade');
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px' },
  );
  els.forEach((el) => io.observe(el));
}

export function initWorkIndex() {
  const toggle = document.querySelector<HTMLElement>('[data-toggle]');
  const list = document.querySelector<HTMLElement>('[data-idx]');
  const knob = toggle?.querySelector<HTMLElement>('[data-knob]');
  const peek = document.querySelector<HTMLElement>('[data-peek]');
  if (!toggle || !list || !knob) return;
  const buttons = [...toggle.querySelectorAll<HTMLButtonElement>('button[data-view]')];

  const placeKnob = () => {
    const active = buttons.find((b) => b.getAttribute('aria-pressed') === 'true');
    if (!active) return;
    knob.style.width = `${active.offsetWidth}px`;
    knob.style.transform = `translateX(${active.offsetLeft}px)`;
  };
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      list.dataset.layout = b.dataset.view;
      placeKnob();
      peek?.classList.remove('on');
      // sections.ts rebuilds the desktop rail for the new layout
      list.dispatchEvent(new Event('layoutchange'));
    }),
  );
  placeKnob();
  document.fonts?.ready.then(placeKnob);
  window.addEventListener('resize', placeKnob);

  // Cursor-following preview, Index view only, fine pointers only.
  if (!peek || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let x = 0;
  let y = 0;
  let tx = 0;
  let ty = 0;
  let raf = 0;
  const loop = () => {
    x += (tx - x) * 0.16;
    y += (ty - y) * 0.16;
    peek.style.left = `${x}px`;
    peek.style.top = `${y}px`;
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.2 ? requestAnimationFrame(loop) : 0;
  };
  list.querySelectorAll<HTMLElement>('.idx-item').forEach((item) => {
    item.addEventListener('pointerenter', (e) => {
      if (list.dataset.layout !== 'list') return;
      const poster = item.querySelector('[data-poster]');
      if (!poster) return;
      peek.replaceChildren(poster.cloneNode(true));
      if (!peek.classList.contains('on')) {
        x = tx = e.clientX + 28;
        y = ty = e.clientY - 120;
      }
      peek.classList.add('on');
      if (!raf) raf = requestAnimationFrame(loop);
    });
    item.addEventListener('pointerleave', () => peek.classList.remove('on'));
  });
  list.addEventListener('pointermove', (e) => {
    if (list.dataset.layout !== 'list') return;
    tx = e.clientX + 28;
    ty = e.clientY - 120;
    if (!raf) raf = requestAnimationFrame(loop);
  });
}

/** Formspree POST with fetch + inline status. Without JS the form posts normally. */
export function initForm() {
  const form = document.querySelector<HTMLFormElement>('[data-form]');
  const status = form?.querySelector<HTMLElement>('[data-status]');
  const submit = form?.querySelector<HTMLButtonElement>('[data-submit]');
  if (!form || !status || !submit) return;

  const setStatus = (text: string, kind: '' | 'ok' | 'err') => {
    status.textContent = text;
    status.className = `form-status ${kind}`.trim();
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fields = [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[required], textarea[required]')];
    let firstBad: HTMLElement | null = null;
    for (const f of fields) {
      const ok = f.checkValidity() && f.value.trim() !== '';
      f.setAttribute('aria-invalid', String(!ok));
      if (!ok && !firstBad) firstBad = f;
    }
    if (firstBad) {
      setStatus('Please fill in your name, a valid email and a short message.', 'err');
      firstBad.focus();
      return;
    }
    submit.disabled = true;
    setStatus('Sending…', '');
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      fields.forEach((f) => f.removeAttribute('aria-invalid'));
      setStatus('Thanks — your message is on its way. I’ll reply by email.', 'ok');
    } catch {
      setStatus('That didn’t send. Please email thisismd.riyash@gmail.com or message me on WhatsApp.', 'err');
    } finally {
      submit.disabled = false;
    }
  });
}
