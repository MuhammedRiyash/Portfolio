/**
 * Act 1 / Act 5 — the desk. A miniature of Muhammed's desk on a light wood top with a slate felt mat: laptop typing
 * real-looking TypeScript/PHP on a bright light-theme editor, phone with a ping, coffee with steam, notebook with a
 * hand-drawn ER diagram, plant, sticky notes, a charging cradle, and small AI agent bots hovering around the laptop
 * (glow ring + contact shadow on the desk under each; hover → label, click → they zip off to do the job).
 * At night the agents dock in the cradle, the coffee is cold, the terminal prints `deployed ✓` and a window behind
 * the desk shows the city lights.
 *
 * Layout is a deliberate triangle: laptop at the apex (back centre), mug + notebook on the left, plant + phone +
 * cradle on the right, the toy cars in front.
 *
 * Units: desk ≈ 1.7 × 1.0, top surface at y = 0. ≈ 34 draws desktop / 24 lite.
 */
import {
  AdditiveBlending,
  CircleGeometry,
  CylinderGeometry,
  Color,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, clamp, css, ease, fonts, MINI, rng, rrect, shadowMaterial, woodTexture, type GlowField, type MatBook, type Palette } from './gl-kit';
import { BASE_T, type Laptop, type ModelKit } from './gl-models';

/** the laptop is drawn a little over scale (miniature-diorama licence) so its screen reads in the hero */
export const LAPTOP_SCALE = 0.46;
const PHONE_SCALE = 0.36;

export type Agent = {
  task: string;
  home: Vector3;
  dock: Vector3;
  pos: Vector3;
  vel: Vector3;
  scale: number;
  hover: number;
  /** seconds since the click, < 0 when idle */
  job: number;
  phase: number;
};

export type DeskState = {
  /** 0 = morning … 1 = night */
  night: number;
  /** the code screen types and redraws only while the desk is on screen */
  active: boolean;
  /** camera position in world space: agents look half at the laptop, half at the viewer */
  eye: Vector3;
};

export type Desk = {
  group: Group;
  laptop: Laptop;
  agents: Agent[];
  /** world-space centre of the laptop screen (code drops start here; the night glow sits here) */
  screenWorld(out: Vector3): Vector3;
  update(dt: number, time: number, s: DeskState): void;
  hoverAgent(i: number): void;
  sendAgent(i: number): void;
  theme(p: Palette): void;
  dispose(): void;
};

/** Mirrored as real DOM text in Hero.astro (visually hidden list). */
export const AGENT_TASKS = [
  'agent: writing Playwright tests',
  'agent: summarising the PR',
  'agent: checking GST on shipping',
  'agent: reviewing the webhook handler',
];

/* ───────────── code on the laptop screen ───────────── */
type Kind = 'k' | 's' | 'c' | 'f' | 'n' | 'p';
type Tok = [string, Kind];
/* ≤ 12 lines of ≤ 46 characters: the editor font is large enough to read in the hero */
const files: { name: string; lines: string[] }[] = [
  {
    name: 'api/webhooks/razorpay.ts',
    lines: [
      "import { verify } from '@/lib/razorpay';",
      '// payment.captured → order paid',
      'export async function POST(req: Request) {',
      '  const body = await req.text();',
      "  const sig = req.headers.get('x-rzp-sig');",
      '  if (!verify(body, sig)) {',
      '    return new Response(null, { status: 401 });',
      '  }',
      '  const order = await orders.markPaid(body);',
      "  await ledger.append({ type: 'sale' });",
      '  return Response.json({ ok: true });',
      '}',
    ],
  },
  {
    name: 'app/Services/GstCalculator.php',
    lines: [
      'final class GstCalculator',
      '{',
      '  public function forLine(Line $l): Tax',
      '  {',
      '    $rate = TaxRule::forHsn($l->hsn)->rate;',
      '    $taxable = $l->price->times($l->qty);',
      '    // intra-state: CGST + SGST, else IGST',
      '    return $l->intraState()',
      '      ? Tax::split($taxable, $rate)',
      '      : Tax::igst($taxable, $rate);',
      '  }',
      '}',
    ],
  },
];
const nightLines = [
  '$ npm run test:e2e',
  '  146 passed (1.2m)',
  '$ git push origin main',
  '  CI ✓ lint  ✓ unit  ✓ playwright',
  '  deploy → production',
  '',
  'deployed ✓',
];
const KEYWORDS = /^(import|from|export|async|function|const|return|await|new|if|public|final|class|private|use)$/;

function tokenize(line: string): Tok[] {
  if (/^\s*(\/\/|#)/.test(line)) return [[line, 'c']];
  const out: Tok[] = [];
  const re = /('[^']*'|"[^"]*")|([A-Za-z_$][\w$]*)|(\d+)|([^\w'"$]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m[1]) out.push([m[1], 's']);
    else if (m[2]) out.push([m[2], KEYWORDS.test(m[2]) ? 'k' : /^[A-Z]/.test(m[2]) || line[re.lastIndex] === '(' ? 'f' : 'p']);
    else if (m[3]) out.push([m[3], 'n']);
    else out.push([m[4], 'p']);
  }
  return out;
}

export function createDesk(kit: ModelKit, mats: MatBook, glow: GlowField, lite: boolean): Desk {
  const group = new Group();
  const geos: BufferGeometry[] = [];
  const keep = <T extends BufferGeometry>(g: T) => (geos.push(g), g);
  const f = fonts();
  let pal: Palette | null = null;
  const m4 = new Matrix4();
  const q = new Quaternion();
  const v = new Vector3();
  const sv = new Vector3();
  const flatQ = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

  /* Desk island: a light, warm wood slab with a slate-blue felt desk mat, so every object reads against it. */
  const wood = woodTexture('#c99b6c', 1024, 512, 7);
  const deskMat = mats.satin((_p, c) => c.set('#ffffff'), { roughness: 0.55, map: wood.tex });
  const desk = new Mesh(keep(new RoundedBoxGeometry(1.7, 0.08, 1.0, 4, 0.035)), deskMat);
  desk.position.y = -0.04;
  group.add(desk);
  const feltMat = mats.satin((_p, c) => c.set(MINI.slate), { roughness: 0.95 });
  const felt = new Mesh(keep(new RoundedBoxGeometry(0.94, 0.006, 0.56, 2, 0.003)), feltMat);
  felt.position.set(0.08, 0.003, 0.03);
  group.add(felt);

  /* Morning sun through a window (off to the left): soft pane-shaped light patches across the desk. */
  const gobo = canvasTexture(512, 512);
  {
    const g = gobo.ctx;
    g.clearRect(0, 0, 512, 512);
    g.filter = 'blur(10px)';
    g.fillStyle = '#ffffff';
    for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) g.fillRect(40 + k * 150, 60 + r * 200, 128, 176);
    g.filter = 'none';
    gobo.tex.needsUpdate = true;
  }
  const goboMat = mats.add(new MeshBasicMaterial({ map: gobo.tex, color: '#ffd7a1', transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false }));
  const goboGeo = keep(new PlaneGeometry(1, 0.62));
  // shear the panes so they fall at the low morning angle
  goboGeo.applyMatrix4(m4.set(1, 0.45, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1));
  goboGeo.rotateX(-Math.PI / 2);
  const goboMesh = new Mesh(goboGeo, goboMat);
  goboMesh.rotation.y = 0.35;
  goboMesh.position.set(0.02, 0.0072, 0.1);
  goboMesh.renderOrder = 2;
  group.add(goboMesh);

  /* Laptop with the code screen: a bright, high-contrast light editor by day, a dark terminal at night. */
  const CW = 1024;
  const CH = 640;
  const code = canvasTexture(CW, CH);
  code.tex.anisotropy = 8;
  const screenMat = mats.add(new MeshBasicMaterial({ map: code.tex, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  const laptop = kit.laptop(0.625, screenMat, lite);
  laptop.root.scale.setScalar(LAPTOP_SCALE);
  laptop.root.position.set(0.04, 0.006 + BASE_T * LAPTOP_SCALE, -0.14);
  laptop.root.rotation.y = 0.06;
  laptop.lid.rotation.x = -14 * (Math.PI / 180);
  group.add(laptop.root);

  /* Phone, lying screen-up on the mat (front right), with a ping bubble. */
  const phoneTex = canvasTexture(256, 520);
  const phoneMat = mats.add(new MeshBasicMaterial({ map: phoneTex.tex, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  const phone = kit.phone(phoneMat, lite);
  phone.scale.setScalar(PHONE_SCALE);
  const ph = phone.userData as { h: number; w: number; depth: number };
  const PHONE = new Vector3(0.44, 0, 0.17);
  phone.rotation.set(-Math.PI / 2, 0, -0.35);
  phone.position.set(PHONE.x, 0.006 + (ph.depth * PHONE_SCALE) / 2, PHONE.z);
  group.add(phone);
  const phoneShadow = new Mesh(keep(new PlaneGeometry(ph.w * PHONE_SCALE * 1.5, ph.h * PHONE_SCALE * 1.2)), kit.shadow(0.45, 0.8));
  phoneShadow.rotation.set(-Math.PI / 2, 0, -0.35);
  phoneShadow.position.set(PHONE.x, 0.0065, PHONE.z);
  group.add(phoneShadow);

  const bubbleMat = mats.flat((p, c) => c.copy(p.signal));
  const ping = new Group();
  ping.add(new Mesh(keep(new ShapeGeometry(rrect(0.1, 0.05, 0.022), 6)), bubbleMat));
  const tail = new Mesh(keep(new CircleGeometry(0.014, 3)), bubbleMat);
  tail.position.set(-0.03, -0.026, -0.0005);
  tail.rotation.z = -Math.PI / 2;
  ping.add(tail);
  const dots = new InstancedMesh(keep(new CircleGeometry(0.0065, 10)), mats.flat((p, c) => c.copy(p.bg)), 3);
  for (let i = 0; i < 3; i++) dots.setMatrixAt(i, m4.makeTranslation((i - 1) * 0.022, 0, 0.001));
  ping.add(dots);
  ping.position.set(PHONE.x + 0.02, 0.16, PHONE.z + 0.02);
  group.add(ping);
  const pingGlow = glow.alloc(1);

  /* Coffee mug (butter glaze) + steam, back left. */
  const mugMat = mats.satin((_p, c) => c.set(MINI.butter), { roughness: 0.32 });
  const prof = [
    [0.0, 0.0],
    [0.052, 0.0],
    [0.056, 0.006],
    [0.056, 0.11],
    [0.05, 0.112],
    [0.046, 0.106],
    [0.046, 0.012],
    [0.0, 0.012],
  ].map(([x, y]) => new Vector2(x, y));
  const MUG = new Vector3(-0.44, 0.006, -0.24);
  const mug = new Mesh(keep(new LatheGeometry(prof, lite ? 18 : 32)), mugMat);
  mug.position.copy(MUG);
  group.add(mug);
  const handle = new Mesh(keep(new TorusGeometry(0.03, 0.008, 8, 18, Math.PI)), mugMat);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(MUG.x + 0.056, MUG.y + 0.058, MUG.z);
  group.add(handle);
  const coffee = new Mesh(keep(new CircleGeometry(0.046, 24)), mats.satin((_p, c) => c.set('#3a2414'), { roughness: 0.2 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.set(MUG.x, MUG.y + 0.094, MUG.z);
  group.add(coffee);
  const steamN = lite ? 5 : 10;
  const steamBase = glow.alloc(steamN);

  /* Notebook (terracotta cover) with a hand-drawn ER diagram, and a pen — front left. */
  const book = new Group();
  const cover = new Mesh(keep(new RoundedBoxGeometry(0.32, 0.014, 0.23, 2, 0.006)), mats.satin((_p, c) => c.set(MINI.terracotta), { roughness: 0.75 }));
  cover.position.y = 0.007;
  book.add(cover);
  const er = canvasTexture(512, 368);
  const page = new Mesh(keep(new PlaneGeometry(0.3, 0.215)), mats.add(new MeshBasicMaterial({ map: er.tex, color: '#e9e4dc' })));
  page.rotation.x = -Math.PI / 2;
  page.position.y = 0.0145;
  book.add(page);
  const pen = new Mesh(keep(new CylinderGeometry(0.0045, 0.0045, 0.15, 10)), mats.satin((p, c) => c.copy(p.signal), { roughness: 0.35 }));
  pen.rotation.set(0, 0.4, Math.PI / 2);
  pen.position.set(0.02, 0.02, 0.13);
  book.add(pen);
  book.rotation.y = 0.22;
  book.position.set(-0.5, 0.006, 0.12);
  group.add(book);

  /* Plant in a terracotta pot, back right. */
  const potProf = [
    [0.0, 0.0],
    [0.04, 0.0],
    [0.05, 0.085],
    [0.054, 0.09],
    [0.046, 0.092],
    [0.0, 0.08],
  ].map(([x, y]) => new Vector2(x, y));
  const POT = new Vector3(0.66, 0.006, -0.3);
  const pot = new Mesh(keep(new LatheGeometry(potProf, lite ? 14 : 24)), mats.satin((_p, c) => c.set(MINI.terracotta), { roughness: 0.85 }));
  pot.position.copy(POT);
  group.add(pot);
  const leafN = lite ? 8 : 13;
  const leaves = new InstancedMesh(keep(new SphereGeometry(1, 10, 6)), mats.satin((_p, c) => c.set('#ffffff'), { roughness: 0.55 }), leafN);
  const leafCols = [MINI.sageDeep, MINI.sage, '#5d7f5c'];
  const leafC = new Color();
  const rnd = rng(11);
  const leafA = new Vector3();
  for (let i = 0; i < leafN; i++) {
    const a = (i / leafN) * Math.PI * 2 + rnd() * 0.4;
    const len = 0.06 + rnd() * 0.045;
    q.setFromAxisAngle(leafA.set(Math.cos(a + Math.PI / 2), 0, Math.sin(a + Math.PI / 2)), 0.45 + rnd() * 0.5);
    v.set(Math.cos(a) * len * 0.5, 0.09 + len * 0.6 + rnd() * 0.03, Math.sin(a) * len * 0.5);
    m4.compose(v, q, sv.set(0.017, len, 0.006));
    leaves.setMatrixAt(i, m4);
    leaves.setColorAt(i, leafC.set(leafCols[i % leafCols.length]));
  }
  leaves.position.copy(POT);
  group.add(leaves);

  /* Sticky notes: PR #79 · GST rule · ship it — one texture, one draw. */
  const notes = canvasTexture(768, 256);
  const noteParts = (
    [
      [0.36, -0.36, -0.22],
      [0.5, -0.2, 0.16],
      [-0.22, 0.36, 0.1],
    ] as const
  ).map(([x, z, rot], i) => {
    const g = new PlaneGeometry(0.085, 0.085);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) + i) / 3);
    g.rotateX(-Math.PI / 2);
    g.rotateY(rot);
    g.translate(x, 0.0075 + i * 0.0002, z);
    return g;
  });
  const noteGeo = keep(mergeGeometries(noteParts));
  noteParts.forEach((g) => g.dispose());
  group.add(new Mesh(noteGeo, mats.add(new MeshBasicMaterial({ map: notes.tex, color: '#ebe6de' }))));

  /* Charging cradle on the right: a cream tray with four glowing pads; the agents dock here at night. */
  const agentN = lite ? 3 : 4;
  const CRADLE = new Vector3(0.7, 0, 0.0);
  const padGap = 0.082;
  const cradle = new Mesh(keep(new RoundedBoxGeometry(0.11, 0.022, padGap * 4 + 0.04, 2, 0.008)), mats.satin((_p, c) => c.set(MINI.cream), { roughness: 0.5 }));
  cradle.position.set(CRADLE.x, 0.011, CRADLE.z);
  group.add(cradle);
  const padGeo = keep(new RingGeometry(0.022, 0.032, lite ? 20 : 32));
  padGeo.rotateX(-Math.PI / 2);
  const padMat = mats.flat((p, c) => c.copy(p.signal));
  const pads = new InstancedMesh(padGeo, padMat, 4);
  for (let i = 0; i < 4; i++) pads.setMatrixAt(i, m4.makeTranslation(CRADLE.x, 0.0225, CRADLE.z + (i - 1.5) * padGap));
  group.add(pads);

  /* Night window behind the desk: the city lights at 23:30 (hidden by day). */
  const winTex = canvasTexture(1024, 512);
  const nightWin = new Group();
  const frame = new Mesh(keep(new RoundedBoxGeometry(1.62, 0.84, 0.03, 2, 0.012)), mats.satin((_p, c) => c.set(MINI.charcoal), { roughness: 0.6 }));
  nightWin.add(frame);
  const glass = new Mesh(keep(new PlaneGeometry(1.54, 0.76)), mats.add(new MeshBasicMaterial({ map: winTex.tex, toneMapped: false })));
  glass.position.z = 0.016;
  nightWin.add(glass);
  const mullions = new InstancedMesh(keep(new RoundedBoxGeometry(1, 1, 1, 1, 0.1)), frame.material, 2);
  mullions.setMatrixAt(0, m4.compose(v.set(0, 0, 0.02), q.identity(), sv.set(0.02, 0.76, 0.02)));
  mullions.setMatrixAt(1, m4.compose(v.set(0, 0.06, 0.02), q.identity(), sv.set(1.54, 0.016, 0.02)));
  nightWin.add(mullions);
  nightWin.position.set(0.0, 0.5, -0.66);
  nightWin.visible = false;
  group.add(nightWin);

  /* Agents: capsule body, visor, eyes, halo ring, antennae + a glow ring and a contact shadow on the desk. */
  const homes = [new Vector3(-0.3, 0.11, 0.02), new Vector3(0.4, 0.13, -0.04), new Vector3(0.32, 0.27, -0.3), new Vector3(-0.12, 0.09, 0.3)];
  const agents: Agent[] = Array.from({ length: agentN }, (_, i) => ({
    task: AGENT_TASKS[i],
    home: homes[i].clone(),
    dock: new Vector3(CRADLE.x, 0.072, CRADLE.z + (i - 1.5) * padGap),
    pos: homes[i].clone(),
    vel: new Vector3(),
    scale: 1,
    hover: 0,
    job: -1,
    phase: i * 1.7,
  }));
  const bodyMat = mats.satin((_p, c) => c.set('#f6f1e8'), { roughness: 0.32, metalness: 0.04 });
  const visorMat = mats.satin((_p, c) => c.set('#1b1e24'), { roughness: 0.12 });
  const haloMat = mats.flat((p, c) => c.copy(p.signal));
  const eyeMat = mats.flat((p, c) => c.copy(p.signal).offsetHSL(0, 0, 0.12));
  const capsule = keep(new SphereGeometry(1, lite ? 16 : 24, lite ? 12 : 18));
  capsule.scale(0.04, 0.05, 0.04);
  const visorGeo = keep(new SphereGeometry(1, 16, 10, -0.9, 1.8, 1.1, 0.75));
  visorGeo.scale(0.041, 0.051, 0.041);
  visorGeo.rotateY(Math.PI / 2);
  const stick = new CylinderGeometry(0.0018, 0.0018, 0.03, 5);
  stick.translate(0, 0.015, 0);
  const tip = new SphereGeometry(0.0055, 8, 6);
  tip.translate(0, 0.032, 0);
  const antGeo = keep(mergeGeometries([stick, tip]));
  stick.dispose();
  tip.dispose();
  const haloGeo = keep(new TorusGeometry(0.036, 0.0042, 6, lite ? 24 : 36));
  haloGeo.rotateX(Math.PI / 2);
  const bodies = new InstancedMesh(capsule, bodyMat, agentN);
  const visors = new InstancedMesh(visorGeo, visorMat, agentN);
  const eyes = new InstancedMesh(keep(new SphereGeometry(0.0062, 8, 6)), eyeMat, agentN * 2);
  const halos = new InstancedMesh(haloGeo, haloMat, agentN);
  const ants = new InstancedMesh(antGeo, bodyMat, agentN * 2);
  // on the desk: an accent ring under each bot (its "hover field") and a soft shadow that tightens as it nears
  const ringGeo = keep(new RingGeometry(0.034, 0.042, lite ? 24 : 40));
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = mats.flat((p, c) => c.copy(p.signal), { transparent: true, opacity: 0.75, depthWrite: false });
  const rings = new InstancedMesh(ringGeo, ringMat, agentN);
  const agentShadowMat = mats.add(shadowMaterial(0.42, 0.95));
  const agentShadows = new InstancedMesh(keep(new PlaneGeometry(1, 1)), agentShadowMat, agentN);
  const agentMeshes = [bodies, visors, eyes, halos, ants, rings, agentShadows];
  agentMeshes.forEach((m) => {
    m.frustumCulled = false;
    group.add(m);
  });
  const agentGlow = glow.alloc(agentN);

  /* ───────────── canvas painters ───────────── */
  let fileIdx = 0;
  let typed = 260; // start mid-file, so the first frame (and the stills) already show code
  let pause = 0;
  let codeTimer = 0;
  let nightMode = false;
  const paintCode = (night: boolean, time: number) => {
    if (!pal) return;
    const ctx = code.ctx;
    // light editor (GitHub-light style contrast) by day, deep terminal by night
    const theme = night
      ? { bg: '#0b1020', bar: '#121933', gutter: '#0e1428', ink: '#dfe7ff', dim: '#7c88aa' }
      : { bg: '#fbf8f2', bar: '#efe9df', gutter: '#f3eee6', ink: '#1f2328', dim: '#8a8f98' };
    const col: Record<Kind, string> = night
      ? { k: css(pal.signal), s: '#a5d6a7', c: theme.dim, f: '#9cc3ff', n: '#ffd28a', p: theme.ink }
      : { k: '#cf222e', s: '#0a3069', c: '#6e7781', f: '#8250df', n: '#0550ae', p: theme.ink };
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = theme.bar;
    ctx.fillRect(0, 0, CW, 46);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(24 + i * 24, 23, 7, 0, Math.PI * 2);
      ctx.fill();
    });
    // the open tab, underlined in the theme accent
    ctx.font = `600 19px ${f.mono}`;
    const tab = night ? 'zsh — deploy' : files[fileIdx].name;
    const tw = ctx.measureText(tab).width;
    ctx.fillStyle = theme.bg;
    ctx.fillRect(104, 6, tw + 36, 40);
    ctx.fillStyle = css(pal.signal);
    ctx.fillRect(104, 43, tw + 36, 3);
    ctx.fillStyle = theme.ink;
    ctx.fillText(tab, 122, 32);
    ctx.fillStyle = theme.gutter;
    ctx.fillRect(0, 46, 62, CH - 46);
    const lh = night ? 54 : 44;
    const lines = night ? nightLines : files[fileIdx].lines;
    let left = night ? Infinity : Math.floor(typed);
    let cx = 78;
    let cy = 94;
    for (let i = 0; i < lines.length; i++) {
      const y = (night ? 104 : 94) + i * lh;
      if (y > CH - 40) break;
      ctx.font = `500 20px ${f.mono}`;
      ctx.fillStyle = theme.dim;
      ctx.textAlign = 'right';
      ctx.fillText(String(i + 1), 46, y);
      ctx.textAlign = 'left';
      if (left <= 0) break;
      let x = 78;
      const deployed = night && lines[i].includes('deployed');
      const toks: Tok[] = night ? [[lines[i], lines[i].startsWith('$') ? 'k' : 'p']] : tokenize(lines[i]);
      ctx.font = night ? `600 ${deployed ? 66 : 30}px ${f.mono}` : `500 30px ${f.mono}`;
      for (const [text, kind] of toks) {
        if (left <= 0) break;
        const t = text.slice(0, left);
        left -= t.length;
        ctx.fillStyle = deployed ? '#3ddc84' : col[kind];
        ctx.fillText(t, x, y + (deployed ? 14 : 0));
        x += ctx.measureText(t).width;
      }
      left -= 1; // newline
      cx = x;
      cy = y;
    }
    if (!night && Math.floor(time * 2) % 2 === 0) {
      ctx.fillStyle = css(pal.signal);
      ctx.fillRect(cx + 3, cy - 25, 14, 32);
    }
    ctx.fillStyle = theme.bar;
    ctx.fillRect(0, CH - 34, CW, 34);
    ctx.fillStyle = theme.dim;
    ctx.font = `500 17px ${f.mono}`;
    ctx.fillText(night ? 'main ✓  ·  production' : 'main  ·  TypeScript  ·  Prettier ✓  ·  146 tests', 16, CH - 11);
    code.tex.needsUpdate = true;
  };

  const paintPhone = () => {
    const ctx = phoneTex.ctx;
    ctx.fillStyle = '#10131a';
    ctx.fillRect(0, 0, 256, 520);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2eee8';
    ctx.font = `600 64px ${f.display}`;
    ctx.fillText('09:41', 128, 120);
    ctx.font = `500 15px ${f.sans}`;
    ctx.fillStyle = '#a7a39c';
    ctx.fillText('Thursday', 128, 146);
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.beginPath();
    ctx.roundRect(14, 196, 228, 92, 18);
    ctx.fill();
    ctx.fillStyle = '#25d366';
    ctx.beginPath();
    ctx.roundRect(26, 210, 28, 28, 7);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f2eee8';
    ctx.font = `600 14px ${f.sans}`;
    ctx.fillText('Team chat', 64, 224);
    ctx.font = `400 13px ${f.sans}`;
    ctx.fillStyle = '#d5d0c8';
    ctx.fillText('PR #79 is green.', 64, 246);
    ctx.fillText('Ready to ship today?', 64, 266);
    phoneTex.tex.needsUpdate = true;
  };

  const paintER = () => {
    if (!pal) return;
    const ctx = er.ctx;
    const ink = '#2b2a33';
    ctx.fillStyle = '#f4efe6';
    ctx.fillRect(0, 0, 512, 368);
    ctx.strokeStyle = 'rgba(80,110,160,.18)';
    ctx.lineWidth = 1;
    for (let y = 30; y < 368; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    const r = rng(5);
    const wob = (n: number) => n + (r() - 0.5) * 2.2;
    const box = (x: number, y: number, w: number, title: string, rows: string[]) => {
      const h = 28 + rows.length * 19;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wob(x), wob(y));
      ctx.lineTo(wob(x + w), wob(y));
      ctx.lineTo(wob(x + w), wob(y + h));
      ctx.lineTo(wob(x), wob(y + h));
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(wob(x), wob(y + 24));
      ctx.lineTo(wob(x + w), wob(y + 24));
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.font = `600 15px ${f.mono}`;
      ctx.fillText(title, x + 8, y + 17);
      ctx.font = `400 12.5px ${f.mono}`;
      rows.forEach((row, i) => ctx.fillText(row, x + 8, y + 42 + i * 19));
      return { x, y, w, h };
    };
    const o = box(22, 26, 150, 'orders', ['id  pk', 'customer_id', 'status', 'total']);
    const it = box(22, 196, 150, 'order_items', ['order_id  fk', 'sku', 'qty · price']);
    const lg = box(312, 26, 176, 'stock_ledger', ['id  pk', 'sku', 'qty (+/−)', 'ref · type']);
    const pay = box(312, 210, 176, 'payments', ['order_id  fk', 'rzp_payment_id', 'verified_at']);
    const link = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo((x1 + x2) / 2, y1 + 6, (x1 + x2) / 2, y2 - 6, x2, y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2 - 10, y2 - 7);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2 - 10, y2 + 7);
      ctx.stroke();
    };
    ctx.lineWidth = 1.6;
    link(o.x + o.w / 2, o.y + o.h, it.x + it.w / 2 + 1, it.y);
    link(o.x + o.w, o.y + 50, lg.x, lg.y + 60);
    link(o.x + o.w, o.y + 80, pay.x, pay.y + 40);
    ctx.fillStyle = '#c0392b';
    ctx.font = `600 14px ${f.mono}`;
    ctx.fillText('append-only!', 330, lg.y + lg.h + 22);
    er.tex.needsUpdate = true;
  };

  const paintNotes = () => {
    if (!pal) return;
    const ctx = notes.ctx;
    const labels = ['PR #79', 'GST rule', 'ship it'];
    const fills = [css(pal.signal), '#f1e08e', '#cfe3c8'];
    ctx.textAlign = 'center';
    labels.forEach((t, i) => {
      const x = i * 256;
      ctx.fillStyle = fills[i];
      ctx.fillRect(x, 0, 256, 256);
      ctx.fillStyle = 'rgba(0,0,0,.08)';
      ctx.fillRect(x, 0, 256, 34);
      ctx.fillStyle = '#1d1b18';
      ctx.font = `600 ${i === 1 ? 44 : 50}px ${f.mono}`;
      ctx.fillText(t, x + 128, 150);
      if (i === 2) ctx.fillText('✓', x + 128, 212);
    });
    ctx.textAlign = 'left';
    notes.tex.needsUpdate = true;
  };

  const paintWindow = () => {
    const ctx = winTex.ctx;
    const W = 1024;
    const H = 512;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0b1230');
    sky.addColorStop(0.65, '#1d2a5c');
    sky.addColorStop(1, '#3a3f72');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // moon + a few stars
    const r = rng(41);
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    for (let i = 0; i < 60; i++) ctx.fillRect(r() * W, r() * H * 0.45, 1.5, 1.5);
    ctx.fillStyle = '#f3ecd6';
    ctx.beginPath();
    ctx.arc(820, 96, 30, 0, Math.PI * 2);
    ctx.fill();
    // three skyline layers, lit windows on the nearest two
    const layer = (base: number, maxH: number, color: string, lit: number, wmin: number) => {
      let x = -10;
      while (x < W) {
        const w = wmin + r() * 70;
        const h = maxH * (0.35 + r() * 0.65);
        ctx.fillStyle = color;
        ctx.fillRect(x, H - base - h, w, h + base);
        if (lit > 0) {
          for (let wy = H - base - h + 10; wy < H - 12; wy += 16) {
            for (let wx = x + 7; wx < x + w - 8; wx += 13) {
              if (r() < lit) {
                ctx.fillStyle = r() < 0.75 ? '#ffd58a' : '#bfe0ff';
                ctx.fillRect(wx, wy, 6, 8);
              }
            }
          }
        }
        x += w + 4 + r() * 10;
      }
    };
    layer(0, 260, '#1a2148', 0, 50);
    layer(0, 210, '#141936', 0.22, 40);
    layer(0, 140, '#0d1126', 0.35, 46);
    winTex.tex.needsUpdate = true;
  };

  /* ───────────── per frame ───────────── */
  const up = new Vector3(0, 1, 0);
  const xAxis = new Vector3(1, 0, 0);
  const zAxis = new Vector3(0, 0, 1);
  const face = new Quaternion();
  const tmp = new Vector3();
  const target = new Vector3();
  const camLocal = new Vector3();

  const update = (dt: number, time: number, st: DeskState) => {
    if (!pal) return;
    const night = st.night;
    group.updateMatrixWorld();
    camLocal.copy(st.eye);
    group.worldToLocal(camLocal);
    nightWin.visible = night > 0.5;
    goboMat.opacity = 0.36 * (1 - night);
    goboMesh.visible = night < 0.95;

    // code typing (~34 chars/s), redrawn at ~14 fps while visible
    const nm = night > 0.5;
    if (nm !== nightMode) {
      nightMode = nm;
      codeTimer = 1;
    }
    if (st.active) {
      const total = files[fileIdx].lines.reduce((sum, l) => sum + l.length + 1, 0);
      if (typed >= total) {
        pause += dt;
        if (pause > 2.2) {
          pause = 0;
          typed = 0;
          fileIdx = (fileIdx + 1) % files.length;
        }
      } else typed += dt * 34;
      codeTimer += dt;
      if (codeTimer > 0.07) {
        codeTimer = 0;
        paintCode(nightMode, time);
      }
    }

    // ping bubble pops every ~6.5 s (daytime only)
    const cyc = (time % 6.5) / 6.5;
    const pop = night > 0.5 ? 0 : ease(clamp(cyc * 6)) * (1 - ease(clamp((cyc - 0.7) * 4)));
    ping.visible = pop > 0.01;
    ping.scale.setScalar(Math.max(0.001, pop));
    ping.position.y = 0.13 + pop * 0.04 + Math.sin(time * 2.4) * 0.004;
    ping.quaternion.setFromAxisAngle(up, Math.atan2(camLocal.x - ping.position.x, camLocal.z - ping.position.z));
    ping.getWorldPosition(tmp);
    glow.set(pingGlow, tmp, 0.16 * pop, pal.signal, 0.5 * pop);

    // steam: goes cold at night
    for (let i = 0; i < steamN; i++) {
      const life = (time * 0.28 + i / steamN) % 1;
      tmp.set(MUG.x + Math.sin(time * 1.3 + i * 2.1) * 0.012 * (1 + life * 2), 0.11 + life * 0.22, MUG.z + Math.cos(time * 1.1 + i) * 0.01);
      group.localToWorld(tmp);
      glow.set(steamBase + i, tmp, 0.05 + life * 0.09, pal.bone, (1 - night) * Math.sin(Math.PI * life) * 0.22);
    }

    // agents: spring towards home (day) or dock (night); a clicked agent hops, zips down to the city and returns
    for (let i = 0; i < agentN; i++) {
      const a = agents[i];
      let s = 1;
      let zipping = false;
      if (a.job >= 0) {
        a.job += dt;
        const j = a.job;
        if (j < 0.35) target.copy(a.home).addScaledVector(up, 0.05 * ease(j / 0.35));
        else if (j < 1.2) {
          const k = ease((j - 0.35) / 0.85);
          target.copy(a.home).lerp(tmp.set(a.home.x * 0.4, -1.6, 0.9), k);
          s = 1 - k * 0.7;
          zipping = true;
        } else if (j < 3.6) {
          target.set(a.home.x, -3, 0.9);
          s = 0.001;
        } else {
          a.job = -1;
          a.pos.set(a.home.x, a.home.y + 0.6, a.home.z);
          target.copy(a.home);
        }
      } else {
        target.copy(a.home).lerp(a.dock, ease(night));
        target.y += Math.sin(time * 1.6 + a.phase) * 0.012 * (1 - night);
        target.x += Math.sin(time * 0.7 + a.phase * 2) * 0.01 * (1 - night);
      }
      tmp.copy(target).sub(a.pos).multiplyScalar(zipping ? 30 : 60);
      a.vel.addScaledVector(tmp, dt).multiplyScalar(Math.exp(-dt * 9));
      a.pos.addScaledVector(a.vel, dt);
      if (zipping) a.pos.lerp(target, 1 - Math.exp(-dt * 6));
      a.scale += (s * (1 + a.hover * 0.28) - a.scale) * (1 - Math.exp(-dt * 12));
      const sc = Math.max(0.001, a.scale);

      // half towards the laptop, half towards the viewer (wiggle when hovered), lean into the motion
      tmp.copy(laptop.root.position).sub(a.pos).setY(0).normalize();
      v.copy(camLocal).sub(a.pos).setY(0).normalize();
      tmp.lerp(v, 0.55 + a.hover * 0.45);
      face.setFromAxisAngle(up, Math.atan2(tmp.x, tmp.z) + a.hover * Math.sin(time * 3) * 0.2);
      face.multiply(q.setFromAxisAngle(xAxis, clamp(a.vel.length() * 0.6, 0, 0.5)));
      sv.set(sc, sc, sc);
      m4.compose(a.pos, face, sv);
      bodies.setMatrixAt(i, m4);
      visors.setMatrixAt(i, m4);
      const blink = Math.sin(time * 0.9 + a.phase * 3) > 0.985 ? 0.15 : 1;
      for (let e = 0; e < 2; e++) {
        tmp.set((e ? 1 : -1) * 0.014, 0.008, 0.039).multiplyScalar(sc).applyQuaternion(face).add(a.pos);
        m4.compose(tmp, face, v.set(sc, sc * blink * (1 - night * 0.7), sc));
        eyes.setMatrixAt(i * 2 + e, m4);
      }
      tmp.set(0, 0.07 * sc + Math.sin(time * 2 + a.phase) * 0.003, 0).add(a.pos);
      m4.compose(tmp, q.setFromAxisAngle(up, time * 0.8 + a.phase), sv);
      halos.setMatrixAt(i, m4);
      const busy = a.job >= 0 ? 1 : 0;
      glow.set(agentGlow + i, tmp, 0.11 * sc, pal.signal, sc > 0.05 ? (0.22 + a.hover * 0.5 + busy * 0.4) * (1 - night * 0.6) : 0);
      for (let e = 0; e < 2; e++) {
        tmp.set((e ? 1 : -1) * 0.016, 0.042, 0).multiplyScalar(sc).applyQuaternion(face).add(a.pos);
        q.setFromAxisAngle(zAxis, (e ? -1 : 1) * (0.35 + Math.sin(time * 5 + a.phase) * 0.08 * (1 - night))).premultiply(face);
        m4.compose(tmp, q, sv);
        ants.setMatrixAt(i * 2 + e, m4);
      }
      // ground: ring + shadow on the surface below (desk top, or the cradle pad when docked)
      const docked = a.pos.distanceTo(a.dock) < 0.06;
      const floorY = docked || Math.abs(a.pos.x - CRADLE.x) < 0.06 ? 0.023 : 0.007;
      const h = Math.max(0, a.pos.y - floorY);
      const near = clamp(1 - h / 0.4) * (sc > 0.05 && a.pos.y > -0.05 ? 1 : 0);
      const rs = (0.75 + h * 1.2) * sc * (near > 0 ? 1 : 0.0001);
      m4.compose(tmp.set(a.pos.x, floorY + 0.0006, a.pos.z), q.identity(), v.set(rs, 1, rs));
      rings.setMatrixAt(i, m4);
      const ss = (0.07 + h * 0.18) * sc * (near > 0 ? 1 : 0.0001);
      m4.compose(tmp.set(a.pos.x, floorY + 0.0003, a.pos.z), flatQ, v.set(ss, ss, 1));
      agentShadows.setMatrixAt(i, m4);
    }
    ringMat.opacity = 0.55 + night * 0.3;
    // the cradle pads wake up at night (dim accent by day)
    if (pal) padMat.color.set(MINI.cream).multiplyScalar(0.7).lerp(pal.signal, night);
    agentShadowMat.uniforms.uOpacity.value = 0.42 * (1 - night * 0.4);
    agentMeshes.forEach((m) => (m.instanceMatrix.needsUpdate = true));
  };

  return {
    group,
    laptop,
    agents,
    screenWorld(out) {
      laptop.screenAnchor.updateWorldMatrix(true, false);
      return laptop.screenAnchor.getWorldPosition(out);
    },
    update,
    hoverAgent(i) {
      agents.forEach((a, k) => (a.hover = k === i ? 1 : 0));
    },
    sendAgent(i) {
      const a = agents[i];
      if (a && a.job < 0) a.job = 0;
    },
    theme(p) {
      pal = p;
      paintCode(nightMode, 0);
      paintPhone();
      paintER();
      paintNotes();
      paintWindow();
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      [code.tex, phoneTex.tex, er.tex, notes.tex, winTex.tex, wood.tex, gobo.tex].forEach((t) => t.dispose());
      kit.disposeLaptop(laptop);
    },
  };
}
