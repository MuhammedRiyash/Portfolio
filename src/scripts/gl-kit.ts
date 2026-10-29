/**
 * Shared helpers for the WebGL world (gl-world/desk/city/street/spots) and the devices act:
 * maths, the theme palette read from the CSS tokens, satin materials that re-theme in place,
 * soft contact shadows, an instanced glow field (the only "bloom"), and canvas textures.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  type ColorRepresentation,
  type Material,
} from 'three';

/* ───────────── maths ───────────── */
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const ease = (t: number) => t * t * (3 - 2 * t);
export const smooth = (a: number, b: number, p: number) => ease(clamp((p - a) / (b - a)));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const DEG = Math.PI / 180;

/** Deterministic Lehmer RNG so layouts are identical on every load. */
export function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Rounded rectangle path centred at (0, oy). */
export function rrect(w: number, h: number, r: number, oy = 0) {
  const shape = new Shape();
  const x = -w / 2;
  const y = oy - h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/** ShapeGeometry with UVs normalised to its bounding box (for screen textures). */
export function screenGeometry(w: number, h: number, r: number) {
  const g = new ShapeGeometry(rrect(w, h, r), 8);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return g;
}

/* ───────────── theme palette (CSS tokens → linear colours) ───────────── */
export type Palette = {
  name: string;
  bg: Color;
  surface: Color;
  bone: Color;
  muted: Color;
  signal: Color;
};

const FALLBACK = { bg: '#0B0B0C', surface: '#131315', bone: '#ECE8E1', muted: '#8C877F', signal: '#FF5B2E' };

export function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const tok = (names: string[], fb: string) => {
    for (const n of names) {
      const v = cs.getPropertyValue(n).trim();
      if (v) return v;
    }
    return fb;
  };
  const col = (v: string, fb: string) => {
    const c = new Color();
    try {
      c.setStyle(v);
    } catch {
      c.setStyle(fb);
    }
    return c;
  };
  return {
    name: document.documentElement.dataset.theme || 'noir',
    bg: col(tok(['--bg', '--ink'], FALLBACK.bg), FALLBACK.bg),
    surface: col(tok(['--surface', '--ink-2'], FALLBACK.surface), FALLBACK.surface),
    bone: col(tok(['--bone'], FALLBACK.bone), FALLBACK.bone),
    muted: col(tok(['--muted'], FALLBACK.muted), FALLBACK.muted),
    signal: col(tok(['--signal'], FALLBACK.signal), FALLBACK.signal),
  };
}

/** A neutral between the ground (0) and the text colour (1). */
export const tone = (p: Palette, k: number, out = new Color()) => out.copy(p.bg).lerp(p.bone, k);

/**
 * The miniature palette: soft clay/plastic colours shared by the desk, the city and the street. The theme accent
 * (`Palette.signal`) is reserved for interactive / important things.
 */
export const MINI = {
  sage: '#9cb79a',
  sageDeep: '#6f9170',
  terracotta: '#cf7a5c',
  cream: '#f1e6d2',
  slate: '#647d9c',
  slateDeep: '#43566f',
  butter: '#ecd27e',
  wood: '#d2ad84',
  charcoal: '#2c2f35',
  concrete: '#bdb3a5',
  brass: '#c9a85a',
} as const;

/* ───────────── materials that re-theme in place ───────────── */
export type Recolor = (p: Palette, c: Color) => void;

export class MatBook {
  private list: { m: MeshStandardMaterial | MeshBasicMaterial; fn: Recolor }[] = [];
  all: Material[] = [];

  /** Satin/matte standard material whose colour is derived from the palette. */
  satin(fn: Recolor, opts: ConstructorParameters<typeof MeshStandardMaterial>[0] = {}) {
    const m = new MeshStandardMaterial({ roughness: 0.62, metalness: 0, ...opts });
    this.list.push({ m, fn });
    this.all.push(m);
    return m;
  }

  /** Unlit material (screens, windows, glows); not tone mapped so it reads as light. */
  flat(fn: Recolor, opts: ConstructorParameters<typeof MeshBasicMaterial>[0] = {}) {
    const m = new MeshBasicMaterial({ toneMapped: false, ...opts });
    this.list.push({ m, fn });
    this.all.push(m);
    return m;
  }

  add<T extends Material>(m: T) {
    this.all.push(m);
    return m;
  }

  theme(p: Palette) {
    this.list.forEach(({ m, fn }) => fn(p, m.color));
  }

  dispose() {
    this.all.forEach((m) => m.dispose());
  }
}

/* ───────────── soft contact shadow (blurred plane) ───────────── */
const plainVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 p = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      p = instanceMatrix * p; // instanced contact shadows (toy cars, the floating desk)
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * p;
  }
`;
const shadowFrag = /* glsl */ `
  uniform float uOpacity;
  uniform float uSoft;
  varying vec2 vUv;
  void main() {
    vec2 p = abs(vUv - 0.5) * 2.0;
    // rounded-rect falloff: soft square for slabs, round for small things
    vec2 q = max(p - (1.0 - uSoft), 0.0) / uSoft;
    float d = length(q);
    float a = (1.0 - smoothstep(0.0, 1.0, d)) * uOpacity;
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
  }
`;
export function shadowMaterial(opacity = 0.45, soft = 0.7) {
  return new ShaderMaterial({
    uniforms: { uOpacity: { value: opacity }, uSoft: { value: soft } },
    vertexShader: plainVert,
    fragmentShader: shadowFrag,
    transparent: true,
    depthWrite: false,
  });
}
export const shadowShaders = { vert: plainVert };

/* ───────────── glow field: instanced additive billboards ───────────── */
const glowVert = /* glsl */ `
  attribute vec4 aGlow;
  varying vec4 vGlow;
  varying vec2 vUv;
  void main() {
    vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float s = length(instanceMatrix[0].xyz);
    vec4 mv = modelViewMatrix * vec4(c, 1.0);
    mv.xy += position.xy * s;
    gl_Position = projectionMatrix * mv;
    vUv = uv;
    vGlow = aGlow;
  }
`;
const glowFrag = /* glsl */ `
  varying vec4 vGlow;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = exp(-d * d * 5.0) * (1.0 - smoothstep(0.7, 1.0, d)) * vGlow.a;
    if (a < 0.002) discard;
    gl_FragColor = vec4(vGlow.rgb * a, 1.0);
  }
`;

export class GlowField {
  mesh: InstancedMesh;
  private data: Float32Array;
  private attr: InstancedBufferAttribute;
  private m4 = new Matrix4();
  private used = 0;
  private mat: ShaderMaterial;

  constructor(capacity: number) {
    const geo = new PlaneGeometry(1, 1);
    this.data = new Float32Array(capacity * 4);
    this.attr = new InstancedBufferAttribute(this.data, 4);
    geo.setAttribute('aGlow', this.attr);
    this.mat = new ShaderMaterial({
      uniforms: {},
      vertexShader: glowVert,
      fragmentShader: glowFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.mesh = new InstancedMesh(geo, this.mat, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    for (let i = 0; i < capacity; i++) this.set(i, new Vector3(0, -999, 0), 0, '#000', 0);
  }

  alloc(n: number) {
    const base = this.used;
    this.used += n;
    if (this.used > this.mesh.count) throw new Error('glow capacity');
    return base;
  }

  private c = new Color();
  set(i: number, pos: Vector3, size: number, color: ColorRepresentation | Color, intensity: number) {
    this.m4.makeScale(size, size, size).setPosition(pos);
    this.mesh.setMatrixAt(i, this.m4);
    const c = color instanceof Color ? color : this.c.set(color);
    this.data[i * 4] = c.r;
    this.data[i * 4 + 1] = c.g;
    this.data[i * 4 + 2] = c.b;
    this.data[i * 4 + 3] = intensity;
  }

  flush() {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.attr.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

/* ───────────── canvas textures ───────────── */
export function canvasTexture(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return { canvas, ctx, tex };
}

/** Font stacks from the site tokens (Geist Mono / Geist / Inter Tight with their fallbacks). */
export function fonts() {
  const cs = getComputedStyle(document.documentElement);
  return {
    mono: cs.getPropertyValue('--mono').trim() || 'ui-monospace, monospace',
    sans: cs.getPropertyValue('--sans').trim() || 'system-ui, sans-serif',
    display: cs.getPropertyValue('--display').trim() || 'system-ui, sans-serif',
  };
}

/** sRGB hex string of a (linear) palette colour, for 2D canvas drawing. */
export const css = (c: Color) => `#${c.getHexString()}`;

/** Light, slightly warm wood (desk top, shop floor): soft grain on a birch/oak base. */
export function woodTexture(base = '#d6b38b', w = 1024, h = 512, seed = 3) {
  const t = canvasTexture(w, h);
  const { ctx } = t;
  const r = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  // planks
  const planks = 5;
  for (let p = 0; p < planks; p++) {
    const y0 = (p * h) / planks;
    ctx.fillStyle = `rgba(${r() < 0.5 ? '120,80,40' : '255,240,220'},${0.04 + r() * 0.05})`;
    ctx.fillRect(0, y0, w, h / planks);
    ctx.fillStyle = 'rgba(90,60,30,.18)';
    ctx.fillRect(0, y0, w, 1.5);
  }
  // grain: long wavy strokes
  for (let i = 0; i < 140; i++) {
    const y = r() * h;
    const a = 0.03 + r() * 0.07;
    ctx.strokeStyle = `rgba(110,70,35,${a})`;
    ctx.lineWidth = 0.6 + r() * 1.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    const amp = 1 + r() * 4;
    const f = 0.002 + r() * 0.006;
    const ph = r() * 6;
    for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x * f + ph) * amp);
    ctx.stroke();
  }
  t.tex.anisotropy = 4;
  t.tex.needsUpdate = true;
  return t;
}

/* ───────────── backdrop: a soft light pool behind the subject (and a gentle vignette) ───────────── */
const backdropVert = /* glsl */ `
  varying vec2 vNdc;
  void main() {
    vNdc = position.xy;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;
const backdropFrag = /* glsl */ `
  uniform vec3 uBg;
  uniform vec3 uGlow;
  uniform vec2 uCenter;
  uniform vec2 uRadius;
  uniform float uStrength;
  uniform float uVignette;
  varying vec2 vNdc;
  void main() {
    vec2 d = (vNdc - uCenter) / uRadius;
    float g = exp(-dot(d, d) * 1.6) * uStrength;
    vec3 col = mix(uBg, uGlow, clamp(g, 0.0, 1.0));
    float v = smoothstep(0.55, 1.45, length(vNdc * vec2(0.85, 1.0)));
    col = mix(col, uBg * 0.82, v * uVignette);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * Full-screen quad drawn first (behind everything): the page ground plus a soft pool of light where the subject
 * sits — morning haze behind the desk, monitor blue at night. Uniforms are linear colours / NDC.
 */
export function createBackdrop() {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const mat = new ShaderMaterial({
    uniforms: {
      uBg: { value: new Color() },
      uGlow: { value: new Color() },
      uCenter: { value: new Vector2(0.3, 0) },
      uRadius: { value: new Vector2(0.9, 0.9) },
      uStrength: { value: 0.3 },
      uVignette: { value: 0.5 },
    },
    vertexShader: backdropVert,
    fragmentShader: backdropFrag,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return {
    mesh,
    u: mat.uniforms as {
      uBg: { value: Color };
      uGlow: { value: Color };
      uCenter: { value: Vector2 };
      uRadius: { value: Vector2 };
      uStrength: { value: number };
      uVignette: { value: number };
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
