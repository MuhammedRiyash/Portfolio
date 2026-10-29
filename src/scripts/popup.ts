/**
 * Lead-capture pop-up. Loaded only by lead-watch.ts (dynamic import) when a trigger fires.
 * Native <dialog> (modal: the page behind is inert, Esc closes), focus restored on close,
 * Lenis paused while open, Formspree POST with inline success/error. The inline form on the
 * page stays the primary, no-JS path; this is progressive enhancement only.
 */
import type Lenis from 'lenis';
import { person } from '../data/site';
import { LEAD_SENT } from './lead-watch';
import '../styles/popup.css';

type Options = { lenis: Lenis | null; trigger: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function openLeadPopup({ lenis, trigger }: Options) {
  const restore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const dialog = document.createElement('dialog');
  dialog.className = 'lp';
  dialog.setAttribute('aria-labelledby', 'lp-title');
  dialog.setAttribute('aria-describedby', 'lp-desc');
  dialog.innerHTML = `
    <div class="lp-card">
      <button class="lp-x" type="button" data-lp-close><span aria-hidden="true">✕</span><span class="sr-only">Close</span></button>
      <p class="lp-k mono"><span class="dot" aria-hidden="true"></span>Open to senior full-stack roles</p>
      <h2 id="lp-title" class="lp-title display">Hiring for a full-stack <em>role?</em></h2>
      <p id="lp-desc" class="lp-sub">Share the role and how to reach you — I’ll reply from ${person.email}.</p>
      <form class="lp-form" action="${person.formspree}" method="POST" novalidate>
        <div class="lp-field">
          <label for="lp-name" class="mono">Name</label>
          <input id="lp-name" name="name" type="text" autocomplete="name" required />
        </div>
        <div class="lp-field">
          <label for="lp-company" class="mono">Company</label>
          <input id="lp-company" name="company" type="text" autocomplete="organization" required />
        </div>
        <div class="lp-field">
          <label for="lp-email" class="mono">Work email</label>
          <input id="lp-email" name="email" type="email" autocomplete="email" required />
        </div>
        <div class="lp-field">
          <label for="lp-role" class="mono">Role or job link</label>
          <input id="lp-role" name="role" type="text" />
        </div>
        <div class="lp-field">
          <label for="lp-msg" class="mono">Short message</label>
          <textarea id="lp-msg" name="message" rows="3" required></textarea>
        </div>
        <div class="lp-hp" aria-hidden="true">
          <label for="lp-gotcha">Leave this field empty</label>
          <input id="lp-gotcha" type="text" name="_gotcha" tabindex="-1" autocomplete="off" />
        </div>
        <input type="hidden" name="_source" value="portfolio-popup" />
        <input type="hidden" name="_subject" value="Portfolio pop-up: role enquiry" />
        <input type="hidden" name="_trigger" value="${trigger}" />
        <div class="lp-foot">
          <button class="pill pill--solid" type="submit" data-lp-submit><span class="dot" aria-hidden="true"></span>Send</button>
          <p class="lp-status" role="status" aria-live="polite" data-lp-status></p>
        </div>
      </form>
      <p class="lp-alt mono">Or:
        <a class="ulink" href="${person.resume}" download>Download CV</a> ·
        <a class="ulink" href="mailto:${person.email}?subject=${encodeURIComponent('Full-stack role')}">Email me</a> ·
        <a class="ulink" href="${person.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>
      </p>
    </div>`;
  document.body.append(dialog);

  const form = dialog.querySelector<HTMLFormElement>('form')!;
  const status = dialog.querySelector<HTMLElement>('[data-lp-status]')!;
  const submit = dialog.querySelector<HTMLButtonElement>('[data-lp-submit]')!;
  const email = dialog.querySelector<HTMLInputElement>('#lp-email')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    const finish = () => {
      dialog.close();
      dialog.remove();
      lenis?.start();
      restore?.focus({ preventScroll: true });
    };
    if (reduced) return finish();
    dialog.classList.add('out');
    window.setTimeout(finish, 220);
  };

  dialog.querySelector('[data-lp-close]')!.addEventListener('click', close);
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  // Backdrop: a click that lands on the <dialog> box itself, outside the card.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });
  // Keep Tab inside the card: a native modal still lets focus leave to the browser UI after the last control.
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll<HTMLElement>('button, input:not([type=hidden]):not([tabindex="-1"]), textarea, a[href]')];
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  const setStatus = (text: string, kind: '' | 'ok' | 'err') => {
    status.textContent = text;
    status.className = `lp-status ${kind}`.trim();
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = email.value.trim();
    const fields = [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[required], textarea[required]')];
    let firstBad: HTMLElement | null = null;
    for (const f of fields) {
      const ok = f === email ? EMAIL.test(value) : f.value.trim() !== '';
      f.setAttribute('aria-invalid', String(!ok));
      if (!ok && !firstBad) firstBad = f;
    }
    if (firstBad) {
      setStatus('Please add your name, company, a valid work email and a short message.', 'err');
      firstBad.focus();
      return;
    }
    const data = new FormData(form);
    submit.disabled = true;
    setStatus('Sending…', '');
    try {
      const res = await fetch(form.action, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      try {
        localStorage.setItem(LEAD_SENT, String(Date.now()));
      } catch {
        /* private mode */
      }
      form.reset();
      fields.forEach((f) => f.removeAttribute('aria-invalid'));
      dialog.classList.add('sent');
      setStatus('Thanks — your message is on its way. I’ll get back to you soon.', 'ok');
    } catch {
      setStatus('That didn’t send. Please use WhatsApp or email below.', 'err');
    } finally {
      submit.disabled = false;
    }
  });

  lenis?.stop();
  dialog.showModal();
  dialog.querySelector<HTMLInputElement>('#lp-name')?.focus();
}
