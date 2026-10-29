/**
 * Act 2 — the product, as a warmly lit, cut-away building (a dollhouse cross-section) whose floors ARE the stack
 * (top → bottom, same order as the DOM list in Stack.astro):
 *   0 shop    — sage walls, wood floor: shelves of products, a counter with a POS tablet, a clerk, a shopper
 *               walking in, pendant lamps; a rooftop skyline above          (Storefronts & admin UIs)
 *   1 API     — slate walls, asphalt: request pods on two glowing lanes, braking at a toll gate   (REST APIs)
 *   2 ledger  — butter walls: the translucent append-only slab tower, glowing per transaction type (sale /
 *               refund / GST), database drums and racks                     (PostgreSQL/MySQL)
 *   3 vault   — terracotta walls: the round vault door, a webhook scanner arch flashing green/red, coins and
 *               cards, an OTP keypad on a stand                              (Razorpay, OTP & 2FA)
 *   4 CI      — cream basement: conveyor, Playwright arch with ✓ pops, the deploy rocket on its lift (Cloudflare, CI)
 * Each floor has its own accent wall, a sign, ceiling light strips and one warm point light; the active floor is
 * brighter. The DOM tags (gl-scene.ts) connect to `propAnchors` with thin leader lines.
 *
 * Local units: block 3.0 wide × 1.6 deep, shop floor at y = 0, open (cut) face towards +z.
 * Everything repeated is instanced; ≈ 36 draws desktop, ≈ 33 lite.
 */
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  RepeatWrapping,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, clamp, css, ease, fonts, lerp, MINI, rng, type GlowField, type MatBook, type Palette } from './gl-kit';

export const CITY_W = 3.0;
export const CITY_D = 1.6;
const FRONT = CITY_D / 2;
const BACK = -FRONT;
/** floor surface of each storey, shop first */
const FLOOR = [0, -0.7, -1.4, -2.1, -2.8];
/** centre height of each storey (camera poses + drops) */
export const LAYER_Y = [0.32, -0.41, -1.11, -1.81, -2.51];
const ROOF = 0.66;
const GREEN = new Color('#3ddc84');
const RED = new Color('#ff5470');

/** per floor: accent wall, side walls, floor finish, light colour, sign text */
const FLOORS: { wall: string; side: string; floor: string; light: string; sign: string }[] = [
  { wall: MINI.sage, side: '#c9d8c2', floor: MINI.wood, light: '#ffd9a6', sign: 'SHOP · open 24×7' },
  { wall: MINI.slate, side: '#b9c5d6', floor: '#3b4049', light: '#e4ecff', sign: 'POST /api/orders 201' },
  { wall: MINI.butter, side: '#eadcaf', floor: '#d9cdb5', light: '#ffe8b8', sign: 'stock_ledger · append-only' },
  { wall: MINI.terracotta, side: '#e2b9a6', floor: '#6b4338', light: '#ffc98e', sign: 'VAULT · webhooks ✓' },
  { wall: '#cfc3ab', side: '#d9cfbd', floor: '#8f887e', light: '#f0f4ff', sign: 'CI · playwright ✓' },
];

export type CityState = {
  /** 0 = day … 1 = night (tower windows on, one by one) */
  night: number;
  /** 0…1: how much of the ledger has settled (scroll-driven, plus time) */
  settle: number;
  /** continuous index of the floor the camera is at (brighter), < 0 for none */
  focus: number;
  /** 0…1: interior lights up (they come on as the camera arrives) */
  lit: number;
};

export type City = {
  group: Group;
  /** local anchor (top right inside each floor, on the cut face) for the DOM floor tags */
  tagAnchors: Vector3[];
  /** local point of each floor's key prop (the leader line's end) */
  propAnchors: Vector3[];
  /** the deploy rocket (not parented: the world adds it to the scene; it sits on the CI lift by day) */
  rocket: Group;
  /** where the rocket rests right now (it rides the lift), in the city's (= world) space */
  rocketHome: Vector3;
  update(dt: number, time: number, s: CityState): void;
  theme(p: Palette): void;
  dispose(): void;
};

export function createCity(mats: MatBook, glow: GlowField, lite: boolean): City {
  const group = new Group();
  const geos: BufferGeometry[] = [];
  const keep = <T extends BufferGeometry>(g: T) => (geos.push(g), g);
  const m4 = new Matrix4();
  const q = new Quaternion();
  const v = new Vector3();
  const s = new Vector3();
  const c = new Color();
  const rand = rng(23);
  const f = fonts();
  let pal: Palette | null = null;
  const inst = (geo: BufferGeometry, mat: Material, n: number, dynamic = false) => {
    const m = new InstancedMesh(geo, mat, n);
    if (dynamic) m.frustumCulled = false;
    group.add(m);
    return m;
  };
  const put = (m: InstancedMesh, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rot?: Quaternion) => {
    m4.compose(v.set(x, y, z), rot ?? q.identity(), s.set(sx, sy, sz));
    m.setMatrixAt(i, m4);
  };
  const box = keep(new BoxGeometry(1, 1, 1));
  const rbox = keep(new RoundedBoxGeometry(1, 1, 1, 2, 0.12));
  const faceSide = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);

  /* ───────────── structure: slabs, walls, floor finishes, racks, stands (one draw, instance colours) ───────────── */
  type Part = [x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string];
  const parts: Part[] = [];
  // section cut in a warm charcoal poché, so each lit room reads as a framed box
  const SLAB = '#3a3431';
  const SHELL = '#c98466';
  // roof + slabs under each floor + bedrock
  parts.push([0, ROOF + 0.05, 0, CITY_W + 0.08, 0.1, CITY_D + 0.06, SLAB]);
  FLOOR.forEach((y) => parts.push([0, y - 0.05, 0, CITY_W + 0.08, 0.1, CITY_D + 0.06, SLAB]));
  parts.push([0, FLOOR[4] - 0.22, 0, CITY_W + 0.08, 0.24, CITY_D + 0.06, '#2a2523']);
  // outer shell (terracotta brick) left / right, full height
  const shellH = ROOF + 0.1 - (FLOOR[4] - 0.1);
  const shellY = (ROOF + 0.1 + FLOOR[4] - 0.1) / 2;
  parts.push([-CITY_W / 2 - 0.02, shellY, 0, 0.06, shellH, CITY_D + 0.06, SHELL], [CITY_W / 2 + 0.02, shellY, 0, 0.06, shellH, CITY_D + 0.06, SHELL]);
  // per floor: accent back wall, light side walls, floor finish
  FLOORS.forEach((fl, i) => {
    const y0 = FLOOR[i];
    const h = (i === 0 ? ROOF : FLOOR[i - 1] - 0.1) - y0;
    parts.push([0, y0 + h / 2, BACK + 0.03, CITY_W - 0.02, h, 0.06, fl.wall]);
    parts.push([-CITY_W / 2 + 0.035, y0 + h / 2, 0, 0.03, h, CITY_D - 0.02, fl.side], [CITY_W / 2 - 0.035, y0 + h / 2, 0, 0.03, h, CITY_D - 0.02, fl.side]);
    parts.push([0, y0 + 0.004, 0, CITY_W - 0.1, 0.008, CITY_D - 0.04, fl.floor]);
    // skirting board in a deeper wall tone
    parts.push([0, y0 + 0.025, BACK + 0.065, CITY_W - 0.1, 0.04, 0.012, '#d9cfbf']);
  });
  // shop: three shelf units (frames), the counter, a wood counter top
  const SHELF_X = [-1.18, -0.74, -0.3];
  SHELF_X.forEach((x) => parts.push([x, 0.23, BACK + 0.15, 0.38, 0.46, 0.16, '#e9dcc4']));
  parts.push([0.72, 0.1, 0.02, 0.56, 0.2, 0.2, MINI.cream], [0.72, 0.205, 0.02, 0.6, 0.014, 0.23, MINI.wood]);
  // ledger: two server racks, the tower plinth
  parts.push([-1.12, FLOOR[2] + 0.22, BACK + 0.2, 0.24, 0.44, 0.28, MINI.charcoal], [-0.84, FLOOR[2] + 0.22, BACK + 0.2, 0.24, 0.44, 0.28, MINI.charcoal]);
  parts.push([0.3, FLOOR[2] + 0.015, 0.02, 0.72, 0.03, 0.52, MINI.cream]);
  // vault: keypad stand + coin conveyor
  parts.push([1.02, FLOOR[3] + 0.16, 0.18, 0.08, 0.32, 0.08, MINI.charcoal], [1.02, FLOOR[3] + 0.34, 0.2, 0.3, 0.38, 0.04, '#2f2a2a']);
  parts.push([0.55, FLOOR[3] + 0.02, 0.28, 1.5, 0.04, 0.2, '#8a6a5c']);
  // CI: conveyor body, lift rails
  parts.push([-0.2, FLOOR[4] + 0.09, 0.22, 2.2, 0.06, 0.34, '#5b6270']);
  parts.push([0.94, FLOOR[4] + 0.3, 0.02, 0.03, 0.6, 0.03, '#8a919c'], [1.34, FLOOR[4] + 0.3, 0.02, 0.03, 0.6, 0.03, '#8a919c']);
  const structMat = mats.satin((_p, col) => col.set('#ffffff'), { roughness: 0.78 });
  const structure = inst(box, structMat, parts.length);
  parts.forEach(([x, y, z, sx, sy, sz, col], i) => {
    put(structure, i, x, y, z, sx, sy, sz);
    structure.setColorAt(i, c.set(col));
  });

  /* ───────────── emissive bits: ceiling light strips, lane lines, ledger posts, window light (instance colours) ───────────── */
  type Glow = [x: number, y: number, z: number, sx: number, sy: number, sz: number, kind: number];
  const strips: Glow[] = [];
  FLOOR.forEach((y, i) => {
    const top = (i === 0 ? ROOF : FLOOR[i - 1] - 0.1) - 0.012;
    strips.push([-0.75, top, 0.05, 0.9, 0.012, 0.05, 0], [0.75, top, 0.05, 0.9, 0.012, 0.05, 0]);
  });
  strips.push([0, FLOOR[1] + 0.012, 0.18, CITY_W - 0.2, 0.006, 0.014, 1], [0, FLOOR[1] + 0.012, 0.46, CITY_W - 0.2, 0.006, 0.014, 1]);
  // a fine cream line along every cut edge (slab tops and undersides)
  [ROOF + 0.1, ...FLOOR].forEach((y) => strips.push([0, y - 0.003, FRONT + 0.032, CITY_W + 0.08, 0.006, 0.004, 3], [0, y - 0.097, FRONT + 0.032, CITY_W + 0.08, 0.004, 0.004, 3]));
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) strips.push([0.3 + dx * 0.34, FLOOR[2] + 0.3, 0.02 + dz * 0.25, 0.01, 0.54, 0.01, 2]);
  const stripMat = mats.flat((_p, col) => col.set('#ffffff'));
  const stripMesh = inst(box, stripMat, strips.length);
  strips.forEach(([x, y, z, sx, sy, sz], i) => put(stripMesh, i, x, y, z, sx, sy, sz));
  const stripGlow = glow.alloc(FLOOR.length);

  /* one warm point light per floor; the floor the camera is at is brighter */
  const lights = FLOORS.map((fl, i) => {
    const l = new PointLight(fl.light, 0, 2.4, 1.3);
    l.position.set(0.1, (i === 0 ? ROOF : FLOOR[i - 1] - 0.1) - 0.12, 0.25);
    group.add(l);
    return l;
  });

  /* ───────────── signs: one atlas, one draw (five back-wall plaques + the storefront fascia) ───────────── */
  const SIGNS = [...FLOORS.map((fl) => fl.sign), 'STOREFRONT'];
  const atlas = canvasTexture(1024, 256 * SIGNS.length);
  const signParts = SIGNS.map((_, i) => {
    const front = i === SIGNS.length - 1;
    const g = new PlaneGeometry(front ? 1.2 : 0.92, front ? 0.15 : 0.18);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1 - uv.getY(k)) / SIGNS.length);
    if (front) g.translate(-0.7, ROOF + 0.19, FRONT - 0.04);
    else g.translate([0.55, 0.55, 1.0, -0.05, 0.55][i], (i === 0 ? ROOF : FLOOR[i - 1] - 0.1) - 0.16, BACK + 0.062);
    return g;
  });
  const signGeo = keep(mergeGeometries(signParts));
  signParts.forEach((g) => g.dispose());
  group.add(new Mesh(signGeo, mats.add(new MeshBasicMaterial({ map: atlas.tex, transparent: true, toneMapped: false }))));
  // fascia board behind the storefront sign
  const fascia = new Mesh(rbox, mats.satin((p, col) => col.copy(p.signal), { roughness: 0.5 }));
  fascia.scale.set(1.28, 0.19, 0.04);
  fascia.position.set(-0.7, ROOF + 0.19, FRONT - 0.065);
  group.add(fascia);

  /* ───────────── roof: skyline towers with windows, trees, water tank ───────────── */
  const towers: [number, number, number, string][] = [
    [0.25, 0.62, 0.36, MINI.cream],
    [0.68, 0.92, 0.34, MINI.slate],
    [1.08, 0.56, 0.32, MINI.terracotta],
    [1.36, 0.78, 0.2, MINI.sage],
  ];
  const towerMesh = inst(rbox, mats.satin((_p, col) => col.set('#ffffff'), { roughness: 0.7 }), towers.length);
  towers.forEach(([x, h, w, col], i) => {
    put(towerMesh, i, x, ROOF + 0.1 + h / 2, -0.45, w, h, 0.42);
    towerMesh.setColorAt(i, c.set(col));
  });
  type Win = { x: number; y: number; z: number; on: number };
  const wins: Win[] = [];
  towers.forEach(([x, h, w]) => {
    const cols = Math.max(2, Math.floor(w / 0.08));
    const rows = Math.floor((h - 0.1) / (lite ? 0.12 : 0.09));
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) wins.push({ x: x - w / 2 + (k + 0.5) * (w / cols), y: ROOF + 0.17 + r * ((h - 0.1) / rows), z: -0.45 + 0.212, on: rand() });
  });
  // side windows on the right outer wall, two per floor
  FLOOR.forEach((y) => [-0.35, 0.3].forEach((z) => wins.push({ x: CITY_W / 2 + 0.052, y: y + 0.32, z, on: -1 })));
  const winMesh = inst(keep(new PlaneGeometry(1, 1)), mats.flat((_p, col) => col.set('#ffffff')), wins.length);
  wins.forEach((w, i) => {
    if (w.on < 0) put(winMesh, i, w.x, w.y, w.z, 0.22, 0.26, 1, faceSide);
    else put(winMesh, i, w.x, w.y, w.z, 0.04, 0.045, 1);
  });
  const trunk = new CylinderGeometry(0.012, 0.016, 0.12, 6);
  trunk.translate(0, 0.06, 0);
  const crown = new SphereGeometry(0.075, 10, 8);
  crown.translate(0, 0.17, 0);
  const treeGeo = keep(mergeGeometries([trunk, crown]));
  trunk.dispose();
  crown.dispose();
  const treeXs = lite ? [-1.3, -0.05, 1.2] : [-1.3, -0.95, -0.05, 0.46, 1.2];
  const trees = inst(treeGeo, mats.satin((_p, col) => col.set(MINI.sageDeep), { roughness: 0.8 }), treeXs.length);
  treeXs.forEach((x, i) => put(trees, i, x, ROOF + 0.1, i % 2 ? -0.1 : 0.25, 1, 0.9 + (i % 3) * 0.15, 1));

  /* ───────────── 0 · shop: products, POS tablet, people, pendant lamps ───────────── */
  const prodN = SHELF_X.length * 3 * (lite ? 3 : 4);
  const perRow = lite ? 3 : 4;
  const products = inst(rbox, mats.satin((_p, col) => col.set('#ffffff'), { roughness: 0.5 }), prodN);
  const prodPalette = [MINI.terracotta, MINI.butter, MINI.slate, MINI.cream, MINI.sageDeep, '#e7a7a0'];
  const accentProd: number[] = [];
  let pi = 0;
  SHELF_X.forEach((x) => {
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < perRow; k++) {
        const h = 0.06 + rand() * 0.04;
        put(products, pi, x - 0.14 + k * (0.28 / (perRow - 1)), 0.04 + row * 0.14 + h / 2, BACK + 0.2, 0.06, h, 0.07);
        const r = rand();
        if (r < 0.14) accentProd.push(pi);
        products.setColorAt(pi, c.set(prodPalette[Math.floor(rand() * prodPalette.length)]));
        pi++;
      }
    }
  });
  // shelf boards
  const boards = inst(box, mats.satin((_p, col) => col.set(MINI.wood), { roughness: 0.6 }), SHELF_X.length * 3);
  SHELF_X.forEach((x, k) => {
    for (let row = 0; row < 3; row++) put(boards, k * 3 + row, x, 0.035 + row * 0.14, BACK + 0.2, 0.36, 0.012, 0.15);
  });
  const posTex = canvasTexture(256, 192);
  const pos = new Mesh(keep(new PlaneGeometry(0.14, 0.105)), mats.add(new MeshBasicMaterial({ map: posTex.tex, toneMapped: false })));
  pos.position.set(0.62, 0.27, 0.06);
  pos.rotation.set(-0.5, 0.25, 0);
  group.add(pos);
  // people: shopper (walks in through the right door to the shelves, then the counter) + clerk behind the counter
  const pBody = new CylinderGeometry(0.032, 0.04, 0.13, 10);
  pBody.translate(0, 0.065, 0);
  const pHead = new SphereGeometry(0.03, 12, 10);
  pHead.translate(0, 0.165, 0);
  const people = inst(keep(mergeGeometries([pBody, pHead])), mats.satin((_p, col) => col.set('#ffffff'), { roughness: 0.6 }), 2, true);
  pBody.dispose();
  pHead.dispose();
  // pendant lamps
  const shadeGeo = new ConeGeometry(0.06, 0.06, 16, 1, true);
  shadeGeo.translate(0, -0.03, 0);
  const cord = new CylinderGeometry(0.002, 0.002, 0.14, 4);
  cord.translate(0, 0.07, 0);
  const lampGeo = keep(mergeGeometries([shadeGeo, cord]));
  shadeGeo.dispose();
  cord.dispose();
  const LAMP_X = [-0.95, -0.35, 0.6];
  const lamps = inst(lampGeo, mats.satin((_p, col) => col.set(MINI.charcoal), { roughness: 0.45 }), LAMP_X.length);
  LAMP_X.forEach((x, i) => put(lamps, i, x, ROOF - 0.14, 0.1, 1, 1, 1));
  const lampGlow = glow.alloc(LAMP_X.length);

  /* ───────────── 1 · API: request pods, toll gate, boom ───────────── */
  const carN = lite ? 6 : 10;
  const cars = inst(keep(new RoundedBoxGeometry(1, 1, 1, 2, 0.35)), mats.satin((_p, col) => col.set('#ffffff'), { roughness: 0.3, metalness: 0.1 }), carN, true);
  const carState = Array.from({ length: carN }, (_, i) => ({ lane: i % 2, u: i / carN + rand() * 0.04, accent: rand() < 0.3 }));
  const GATE_X = 0.35;
  const post = new BoxGeometry(0.04, 0.36, 0.04);
  const postL = post.clone().translate(-0.42, 0.18, 0);
  const postR = post.clone().translate(0.42, 0.18, 0);
  const beam = new BoxGeometry(0.88, 0.07, 0.05).translate(0, 0.36, 0);
  const archGeo = keep(mergeGeometries([postL, postR, beam]));
  [post, postL, postR, beam].forEach((g) => g.dispose());
  const gates = inst(archGeo, mats.satin((_p, col) => col.set(MINI.cream), { roughness: 0.45 }), 2);
  q.setFromAxisAngle(v.set(0, 1, 0), Math.PI / 2);
  put(gates, 0, GATE_X, FLOOR[1], 0.32, 1, 1, 0.62, q.clone());
  put(gates, 1, 0.2, FLOOR[3], 0.28, 1, 1, 0.5, q.clone());
  const boom = new Mesh(box, mats.satin((p, col) => col.copy(p.signal), { roughness: 0.5 }));
  boom.scale.set(0.016, 0.016, 0.3);
  group.add(boom);
  const gateGlow = glow.alloc(2);

  /* ───────────── 2 · ledger: translucent slab tower, rack LEDs, database drums ───────────── */
  const slabMax = lite ? 14 : 22;
  const ledger = inst(rbox, mats.flat((_p, col) => col.set('#ffffff'), { transparent: true, opacity: 0.82 }), slabMax, true);
  const slabKind = Array.from({ length: slabMax }, (_, i) => (i % 7 === 3 ? 1 : i % 4 === 1 ? 2 : 0)); // 0 sale · 1 refund · 2 GST
  const SALE = new Color('#8fd19a');
  const REFUND = new Color('#ef8f6e');
  let shown = 0;
  let drop = 1;
  const ledgerGlow = glow.alloc(1);
  const ledN = lite ? 8 : 16;
  const leds = inst(box, mats.flat((_p, col) => col.set('#ffffff')), ledN, true);
  for (let i = 0; i < ledN; i++) put(leds, i, (i % 2 ? -0.84 : -1.12) - 0.07 + ((i >> 1) % 4) * 0.045, FLOOR[2] + 0.1 + Math.floor(i / 8) * 0.16, BACK + 0.345, 0.022, 0.012, 0.004);
  const drumGeo = keep(new CylinderGeometry(0.09, 0.09, 0.07, 24));
  const drums = inst(drumGeo, mats.satin((_p, col) => col.set(MINI.slate), { roughness: 0.4, metalness: 0.2 }), 3);
  for (let i = 0; i < 3; i++) put(drums, i, 1.0, FLOOR[2] + 0.04 + i * 0.085, -0.25, 1, 1, 1);

  /* ───────────── 3 · vault: door, webhook scanner, coins + cards, OTP keypad ───────────── */
  const metal = mats.satin((_p, col) => col.set('#b9b4aa'), { roughness: 0.28, metalness: 0.85 });
  const brass = mats.satin((_p, col) => col.set(MINI.brass), { roughness: 0.3, metalness: 0.85 });
  const disc = new CylinderGeometry(0.235, 0.235, 0.06, lite ? 28 : 44);
  disc.rotateX(Math.PI / 2);
  const vaultDoor = new Mesh(keep(disc), metal);
  vaultDoor.position.set(-0.72, FLOOR[3] + 0.3, BACK + 0.1);
  group.add(vaultDoor);
  const ringGeo = keep(new TorusGeometry(0.25, 0.022, 10, lite ? 28 : 44));
  const vaultRing = new Mesh(ringGeo, brass);
  vaultRing.position.set(-0.72, FLOOR[3] + 0.3, BACK + 0.11);
  group.add(vaultRing);
  const spokes = [0, 1, 2].map((k) => new BoxGeometry(0.3, 0.02, 0.02).rotateZ((k * Math.PI) / 3));
  const hub = new CylinderGeometry(0.04, 0.04, 0.035, 16).rotateX(Math.PI / 2);
  const wheel = new Mesh(keep(mergeGeometries([...spokes, hub])), brass);
  spokes.forEach((g) => g.dispose());
  hub.dispose();
  wheel.position.set(-0.72, FLOOR[3] + 0.3, BACK + 0.155);
  group.add(wheel);
  const scanMat = mats.add(new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false }));
  const scan = new Mesh(keep(new PlaneGeometry(0.42, 0.34)), scanMat);
  scan.rotation.y = Math.PI / 2;
  scan.position.set(0.2, FLOOR[3] + 0.18, 0.28);
  group.add(scan);
  const coinN = lite ? 4 : 7;
  const coins = inst(keep(new CylinderGeometry(0.04, 0.04, 0.014, 18)), brass, coinN, true);
  const cardN = lite ? 2 : 4;
  const cards = inst(rbox, mats.satin((_p, col) => col.set(MINI.cream), { roughness: 0.4 }), cardN, true);
  const flowState = Array.from({ length: coinN + cardN }, (_, i) => ({ u: i / (coinN + cardN), cycle: 0 }));
  const scanGlow = glow.alloc(1);
  let scanFlash = 0;
  let scanOk = true;
  const keyN = 12;
  const keys = inst(rbox, mats.satin((_p, col) => col.set('#ffffff'), { roughness: 0.45 }), keyN, true);
  for (let i = 0; i < keyN; i++) put(keys, i, 0.94 + (i % 3) * 0.08, FLOOR[3] + 0.44 - Math.floor(i / 3) * 0.07, 0.225, 0.065, 0.055, 0.02);
  const otp = inst(keep(new SphereGeometry(0.012, 8, 6)), mats.flat((_p, col) => col.set('#ffffff')), 6, true);
  for (let i = 0; i < 6; i++) put(otp, i, 0.91 + i * 0.044, FLOOR[3] + 0.5, 0.225, 1, 1, 1);
  const keyGlow = glow.alloc(1);

  /* ───────────── 4 · CI: belt, rollers, packages, Playwright arch, ✓ pops, rocket lift ───────────── */
  const stripes = canvasTexture(128, 32);
  stripes.tex.wrapS = RepeatWrapping;
  stripes.tex.repeat.set(14, 1);
  const beltTop = new Mesh(keep(new PlaneGeometry(2.2, 0.3)), mats.add(new MeshBasicMaterial({ map: stripes.tex })));
  beltTop.rotation.x = -Math.PI / 2;
  beltTop.position.set(-0.2, FLOOR[4] + 0.121, 0.22);
  group.add(beltTop);
  const rollerN = lite ? 6 : 12;
  const rollers = inst(keep(new CylinderGeometry(0.03, 0.03, 0.36, 10).rotateX(Math.PI / 2)), metal, rollerN);
  for (let i = 0; i < rollerN; i++) put(rollers, i, -1.25 + (i * 2.1) / (rollerN - 1), FLOOR[4] + 0.06, 0.22, 1, 1, 1);
  const pkgN = lite ? 4 : 7;
  const pkgs = inst(rbox, mats.satin((_p, col) => col.set('#ffffff'), { roughness: 0.7 }), pkgN, true);
  const pkgGlow = glow.alloc(pkgN);
  const ARCH_X = -0.25;
  const arch = new Mesh(keep(new TorusGeometry(0.24, 0.02, 10, 36, Math.PI)), mats.flat((p, col) => col.copy(p.signal)));
  arch.position.set(ARCH_X, FLOOR[4] + 0.12, 0.22);
  group.add(arch);
  const tickTex = canvasTexture(128, 128);
  const tickN = 3;
  const ticks = inst(keep(new PlaneGeometry(0.09, 0.09)), mats.add(new MeshBasicMaterial({ map: tickTex.tex, transparent: true, depthWrite: false, toneMapped: false })), tickN, true);
  const lift = new Mesh(rbox, mats.satin((p, col) => col.copy(p.signal).lerp(c.set('#ffffff'), 0.2), { roughness: 0.5 }));
  lift.scale.set(0.42, 0.03, 0.34);
  group.add(lift);

  // rocket: lathe body + nose, three fins, window
  const rocket = new Group();
  const rprof = [
    [0, 0],
    [0.05, 0],
    [0.06, 0.04],
    [0.062, 0.16],
    [0.05, 0.24],
    [0.026, 0.3],
    [0, 0.33],
  ].map(([x, y]) => new Vector2(x, y));
  rocket.add(new Mesh(keep(new LatheGeometry(rprof, lite ? 14 : 24)), mats.satin((_p, col) => col.set('#f4efe6'), { roughness: 0.35, metalness: 0.1 })));
  const finGeo = keep(new BoxGeometry(0.008, 0.08, 0.06).translate(0, 0.04, 0.07));
  const fins = new InstancedMesh(finGeo, mats.satin((p, col) => col.copy(p.signal), { roughness: 0.5 }), 3);
  for (let i = 0; i < 3; i++) {
    m4.makeRotationY((i * Math.PI * 2) / 3);
    fins.setMatrixAt(i, m4);
  }
  rocket.add(fins);
  const port = new Mesh(keep(new CylinderGeometry(0.018, 0.018, 0.01, 16).rotateX(Math.PI / 2)), mats.flat((_p, col) => col.set('#9fd3ff')));
  port.position.set(0, 0.19, 0.06);
  rocket.add(port);
  const LIFT_X = 1.14;
  const rocketHome = new Vector3(LIFT_X, FLOOR[4] + 0.03, 0.02);
  rocket.position.copy(rocketHome);

  /* tags: top right inside each floor (label), key prop (leader line end) */
  const tagAnchors = FLOOR.map((y, i) => new Vector3(CITY_W / 2 - 0.12, (i === 0 ? ROOF : FLOOR[i - 1] - 0.1) - 0.08, FRONT));
  const propAnchors = [
    new Vector3(-0.74, 0.3, BACK + 0.2),
    new Vector3(GATE_X, FLOOR[1] + 0.36, 0.32),
    new Vector3(0.3, FLOOR[2] + 0.42, 0.02),
    new Vector3(-0.72, FLOOR[3] + 0.3, BACK + 0.15),
    new Vector3(ARCH_X, FLOOR[4] + 0.36, 0.22),
  ];

  /* ───────────── painters ───────────── */
  const paintSigns = (p: Palette) => {
    const ctx = atlas.ctx;
    ctx.clearRect(0, 0, 1024, 256 * SIGNS.length);
    SIGNS.forEach((t, i) => {
      const y = i * 256;
      const front = i === SIGNS.length - 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (front) {
        ctx.font = `700 150px ${f.display}`;
        ctx.fillStyle = p.name === 'forest' ? '#13261b' : '#fff8ef';
        ctx.fillText(t, 512, y + 136);
        return;
      }
      ctx.fillStyle = 'rgba(28,30,36,.92)';
      ctx.beginPath();
      ctx.roundRect(24, y + 34, 976, 188, 40);
      ctx.fill();
      ctx.fillStyle = css(p.signal);
      ctx.beginPath();
      ctx.arc(104, y + 128, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fbf6ee';
      let size = 76;
      ctx.font = `600 ${size}px ${f.mono}`;
      while (ctx.measureText(t).width > 800 && size > 40) ctx.font = `600 ${(size -= 4)}px ${f.mono}`;
      ctx.fillText(t, 560, y + 132);
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    atlas.tex.needsUpdate = true;
  };
  const paintPos = (p: Palette) => {
    const ctx = posTex.ctx;
    ctx.fillStyle = '#fbf8f2';
    ctx.fillRect(0, 0, 256, 192);
    ctx.fillStyle = '#e8dfcf';
    ctx.fillRect(16, 16, 86, 86);
    ctx.fillStyle = MINI.terracotta;
    ctx.beginPath();
    ctx.moveTo(59, 30);
    ctx.lineTo(86, 92);
    ctx.lineTo(32, 92);
    ctx.fill();
    ctx.fillStyle = '#1f2328';
    ctx.font = `600 22px ${f.sans}`;
    ctx.fillText('Tote', 116, 44);
    ctx.font = `500 20px ${f.mono}`;
    ctx.fillText('₹1,299', 116, 76);
    ctx.fillStyle = css(p.signal);
    ctx.beginPath();
    ctx.roundRect(16, 120, 224, 52, 14);
    ctx.fill();
    ctx.fillStyle = p.name === 'forest' ? '#13261b' : '#ffffff';
    ctx.font = `700 24px ${f.sans}`;
    ctx.textAlign = 'center';
    ctx.fillText('Pay · UPI', 128, 154);
    ctx.textAlign = 'left';
    posTex.tex.needsUpdate = true;
  };
  const paintTick = () => {
    const ctx = tickTex.ctx;
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = '#3ddc84';
    ctx.beginPath();
    ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0b2614';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(36, 66);
    ctx.lineTo(56, 86);
    ctx.lineTo(92, 44);
    ctx.stroke();
    tickTex.tex.needsUpdate = true;
  };

  /* ───────────── per frame ───────────── */
  const tmp = new Vector3();
  const warm = new Color('#ffcf8a');
  const stripCol = new Color();
  const lightCol = new Color();
  const tmpQ = new Quaternion();
  const yAxis = new Vector3(0, 1, 0);

  const update = (dt: number, time: number, st: CityState) => {
    if (!pal) return;
    const p = pal;
    const night = st.night;
    group.updateMatrixWorld();

    // interiors: each floor's light comes up with `lit`; the focused floor is brighter
    for (let i = 0; i < FLOORS.length; i++) {
      const focus = st.focus < 0 ? 0.6 : clamp(1 - Math.abs(st.focus - i) * 0.7);
      const k = st.lit * (0.55 + focus * 0.45);
      lights[i].intensity = k * (lite ? 1.1 : 0.85);
      lightCol.set(FLOORS[i].light);
      tmp.set(0.1, (i === 0 ? ROOF : FLOOR[i - 1] - 0.1) - 0.05, 0.25);
      group.localToWorld(tmp);
      glow.set(stripGlow + i, tmp, 0.9, lightCol, 0.1 * k);
    }
    for (let i = 0; i < strips.length; i++) {
      const kind = strips[i][6];
      if (kind === 1) stripCol.copy(p.signal).multiplyScalar(1.1);
      else if (kind === 2) stripCol.set(MINI.cream);
      else if (kind === 3) stripCol.set('#e9dcc6').multiplyScalar(0.55);
      else stripCol.set('#fff3dc').multiplyScalar(0.5 + st.lit * 0.7);
      stripMesh.setColorAt(i, stripCol);
    }
    stripMesh.instanceColor!.needsUpdate = true;

    // windows: towers light up one by one at dusk; side windows glow with the interior
    for (let i = 0; i < wins.length; i++) {
      const w = wins[i];
      if (w.on < 0) c.set('#ffe3b0').multiplyScalar(0.35 + st.lit * 0.6);
      else {
        const lit = clamp((night * 1.25 - w.on * 0.9) * 6);
        c.set('#2d3440').lerp(warm, lit * 0.9 + 0.08);
      }
      winMesh.setColorAt(i, c);
    }
    winMesh.instanceColor!.needsUpdate = true;

    // pendant lamps
    for (let i = 0; i < LAMP_X.length; i++) {
      tmp.set(LAMP_X[i], ROOF - 0.19, 0.1);
      group.localToWorld(tmp);
      glow.set(lampGlow + i, tmp, 0.32, warm, 0.35 * st.lit);
    }

    // shopper: enters through the right door, browses the shelves, pays at the counter (14 s loop); clerk sways
    const w = (time / 14) % 1;
    let sx: number;
    let sz: number;
    let face: number;
    if (w < 0.3) {
      const k = ease(w / 0.3);
      sx = lerp(1.45, -0.6, k);
      sz = lerp(0.42, 0.05, k);
      face = -Math.PI / 2;
    } else if (w < 0.55) {
      sx = -0.6 - Math.sin(((w - 0.3) / 0.25) * Math.PI) * 0.45;
      sz = 0.05 - 0.15 * Math.sin(((w - 0.3) / 0.25) * Math.PI);
      face = Math.PI;
    } else if (w < 0.8) {
      const k = ease((w - 0.55) / 0.25);
      sx = lerp(-0.6, 0.62, k);
      sz = lerp(0.05, 0.3, k);
      face = Math.PI / 2;
    } else {
      sx = 0.62;
      sz = 0.3;
      face = Math.PI;
    }
    const step = w < 0.8 ? Math.abs(Math.sin(time * 9)) * 0.008 : 0;
    q.setFromAxisAngle(yAxis, face);
    put(people, 0, sx, step, sz, 1, 1, 1, q);
    q.setFromAxisAngle(yAxis, Math.sin(time * 0.7) * 0.3);
    put(people, 1, 0.78, 0.0, -0.18, 0.95, 0.95, 0.95, q);
    people.instanceMatrix.needsUpdate = true;
    people.setColorAt(0, c.copy(p.signal).lerp(tmpC.set('#ffffff'), 0.15));
    people.setColorAt(1, c.set(MINI.slate));
    people.instanceColor!.needsUpdate = true;

    // API pods: two lanes, opposite directions, braking at the gate
    let gateBusy = 0;
    for (let i = 0; i < carN; i++) {
      const cs = carState[i];
      const x = -1.36 + cs.u * 2.72;
      const gx = cs.lane ? -x : x;
      const dGate = Math.abs(gx - GATE_X);
      const speed = 0.07 * (0.25 + 0.75 * clamp((dGate - 0.05) / 0.3));
      cs.u = (cs.u + dt * speed) % 1;
      if (dGate < 0.14) gateBusy = 1;
      const z = cs.lane ? 0.46 : 0.18;
      put(cars, i, gx, FLOOR[1] + 0.05, z, 0.16, 0.07, 0.09);
      cars.setColorAt(i, cs.accent ? p.signal : c.set(i % 3 ? MINI.cream : MINI.butter));
    }
    cars.instanceMatrix.needsUpdate = true;
    cars.instanceColor!.needsUpdate = true;
    boom.position.set(GATE_X, FLOOR[1] + 0.2, 0.32);
    boom.rotation.set(gateBusy ? -1.25 : 0, 0, 0);
    tmp.set(GATE_X, FLOOR[1] + 0.42, 0.06);
    group.localToWorld(tmp);
    glow.set(gateGlow, tmp, 0.16, gateBusy ? GREEN : p.signal, 0.9);
    tmp.set(GATE_X, FLOOR[1] + 0.42, 0.58);
    group.localToWorld(tmp);
    glow.set(gateGlow + 1, tmp, 0.16, gateBusy ? GREEN : p.signal, 0.9);

    // ledger: slabs append as transactions settle (never removed), glowing by type
    const want = Math.min(slabMax, Math.floor(clamp(st.settle) * slabMax + 0.001));
    if (want > shown) {
      shown++;
      drop = 0;
    } else if (want < shown) shown = want;
    drop = Math.min(1, drop + dt * 3.5);
    for (let i = 0; i < slabMax; i++) {
      const isNew = i === shown - 1;
      const y = FLOOR[2] + 0.045 + i * 0.024 + (isNew ? (1 - ease(drop)) * 0.25 : 0);
      put(ledger, i, 0.3, y, 0.02, i < shown ? 0.6 : 0.0001, 0.016, 0.44);
      const k = slabKind[i];
      c.copy(k === 2 ? p.signal : k === 1 ? REFUND : SALE).multiplyScalar(isNew ? 1.4 : 0.85);
      ledger.setColorAt(i, c);
    }
    ledger.instanceMatrix.needsUpdate = true;
    ledger.instanceColor!.needsUpdate = true;
    tmp.set(0.3, FLOOR[2] + 0.045 + Math.max(0, shown - 1) * 0.024, 0.25);
    group.localToWorld(tmp);
    const nk = slabKind[Math.max(0, shown - 1)];
    glow.set(ledgerGlow, tmp, 0.4, nk === 2 ? p.signal : nk === 1 ? REFUND : SALE, (1 - drop) * 0.8 + 0.15);
    for (let i = 0; i < ledN; i++) leds.setColorAt(i, Math.sin(time * (2 + (i % 5)) + i * 1.7) > 0.2 ? GREEN : c.set('#20242b'));
    leds.instanceColor!.needsUpdate = true;

    // vault: items ride in from the right, get scanned at the webhook gate, verified ones roll into the door
    wheel.rotation.z = time * 0.25;
    scanFlash = Math.max(0, scanFlash - dt * 2.5);
    flowState.forEach((fs, i) => {
      const prev = fs.u;
      fs.u += dt * 0.07;
      if (fs.u >= 1) {
        fs.u -= 1;
        fs.cycle++;
      }
      const ok = (i * 7 + fs.cycle * 3) % 9 !== 0;
      if (prev < 0.5 && fs.u >= 0.5) {
        scanFlash = 1;
        scanOk = ok;
      }
      let x = 1.3 - fs.u * 2.2;
      let z = 0.28;
      let sc = 1;
      if (fs.u > 0.5) {
        const k = (fs.u - 0.5) / 0.5;
        if (ok) {
          z = 0.28 - ease(k) * 0.9;
          x = 0.2 - ease(k) * 0.92;
          sc = 1 - ease(clamp((k - 0.7) / 0.3));
        } else {
          x = 0.2 + ease(k) * 0.5;
          z = 0.28 + ease(k) * 0.3;
          sc = 1 - ease(k);
        }
      }
      const y = FLOOR[3] + 0.05 + Math.abs(Math.sin(fs.u * 40)) * 0.01;
      if (i < coinN) {
        q.setFromAxisAngle(v.set(1, 0, 0), Math.PI / 2).premultiply(tmpQ.setFromAxisAngle(v.set(0, 0, 1), fs.u * 30));
        put(coins, i, x, y + 0.035, z, sc, sc, sc, q);
      } else {
        put(cards, i - coinN, x, y + 0.012, z, 0.1 * sc, 0.008 * sc, 0.064 * sc);
      }
    });
    coins.instanceMatrix.needsUpdate = true;
    cards.instanceMatrix.needsUpdate = true;
    const scol = scanOk ? GREEN : RED;
    scanMat.color.copy(scanFlash > 0 ? scol : p.signal);
    scanMat.opacity = 0.12 + scanFlash * 0.45;
    tmp.set(0.2, FLOOR[3] + 0.36, 0.28);
    group.localToWorld(tmp);
    glow.set(scanGlow, tmp, 0.55, scol, scanFlash * 1.3);

    // OTP: six key presses fill the dots, then a green ✓ flash
    const otpT = (time % 5) / 5;
    const pressed = Math.floor(otpT * 9);
    for (let i = 0; i < keyN; i++) keys.setColorAt(i, (i * 5 + Math.floor(time / 5) * 7) % keyN === pressed % keyN && pressed < 6 ? p.signal : c.set(MINI.cream));
    keys.instanceColor!.needsUpdate = true;
    for (let i = 0; i < 6; i++) otp.setColorAt(i, pressed >= 6 ? GREEN : i < pressed ? p.signal : c.set('#5a5550'));
    otp.instanceColor!.needsUpdate = true;
    tmp.set(1.02, FLOOR[3] + 0.5, 0.24);
    group.localToWorld(tmp);
    glow.set(keyGlow, tmp, 0.32, GREEN, pressed >= 6 ? 0.9 : 0);

    // CI: belt runs, packages get a ✓ at the Playwright arch and roll on to the lift
    stripes.tex.offset.x = (stripes.tex.offset.x - dt * 0.6) % 1;
    for (let i = 0; i < pkgN; i++) {
      const u = (time * 0.06 + i / pkgN) % 1;
      const x = -1.25 + u * 2.1;
      const passed = x > ARCH_X;
      const near = clamp(1 - Math.abs(x - ARCH_X) / 0.12);
      put(pkgs, i, x, FLOOR[4] + 0.12 + 0.045, 0.22, 0.09, 0.08, 0.1);
      pkgs.setColorAt(i, passed ? c.set('#d8f2df') : c.set('#d2b48c'));
      tmp.set(x, FLOOR[4] + 0.26, 0.22);
      group.localToWorld(tmp);
      glow.set(pkgGlow + i, tmp, 0.2, GREEN, near * 1.1);
    }
    pkgs.instanceMatrix.needsUpdate = true;
    pkgs.instanceColor!.needsUpdate = true;
    // ✓ pops: rise and shrink above the arch, staggered
    for (let i = 0; i < tickN; i++) {
      const u = (time * 0.45 + i / tickN) % 1;
      const sc = Math.sin(Math.PI * Math.min(1, u * 1.2)) * (u < 0.85 ? 1 : 0);
      put(ticks, i, ARCH_X + (i - 1) * 0.12, FLOOR[4] + 0.42 + u * 0.14, 0.24, Math.max(0.0001, sc), Math.max(0.0001, sc), 1);
    }
    ticks.instanceMatrix.needsUpdate = true;
    // rocket lift: rises with the rocket, pauses at the top, comes back down
    const lt = (time % 12) / 12;
    const ly = lt < 0.35 ? ease(lt / 0.35) : lt < 0.6 ? 1 : 1 - ease((lt - 0.6) / 0.4);
    const liftY = FLOOR[4] + 0.02 + ly * 0.2;
    lift.position.set(LIFT_X, liftY, 0.02);
    rocketHome.set(LIFT_X, liftY + 0.015, 0.02);
  };
  const tmpC = new Color();

  return {
    group,
    tagAnchors,
    propAnchors,
    rocket,
    rocketHome,
    update,
    theme(p) {
      pal = p;
      accentProd.forEach((i) => products.setColorAt(i, p.signal));
      products.instanceColor!.needsUpdate = true;
      paintSigns(p);
      paintPos(p);
      paintTick();
      const sx = stripes.ctx;
      sx.fillStyle = '#3a404b';
      sx.fillRect(0, 0, 128, 32);
      sx.fillStyle = '#4b5260';
      sx.fillRect(0, 0, 64, 32);
      stripes.tex.needsUpdate = true;
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      [atlas.tex, stripes.tex, posTex.tex, tickTex.tex].forEach((t) => t.dispose());
    },
  };
}
