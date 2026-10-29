/**
 * Act 4 — 20:00, "The range, after hours": a short street of small shopfronts at dusk, drawn behind the
 * horizontal range rail (gl-scene.ts, canvas behind <main>). The camera trucks along the street with the rail.
 *
 *   KOMAKI (e-scooter showroom) · SGR777 Foods (food store) · TAABI AI (fleet depot) · Eleenova (kitchen store) ·
 *   Transworld Academy (school front) · HMJ Developers (office) · Botticelli (boutique) · Srishti Construction
 *   (builders) · Morca Pumps (solar pumps)
 *
 * Names are plain signage text (no logos). Shops with a live public site show its real homepage screenshot in the
 * display window (`data-street-tex` on #freelance, built by Freelance.astro from src/assets).
 * Street lamps, lit windows and light pools on the pavement; a die-cast muscle car parked out front of SGR777 and a
 * die-cast van at the TAABI depot (on the pavement, so they show above the rail cards).
 *
 * Units: shop ≈ 1.6 wide × 1.6 tall, facades on z = 0, pavement to z ≈ 0.9, road to z ≈ 2.3. Everything per-shop is
 * instanced or atlased, so more shops cost no draw calls: ≈ 23 draws.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Garage } from './gl-cars';
import { canvasTexture, clamp, createBackdrop, css, ease, fonts, GlowField, lerp, MatBook, MINI, rng, shadowMaterial, type Palette } from './gl-kit';

export type ShopTextures = Partial<Record<'komaki' | 'sgr777' | 'taabi' | 'eleenova' | 'botticelli' | 'transworld' | 'hmj' | 'srishti' | 'morca', string>>;

export type Street = {
  scene: Scene;
  camera: PerspectiveCamera;
  exposure: number;
  resize(width: number, height: number): void;
  /** `p` rail progress 0…1 (camera trucks along the street), `enter` 0…1 as the section arrives */
  update(dt: number, p: number, enter: number): void;
  theme(p: Palette): void;
  dispose(): void;
};

type Shop = { name: string; kind: string; body: string; awning: string; tex: keyof ShopTextures };
const SHOPS: Shop[] = [
  { name: 'KOMAKI', kind: 'E-scooter showroom', body: MINI.sage, awning: MINI.sageDeep, tex: 'komaki' },
  { name: 'SGR777 Foods', kind: 'Food store', body: MINI.butter, awning: MINI.terracotta, tex: 'sgr777' },
  { name: 'TAABI AI', kind: 'Fleet depot', body: MINI.slate, awning: MINI.slateDeep, tex: 'taabi' },
  { name: 'Eleenova', kind: 'Kitchen store', body: '#e7a7a0', awning: '#b9645a', tex: 'eleenova' },
  { name: 'Transworld Academy', kind: 'School', body: MINI.cream, awning: '#3f6b55', tex: 'transworld' },
  { name: 'HMJ Developers', kind: 'Office', body: MINI.terracotta, awning: MINI.charcoal, tex: 'hmj' },
  { name: 'Botticelli', kind: 'Boutique', body: '#c9b08f', awning: '#6b4a35', tex: 'botticelli' },
  { name: 'Srishti Construction', kind: 'Builders', body: MINI.butter, awning: MINI.slateDeep, tex: 'srishti' },
  { name: 'Morca Pumps', kind: 'Solar pumps', body: MINI.slate, awning: '#2f5d8a', tex: 'morca' },
];
const PITCH = 1.85;
const SHOP_W = 1.6;
const GROUND_H = 0.92;
const SHOP_H = [1.62, 1.5, 1.7, 1.45, 1.78, 1.58, 1.52, 1.74, 1.6];
const WIN_W = 0.9;
const WIN_H = 0.5625;
const CELL_W = 512;
const CELL_H = 320;

export function createStreet(garage: Garage, env: Texture, mobile: boolean): Street {
  const scene = new Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.45;
  scene.fog = new Fog('#000', 12, 26);
  const camera = new PerspectiveCamera(28, 1, 0.1, 60);
  const mats = new MatBook();
  const glow = new GlowField(mobile ? 40 : 64);
  scene.add(glow.mesh);
  const backdrop = createBackdrop();
  scene.add(backdrop.mesh);
  const geos: BufferGeometry[] = [];
  const keep = <T extends BufferGeometry>(g: T) => (geos.push(g), g);
  const f = fonts();
  const m4 = new Matrix4();
  const q = new Quaternion();
  const v = new Vector3();
  const s = new Vector3();
  const c = new Color();
  const rand = rng(77);
  let pal: Palette | null = null;
  const group = new Group();
  scene.add(group);
  const inst = (geo: BufferGeometry, mat: ConstructorParameters<typeof InstancedMesh>[1], n: number) => {
    const m = new InstancedMesh(geo, mat, n);
    group.add(m);
    return m;
  };
  const put = (m: InstancedMesh, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rot?: Quaternion) => {
    m4.compose(v.set(x, y, z), rot ?? q.identity(), s.set(sx, sy, sz));
    m.setMatrixAt(i, m4);
  };
  const shopX = (i: number) => i * PITCH;
  const box = keep(new BoxGeometry(1, 1, 1));
  const rbox = keep(new RoundedBoxGeometry(1, 1, 1, 2, 0.08));
  const flatQ = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

  /* dusk light rig: low amber key from the left, violet fill, warm rim behind the roofline */
  const hemi = new HemisphereLight('#7d6fa8', '#2a2026', 0.55);
  const key = new DirectionalLight('#ffa565', 1.6);
  key.position.set(-8, 3.5, 5);
  const fill = new DirectionalLight('#7a86ff', 0.55);
  fill.position.set(6, 3, 8);
  const rim = new DirectionalLight('#ff9a5c', 1.6);
  rim.position.set(2, 5, -10);
  scene.add(hemi, key, fill, rim);

  /* ───────────── street: pavement, kerb, road, far kerb (one draw, instance colours) ───────────── */
  const N = SHOPS.length;
  const len = (N - 1) * PITCH + SHOP_W + 6;
  const midX = ((N - 1) * PITCH) / 2;
  const ground: [number, number, number, number, number, number, string][] = [
    [midX, -0.03, 0.45, len, 0.06, 0.9, '#8f877d'],
    [midX, -0.02, 0.92, len, 0.08, 0.06, '#b7ae9f'],
    [midX, -0.07, 1.65, len, 0.04, 1.4, '#2b2d33'],
    [midX, -0.02, 2.38, len, 0.08, 0.06, '#b7ae9f'],
    [midX, -0.03, 2.9, len, 0.06, 1.0, '#7f786f'],
    [midX, 0.8, -0.62, len, 1.7, 0.1, '#2f2b2c'],
  ];
  const groundMesh = inst(box, mats.satin((_p, col) => col.set('#ffffff'), { roughness: 0.85 }), ground.length);
  ground.forEach(([x, y, z, sx, sy, sz, col], i) => {
    put(groundMesh, i, x, y, z, sx, sy, sz);
    groundMesh.setColorAt(i, c.set(col));
  });
  const dashN = Math.ceil(len / 0.5);
  const dashes = inst(box, mats.flat((_p, col) => col.set('#d9cfbd').multiplyScalar(0.6)), dashN);
  for (let i = 0; i < dashN; i++) put(dashes, i, midX - len / 2 + i * 0.5 + 0.25, -0.048, 1.65, 0.24, 0.004, 0.035);

  /* ───────────── shop bodies, cornices, fascia boards, doors, awnings, upper windows ───────────── */
  const bodies = inst(rbox, mats.satin((_p, col) => col.set('#ffffff'), { roughness: 0.72 }), N);
  const cornices = inst(box, mats.satin((_p, col) => col.set(MINI.cream), { roughness: 0.6 }), N * 2);
  const fascias = inst(rbox, mats.satin((_p, col) => col.set(MINI.charcoal), { roughness: 0.5 }), N);
  const doors = inst(box, mats.satin((_p, col) => col.set('#24262b'), { roughness: 0.4, metalness: 0.2 }), N);
  const awnings = inst(rbox, mats.satin((_p, col) => col.set('#ffffff'), { roughness: 0.6 }), N);
  const frames = inst(box, mats.satin((_p, col) => col.set('#1f2126'), { roughness: 0.5 }), N * 4);
  const tilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.42);
  SHOPS.forEach((shop, i) => {
    const x = shopX(i);
    const h = SHOP_H[i];
    put(bodies, i, x, h / 2, -0.3, SHOP_W, h, 0.6);
    bodies.setColorAt(i, c.set(shop.body));
    put(cornices, i * 2, x, h + 0.02, -0.26, SHOP_W + 0.06, 0.05, 0.68);
    put(cornices, i * 2 + 1, x, GROUND_H + 0.03, -0.01, SHOP_W + 0.02, 0.03, 0.06);
    put(fascias, i, x, GROUND_H - 0.06, 0.012, 1.44, 0.2, 0.03);
    put(doors, i, x + 0.56, 0.3, 0.004, 0.24, 0.6, 0.02);
    put(awnings, i, x - 0.12, GROUND_H - 0.2, 0.18, 1.08, 0.02, 0.34, tilt);
    awnings.setColorAt(i, c.set(shop.awning));
    // window frame: four bars around the display window
    const wx = x - 0.12;
    const wy = 0.4;
    put(frames, i * 4, wx, wy + WIN_H / 2 + 0.015, 0.006, WIN_W + 0.06, 0.03, 0.03);
    put(frames, i * 4 + 1, wx, wy - WIN_H / 2 - 0.015, 0.006, WIN_W + 0.06, 0.03, 0.03);
    put(frames, i * 4 + 2, wx - WIN_W / 2 - 0.015, wy, 0.006, 0.03, WIN_H, 0.03);
    put(frames, i * 4 + 3, wx + WIN_W / 2 + 0.015, wy, 0.006, 0.03, WIN_H, 0.03);
  });
  type Up = { x: number; y: number; on: number };
  const ups: Up[] = [];
  SHOPS.forEach((_, i) => {
    const x = shopX(i);
    const h = SHOP_H[i];
    const cols = 3;
    const rows = h > 1.6 ? 2 : 1;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) ups.push({ x: x - 0.5 + k * 0.5, y: GROUND_H + 0.28 + r * 0.34, on: rand() });
  });
  const upWins = inst(keep(new PlaneGeometry(0.26, 0.22)), mats.flat((_p, col) => col.set('#ffffff')), ups.length);
  ups.forEach((u, i) => {
    put(upWins, i, u.x, u.y, 0.002, 1, 1, 1);
    upWins.setColorAt(i, u.on < 0.65 ? c.set('#ffd48f').multiplyScalar(0.75 + u.on * 0.3) : c.set('#2b3142'));
  });

  /* ───────────── display windows (one atlas, one draw) + fascia signs (one atlas, one draw) ───────────── */
  const ROWS = Math.ceil(N / 3);
  const winAtlas = canvasTexture(CELL_W * 3, CELL_H * ROWS);
  winAtlas.tex.anisotropy = 4;
  const winParts = SHOPS.map((_, i) => {
    const g = new PlaneGeometry(WIN_W, WIN_H);
    const uv = g.attributes.uv;
    const col = i % 3;
    const row = Math.floor(i / 3);
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (col + uv.getX(k)) / 3, 1 - (row + 1 - uv.getY(k)) / ROWS);
    g.translate(shopX(i) - 0.12, 0.4, 0.004);
    return g;
  });
  const winGeo = keep(mergeGeometries(winParts));
  winParts.forEach((g) => g.dispose());
  const winMat = mats.add(new MeshBasicMaterial({ map: winAtlas.tex, toneMapped: false, color: '#e8e2d8' }));
  group.add(new Mesh(winGeo, winMat));

  const SIGN_H = 160;
  const signAtlas = canvasTexture(1024, SIGN_H * N);
  signAtlas.tex.anisotropy = 4;
  const signParts = SHOPS.map((_, i) => {
    const g = new PlaneGeometry(1.4, (1.4 * SIGN_H) / 1024);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1 - uv.getY(k)) / N);
    g.translate(shopX(i), GROUND_H - 0.06, 0.03);
    return g;
  });
  const signGeo = keep(mergeGeometries(signParts));
  signParts.forEach((g) => g.dispose());
  group.add(new Mesh(signGeo, mats.add(new MeshBasicMaterial({ map: signAtlas.tex, transparent: true, toneMapped: false }))));
  // accent underline per fascia: brighter for the shop nearest the frame's focus
  const lines = inst(box, mats.flat((p, col) => col.copy(p.signal)), N);
  SHOPS.forEach((_, i) => put(lines, i, shopX(i), GROUND_H - 0.165, 0.03, 1.4, 0.008, 0.01));

  /* ───────────── street lamps + light pools on the pavement ───────────── */
  const lampXs = Array.from({ length: N + 1 }, (_, i) => shopX(i) - PITCH / 2);
  const pole = new CylinderGeometry(0.014, 0.018, 1.3, 8).translate(0, 0.65, 0);
  const arm = new BoxGeometry(0.2, 0.016, 0.016).translate(0.09, 1.28, 0);
  const head = new CylinderGeometry(0.04, 0.06, 0.06, 12).translate(0.18, 1.25, 0);
  const lampGeo = keep(mergeGeometries([pole, arm, head]));
  [pole, arm, head].forEach((g) => g.dispose());
  const lamps = inst(lampGeo, mats.satin((_p, col) => col.set('#25272c'), { roughness: 0.4, metalness: 0.5 }), lampXs.length);
  lampXs.forEach((x, i) => put(lamps, i, x, 0, 0.82, 1, 1, 1));
  const lampGlow = glow.alloc(lampXs.length);
  const poolTex = canvasTexture(256, 256);
  {
    const g = poolTex.ctx;
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,255,.9)');
    grad.addColorStop(0.45, 'rgba(255,255,255,.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    poolTex.tex.needsUpdate = true;
  }
  const poolN = lampXs.length + N;
  const pools = inst(keep(new PlaneGeometry(1, 1)), mats.add(new MeshBasicMaterial({ map: poolTex.tex, color: '#ffc27a', transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false })), poolN);
  pools.renderOrder = 2;
  lampXs.forEach((x, i) => put(pools, i, x + 0.18, 0.004, 0.75, 1.3, 1.0, 1, flatQ));
  SHOPS.forEach((_, i) => put(pools, lampXs.length + i, shopX(i) - 0.12, 0.004, 0.35, 1.3, 0.6, 1, flatQ));
  const winGlow = glow.alloc(N);

  /* ───────────── props: scooters at KOMAKI, crates at SGR777, bench at the school, plants at HMJ ───────────── */
  const scooterN = 2;
  const deck = new BoxGeometry(0.2, 0.02, 0.06).translate(0, 0.05, 0);
  const stem = new BoxGeometry(0.015, 0.2, 0.015).translate(0.09, 0.15, 0);
  const bar = new BoxGeometry(0.015, 0.015, 0.12).translate(0.09, 0.25, 0);
  const seat = new BoxGeometry(0.08, 0.03, 0.05).translate(-0.05, 0.12, 0);
  const scooterGeo = keep(mergeGeometries([deck, stem, bar, seat]));
  [deck, stem, bar, seat].forEach((g) => g.dispose());
  const scooters = inst(scooterGeo, mats.satin((_p, col) => col.set('#ffffff'), { roughness: 0.35, metalness: 0.2 }), scooterN);
  const wheels = inst(keep(new TorusGeometry(0.032, 0.012, 8, 16)), mats.satin((_p, col) => col.set('#1a1a1c'), { roughness: 0.7 }), scooterN * 2);
  // two scooters on display at the pavement edge, left of the window
  [-0.66, -0.4].forEach((dx, i) => {
    const x = shopX(0) + dx;
    q.setFromAxisAngle(v.set(0, 1, 0), 0.7);
    put(scooters, i, x, 0, 0.7 - i * 0.1, 1.3, 1.3, 1.3, q);
    scooters.setColorAt(i, c.set(i ? MINI.cream : '#2f8f5b'));
    const ca = Math.cos(0.7) * 0.12;
    const sa = Math.sin(0.7) * 0.12;
    put(wheels, i * 2, x + ca, 0.042, 0.7 - i * 0.1 - sa, 1.3, 1.3, 1.3, q);
    put(wheels, i * 2 + 1, x - ca, 0.042, 0.7 - i * 0.1 + sa, 1.3, 1.3, 1.3, q);
  });
  const crateN = 6;
  const crates = inst(rbox, mats.satin((_p, col) => col.set('#ffffff'), { roughness: 0.7 }), crateN * 2);
  const fruit = ['#e8773d', '#d93b3b', '#f2c94c', '#6fae4a', '#e8773d', '#9b59b6'];
  for (let i = 0; i < crateN; i++) {
    const x = shopX(1) - 0.5 + (i % 3) * 0.17;
    const z = 0.36 + Math.floor(i / 3) * 0.17;
    put(crates, i, x, 0.06, z, 0.15, 0.1, 0.13);
    crates.setColorAt(i, c.set('#b88a5a'));
    put(crates, crateN + i, x, 0.115, z, 0.13, 0.02, 0.11);
    crates.setColorAt(crateN + i, c.set(fruit[i]));
  }
  const bench = inst(box, mats.satin((_p, col) => col.set(MINI.wood), { roughness: 0.6 }), 3);
  put(bench, 0, shopX(4) - 0.15, 0.12, 0.5, 0.5, 0.025, 0.12);
  put(bench, 1, shopX(4) - 0.37, 0.06, 0.5, 0.025, 0.12, 0.1);
  put(bench, 2, shopX(4) + 0.07, 0.06, 0.5, 0.025, 0.12, 0.1);
  const potGeo = new CylinderGeometry(0.06, 0.045, 0.12, 12).translate(0, 0.06, 0);
  const bush = new SphereGeometry(0.1, 12, 10).translate(0, 0.2, 0);
  const plantGeo = keep(mergeGeometries([potGeo, bush]));
  potGeo.dispose();
  bush.dispose();
  const plants = inst(plantGeo, mats.satin((_p, col) => col.set(MINI.sageDeep), { roughness: 0.7 }), 2);
  put(plants, 0, shopX(5) - 0.68, 0, 0.12, 1, 1, 1);
  put(plants, 1, shopX(5) + 0.84, 0, 0.12, 1, 1, 1);

  /* far skyline behind the roofline, with a few lit windows */
  const farN = 4 * N - 2;
  const far = inst(box, mats.satin((_p, col) => col.set('#4b4569'), { roughness: 0.9 }), farN);
  const farWins: [number, number][] = [];
  for (let i = 0; i < farN; i++) {
    const x = midX - len / 2 + (i + 0.5) * (len / farN);
    const h = 1.85 + rand() * 0.9;
    put(far, i, x, h / 2, -2.6, len / farN - 0.08, h, 0.4);
    for (let k = 0; k < 3; k++) if (rand() < 0.6) farWins.push([x - 0.15 + k * 0.15, 1.85 + rand() * (h - 1.95)]);
  }
  const farLit = inst(keep(new PlaneGeometry(0.06, 0.08)), mats.flat((_p, col) => col.set('#ffd48f').multiplyScalar(0.7)), farWins.length);
  farWins.forEach(([x, y], i) => put(farLit, i, x, y, -2.39, 1, 1, 1));

  /* ───────────── die-cast cars parked out front (on the pavement, so they show above the rail cards) ───────────── */
  const parked = garage.make('muscle', 0);
  parked.root.scale.setScalar(0.62);
  parked.root.position.set(shopX(1) + 0.5, 0, 0.66);
  parked.root.rotation.y = Math.PI;
  scene.add(parked.root);
  const van = garage.make('van', 1);
  van.root.scale.setScalar(0.6);
  van.root.position.set(shopX(2) + 0.45, 0, 0.62);
  scene.add(van.root);
  const carShadows = new InstancedMesh(keep(new PlaneGeometry(1, 1)), mats.add(shadowMaterial(0.55, 0.85)), 2);
  [parked.root, van.root].forEach((r, i) => {
    m4.compose(v.set(r.position.x, 0.003, r.position.z), flatQ, s.set(r.scale.x * 1.15, r.scale.x * 0.55, 1));
    carShadows.setMatrixAt(i, m4);
  });
  scene.add(carShadows);

  /* ───────────── painters ───────────── */
  const paintCell = (i: number, img?: HTMLImageElement) => {
    const ctx = winAtlas.ctx;
    const x0 = (i % 3) * CELL_W;
    const y0 = Math.floor(i / 3) * CELL_H;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, CELL_W, CELL_H);
    ctx.clip();
    if (img) {
      // cover, anchored at the top of the homepage
      const k = Math.max(CELL_W / img.naturalWidth, CELL_H / img.naturalHeight);
      ctx.drawImage(img, x0, y0, img.naturalWidth * k, img.naturalHeight * k);
    } else {
      paintInterior(ctx, x0, y0);
    }
    // a soft reflection band across the glass
    const gl = ctx.createLinearGradient(x0, y0, x0 + CELL_W, y0 + CELL_H);
    gl.addColorStop(0.3, 'rgba(255,255,255,0)');
    gl.addColorStop(0.42, 'rgba(255,255,255,.12)');
    gl.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(x0, y0, CELL_W, CELL_H);
    ctx.restore();
    winAtlas.tex.needsUpdate = true;
  };
  /* a warm lit interior until the shop's homepage screenshot decodes */
  const paintInterior = (ctx: CanvasRenderingContext2D, x0: number, y0: number) => {
    const W = CELL_W;
    const H = CELL_H;
    ctx.fillStyle = '#f2e6d6';
    ctx.fillRect(x0, y0, W, H);
    // warm interior light from above
    const lg = ctx.createRadialGradient(x0 + W / 2, y0, 10, x0 + W / 2, y0, W * 0.8);
    lg.addColorStop(0, 'rgba(255,220,160,.35)');
    lg.addColorStop(1, 'rgba(255,220,160,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(x0, y0, W, H);
  };
  const paintSigns = (p: Palette) => {
    const ctx = signAtlas.ctx;
    ctx.clearRect(0, 0, 1024, SIGN_H * N);
    SHOPS.forEach((shop, i) => {
      const y = i * SIGN_H;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      let size = 96;
      ctx.font = `600 ${size}px ${f.display}`;
      while (ctx.measureText(shop.name).width > 860 && size > 40) ctx.font = `600 ${(size -= 4)}px ${f.display}`;
      ctx.fillStyle = '#fbf3e6';
      ctx.fillText(shop.name, 512, y + 62);
      ctx.font = `600 34px ${f.mono}`;
      ctx.fillStyle = css(p.signal);
      ctx.fillText(shop.kind.toUpperCase(), 512, y + 130);
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    signAtlas.tex.needsUpdate = true;
  };
  SHOPS.forEach((_, i) => paintCell(i));

  /* real homepage screenshots for the shops with a live public site */
  const root = document.getElementById('freelance');
  let urls: ShopTextures = {};
  try {
    urls = JSON.parse(root?.dataset.streetTex ?? '{}') as ShopTextures;
  } catch {
    urls = {};
  }
  SHOPS.forEach((shop, i) => {
    const url = urls[shop.tex];
    if (!url) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    img
      .decode()
      .then(() => paintCell(i, img))
      .catch(() => undefined);
  });

  /* ───────────── framing ───────────── */
  let W = 1;
  let H = 1;
  let time = 0;
  const eye = new Vector3();
  const look = new Vector3();
  const cA = new Color();
  const CAM_D = 9;

  return {
    scene,
    camera,
    exposure: 1,
    resize(width, height) {
      W = width;
      H = height;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    },
    update(dt, p, enter) {
      if (!pal) return;
      time += dt;
      // truck from KOMAKI to Morca Pumps: the shop in focus sits in the right part of the frame, clear of the title
      const span = camera.aspect * 2 * CAM_D * Math.tan((camera.fov * Math.PI) / 360);
      const x0 = shopX(0) - span * 0.16;
      const x1 = shopX(N - 1) - span * 0.16;
      const x = lerp(x0, x1, ease(clamp(p)));
      eye.set(x - 0.35, 1.05 + (1 - enter) * 0.35, CAM_D);
      look.set(x, 0.95, 0);
      camera.position.copy(eye);
      camera.lookAt(look);
      // shift the frame (tilt-shift style, verticals stay straight) so the shopfronts ride above the rail cards
      camera.setViewOffset(W, H, 0, H * 0.24, W, H);
      camera.updateMatrixWorld();

      const focusX = x + span * 0.16;
      SHOPS.forEach((_, i) => {
        const near = clamp(1 - Math.abs(shopX(i) - focusX) / PITCH);
        c.copy(pal!.signal).multiplyScalar(0.4 + near * 0.9);
        lines.setColorAt(i, c);
        v.set(shopX(i) - 0.12, 0.42, 0.25);
        glow.set(winGlow + i, v, 1.1, cA.set('#ffcf8f'), 0.12 + near * 0.06);
      });
      lines.instanceColor!.needsUpdate = true;
      lampXs.forEach((lx, i) => {
        v.set(lx + 0.18, 1.22, 0.82);
        glow.set(lampGlow + i, v, 0.5, cA.set('#ffd08a'), 0.75 + Math.sin(time * 3 + i * 1.7) * 0.03);
      });

      glow.flush();
    },
    theme(p) {
      pal = p;
      (scene.fog as Fog).color.copy(p.bg);
      backdrop.u.uBg.value.copy(p.bg);
      backdrop.u.uGlow.value.set('#ff9a5c').lerp(p.bg, 0.35);
      backdrop.u.uCenter.value.set(0.15, 0.55);
      backdrop.u.uRadius.value.set(1.6, 0.55);
      backdrop.u.uStrength.value = 0.5;
      backdrop.u.uVignette.value = 0.4;
      hemi.groundColor.copy(p.bg);
      mats.theme(p);
      paintSigns(p);
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.dispose();
      glow.dispose();
      backdrop.dispose();
      [winAtlas.tex, signAtlas.tex, poolTex.tex].forEach((t) => t.dispose());
    },
  };
}
