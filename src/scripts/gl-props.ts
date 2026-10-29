/**
 * Themed miniature props and the premium table top for each work chapter's plinth (gl-devices.ts places,
 * frames and draws them). Procedural, rounded, satin miniatures in the desk's style — no logos or trademarks.
 *
 * Budget: every table is a handful of draws, whatever its prop count —
 *   - surface: wood slab (shared `woodTexture`, tinted per project) + desk mat (felt or cutting-mat grid),
 *   - props: ALL props of a table are merged into one geometry per material channel (satin · paper · glow).
 *     Each vertex carries `aProp = (slot, accent, roughness, metalness)`; the vertex shader moves it by
 *     `uSlot[slot]` (16 mat4 per table), so props still drop/slide/unfold, lift on hover and run idle loops
 *     one by one. `accent` mixes the vertex colour towards the theme accent (re-themes in place),
 *   - one instanced contact-shadow mesh for the props and the toy cars, and an optional glow sprite (the orb).
 * Paper/glow parts sample one canvas atlas (invoices, labels, barcodes, notes, patterns…).
 *
 * Add a prop: a `PropKey` + label in src/data/props.ts, a builder in `DEFS` (prop space: base on y = 0,
 * footprint centred on the origin, front towards +z; `size` = half footprint + height for shadows/picking/the
 * overlap check) and a placement in the chapter's `TABLES` entry. See AGENTS.md → "Add / change a project plinth".
 */
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  type CanvasTexture,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  RingGeometry,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type ColorRepresentation,
  type Material,
  type ShaderMaterial,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CarKind } from './gl-cars';
import { canvasTexture, clamp, ease, fonts, GlowField, MINI, rng, rrect, shadowMaterial, woodTexture, type Palette } from './gl-kit';
import { tableProps, type PropKey } from '../data/props';

/** Slot matrices per table (slot 0 = static parts). */
const SLOTS = 16;
/** Props are modelled near real size next to a 1-unit laptop and drawn a little larger so they read at plinth scale. */
export const PROP_SCALE = 1.4;

/* ───────────── small helpers ───────────── */
const _v = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _e = new Euler();
const _c = new Color();
/** TRS matrix (Euler XYZ). */
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, out = new Matrix4()) =>
  out.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
const rbox = (w: number, h: number, d: number, r: number, seg = 2) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
const smoothstep = (a: number, b: number, x: number) => ease(clamp((x - a) / (b - a)));
/** Back-out easing: overshoots ≈ 12 % then settles (the "spring" of the reveals). */
const backOut = (t: number) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

/* ───────────── paper atlas ───────────── */
const ATLAS = 1024;
const PAD = 6;
const REGIONS = {
  white: [16, 16],
  invoice: [256, 340],
  stock: [256, 340],
  face: [192, 192],
  prompt: [192, 192],
  shiplabel: [192, 140],
  barcode: [192, 80],
  sizetag: [128, 192],
  washi0: [256, 64],
  washi1: [256, 64],
  washi2: [256, 64],
  tape: [512, 40],
  gingham: [128, 128],
  stripe: [128, 128],
  herring: [128, 128],
  dots: [128, 128],
  millet: [128, 128],
  days: [256, 40],
  lcd: [128, 48],
  jarlabel: [192, 80],
  grille: [64, 64],
  call: [96, 176],
  bubble: [160, 72],
} satisfies Record<string, [number, number]>;
type Region = keyof typeof REGIONS;
type Atlas = { uv: Record<Region, [number, number, number, number]>; tex: CanvasTexture };

function createAtlas(): Atlas {
  const t = canvasTexture(ATLAS, ATLAS);
  const { ctx } = t;
  const px = {} as Record<Region, [number, number, number, number]>;
  const uv = {} as Atlas['uv'];
  // shelf packing, tallest first
  let x = PAD;
  let y = PAD;
  let shelf = 0;
  const order = (Object.keys(REGIONS) as Region[]).sort((a, b) => REGIONS[b][1] - REGIONS[a][1]);
  for (const k of order) {
    const [w, h] = REGIONS[k];
    if (x + w + PAD > ATLAS) {
      x = PAD;
      y += shelf + PAD * 2;
      shelf = 0;
    }
    px[k] = [x, y, w, h];
    uv[k] = [x / ATLAS, 1 - (y + h) / ATLAS, (x + w) / ATLAS, 1 - y / ATLAS];
    x += w + PAD * 2;
    shelf = Math.max(shelf, h);
  }
  const f = fonts();
  const r = rng(29);
  const ink = '#2b2a33';
  const at = (k: Region, draw: (w: number, h: number) => void) => {
    const [rx, ry, w, h] = px[k];
    ctx.save();
    ctx.translate(rx, ry);
    ctx.beginPath();
    ctx.rect(-PAD / 2, -PAD / 2, w + PAD, h + PAD);
    ctx.clip();
    draw(w, h);
    ctx.restore();
  };
  const fill = (c: string, w: number, h: number) => {
    ctx.fillStyle = c;
    ctx.fillRect(-PAD, -PAD, w + PAD * 2, h + PAD * 2);
  };
  const bars = (x0: number, y0: number, w: number, h: number, c = 'rgba(43,42,51,.55)') => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.roundRect(x0, y0, w, h, h / 2);
    ctx.fill();
  };
  const text = (s: string, x0: number, y0: number, font: string, c = ink, align: CanvasTextAlign = 'left') => {
    ctx.font = font;
    ctx.fillStyle = c;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x0, y0);
  };
  const barcode = (x0: number, y0: number, w: number, h: number, seed: number) => {
    const rr = rng(seed);
    let bx = x0;
    while (bx < x0 + w - 4) {
      const bw = 1 + Math.floor(rr() * 3.2);
      if (rr() > 0.35) {
        ctx.fillStyle = ink;
        ctx.fillRect(bx, y0, bw, h);
      }
      bx += bw + 1;
    }
  };

  at('white', (w, h) => fill('#ffffff', w, h));
  at('invoice', (w, h) => {
    fill('#fbf9f4', w, h);
    text('TAX INVOICE', 18, 26, `700 19px ${f.sans}`);
    text('GSTIN', 18, 52, `600 11px ${f.mono}`, '#6b6872');
    bars(66, 47, 110, 9);
    ctx.fillStyle = '#e9e4da';
    ctx.fillRect(14, 74, w - 28, 20);
    text('ITEM', 20, 84, `600 10px ${f.mono}`);
    text('HSN', 130, 84, `600 10px ${f.mono}`);
    text('AMT', w - 20, 84, `600 10px ${f.mono}`, ink, 'right');
    for (let i = 0; i < 7; i++) {
      const yy = 106 + i * 22;
      bars(20, yy, 60 + r() * 40, 7);
      bars(130, yy, 34, 7, 'rgba(43,42,51,.35)');
      bars(w - 20 - 36, yy, 36, 7);
    }
    ctx.fillStyle = 'rgba(43,42,51,.25)';
    ctx.fillRect(14, 262, w - 28, 1.5);
    text('CGST 9%', 20, 278, `600 11px ${f.mono}`);
    bars(w - 56, 274, 36, 7);
    text('SGST 9%', 20, 296, `600 11px ${f.mono}`);
    bars(w - 56, 292, 36, 7);
    text('TOTAL', 20, 320, `700 13px ${f.mono}`);
    bars(w - 66, 315, 46, 10, ink);
  });
  at('stock', (w, h) => {
    fill('#fbfaf6', w, h);
    text('STOCK COUNT', 16, 24, `700 17px ${f.sans}`);
    text('WH-02 · AISLE B', 16, 46, `500 10px ${f.mono}`, '#6b6872');
    ctx.strokeStyle = 'rgba(43,42,51,.22)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const yy = 70 + i * 26;
      ctx.beginPath();
      ctx.moveTo(14, yy + 13);
      ctx.lineTo(w - 14, yy + 13);
      ctx.stroke();
      text('SKU', 18, yy, `600 9px ${f.mono}`, '#6b6872');
      bars(48, yy - 3, 50 + r() * 50, 6);
      bars(170, yy - 3, 22, 6, 'rgba(43,42,51,.4)');
      // tick boxes, most of them checked
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(w - 38, yy - 8, 16, 16);
      if (i < 7) {
        ctx.strokeStyle = '#2f8f5b';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(w - 35, yy);
        ctx.lineTo(w - 30, yy + 5);
        ctx.lineTo(w - 22, yy - 7);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(43,42,51,.22)';
      ctx.lineWidth = 1;
    }
  });
  at('face', (w, h) => {
    fill('#ffe58a', w, h);
    ctx.fillStyle = ink;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(w / 2 + s * 34, h / 2 - 6, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(w / 2 + s * 34 + 3, h / 2 - 9, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(244,128,150,.55)';
      ctx.beginPath();
      ctx.ellipse(w / 2 + s * 56, h / 2 + 14, 15, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ink;
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(w / 2 - 7, h / 2 + 10, 7, 0.1, Math.PI - 0.1);
    ctx.arc(w / 2 + 7, h / 2 + 10, 7, 0.1, Math.PI - 0.1);
    ctx.stroke();
  });
  at('prompt', (w, h) => {
    fill('#ffe27a', w, h);
    ctx.fillStyle = 'rgba(0,0,0,.05)';
    ctx.fillRect(0, 0, w, 26);
    ctx.save();
    ctx.translate(w / 2, h / 2 + 6);
    ctx.rotate(-0.06);
    text('prompt', 0, -22, `600 40px ${f.sans}`, '#23222b', 'center');
    text('v3', 0, 26, `700 46px ${f.sans}`, '#23222b', 'center');
    ctx.strokeStyle = '#23222b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-58, 54);
    ctx.quadraticCurveTo(0, 62, 60, 50);
    ctx.stroke();
    ctx.restore();
  });
  at('shiplabel', (w, h) => {
    fill('#fdfcf8', w, h);
    text('SHIP TO', 12, 18, `700 13px ${f.mono}`);
    bars(12, 32, 120, 7);
    bars(12, 46, 96, 7);
    bars(12, 60, 108, 7);
    ctx.fillStyle = ink;
    ctx.fillRect(w - 46, 10, 34, 34);
    ctx.fillStyle = '#fdfcf8';
    ctx.fillRect(w - 40, 16, 22, 22);
    ctx.fillStyle = ink;
    ctx.fillRect(w - 34, 22, 10, 10);
    barcode(12, 80, w - 24, 42, 7);
  });
  at('barcode', (w, h) => {
    fill('#fdfcf8', w, h);
    barcode(10, 8, w - 20, h - 30, 11);
    text('8 901234 567890', w / 2, h - 12, `500 12px ${f.mono}`, ink, 'center');
  });
  at('sizetag', (w, h) => {
    fill('#f3ede2', w, h);
    ctx.strokeStyle = 'rgba(43,42,51,.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    text('SIZE', w / 2, 60, `600 14px ${f.mono}`, '#6b6872', 'center');
    text('M', w / 2, 112, `700 64px ${f.display}`, ink, 'center');
    bars(30, 160, w - 60, 6, 'rgba(43,42,51,.35)');
  });
  const washi = (k: Region, bg: string, fg: string, kind: number) =>
    at(k, (w, h) => {
      fill(bg, w, h);
      ctx.fillStyle = fg;
      if (kind === 0) {
        for (let i = 0; i < 26; i++) for (let j = 0; j < 4; j++) {
          ctx.beginPath();
          ctx.arc(6 + i * 10 + (j % 2) * 5, 8 + j * 16, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (kind === 1) {
        for (let i = -4; i < 30; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 12, 0);
          ctx.lineTo(i * 12 + 6, 0);
          ctx.lineTo(i * 12 + 6 + h * 0.5, h);
          ctx.lineTo(i * 12 + h * 0.5, h);
          ctx.fill();
        }
      } else {
        for (let i = 0; i < 12; i++) {
          const cx = 12 + i * 22;
          const cy = 18 + (i % 2) * 26;
          ctx.beginPath();
          ctx.moveTo(cx, cy + 6);
          ctx.bezierCurveTo(cx - 10, cy - 2, cx - 4, cy - 10, cx, cy - 3);
          ctx.bezierCurveTo(cx + 4, cy - 10, cx + 10, cy - 2, cx, cy + 6);
          ctx.fill();
        }
      }
    });
  washi('washi0', '#bfe8d6', '#ffffff', 0);
  washi('washi1', '#f7c3d2', '#fff4f7', 1);
  washi('washi2', '#d9cdf5', '#9c86d6', 2);
  at('tape', (w, h) => {
    fill('#f2cf3c', w, h);
    ctx.fillStyle = ink;
    for (let i = 0; i < 100; i++) {
      const xx = 4 + i * 5;
      const len = i % 10 === 0 ? 16 : i % 5 === 0 ? 11 : 6;
      ctx.fillRect(xx, 0, 1.2, len);
      if (i % 10 === 0 && i) text(String(i / 10), xx + 3, 26, `600 11px ${f.mono}`);
    }
  });
  at('gingham', (w, h) => {
    fill('#ffffff', w, h);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(i * 16, 0, 8, h);
      ctx.fillRect(0, i * 16, w, 8);
    }
  });
  at('stripe', (w, h) => {
    fill('#ffffff', w, h);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    for (let i = 0; i < 16; i++) ctx.fillRect(0, i * 8, w, 3);
  });
  at('herring', (w, h) => {
    fill('#ffffff', w, h);
    ctx.strokeStyle = 'rgba(0,0,0,.2)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++)
      for (let j = 0; j < 18; j++) {
        const x0 = i * 16;
        const y0 = j * 8;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + 8, y0 + (i % 2 ? -6 : 6));
        ctx.stroke();
      }
  });
  at('dots', (w, h) => {
    fill('#ffffff', w, h);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) {
        ctx.beginPath();
        ctx.arc(8 + i * 16 + (j % 2) * 8, 8 + j * 16, 3, 0, Math.PI * 2);
        ctx.fill();
      }
  });
  at('millet', (w, h) => {
    fill('#e7cf8a', w, h);
    for (let i = 0; i < 420; i++) {
      ctx.fillStyle = r() > 0.5 ? 'rgba(255,248,214,.85)' : 'rgba(176,132,58,.55)';
      ctx.beginPath();
      ctx.arc(r() * w, r() * h, 1.6 + r() * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  at('days', (w, h) => {
    fill('#f4f1ec', w, h);
    'SMTWTFS'.split('').forEach((d, i) => text(d, (i + 0.5) * (w / 7), h / 2, `700 20px ${f.mono}`, '#6b6872', 'center'));
  });
  at('lcd', (w, h) => {
    fill('#b9c7a4', w, h);
    text('GST 18%', w - 10, h / 2 + 1, `600 24px ${f.mono}`, '#2a3324', 'right');
  });
  at('jarlabel', (w, h) => {
    fill('#efe2c4', w, h);
    ctx.strokeStyle = 'rgba(43,42,51,.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    text('MILLETS', w / 2, h / 2 - 6, `700 26px ${f.display}`, '#4a3a22', 'center');
    text('foxtail · 500 g', w / 2, h / 2 + 20, `500 11px ${f.mono}`, '#6b5a3a', 'center');
  });
  at('grille', (w, h) => {
    fill('#9a9da4', w, h);
    ctx.fillStyle = '#2a2c31';
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) {
        ctx.beginPath();
        ctx.arc(4 + i * 8 + (j % 2) * 4, 4 + j * 8, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
  });
  at('call', (w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2c3a52');
    g.addColorStop(1, '#151a24');
    ctx.fillStyle = g;
    ctx.fillRect(-PAD, -PAD, w + PAD * 2, h + PAD * 2);
    ctx.fillStyle = '#e9edf5';
    ctx.beginPath();
    ctx.arc(w / 2, 50, 18, 0, Math.PI * 2);
    ctx.fill();
    text('Callback', w / 2, 86, `600 12px ${f.sans}`, '#e9edf5', 'center');
    text('incoming…', w / 2, 102, `500 9px ${f.mono}`, '#9fb0cc', 'center');
    ctx.fillStyle = '#e5484d';
    ctx.beginPath();
    ctx.arc(w / 2 - 22, h - 32, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#30a46c';
    ctx.beginPath();
    ctx.arc(w / 2 + 22, h - 32, 11, 0, Math.PI * 2);
    ctx.fill();
  });
  at('bubble', (w, h) => {
    fill('#ffffff', w, h);
    text('☎', 26, h / 2 + 2, `600 26px ${f.sans}`, '#1b1e24', 'center');
    text('Call back', 46, h / 2 + 1, `700 21px ${f.sans}`, '#1b1e24');
  });
  t.tex.anisotropy = 4;
  t.tex.needsUpdate = true;
  return { uv, tex: t.tex };
}

/* ───────────── builder: parts → per-channel geometry with aProp ───────────── */
type Channel = 'satin' | 'paper' | 'glow';
const CHANNELS: Channel[] = ['satin', 'paper', 'glow'];
type Paint = ColorRepresentation | ((p: Vector3) => ColorRepresentation);
type PartOpts = { ch?: Channel; rough?: number; metal?: number; accent?: number; uv?: Region };

class Builder {
  readonly geos: Record<Channel, BufferGeometry[]> = { satin: [], paper: [], glow: [] };
  /** slot of the parts being added */
  slot = 0;
  /** pivot subtracted from the parts of a sub slot (they are drawn relative to it) */
  readonly pivot = new Vector3();
  /** rest-pose box of the current prop, in prop space */
  readonly box = new Box3();
  constructor(
    private atlas: Atlas,
    readonly q: number,
  ) {}

  seg(n: number) {
    return Math.max(4, Math.round(n * this.q));
  }

  add(geo: BufferGeometry, paint: Paint, m: Matrix4 | null, o: PartOpts = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (m) g.applyMatrix4(m);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.computeBoundingBox();
    this.box.union(g.boundingBox!);
    const pos = g.attributes.position;
    const n = pos.count;
    const col = new Float32Array(n * 3);
    const prop = new Float32Array(n * 4);
    const fn = typeof paint === 'function' ? paint : null;
    if (!fn) _c.set(paint as ColorRepresentation);
    const p = new Vector3();
    for (let i = 0; i < n; i++) {
      if (fn) _c.set(fn(p.fromBufferAttribute(pos, i)));
      col[i * 3] = _c.r;
      col[i * 3 + 1] = _c.g;
      col[i * 3 + 2] = _c.b;
      prop[i * 4] = this.slot;
      prop[i * 4 + 1] = o.accent ?? 0;
      prop[i * 4 + 2] = o.rough ?? 0.5;
      prop[i * 4 + 3] = o.metal ?? 0;
    }
    g.setAttribute('color', new BufferAttribute(col, 3));
    g.setAttribute('aProp', new BufferAttribute(prop, 4));
    const ch = o.ch ?? 'satin';
    if (ch !== 'satin') {
      const [u0, v0, u1, v1] = this.atlas.uv[o.uv ?? 'white'];
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + clamp(uv.getX(i)) * (u1 - u0), v0 + clamp(uv.getY(i)) * (v1 - v0));
    }
    if (this.pivot.lengthSq()) g.translate(-this.pivot.x, -this.pivot.y, -this.pivot.z);
    this.geos[ch].push(g);
    return this;
  }
}

/** Flat plane on the table (uv up = away from the viewer). */
const flat = (w: number, d: number, sx = 1, sy = 1) => new PlaneGeometry(w, d, sx, sy).rotateX(-Math.PI / 2);

/** A ribbon standing on its edge along a path in the table plane (both faces + top edge), uv.x along its length. */
function ribbon(path: Vector2[], h: number, t: number) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  let total = 0;
  const lens = [0];
  for (let i = 1; i < path.length; i++) lens.push((total += path[i].distanceTo(path[i - 1])));
  const normalAt = (i: number) => {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(path.length - 1, i + 1)];
    const tx = b.x - a.x;
    const tz = b.y - a.y;
    const l = Math.hypot(tx, tz) || 1;
    return [tz / l, -tx / l];
  };
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[][], u: number[][]) => {
    for (const [P, N, U] of [
      [a, n[0], u[0]],
      [b, n[1], u[1]],
      [c, n[2], u[2]],
      [a, n[0], u[0]],
      [c, n[2], u[2]],
      [d, n[3], u[3]],
    ] as number[][][]) {
      pos.push(...P);
      nor.push(...N);
      uv.push(...U);
    }
  };
  for (let i = 0; i < path.length - 1; i++) {
    const [nx0, nz0] = normalAt(i);
    const [nx1, nz1] = normalAt(i + 1);
    const p0 = path[i];
    const p1 = path[i + 1];
    const u0 = lens[i] / total;
    const u1 = lens[i + 1] / total;
    for (const side of [1, -1]) {
      const o = (t / 2) * side;
      const a = [p0.x + nx0 * o, 0, p0.y + nz0 * o];
      const b = [p1.x + nx1 * o, 0, p1.y + nz1 * o];
      const c = [p1.x + nx1 * o, h, p1.y + nz1 * o];
      const d = [p0.x + nx0 * o, h, p0.y + nz0 * o];
      const n0 = [nx0 * side, 0, nz0 * side];
      const n1 = [nx1 * side, 0, nz1 * side];
      if (side > 0) quad(a, b, c, d, [n0, n1, n1, n0], [[u0, 0], [u1, 0], [u1, 1], [u0, 1]]);
      else quad(b, a, d, c, [n1, n0, n0, n1], [[u1, 0], [u0, 0], [u0, 1], [u1, 1]]);
    }
    // top edge
    const up = [0, 1, 0];
    quad(
      [p0.x + (nx0 * t) / 2, h, p0.y + (nz0 * t) / 2],
      [p1.x + (nx1 * t) / 2, h, p1.y + (nz1 * t) / 2],
      [p1.x - (nx1 * t) / 2, h, p1.y - (nz1 * t) / 2],
      [p0.x - (nx0 * t) / 2, h, p0.y - (nz0 * t) / 2],
      [up, up, up, up],
      [[u0, 1], [u1, 1], [u1, 1], [u0, 1]],
    );
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}

/* ───────────── prop definitions ───────────── */
type Reveal = 'drop' | 'slide' | 'unfold' | 'subs';
/** per-frame motion of a prop's sub slots: `set(i, m)` = local transform of sub i around its pivot */
type Anim = { t: number; time: number; idle: number; set(i: number, m: Matrix4): void; m: Matrix4 };
type PropDef = {
  /** half footprint x, half footprint z, height (prop space) */
  size: [number, number, number];
  reveal: Reveal;
  build(b: Builder, sub: (pivot: Vector3) => void, main: () => void): void;
  animate?(a: Anim): void;
};

const PASTEL = { mint: '#a8e3cf', lilac: '#cbb8f0', peach: '#ffc3ab', pink: '#f7b3c8', butter: '#fbe38c', sky: '#a9d2f5' };
const METAL = { rough: 0.22, metal: 1 };
const steel = '#cfd3da';
const kraft = '#c49a6c';

const DEFS: Record<PropKey, PropDef> = {
  /* ── Young Onion ── */
  pens: {
    size: [0.15, 0.06, 0.026],
    reveal: 'slide',
    build(b, sub, main) {
      const r = 0.011;
      const pen = (z: number, yaw: number, body: string, cap: string) => {
        const seg = b.seg(16);
        /** pen-axis matrix: along +x at `x`, lying on the table, fanned by `yaw` */
        const T = (x: number) => new Matrix4().makeRotationY(yaw).multiply(M(x, r, z, 0, 0, -Math.PI / 2));
        b.add(new CylinderGeometry(r, r, 0.17, seg), body, T(-0.005), { rough: 0.3 });
        b.add(new CylinderGeometry(r * 1.06, r * 1.06, 0.045, seg), cap, T(0.1), { rough: 0.55 });
        b.add(new CylinderGeometry(r * 0.35, r * 0.95, 0.03, seg), '#f4f1ec', T(0.137), { rough: 0.3 });
        b.add(new SphereGeometry(r * 0.32, 8, 6), steel, T(0.153), METAL);
        b.add(new CylinderGeometry(r * 1.1, r * 1.1, 0.062, seg), cap, T(-0.112), { rough: 0.35 });
        b.add(new SphereGeometry(r * 1.1, seg, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap, new Matrix4().makeRotationY(yaw).multiply(M(-0.143, r, z, 0, 0, Math.PI / 2)), { rough: 0.35 });
        b.add(rbox(0.05, 0.004, 0.006, 0.0019), '#ffffff', new Matrix4().makeRotationY(yaw).multiply(M(-0.11, r * 2.1, z)), { rough: 0.3, metal: 0.3 });
      };
      pen(-0.032, 0.05, PASTEL.lilac, '#9d86d8');
      pen(0.0, -0.04, PASTEL.peach, '#f08c6b');
      // the front pen rolls (idle)
      sub(new Vector3(0, 0.011, 0.034));
      pen(0.034, 0, PASTEL.mint, '#5fbf9c');
      main();
    },
    animate(a) {
      const ang = Math.sin(a.time * 1.4) * 0.9 * a.idle;
      a.set(0, M(0, 0, ang * 0.011, ang, 0, 0, 1, 1, 1, a.m));
    },
  },
  highlighters: {
    size: [0.11, 0.09, 0.03],
    reveal: 'drop',
    build(b) {
      const cols = [PASTEL.butter, PASTEL.pink, PASTEL.mint, PASTEL.sky];
      const caps = ['#e8c53a', '#ec6f9c', '#4fbf8a', '#5aa6e6'];
      cols.forEach((c, i) => {
        const z = (i - 1.5) * 0.044;
        const x = (i % 2) * 0.012 - 0.006;
        b.add(rbox(0.17, 0.028, 0.04, 0.011), c, M(x, 0.014, z), { rough: 0.4 });
        b.add(rbox(0.052, 0.031, 0.043, 0.012), caps[i], M(x + 0.075, 0.0155, z), { rough: 0.35 });
        b.add(rbox(0.03, 0.0295, 0.0405, 0.011), '#fbf8f2', M(x - 0.02, 0.014, z), { rough: 0.6 });
      });
    },
  },
  washi: {
    size: [0.1, 0.08, 0.095],
    reveal: 'drop',
    build(b) {
      const R = 0.046;
      const ri = 0.031;
      const w = 0.022;
      const seg = b.seg(32);
      const roll = (m: Matrix4, k: Region, solid: string) => {
        b.add(new CylinderGeometry(R, R, w, seg, 1, true), '#ffffff', m, { ch: 'paper', uv: k, rough: 0.45 });
        const side = new LatheGeometry([new Vector2(R, w / 2), new Vector2(ri + 0.006, w / 2), new Vector2(ri, w / 2), new Vector2(ri, -w / 2), new Vector2(ri + 0.006, -w / 2), new Vector2(R, -w / 2)], seg);
        b.add(side, (p) => (Math.hypot(p.x, p.z) < ri + 0.004 ? kraft : solid), m, { rough: 0.6 });
      };
      roll(M(-0.035, w / 2, 0.02), 'washi0', '#bfe8d6');
      roll(M(-0.03, w * 1.5 + 0.0005, 0.015, 0, 0.3, 0), 'washi1', '#f7c3d2');
      roll(M(0.05, R, -0.01, Math.PI / 2, 0.5, 0), 'washi2', '#d9cdf5');
    },
  },
  notepad: {
    size: [0.06, 0.06, 0.034],
    reveal: 'unfold',
    build(b) {
      b.add(rbox(0.114, 0.005, 0.114, 0.002), kraft, M(0, 0.0025, 0), { rough: 0.8 });
      b.add(rbox(0.11, 0.028, 0.11, 0.003), (p) => (Math.round(p.y * 900) % 3 === 0 ? '#f6d96f' : PASTEL.butter), M(0, 0.019, 0), { rough: 0.85 });
      b.add(flat(0.106, 0.106), '#ffffff', M(0, 0.0332, 0), { ch: 'paper', uv: 'face', rough: 0.85 });
    },
  },
  eraser: {
    size: [0.042, 0.042, 0.11],
    reveal: 'drop',
    build(b) {
      const prof = [
        [0, 0],
        [0.02, 0.002],
        [0.034, 0.012],
        [0.041, 0.028],
        [0.038, 0.044],
        [0.027, 0.058],
        [0.012, 0.07],
        [0.004, 0.08],
        [0, 0.083],
      ].map(([x, y]) => new Vector2(x, y));
      const bottom = new Color('#fbf3ea');
      const top = new Color('#c79ad9');
      b.add(new LatheGeometry(prof, b.seg(28)), (p) => _c.copy(bottom).lerp(top, smoothstep(0.02, 0.075, p.y)).getHex(), null, { rough: 0.6 });
      for (const [rz, ry] of [
        [0.25, 0],
        [-0.3, 0.6],
      ])
        b.add(new CylinderGeometry(0.0015, 0.0055, 0.04, 8), '#86c96f', M(0, 0.095, 0, 0, ry, rz), { rough: 0.5 });
      for (const s of [-1, 1]) {
        b.add(new SphereGeometry(0.0042, 10, 8), '#22212a', M(s * 0.012, 0.034, 0.0385), { rough: 0.2 });
        b.add(new SphereGeometry(0.006, 10, 6), '#f39bb0', M(s * 0.024, 0.026, 0.032, 0, s * 0.6, 0, 1, 0.55, 0.35), { rough: 0.6 });
      }
      b.add(new TorusGeometry(0.004, 0.0012, 4, 10, Math.PI), '#22212a', M(0, 0.027, 0.0405, Math.PI, 0, 0), { rough: 0.4 });
    },
  },

  /* ── ZetStore ── */
  invoices: {
    size: [0.11, 0.14, 0.02],
    reveal: 'unfold',
    build(b, sub, main) {
      const yaws = [0.22, -0.12, 0.08, -0.03];
      yaws.forEach((_yaw, i) => {
        sub(new Vector3(0, 0, 0));
        const y = 0.0015 + i * 0.0032;
        b.add(rbox(0.2, 0.0028, 0.27, 0.0012), '#f5f2ea', M(0, y, 0), { rough: 0.9 });
        if (i === yaws.length - 1) {
          b.add(flat(0.196, 0.266), '#ffffff', M(0, y + 0.0015, 0), { ch: 'paper', uv: 'invoice', rough: 0.9 });
          // paperclip over the top edge
          const pts = [
            [-0.006, 0.026],
            [-0.006, -0.026],
            [0, -0.034],
            [0.006, -0.026],
            [0.006, 0.04],
            [-0.002, 0.049],
            [-0.01, 0.04],
            [-0.01, -0.018],
          ].map(([x, z]) => new Vector3(x, 0, z));
          const curve = new CatmullRomCurve3(pts, false, 'centripetal');
          b.add(new TubeGeometry(curve, b.seg(64), 0.0016, 5), '#c8ccd3', M(0.05, y + 0.003, -0.13), METAL);
        }
      });
      main();
    },
    animate(a) {
      const yaws = [0.22, -0.12, 0.08, -0.03];
      const k = ease(clamp(a.t * 1.3 - 0.15));
      yaws.forEach((yaw, i) => a.set(i, M(0, 0, 0, 0, yaw * k + (1 - k) * 0.6, 0, 1, 1, 1, a.m)));
    },
  },
  calculator: {
    size: [0.058, 0.082, 0.022],
    reveal: 'slide',
    build(b, sub, main) {
      b.add(rbox(0.112, 0.016, 0.162, 0.007), MINI.charcoal, M(0, 0.008, 0), { rough: 0.45 });
      b.add(rbox(0.092, 0.003, 0.034, 0.0014), '#1b1d22', M(0, 0.0165, -0.054), { rough: 0.3 });
      b.add(flat(0.086, 0.028), '#ffffff', M(0, 0.0182, -0.054), { ch: 'paper', uv: 'lcd', rough: 0.25 });
      b.add(rbox(0.04, 0.002, 0.01, 0.0009), '#3b3226', M(0.024, 0.0165, -0.076), { rough: 0.2 });
      const key = rbox(0.018, 0.006, 0.014, 0.0025, 1);
      for (let row = 0; row < 5; row++)
        for (let c = 0; c < 4; c++) {
          if (row === 4 && c === 3) continue;
          const x = (c - 1.5) * 0.024;
          const z = -0.022 + row * 0.022;
          b.add(key.clone(), c === 3 ? '#a7a29a' : '#e7e2d8', M(x, 0.018, z), { rough: 0.5 });
        }
      key.dispose();
      // the "=" key taps (idle)
      sub(new Vector3(0.036, 0.018, 0.066));
      b.add(rbox(0.018, 0.006, 0.014, 0.0025, 1), '#ffffff', M(0.036, 0.018, 0.066), { rough: 0.4, accent: 1 });
      main();
    },
    animate(a) {
      const ph = (a.time * 0.9) % 1;
      const press = ph < 0.12 ? Math.sin((ph / 0.12) * Math.PI) : 0;
      a.set(0, M(0, -0.0035 * press * a.idle, 0, 0, 0, 0, 1, 1, 1, a.m));
    },
  },
  jar: {
    size: [0.042, 0.042, 0.106],
    reveal: 'drop',
    build(b) {
      const seg = b.seg(28);
      const prof = [
        [0, 0],
        [0.034, 0],
        [0.04, 0.006],
        [0.041, 0.074],
        [0.035, 0.084],
        [0.029, 0.089],
        [0, 0.089],
      ].map(([x, y]) => new Vector2(x, y));
      b.add(new LatheGeometry(prof, seg), '#ffffff', null, { ch: 'paper', uv: 'millet', rough: 0.14 });
      b.add(new CylinderGeometry(0.0315, 0.0315, 0.016, seg), MINI.wood, M(0, 0.097, 0), { rough: 0.55 });
      b.add(new TorusGeometry(0.0305, 0.0022, 6, seg), '#bfa171', M(0, 0.089, 0, Math.PI / 2, 0, 0), { rough: 0.8 });
      b.add(new CylinderGeometry(0.0415, 0.0415, 0.03, b.seg(16), 1, true, -0.75, 1.5), '#ffffff', M(0, 0.042, 0), { ch: 'paper', uv: 'jarlabel', rough: 0.7 });
    },
  },
  parcel: {
    size: [0.086, 0.066, 0.104],
    reveal: 'drop',
    build(b) {
      b.add(rbox(0.17, 0.1, 0.13, 0.005), kraft, M(0, 0.05, 0), { rough: 0.85 });
      b.add(rbox(0.172, 0.0018, 0.003, 0.0008), '#8a6844', M(0, 0.1, 0), { rough: 0.9 });
      b.add(rbox(0.026, 0.0024, 0.132, 0.001), '#dcc192', M(-0.02, 0.1008, 0), { rough: 0.3 });
      b.add(flat(0.068, 0.05), '#ffffff', M(0.042, 0.1025, 0.02, 0, 0.08, 0), { ch: 'paper', uv: 'shiplabel', rough: 0.8 });
    },
  },

  /* ── 360 Home Healthcare ── */
  stethoscope: {
    size: [0.13, 0.1, 0.024],
    reveal: 'unfold',
    build(b, sub, main) {
      const rt = 0.0055;
      const pts = [
        [0.098, 0.056, 0],
        [0.06, 0.078, 0],
        [0.0, 0.082, 0],
        [-0.062, 0.052, 0],
        [-0.082, -0.008, 0],
        [-0.05, -0.066, 0],
        [0.012, -0.08, 0],
        [0.062, -0.048, 0.006],
        [0.068, 0.004, 0.009],
        [0.036, 0.04, 0.006],
        [-0.012, 0.03, 0],
        [-0.036, 0.0, 0],
      ].map(([x, z, y]) => new Vector3(x, rt + y, z));
      b.add(new TubeGeometry(new CatmullRomCurve3(pts, false, 'centripetal'), b.seg(110), rt, b.seg(8)), '#ffffff', null, { accent: 1, rough: 0.38 });
      // Y yoke + binaural tubes + ear tips
      b.add(new SphereGeometry(rt * 1.25, 10, 8), steel, M(-0.036, rt, 0), METAL);
      for (const s of [-1, 1]) {
        const bin = [
          [-0.036, 0],
          [-0.07, s * 0.012],
          [-0.11, s * 0.03],
          [-0.128, s * 0.05],
        ].map(([x, z]) => new Vector3(x, 0.0035, z));
        b.add(new TubeGeometry(new CatmullRomCurve3(bin), b.seg(24), 0.0026, 6), steel, null, METAL);
        b.add(new SphereGeometry(0.0072, 10, 8), MINI.charcoal, M(-0.13, 0.0068, s * 0.054), { rough: 0.6 });
      }
      // the chestpiece swings (idle) around the tube end
      sub(new Vector3(0.098, rt, 0.056));
      b.add(new CylinderGeometry(0.0034, 0.0034, 0.022, 8), steel, M(0.11, rt, 0.058, 0, 0, Math.PI / 2), METAL);
      b.add(new CylinderGeometry(0.028, 0.028, 0.011, b.seg(28)), steel, M(0.145, 0.0058, 0.062), METAL);
      b.add(new CylinderGeometry(0.0235, 0.0235, 0.0016, b.seg(28)), '#26282e', M(0.145, 0.0118, 0.062), { rough: 0.35 });
      main();
    },
    animate(a) {
      a.set(0, M(0, 0, 0, 0, Math.sin(a.time * 1.3) * 0.22 * a.idle, 0, 1, 1, 1, a.m));
    },
  },
  pills: {
    size: [0.125, 0.045, 0.036],
    reveal: 'slide',
    build(b) {
      b.add(rbox(0.25, 0.026, 0.056, 0.008), '#f4f1ec', M(0, 0.013, 0), { rough: 0.35 });
      const lids = [PASTEL.pink, PASTEL.peach, PASTEL.butter, PASTEL.mint, PASTEL.sky, PASTEL.lilac, '#f4b7e0'];
      lids.forEach((c, i) => b.add(rbox(0.031, 0.006, 0.05, 0.0025), c, M((i - 3) * 0.0345, 0.0285, -0.001), { rough: 0.25 }));
      b.add(new PlaneGeometry(0.242, 0.014), '#ffffff', M(0, 0.013, 0.0282), { ch: 'paper', uv: 'days', rough: 0.4 });
      for (const [x, z, yaw] of [
        [0.05, 0.05, 0.4],
        [0.075, 0.04, -0.5],
      ]) {
        b.add(new CapsuleGeometry(0.006, 0.014, 4, 10), (p) => (p.y > 0 ? '#ffffff' : MINI.terracotta), M(x, 0.006, z, 0, yaw, Math.PI / 2), { rough: 0.25 });
      }
    },
  },
  firstaid: {
    size: [0.076, 0.052, 0.058],
    reveal: 'drop',
    build(b) {
      b.add(rbox(0.15, 0.056, 0.1, 0.022, 3), '#3f9a6b', M(0, 0.028, 0), { rough: 0.85 });
      b.add(rbox(0.044, 0.004, 0.013, 0.0019), '#ffffff', M(0, 0.0562, 0), { rough: 0.6 });
      b.add(rbox(0.013, 0.004, 0.044, 0.0019), '#ffffff', M(0, 0.0562, 0), { rough: 0.6 });
      b.add(rbox(0.012, 0.004, 0.02, 0.0018), steel, M(0.078, 0.034, 0.02, 0, 0, 0.2), METAL);
      b.add(rbox(0.152, 0.003, 0.003, 0.001), '#2f7350', M(0, 0.038, 0.05), { rough: 0.7 });
    },
  },
  callback: {
    size: [0.042, 0.036, 0.16],
    reveal: 'drop',
    build(b, sub, main) {
      b.add(rbox(0.072, 0.008, 0.06, 0.003), MINI.cream, M(0, 0.004, 0), { rough: 0.45 });
      b.add(rbox(0.062, 0.075, 0.008, 0.003), MINI.cream, M(0, 0.04, -0.012, -0.32, 0, 0), { rough: 0.45 });
      b.add(rbox(0.062, 0.012, 0.006, 0.0025), MINI.cream, M(0, 0.014, 0.022), { rough: 0.45 });
      // a small phone ringing on the stand (it wiggles), the callback bubble pops above it
      sub(new Vector3(0, 0.012, 0.012));
      b.add(rbox(0.05, 0.096, 0.006, 0.006), '#1b1e24', M(0, 0.058, 0.004, -0.32, 0, 0), { rough: 0.25, metal: 0.3 });
      b.add(new PlaneGeometry(0.044, 0.086), '#ffffff', M(0, 0.058, 0.004, -0.32, 0, 0).multiply(M(0, 0, 0.0032)), { ch: 'glow', uv: 'call' });
      sub(new Vector3(0, 0.138, 0.0));
      const bub = new ShapeGeometry(rrect(0.084, 0.036, 0.016), 6);
      const tail = new ShapeGeometry(rrect(0.012, 0.012, 0.002), 1).rotateZ(Math.PI / 4).translate(-0.022, -0.017, -0.0002);
      const uvFit = (g: BufferGeometry) => {
        const p = g.attributes.position;
        const uv = g.attributes.uv;
        for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.084 + 0.5, p.getY(i) / 0.036 + 0.5);
        return g;
      };
      b.add(uvFit(bub), '#ffffff', M(0, 0.138, 0.0), { ch: 'glow', uv: 'bubble', accent: 1 });
      b.add(tail, '#ffffff', M(0, 0.138, 0.0), { ch: 'glow', accent: 1 });
      main();
    },
    animate(a) {
      const ph = (a.time * 0.55) % 1;
      const ring = ph < 0.45 ? Math.sin(ph * 70) * Math.sin((ph / 0.45) * Math.PI) : 0;
      a.set(0, M(0, 0, 0, 0, 0, ring * 0.05 * a.idle, 1, 1, 1, a.m));
      const pop = 1 + (ph < 0.45 ? Math.sin((ph / 0.45) * Math.PI) * 0.1 : 0) * a.idle;
      const show = smoothstep(0.55, 0.9, a.t);
      a.set(1, M(0, 0, 0, 0, 0, 0, pop * show, pop * show, 1, a.m));
    },
  },

  /* ── Fiomis ── */
  tees: {
    size: [0.092, 0.072, 0.09],
    reveal: 'drop',
    build(b) {
      const cols = ['#ece6da', MINI.sage, MINI.terracotta, MINI.slateDeep];
      cols.forEach((c, i) => {
        const y = 0.012 + i * 0.022;
        const yaw = [0.04, -0.05, 0.03, -0.02][i];
        b.add(rbox(0.17, 0.024, 0.126, 0.01, 3), c, M(0, y, 0, 0, yaw, 0), { rough: 0.92 });
        if (i === cols.length - 1) {
          b.add(new TorusGeometry(0.022, 0.0042, 6, b.seg(18), Math.PI), c, M(0, y + 0.012, -0.042, -Math.PI / 2, yaw, 0, 1, 1, 0.8), { rough: 0.9 });
          for (const s of [-1, 1]) b.add(rbox(0.003, 0.0012, 0.11, 0.0005), '#33445a', M(s * 0.05, y + 0.0121, 0.004, 0, yaw, 0), { rough: 0.9 });
        }
      });
    },
  },
  swatches: {
    size: [0.1, 0.09, 0.026],
    reveal: 'subs',
    build(b, sub, main) {
      const fab: [string, Region][] = [
        ['#e8d9c0', 'herring'],
        ['#9cb79a', 'gingham'],
        ['#cf7a5c', 'stripe'],
        ['#647d9c', 'dots'],
        ['#ecd27e', 'herring'],
      ];
      fab.forEach(([c, k], i) => {
        sub(new Vector3(-0.07, 0, 0));
        const y = 0.002 + i * 0.0046;
        b.add(rbox(0.16, 0.004, 0.05, 0.0019), c, M(0, y, 0), { rough: 0.9 });
        b.add(flat(0.152, 0.046), c, M(0.002, y + 0.0021, 0), { ch: 'paper', uv: k, rough: 0.9 });
      });
      main();
      b.add(new TorusGeometry(0.009, 0.0024, 6, 16), '#c9a85a', M(-0.07, 0.024, 0, Math.PI / 2, 0, 0), METAL);
      b.add(new CylinderGeometry(0.0035, 0.0035, 0.026, 8), '#c9a85a', M(-0.07, 0.013, 0), METAL);
    },
    animate(a) {
      const fan = [-0.62, -0.31, 0, 0.31, 0.62];
      fan.forEach((ang, i) => {
        const k = backOut(clamp(a.t * 1.4 - 0.1 - i * 0.06));
        const s = smoothstep(0, 0.15, a.t);
        a.set(i, M(0, 0, 0, 0, ang * k, 0, s, s, s, a.m));
      });
    },
  },
  hanger: {
    size: [0.145, 0.07, 0.018],
    reveal: 'slide',
    build(b) {
      const r = 0.0075;
      const body = [
        [-0.135, 0.032],
        [-0.1, 0.008],
        [-0.05, -0.022],
        [0, -0.036],
        [0.05, -0.022],
        [0.1, 0.008],
        [0.135, 0.032],
      ].map(([x, z]) => new Vector3(x, r, z));
      b.add(new TubeGeometry(new CatmullRomCurve3(body), b.seg(60), r, b.seg(10)), '#b07a4a', null, { rough: 0.4 });
      for (const s of [-1, 1]) b.add(new SphereGeometry(r, 10, 8), '#b07a4a', M(s * 0.135, r, 0.032), { rough: 0.4 });
      b.add(new CylinderGeometry(0.0042, 0.0042, 0.27, 10), '#b07a4a', M(0, 0.0042, 0.034, 0, 0, Math.PI / 2), { rough: 0.4 });
      const hook = [
        [0, -0.036],
        [0, -0.056],
        [0.004, -0.07],
        [0.018, -0.078],
        [0.03, -0.07],
        [0.03, -0.058],
      ].map(([x, z]) => new Vector3(x, 0.0025, z));
      b.add(new TubeGeometry(new CatmullRomCurve3(hook), b.seg(30), 0.0022, 6), steel, null, METAL);
    },
  },
  tape: {
    size: [0.075, 0.06, 0.015],
    reveal: 'unfold',
    build(b, sub, main) {
      const path: Vector2[] = [];
      const turns = 2.4;
      const n = b.seg(90);
      for (let i = 0; i <= n; i++) {
        const th = (i / n) * turns * Math.PI * 2;
        const rr = 0.012 + (0.028 * th) / (turns * Math.PI * 2);
        path.push(new Vector2(Math.cos(th) * rr - 0.02, Math.sin(th) * rr));
      }
      b.add(ribbon(path, 0.014, 0.0012), '#ffffff', null, { ch: 'paper', uv: 'tape', rough: 0.45 });
      // the free end (sways, idle): a straight run + the metal end tab
      const end = path[path.length - 1];
      sub(new Vector3(end.x, 0, end.y));
      const tail = [end.clone(), end.clone().add(new Vector2(0.05, 0.016)), end.clone().add(new Vector2(0.095, 0.03))];
      b.add(ribbon(tail, 0.014, 0.0012), '#ffffff', null, { ch: 'paper', uv: 'tape', rough: 0.45 });
      b.add(rbox(0.004, 0.017, 0.007, 0.0015), steel, M(end.x + 0.096, 0.0085, end.y + 0.0303, 0, -0.31, 0), METAL);
      main();
    },
    animate(a) {
      a.set(0, M(0, 0, 0, 0, Math.sin(a.time * 1.1) * 0.12 * a.idle, 0, 1, 1, 1, a.m));
    },
  },
  sizetag: {
    size: [0.03, 0.05, 0.006],
    reveal: 'drop',
    build(b) {
      b.add(rbox(0.046, 0.0022, 0.072, 0.001), '#f3ede2', M(0, 0.0011, 0), { rough: 0.85 });
      b.add(flat(0.044, 0.07), '#ffffff', M(0, 0.0023, 0.002), { ch: 'paper', uv: 'sizetag', rough: 0.85 });
      b.add(new TorusGeometry(0.0035, 0.001, 4, 12), '#c9a85a', M(0, 0.0024, -0.028, Math.PI / 2, 0, 0), METAL);
      b.add(new TorusGeometry(0.014, 0.0009, 4, b.seg(20)), '#2c2f35', M(0.004, 0.0024, -0.04, Math.PI / 2, 0, 0, 1, 1.4, 1), { rough: 0.9 });
    },
  },

  /* ── Inventra ── */
  cartons: {
    size: [0.115, 0.075, 0.15],
    reveal: 'subs',
    build(b, sub, main) {
      const boxes: [number, number, number, number, number, number, string][] = [
        [-0.03, 0, 0, 0.12, 0.08, 0.1, kraft],
        [0.085, 0, 0.018, 0.09, 0.06, 0.08, '#b88a5a'],
        [-0.024, 0.08, 0.004, 0.1, 0.066, 0.086, '#d2ab7c'],
      ];
      boxes.forEach(([x, y, z, w, h, d, c], i) => {
        sub(new Vector3(x, y, z));
        const yaw = [0, -0.12, 0.16][i];
        const R = M(x, y, z, 0, yaw, 0);
        b.add(rbox(w, h, d, 0.004), c, R.clone().multiply(M(0, h / 2, 0)), { rough: 0.85 });
        b.add(rbox(w + 0.002, 0.0018, 0.02, 0.0008), '#dcc192', R.clone().multiply(M(0, h + 0.0004, 0)), { rough: 0.3 });
        b.add(new PlaneGeometry(w * 0.5, 0.024), '#ffffff', R.clone().multiply(M(-w * 0.12, h * 0.48, d / 2 + 0.0006)), { ch: 'paper', uv: 'barcode', rough: 0.8 });
      });
      main();
    },
    animate(a) {
      for (let i = 0; i < 3; i++) {
        const k = clamp(a.t * 1.6 - i * 0.28);
        const fall = clamp(k / 0.6);
        const bounce = k > 0.6 ? Math.sin(((k - 0.6) / 0.4) * Math.PI) * (1 - (k - 0.6) / 0.4) * 0.02 : 0;
        const dy = 0.22 * (1 - fall * fall) + bounce;
        const s = k > 0 ? 1 : 0;
        a.set(i, M(0, dy, 0, 0, 0, (1 - fall) * 0.2, s, s, s, a.m));
      }
    },
  },
  scanner: {
    size: [0.07, 0.032, 0.13],
    reveal: 'slide',
    build(b, sub, main) {
      b.add(rbox(0.05, 0.012, 0.045, 0.005), MINI.charcoal, M(-0.01, 0.006, 0), { rough: 0.5 });
      b.add(rbox(0.032, 0.095, 0.036, 0.012), '#ecd27e', M(-0.012, 0.055, 0, 0, 0, 0.22), { rough: 0.55 });
      b.add(rbox(0.11, 0.044, 0.05, 0.014), MINI.charcoal, M(0.02, 0.112, 0, 0, 0, -0.08), { rough: 0.4 });
      b.add(rbox(0.012, 0.022, 0.012, 0.004), '#ffffff', M(0.012, 0.082, 0, 0, 0, 0.3), { accent: 1, rough: 0.35 });
      b.add(rbox(0.004, 0.026, 0.036, 0.0018), '#ff4848', M(0.077, 0.106, 0, 0, 0, -0.08), { ch: 'glow', accent: 0.35 });
      // the scan line on the table blinks (idle)
      sub(new Vector3(0.17, 0.0008, 0));
      b.add(rbox(0.004, 0.0012, 0.07, 0.0005), '#ff4848', M(0.17, 0.0008, 0), { ch: 'glow', accent: 0.35 });
      main();
    },
    animate(a) {
      const ph = (a.time * 1.6) % 1;
      const on = a.idle > 0.5 ? (ph < 0.55 ? 1 : 0) : 1;
      const s = smoothstep(0.7, 1, a.t) * on;
      a.set(0, M(0, 0, 0, 0, 0, 0, s, 1, s, a.m));
    },
  },
  clipboard: {
    size: [0.082, 0.112, 0.022],
    reveal: 'unfold',
    build(b) {
      b.add(rbox(0.16, 0.006, 0.222, 0.003), '#8b5e3c', M(0, 0.003, 0), { rough: 0.6 });
      b.add(flat(0.14, 0.19), '#ffffff', M(0, 0.0064, 0.012), { ch: 'paper', uv: 'stock', rough: 0.9 });
      b.add(rbox(0.07, 0.01, 0.026, 0.004), steel, M(0, 0.011, -0.094), METAL);
      b.add(new CylinderGeometry(0.0045, 0.0045, 0.06, 10), steel, M(0, 0.017, -0.104, 0, 0, Math.PI / 2), METAL);
    },
  },
  pallet: {
    size: [0.085, 0.07, 0.085],
    reveal: 'slide',
    build(b) {
      const wood = '#d9b98c';
      for (const z of [-0.05, 0, 0.05]) b.add(rbox(0.17, 0.008, 0.036, 0.002), wood, M(0, 0.022, z), { rough: 0.75 });
      for (const x of [-0.07, 0, 0.07]) for (const z of [-0.05, 0, 0.05]) b.add(rbox(0.026, 0.018, 0.026, 0.002), '#c9a776', M(x, 0.009, z), { rough: 0.8 });
      b.add(rbox(0.09, 0.056, 0.074, 0.004), kraft, M(-0.01, 0.054, 0, 0, 0.1, 0), { rough: 0.85 });
      b.add(rbox(0.092, 0.0016, 0.016, 0.0007), '#dcc192', M(-0.01, 0.0826, 0, 0, 0.1, 0), { rough: 0.3 });
    },
  },

  /* ── AI content SaaS ── */
  mic: {
    size: [0.07, 0.045, 0.13],
    reveal: 'slide',
    build(b, sub, main) {
      const seg = b.seg(24);
      b.add(new CylinderGeometry(0.038, 0.041, 0.009, seg), MINI.charcoal, M(0, 0.0045, 0), { rough: 0.35, metal: 0.4 });
      b.add(new CylinderGeometry(0.0038, 0.0038, 0.05, 10), steel, M(0, 0.033, 0), METAL);
      const yoke = new TorusGeometry(0.022, 0.0026, 6, 16, Math.PI);
      b.add(yoke, steel, M(0, 0.08, 0, 0, 0, Math.PI), METAL);
      const head = M(0, 0.095, 0, 0.28, 0, 0);
      b.add(new CylinderGeometry(0.018, 0.016, 0.04, seg), '#2a2c31', head.clone().multiply(M(0, -0.004, 0)), { rough: 0.3, metal: 0.5 });
      b.add(new CylinderGeometry(0.0188, 0.0188, 0.028, seg, 1, true), '#ffffff', head.clone().multiply(M(0, 0.03, 0)), { ch: 'paper', uv: 'grille', rough: 0.35, metal: 0.6 });
      b.add(new SphereGeometry(0.0188, seg, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#ffffff', head.clone().multiply(M(0, 0.044, 0)), { ch: 'paper', uv: 'grille', rough: 0.35, metal: 0.6 });
      b.add(new TorusGeometry(0.0186, 0.0022, 6, seg), '#ffffff', head.clone().multiply(M(0, 0.016, 0, Math.PI / 2, 0, 0)), { accent: 1, rough: 0.3 });
      // level meter: a little LED block in front, its bars bounce (idle)
      b.add(rbox(0.058, 0.026, 0.014, 0.004), '#1b1e24', M(0.062, 0.013, 0.03, 0, -0.3, 0), { rough: 0.3 });
      for (let i = 0; i < 6; i++) {
        const lx = 0.062 + (i - 2.5) * 0.0086 * Math.cos(-0.3);
        const lz = 0.03 - (i - 2.5) * 0.0086 * Math.sin(-0.3) + 0.0072 * Math.cos(-0.3);
        sub(new Vector3(lx + 0.0072 * Math.sin(-0.3), 0.005, lz));
        b.add(rbox(0.0056, 0.016, 0.0016, 0.0007), i < 3 ? '#62d38b' : i < 5 ? '#f2cf3c' : '#ffffff', M(lx + 0.0072 * Math.sin(-0.3), 0.013, lz, 0, -0.3, 0), {
          ch: 'glow',
          accent: i === 5 ? 1 : 0,
        });
      }
      main();
    },
    animate(a) {
      for (let i = 0; i < 6; i++) {
        const lvl = a.idle > 0.01 ? clamp(0.35 + 0.35 * Math.sin(a.time * 7.3 + i * 0.9) * Math.sin(a.time * 2.1 + i) + 0.3 * Math.sin(a.time * 13 + i * 2.3) - i * 0.06, 0.08, 1) : 0.7 - i * 0.1;
        const s = smoothstep(0.6, 0.95, a.t);
        a.set(i, M(0, 0, 0, 0, 0, 0, s, Math.max(0.001, lvl * s), s, a.m));
      }
    },
  },
  headphones: {
    size: [0.08, 0.035, 0.12],
    reveal: 'drop',
    build(b) {
      const seg = b.seg(24);
      for (const s of [-1, 1]) {
        b.add(new CylinderGeometry(0.031, 0.031, 0.022, seg), MINI.charcoal, M(s * 0.062, 0.031, 0, 0, 0, Math.PI / 2), { rough: 0.35 });
        b.add(new TorusGeometry(0.021, 0.0075, 8, seg), '#3a3d44', M(s * 0.049, 0.031, 0, 0, Math.PI / 2, 0), { rough: 0.9 });
        b.add(new CylinderGeometry(0.0045, 0.0045, 0.03, 8), steel, M(s * 0.07, 0.068, 0), METAL);
      }
      b.add(new TorusGeometry(0.07, 0.0055, 8, b.seg(36), Math.PI), '#2a2c31', M(0, 0.082, 0), { rough: 0.4, metal: 0.4 });
      b.add(new TorusGeometry(0.066, 0.0075, 8, b.seg(24), Math.PI * 0.5), '#ffffff', M(0, 0.082, 0, 0, 0, Math.PI * 0.25), { accent: 1, rough: 0.6 });
    },
  },
  prompt: {
    size: [0.048, 0.048, 0.012],
    reveal: 'unfold',
    build(b) {
      const g = flat(0.09, 0.09, 6, 6);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const c = (p.getX(i) + p.getZ(i)) / 0.09;
        p.setY(i, 0.0016 + Math.max(0, c - 0.3) ** 2 * 0.02);
      }
      g.computeVertexNormals();
      b.add(g, '#ffffff', null, { ch: 'paper', uv: 'prompt', rough: 0.85 });
      b.add(rbox(0.088, 0.0014, 0.06, 0.0006), '#e9cc62', M(-0.001, 0.0007, -0.014), { rough: 0.85 });
    },
  },
  orb: {
    size: [0.04, 0.04, 0.12],
    reveal: 'unfold',
    build(b, sub, main) {
      b.add(new RingGeometry(0.03, 0.037, b.seg(40)).rotateX(-Math.PI / 2), '#ffffff', M(0, 0.0012, 0), { ch: 'glow', accent: 1 });
      sub(new Vector3(0, 0.07, 0));
      const k = 0.8;
      b.add(new SphereGeometry(1, b.seg(24), b.seg(18)), '#f6f1e8', M(0, 0.07, 0, 0, 0, 0, 0.04 * k, 0.05 * k, 0.04 * k), { rough: 0.32, metal: 0.04 });
      const visor = new SphereGeometry(1, 16, 10, -0.9, 1.8, 1.1, 0.75).rotateY(Math.PI / 2);
      b.add(visor, '#1b1e24', M(0, 0.07, 0, 0, 0, 0, 0.041 * k, 0.051 * k, 0.041 * k), { rough: 0.12 });
      for (const s of [-1, 1]) b.add(new SphereGeometry(0.0062 * k, 8, 6), '#ffffff', M(s * 0.016 * k, 0.07 + 0.004 * k, 0.037 * k), { ch: 'glow', accent: 1 });
      b.add(new TorusGeometry(0.036 * k, 0.0042 * k, 6, b.seg(32)), '#ffffff', M(0, 0.07 + 0.002, 0, Math.PI / 2 + 0.25, 0, 0), { ch: 'glow', accent: 1 });
      b.add(new CylinderGeometry(0.0018, 0.0018, 0.03 * k, 5), '#f6f1e8', M(0, 0.07 + 0.052 * k, 0), { rough: 0.32 });
      b.add(new SphereGeometry(0.0055 * k, 8, 6), '#ffffff', M(0, 0.07 + 0.066 * k, 0), { ch: 'glow', accent: 1 });
      main();
    },
    animate(a) {
      const bob = Math.sin(a.time * 2.1) * 0.006 * a.idle;
      a.set(0, M(0, bob, 0, 0, Math.sin(a.time * 0.7) * 0.25 * a.idle, 0, 1, 1, 1, a.m));
    },
  },
};

/* ───────────── per-chapter tables ───────────── */
export type TableSpec = {
  /** wood tint over the shared wood texture */
  wood: string;
  /** desk-mat colour (pulled ~5 % towards the theme accent; the mat's piping is the full accent) */
  mat: string;
  /** cutting-mat grid instead of felt */
  grid?: boolean;
  /** prop placements on the table: [x, z, yaw] in laptop widths (laptop base x −0.5…0.5, z 0…0.64; phone ≈ x 0.57…0.74) */
  props: Partial<Record<PropKey, [number, number, number]>>;
  /** toy cars: [kind, hue index, x, z, heading]; heading turns the car around +y (0 = facing +x) */
  cars: [CarKind, number, number, number, number][];
};

export const TABLES: Record<string, TableSpec> = {
  'young-onion': {
    wood: '#f0d8bd',
    mat: '#f2b9c9',
    props: {
      eraser: [0.38, 0.95, -0.3],
      pens: [-0.32, 0.95, 0.1],
      washi: [-0.72, 0.06, 0],
      notepad: [-0.72, 0.44, 0.22],
      highlighters: [0.7, 0.96, -0.28],
    },
    cars: [['van', 2, 0.07, 0.96, -0.2]],
  },
  zetstore: {
    wood: '#d9a46c',
    mat: '#9cb79a',
    props: {
      invoices: [-0.72, 0.3, 0.12],
      parcel: [0.66, 0.97, -0.25],
      calculator: [-0.32, 0.97, 0.35],
      jar: [-0.73, -0.06, 0],
    },
    cars: [
      ['muscle', 4, 0.02, 0.99, -0.2],
      ['rally', 1, 0.36, 0.83, Math.PI + 0.3],
    ],
  },
  doc2home: {
    wood: '#eadccb',
    mat: '#8fc9bf',
    props: {
      stethoscope: [-0.3, 0.96, 0],
      callback: [-0.72, 0.02, 0.3],
      pills: [0.5, 0.98, -0.15],
      firstaid: [-0.72, 0.42, 0.18],
    },
    cars: [['jdm', 0, 0.12, 0.96, -0.2]],
  },
  fiomis: {
    wood: '#a8754f',
    mat: '#e9dcc6',
    props: {
      tees: [-0.74, 0.04, 0.15],
      tape: [0.36, 0.96, 0],
      swatches: [-0.72, 0.48, 0.2],
      hanger: [-0.28, 0.98, 0.08],
      sizetag: [0.64, 0.95, 0.4],
    },
    cars: [['wedge', 0, 0.06, 0.96, -0.2]],
  },
  inventra: {
    wood: '#e3c595',
    mat: '#4f6b8a',
    grid: true,
    props: {
      cartons: [-0.71, 0.14, 0.15],
      scanner: [0.5, 0.96, -0.2],
      clipboard: [-0.72, 0.56, -0.1],
      pallet: [-0.28, 0.97, 0.2],
    },
    cars: [['muscle', 3, 0.08, 0.96, -0.2]],
  },
  'ai-saas': {
    wood: '#7d5638',
    mat: '#34373e',
    props: {
      mic: [-0.72, 0.2, 0.3],
      orb: [-0.22, 0.95, 0],
      headphones: [0.48, 0.98, -0.2],
      prompt: [-0.72, 0.62, -0.15],
    },
    cars: [['openwheel', 1, 0.12, 0.95, -0.2]],
  },
};

/* ───────────── materials: slot transforms + per-vertex accent/roughness/metalness ───────────── */
type SlotUniforms = { uSlot: { value: Matrix4[] }; uAccent: { value: Color } };

function slotted<T extends MeshStandardMaterial | MeshBasicMaterial>(m: T, u: SlotUniforms, lit: boolean): T {
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec4 aProp;\nuniform mat4 uSlot[${SLOTS}];\nuniform vec3 uAccent;\nvarying vec2 vPropRM;`)
      .replace('#include <color_vertex>', '#include <color_vertex>\n\tvColor.rgb = mix(vColor.rgb, uAccent, aProp.y);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed = (uSlot[int(aProp.x + 0.5)] * vec4(transformed, 1.0)).xyz;\n\tvPropRM = aProp.zw;');
    if (lit) {
      s.vertexShader = s.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n\tobjectNormal = mat3(uSlot[int(aProp.x + 0.5)]) * objectNormal;');
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vPropRM;')
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vPropRM.x;')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vPropRM.y;');
    }
  };
  m.customProgramCacheKey = () => `props-${lit ? 'lit' : 'flat'}`;
  return m;
}

export type PropItem = {
  key: PropKey;
  label: string;
  def: PropDef;
  x: number;
  y: number;
  z: number;
  yaw: number;
  slot: number;
  subs: { slot: number; pivot: Vector3 }[];
  /** rest-pose box in prop space */
  box: Box3;
  /** reveal progress 0…1 (last frame) */
  t: number;
  hover: number;
  hoverT: number;
  hop: number;
  m: Matrix4;
};

export type PropTable = {
  /** every mesh of the table (surface, props, shadows), in table space; add to the device root */
  group: Group;
  items: PropItem[];
  /** instanced contact shadows: props first, then `cars` extra instances for gl-devices */
  shadows: InstancedMesh;
  /** surface top at (x, z): the desk mat or the wood around it */
  yAt(x: number, z: number): number;
  /** rest-pose boxes (table space) of the props, for the overlap check */
  restBoxes(): Box3[];
  /** `p` = scroll progress of the reveal 0…1, `idle` = idle loops allowed, `k` = table → px scale (glow size) */
  update(p: number, time: number, dt: number, idle: boolean, k: number): void;
  /** top-centre of item `i` in table space */
  anchor(i: number, out: Vector3): Vector3;
  setHover(i: number): void;
  hop(i: number): void;
  /** fade with the outgoing chapter (unlit glow parts don't follow the exposure) */
  dim(d: number): void;
  dispose(): void;
};

export type Extents = { left: number; right: number; back: number; front: number; mat: [number, number, number, number]; top: number };

export type PropKit = {
  table(id: string, ext: Extents, lite: boolean, cars: number): PropTable;
  theme(p: Palette): void;
  dispose(): void;
};

/** Felt grain (or a cutting-mat grid) for the desk mats; white-based, tinted by the material colour. */
function matTexture(grid: boolean) {
  const t = canvasTexture(512, 512);
  const { ctx } = t;
  const r = rng(grid ? 41 : 17);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.02 + r() * 0.04})`;
    ctx.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2);
  }
  if (grid) {
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i <= 32; i++) {
      ctx.lineWidth = i % 4 === 0 ? 1.6 : 0.7;
      ctx.globalAlpha = i % 4 === 0 ? 0.55 : 0.28;
      ctx.beginPath();
      ctx.moveTo(i * 16, 0);
      ctx.lineTo(i * 16, 512);
      ctx.moveTo(0, i * 16);
      ctx.lineTo(512, i * 16);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  t.tex.wrapS = t.tex.wrapT = RepeatWrapping;
  t.tex.anisotropy = 4;
  t.tex.needsUpdate = true;
  return t.tex;
}

export function createPropKit(): PropKit {
  const atlas = createAtlas();
  const wood = woodTexture('#d6b38b', 1024, 512, 13);
  const felt = matTexture(false);
  const gridTex = matTexture(true);
  const accent = new Color('#ff5b2e');
  const mats: { m: MeshStandardMaterial; base: string; k: number }[] = [];
  const disposables: { dispose(): void }[] = [atlas.tex, wood.tex, felt, gridTex];

  return {
    theme(p) {
      accent.copy(p.signal);
      mats.forEach(({ m, base, k }) => m.color.set(base).lerp(p.signal, k));
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
    table(id, ext, lite, carCount) {
      const spec = TABLES[id];
      const group = new Group();
      const own: (BufferGeometry | Material)[] = [];
      const keep = <T extends BufferGeometry | Material>(x: T) => (own.push(x), x);

      /* surface: bevelled wood slab + desk mat */
      const MAT_T = 0.0028;
      const SLAB_T = 0.05;
      const slabW = ext.right - ext.left;
      const slabD = ext.front - ext.back;
      const woodMat = keep(new MeshStandardMaterial({ map: wood.tex, roughness: 0.5, metalness: 0 }));
      mats.push({ m: woodMat, base: spec?.wood ?? MINI.wood, k: 0 });
      const slab = new Mesh(keep(new RoundedBoxGeometry(slabW, SLAB_T, slabD, lite ? 2 : 4, 0.018)), woodMat);
      slab.position.set((ext.left + ext.right) / 2, ext.top - MAT_T - SLAB_T / 2, (ext.back + ext.front) / 2);
      group.add(slab);
      const [mx0, mx1, mz0, mz1] = ext.mat;
      const matMat = keep(new MeshStandardMaterial({ map: spec?.grid ? gridTex : felt, roughness: 0.95, metalness: 0 }));
      mats.push({ m: matMat, base: spec?.mat ?? MINI.slate, k: 0.05 });
      const mat = new Mesh(keep(new RoundedBoxGeometry(mx1 - mx0, MAT_T * 2, mz1 - mz0, 2, MAT_T * 0.9)), matMat);
      mat.position.set((mx0 + mx1) / 2, ext.top - MAT_T, (mz0 + mz1) / 2);
      group.add(mat);
      const yAt = (x: number, z: number) => (x > mx0 && x < mx1 && z > mz0 && z < mz1 ? ext.top : ext.top - MAT_T);

      /* props */
      const labels = tableProps[id] ?? [];
      const chosen = labels.filter((l) => spec?.props[l.key]).slice(0, lite ? 2 : 5);
      const b = new Builder(atlas, lite ? 0.6 : 1);
      const slots = Array.from({ length: SLOTS }, () => new Matrix4());
      let next = 1;
      // static parts (slot 0): a thin accent piping around the desk mat
      const ring = rrect(mx1 - mx0 - 0.02, mz1 - mz0 - 0.02, 0.03);
      ring.holes.push(rrect(mx1 - mx0 - 0.03, mz1 - mz0 - 0.03, 0.026));
      b.slot = 0;
      b.add(new ShapeGeometry(ring, 6).rotateX(-Math.PI / 2), '#ffffff', M((mx0 + mx1) / 2, ext.top + 0.0004, (mz0 + mz1) / 2), { accent: 1, rough: 0.5 });
      const items: PropItem[] = [];
      for (const { key, label } of chosen) {
        const def = DEFS[key];
        const [x, z, yaw] = spec.props[key]!;
        const item: PropItem = { key, label, def, x, z, yaw, y: yAt(x, z), slot: next++, subs: [], box: new Box3(), t: 0, hover: 0, hoverT: 0, hop: -1, m: new Matrix4() };
        b.box.makeEmpty();
        b.slot = item.slot;
        b.pivot.set(0, 0, 0);
        def.build(
          b,
          (pivot) => {
            if (next >= SLOTS) throw new Error('gl-props: slot capacity');
            const s = { slot: next++, pivot: pivot.clone() };
            item.subs.push(s);
            b.slot = s.slot;
            b.pivot.copy(pivot);
          },
          () => {
            b.slot = item.slot;
            b.pivot.set(0, 0, 0);
          },
        );
        item.box.copy(b.box);
        items.push(item);
      }
      const uniforms: SlotUniforms = { uSlot: { value: slots }, uAccent: { value: accent } };
      const satinMat = keep(slotted(new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1 }), uniforms, true));
      const paperMat = keep(slotted(new MeshStandardMaterial({ vertexColors: true, map: atlas.tex, roughness: 1, metalness: 1 }), uniforms, true));
      const glowMat = keep(slotted(new MeshBasicMaterial({ vertexColors: true, map: atlas.tex, toneMapped: false }), uniforms, false));
      const chMat: Record<Channel, Material> = { satin: satinMat, paper: paperMat, glow: glowMat };
      for (const ch of CHANNELS) {
        const list = b.geos[ch];
        if (!list.length) continue;
        const geo = keep(mergeGeometries(list)!);
        list.forEach((g) => g.dispose());
        const mesh = new Mesh(geo, chMat[ch]);
        mesh.frustumCulled = false;
        group.add(mesh);
      }

      /* contact shadows: props + the cars (gl-devices writes those) */
      const shadowGeo = keep(new PlaneGeometry(1, 1));
      const shadowMat = keep(shadowMaterial(0.5, 0.8)) as ShaderMaterial;
      const shadows = new InstancedMesh(shadowGeo, shadowMat, Math.max(1, items.length + carCount));
      shadows.renderOrder = -1;
      shadows.frustumCulled = false;
      group.add(shadows);

      /* the agent orb gets a soft glow sprite (same as the hero agents) */
      const orb = items.find((it) => it.key === 'orb');
      const glow = orb && !lite ? new GlowField(1) : null;
      if (glow) group.add(glow.mesh);

      const flatQ = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
      const yQ = new Quaternion();
      const yAxis = new Vector3(0, 1, 0);
      const m4 = new Matrix4();
      const sub = new Matrix4();
      const tmp = new Vector3();
      const reduce = matchMedia('(prefers-reduced-motion: reduce)');

      return {
        group,
        items,
        shadows,
        yAt,
        restBoxes() {
          return items.map((it) => it.box.clone().applyMatrix4(M(it.x, it.y, it.z, 0, it.yaw, 0, PROP_SCALE)));
        },
        anchor(i, out) {
          const it = items[i];
          return out.set(0, it.def.size[2] * 1.05, 0).applyMatrix4(it.m);
        },
        setHover(i) {
          items.forEach((it, k) => (it.hover = k === i ? 1 : 0));
        },
        hop(i) {
          if (items[i] && items[i].hop < 0) items[i].hop = 0;
        },
        dim(d) {
          glowMat.color.setScalar(1 - d * 0.75);
          shadowMat.uniforms.uOpacity.value = 0.5 * (1 - d);
        },
        update(p, time, dt, idleOn, k) {
          const idleOk = idleOn && !reduce.matches;
          items.forEach((it, i) => {
            const t = clamp((p - (0.04 + i * 0.1)) / 0.42);
            it.t = t;
            it.hoverT += (it.hover - it.hoverT) * (1 - Math.exp(-dt * 12));
            let hopY = 0;
            if (it.hop >= 0) {
              it.hop += dt;
              hopY = Math.sin(Math.min(1, it.hop / 0.55) * Math.PI) * 0.07;
              if (it.hop > 0.55) it.hop = -1;
            }
            const [fx, fz] = it.def.size;
            let dx = 0;
            let dy = 0;
            let dz = 0;
            let ry = 0;
            let rz = 0;
            let s = 1;
            let sy = 1;
            switch (it.def.reveal) {
              case 'drop': {
                const fall = clamp(t / 0.55);
                const k2 = clamp((t - 0.55) / 0.45);
                dy = 0.3 * (1 - fall * fall) + (t > 0.55 ? Math.sin(Math.min(1, k2 * 1.7) * Math.PI) * 0.035 * (1 - k2) : 0);
                const squash = t > 0.55 ? Math.sin(clamp(k2 * 3) * Math.PI) * (1 - k2) * 0.2 : 0;
                sy = 1 - squash;
                s = smoothstep(0, 0.08, t) * (1 + squash * 0.5);
                rz = (1 - fall) * 0.4;
                break;
              }
              case 'slide': {
                const o = 1 - backOut(t);
                // in from the nearest table edge (outwards from the laptop)
                const ox = it.x < -0.55 ? -1 : it.x > 0.55 ? 1 : 0;
                const oz = ox ? 0 : 1;
                dx = ox * 0.3 * o;
                dz = oz * 0.3 * o;
                ry = o * 0.7;
                s = smoothstep(0, 0.12, t);
                break;
              }
              case 'unfold': {
                s = Math.max(0, backOut(t));
                ry = -(1 - ease(t)) * 0.9;
                dy = (1 - ease(t)) * 0.06;
                break;
              }
              case 'subs':
                s = t > 0 ? 1 : 0;
                break;
            }
            const lift = it.hoverT * 0.022 + hopY;
            const tilt = it.hoverT * 0.06;
            const S = PROP_SCALE;
            M(it.x + dx, it.y + dy + lift, it.z + dz, tilt, it.yaw + ry, rz, Math.max(1e-4, s * S), Math.max(1e-4, s * sy * S), Math.max(1e-4, s * S), it.m);
            slots[it.slot].copy(it.m);
            const idle = idleOk ? smoothstep(0.92, 1, t) : 0;
            it.subs.forEach((sb) => slots[sb.slot].copy(it.m).multiply(m4.makeTranslation(sb.pivot.x, sb.pivot.y, sb.pivot.z)));
            it.def.animate?.({
              t,
              time,
              idle,
              m: sub,
              set(n, local) {
                const sb = it.subs[n];
                if (sb) slots[sb.slot].copy(it.m).multiply(m4.makeTranslation(sb.pivot.x, sb.pivot.y, sb.pivot.z)).multiply(local);
              },
            });
            // contact shadow: tighter and fainter while the prop is in the air
            const air = 1 / (1 + (dy + lift) * 9);
            const ss = (s > 0.001 ? 1 : 0) * air * Math.min(1.2, Math.max(s, 0.001));
            yQ.setFromAxisAngle(yAxis, it.yaw + ry).multiply(flatQ);
            m4.compose(tmp.set(it.x + dx, it.y + 0.0012, it.z + dz), yQ, _s.set(fx * 2.5 * PROP_SCALE * ss + 1e-4, fz * 2.5 * PROP_SCALE * ss + 1e-4, 1));
            shadows.setMatrixAt(i, m4);
          });
          shadows.instanceMatrix.needsUpdate = true;
          if (glow && orb) {
            orb.subs[0] && tmp.set(0, 0, 0).applyMatrix4(slots[orb.subs[0].slot]);
            glow.set(0, tmp, 0.16 * k, accent, 0.5 * smoothstep(0.6, 1, orb.t));
            glow.flush();
          }
        },
        dispose() {
          own.forEach((x) => x.dispose());
          glow?.dispose();
          mats.splice(0, mats.length, ...mats.filter(({ m }) => m !== woodMat && m !== matMat));
        },
      };
    },
  };
}
