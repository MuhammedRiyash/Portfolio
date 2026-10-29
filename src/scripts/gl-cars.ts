/**
 * Procedural 1:64 die-cast toy cars for the desk, the project plinths and the street — generic, no brands, logos or
 * decals: glossy metallic paint (clearcoat), tinted glass, chrome 5-spoke rims, rounded black tyres, lights.
 *
 * Six silhouettes: muscle, jdm (sports coupe), wedge (supercar), van (retro surf van), rally (hatchback),
 * openwheel (race car). Each body is a side profile with rounded corners and wheel arches cut around the tyres,
 * extruded with a soft bevel, then shaped: tumblehome above the beltline and a rounded plan view at the nose and
 * tail. Pillars split the side windows; bumpers, grille and headlight bezels are dark trim baked into the body as
 * vertex colours (multiplied with the paint), so a car stays 6 draws (body, glass, lights, tyres, rims, spokes;
 * 4 when `lite`) and < 4k triangles. Units: car length = 1 (callers scale it).
 *
 * A `CarRig` adds the motion: a scrubbed roll along the table (wheels turn with the distance), a hover "rev"
 * bounce + wheel spin, and a click that zooms the car off the table edge until the scene is next re-entered.
 */
import {
  BoxGeometry,
  BufferAttribute,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Quaternion,
  Shape,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, ease, type Palette } from './gl-kit';

export type CarKind = 'muscle' | 'jdm' | 'wedge' | 'van' | 'rally' | 'openwheel';

/** Vivid die-cast hues; each is pulled a little towards the theme accent so the set feels part of the page. */
export const HUES = ['#c8102e', '#1f5fd6', '#7ccf2a', '#7a3dc8', '#ff7a1a', '#d4a72c'] as const;

type Spec = {
  body: [number, number][];
  glass: [number, number][];
  /** paint-coloured roof plate over the glass: [x0, x1, y] */
  roof?: [number, number, number];
  width: number;
  /** glass width as a fraction of the body width (> 1 lets side windows show through the body) */
  glassW: number;
  axles: [number, number];
  r: number;
  /** wheel centre offset from the body side (negative = outboard) */
  inset: number;
  lights: { head: [number, number]; tail: [number, number] };
  /** round headlights (else slim rectangles) */
  round?: boolean;
  /** x of the paint pillars that split the side windows */
  pillars?: number[];
  extra?: 'wings';
};

const SPECS: Record<CarKind, Spec> = {
  muscle: {
    body: [[-0.5, 0.08], [0.5, 0.08], [0.5, 0.19], [0.46, 0.235], [0.12, 0.26], [-0.42, 0.26], [-0.5, 0.22]],
    glass: [[-0.3, 0.25], [0.11, 0.25], [-0.02, 0.355], [-0.22, 0.355], [-0.38, 0.265]],
    roof: [-0.22, -0.02, 0.355],
    width: 0.42,
    glassW: 0.84,
    axles: [-0.31, 0.31],
    r: 0.1,
    inset: 0.035,
    lights: { head: [0.5, 0.175], tail: [-0.5, 0.19] },
    round: true,
    pillars: [-0.13],
  },
  jdm: {
    body: [[-0.5, 0.08], [0.5, 0.08], [0.5, 0.165], [0.44, 0.205], [0.2, 0.225], [-0.42, 0.235], [-0.5, 0.2]],
    glass: [[-0.3, 0.225], [0.17, 0.225], [0.02, 0.335], [-0.24, 0.335], [-0.34, 0.24]],
    roof: [-0.24, 0.02, 0.335],
    width: 0.42,
    glassW: 0.84,
    axles: [-0.31, 0.31],
    r: 0.095,
    inset: 0.03,
    lights: { head: [0.5, 0.155], tail: [-0.5, 0.175] },
    pillars: [-0.1],
  },
  wedge: {
    body: [[-0.5, 0.07], [0.5, 0.07], [0.52, 0.12], [0.1, 0.205], [-0.45, 0.24], [-0.5, 0.2]],
    glass: [[-0.22, 0.2], [0.16, 0.168], [-0.04, 0.27], [-0.2, 0.27], [-0.32, 0.225]],
    width: 0.46,
    glassW: 0.8,
    axles: [-0.32, 0.3],
    r: 0.1,
    inset: 0.03,
    lights: { head: [0.49, 0.112], tail: [-0.5, 0.2] },
  },
  van: {
    body: [[-0.5, 0.08], [0.5, 0.08], [0.5, 0.29], [0.42, 0.46], [-0.46, 0.47], [-0.5, 0.42]],
    glass: [[-0.45, 0.31], [0.43, 0.31], [0.37, 0.43], [-0.45, 0.43]],
    width: 0.44,
    glassW: 1.03,
    axles: [-0.3, 0.32],
    r: 0.095,
    inset: 0.035,
    lights: { head: [0.5, 0.2], tail: [-0.5, 0.24] },
    round: true,
    pillars: [-0.2, 0.12],
  },
  rally: {
    body: [[-0.45, 0.09], [0.46, 0.09], [0.47, 0.2], [0.4, 0.24], [0.1, 0.26], [-0.42, 0.27], [-0.45, 0.22]],
    glass: [[-0.42, 0.26], [0.12, 0.26], [-0.02, 0.38], [-0.4, 0.39]],
    roof: [-0.4, -0.02, 0.385],
    width: 0.43,
    glassW: 0.86,
    axles: [-0.28, 0.29],
    r: 0.105,
    inset: 0.03,
    lights: { head: [0.47, 0.18], tail: [-0.45, 0.2] },
    round: true,
    pillars: [-0.15],
  },
  openwheel: {
    body: [[-0.5, 0.07], [0.5, 0.055], [0.5, 0.095], [0.1, 0.15], [-0.15, 0.2], [-0.4, 0.2], [-0.5, 0.15]],
    glass: [[-0.2, 0.18], [0.0, 0.17], [-0.07, 0.235], [-0.17, 0.235]],
    width: 0.17,
    glassW: 0.9,
    axles: [-0.33, 0.33],
    r: 0.1,
    inset: -0.11,
    lights: { head: [0.5, 0.075], tail: [-0.5, 0.16] },
    extra: 'wings',
  },
};

/** Top of the profile polygon at `x` (highest edge crossing). */
function heightAt(pts: [number, number][], x: number) {
  let top = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    if ((x0 - x) * (x1 - x) > 0 || x0 === x1) continue;
    top = Math.max(top, y0 + ((x - x0) / (x1 - x0)) * (y1 - y0));
  }
  return top;
}

/**
 * Side profile → Shape with rounded corners (radius `rad`, clipped to the edges) and wheel arches cut into the
 * bottom edge (pts[0] → pts[1]) around each axle where the body is tall enough above it.
 */
function profileShape(pts: [number, number][], rad: number, spec?: Spec) {
  const n = pts.length;
  const P = pts.map(([x, y]) => new Vector2(x, y));
  const corner = (i: number) => {
    const cur = P[i % n];
    const prev = P[(i - 1 + n) % n];
    const next = P[(i + 1) % n];
    const d1 = Math.min(rad, cur.distanceTo(prev) * 0.45);
    const d2 = Math.min(rad, cur.distanceTo(next) * 0.45);
    return {
      a: cur.clone().add(prev.clone().sub(cur).setLength(d1)),
      cur,
      b: cur.clone().add(next.clone().sub(cur).setLength(d2)),
    };
  };
  const sh = new Shape();
  const c0 = corner(0);
  sh.moveTo(c0.b.x, c0.b.y);
  for (let i = 1; i <= n; i++) {
    if (i === 1 && spec && spec.inset > 0) {
      const b = pts[0][1];
      for (const ax of spec.axles) {
        const R = spec.r * 1.1;
        const cy = b + 0.006;
        if (heightAt(pts, ax) - (cy + R) < 0.024) continue;
        const e = Math.asin(Math.min(1, (cy - b) / R));
        sh.lineTo(ax - Math.cos(e) * R, b);
        sh.absarc(ax, cy, R, Math.PI + e, -e, true);
      }
    }
    const c = corner(i);
    sh.lineTo(c.a.x, c.a.y);
    sh.quadraticCurveTo(c.cur.x, c.cur.y, c.b.x, c.b.y);
  }
  return sh;
}

const extrude = (shape: Shape, depth: number, bevel: number, segs: number, curve: number) => {
  const g = new ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: segs,
    curveSegments: curve,
  });
  g.translate(0, 0, -depth / 2 + bevel);
  return g;
};

/** Tumblehome above the beltline and a rounded plan view at both ends (z scale by x/y). */
function shapeBody(g: BufferGeometry, belt: number, top: number) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const k = y > belt ? clamp((y - belt) / Math.max(0.01, top - belt)) : 0;
    const t = ease(clamp((Math.abs(x) - 0.34) / 0.18));
    p.setZ(i, p.getZ(i) * (1 - 0.13 * k) * (1 - 0.15 * t * t));
  }
  g.computeVertexNormals();
  return g;
}

type KindGeo = { body: BufferGeometry; glass: BufferGeometry; lights: BufferGeometry; spec: Spec };

export type ToyCar = {
  root: Group;
  kind: CarKind;
  hue: number;
  /** wheel rotation (radians) */
  spin(angle: number): void;
};

export type Garage = {
  make(kind: CarKind, hue: number): ToyCar;
  theme(p: Palette): void;
  dispose(): void;
};

const TRIM = '#141518';

export function createGarage(lite: boolean): Garage {
  const kinds = new Map<CarKind, KindGeo>();
  const geos: BufferGeometry[] = [];
  const mats: Material[] = [];
  const keep = <T extends BufferGeometry>(g: T) => (geos.push(g), g);
  const mat = <T extends Material>(m: T) => (mats.push(m), m);

  const glassMat = mat(new MeshPhysicalMaterial({ color: '#16202b', roughness: 0.06, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }));
  const tyreMat = mat(new MeshPhysicalMaterial({ color: '#111113', roughness: 0.75 }));
  const chrome = mat(new MeshPhysicalMaterial({ color: '#d9dbe0', metalness: 1, roughness: 0.14 }));
  const lightMat = mat(new MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  // body paint × vertex colour (white = paint, dark = bumpers/grille/bezels)
  const paints = HUES.map((h) => mat(new MeshPhysicalMaterial({ color: h, metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06, vertexColors: true })));

  // rounded tyre: lathe of a soft sidewall profile around the axle (z), closed at the hub (the rims sit on top)
  const tyreProf = [
    [0, -0.03],
    [0.6, -0.032],
    [0.9, -0.04],
    [0.985, -0.03],
    [1, -0.012],
    [1, 0.012],
    [0.985, 0.03],
    [0.9, 0.04],
    [0.6, 0.032],
    [0, 0.03],
  ].map(([r, y]) => new Vector2(r, y));
  const tyreGeo = keep(new LatheGeometry(tyreProf, lite ? 12 : 22).rotateX(Math.PI / 2));
  const rimGeo = keep(new CylinderGeometry(0.62, 0.62, 0.074, lite ? 10 : 18).rotateX(Math.PI / 2));
  const spokeParts = [0, 1, 2, 3, 4].map((k) => new BoxGeometry(0.12, 0.9, 0.08).rotateZ((k * Math.PI * 2) / 5));
  const spokeGeo = keep(mergeGeometries(spokeParts));
  spokeParts.forEach((g) => g.dispose());

  const kindGeo = (kind: CarKind) => {
    const hit = kinds.get(kind);
    if (hit) return hit;
    const spec = SPECS[kind];
    const curve = lite ? 3 : 6;
    const segs = lite ? 2 : 3;
    const belt = spec.glass[0][1];
    const top = Math.max(...spec.glass.map(([, y]) => y), ...spec.body.map(([, y]) => y));
    const parts: BufferGeometry[] = [];
    const add = (g: BufferGeometry, hex = '#ffffff') => parts.push(paintGeo(g.index ? g.toNonIndexed() : g, hex));
    add(extrude(profileShape(spec.body, 0.035, spec), spec.width, spec.extra === 'wings' ? 0.015 : 0.04, segs, curve));
    const gw = spec.width * spec.glassW;
    if (spec.roof) {
      const [x0, x1, y] = spec.roof;
      add(new RoundedBoxGeometry(x1 - x0 + 0.04, 0.026, gw + 0.012, 2, 0.011).translate((x0 + x1) / 2, y + 0.006, 0));
    }
    for (const px of spec.pillars ?? []) {
      const h = heightAt(spec.glass, px);
      add(new RoundedBoxGeometry(0.03, h - belt + 0.01, gw + 0.012, 1, 0.006).translate(px, (belt + h) / 2, 0));
    }
    if (spec.extra === 'wings') {
      add(new BoxGeometry(0.1, 0.018, 0.5).translate(-0.46, 0.29, 0));
      add(new BoxGeometry(0.02, 0.1, 0.02).translate(-0.44, 0.24, 0.12), TRIM);
      add(new BoxGeometry(0.02, 0.1, 0.02).translate(-0.44, 0.24, -0.12), TRIM);
      add(new BoxGeometry(0.1, 0.014, 0.52).translate(0.46, 0.06, 0));
    } else {
      // bumpers, grille, mirrors
      const [fx] = spec.body[1];
      const [rx] = spec.body[0];
      const b = spec.body[0][1];
      add(new RoundedBoxGeometry(0.05, 0.045, spec.width * 0.94, 2, 0.016).translate(fx - 0.012, b + 0.022, 0), TRIM);
      add(new RoundedBoxGeometry(0.05, 0.04, spec.width * 0.94, 2, 0.016).translate(rx + 0.012, b + 0.022, 0), TRIM);
      add(new RoundedBoxGeometry(0.02, 0.036, spec.width * 0.36, 1, 0.008).translate(spec.lights.head[0] - 0.004, spec.lights.head[1] - 0.006, 0), TRIM);
      const mx = spec.glass[1][0] - 0.06;
      for (const s of [-1, 1]) add(new RoundedBoxGeometry(0.04, 0.026, 0.05, 1, 0.009).translate(mx, belt + 0.012, s * (gw / 2 + 0.02)));
    }
    // headlight bezels (dark) behind the lamps
    const hz = spec.width * 0.31;
    const [hx, hy] = spec.lights.head;
    for (const s of [-1, 1]) add(new RoundedBoxGeometry(0.02, 0.05, 0.085, 1, 0.008).translate(hx - 0.006, hy, s * hz), TRIM);
    const body = keep(shapeBody(mergeGeometries(parts), belt, top));
    parts.forEach((g) => g.dispose());
    const glass = keep(shapeBody(extrude(profileShape(spec.glass, 0.022), gw, 0.02, segs, curve), belt, top));
    // lights: two white heads (round or slim), two red tail strips; one geometry with vertex colours
    const lp: BufferGeometry[] = [];
    const [tx, ty] = spec.lights.tail;
    for (const s of [-1, 1]) {
      const head = spec.round
        ? new CylinderGeometry(0.026, 0.026, 0.012, lite ? 8 : 14).rotateZ(Math.PI / 2).translate(hx + 0.002, hy, s * hz)
        : new RoundedBoxGeometry(0.014, 0.028, 0.08, 1, 0.006).translate(hx + 0.002, hy, s * hz);
      lp.push(paintGeo(head.index ? head.toNonIndexed() : head, '#fff4d6'));
      const tail = new RoundedBoxGeometry(0.014, 0.03, 0.1, 1, 0.006).translate(tx - 0.002, ty, s * spec.width * 0.3);
      lp.push(paintGeo(tail, '#ff2a3a'));
    }
    const lights = keep(shapeBody(mergeGeometries(lp), belt, top));
    lp.forEach((g) => g.dispose());
    const kg = { body, glass, lights, spec };
    kinds.set(kind, kg);
    return kg;
  };

  const m4 = new Matrix4();
  const q = new Quaternion();
  const v = new Vector3();
  const s = new Vector3();
  const zAxis = new Vector3(0, 0, 1);

  return {
    make(kind, hue) {
      const kg = kindGeo(kind);
      const { spec } = kg;
      const root = new Group();
      const paint = paints[hue % paints.length];
      root.add(new Mesh(kg.body, paint), new Mesh(kg.glass, glassMat), new Mesh(kg.lights, lightMat));
      const tyres = new InstancedMesh(tyreGeo, tyreMat, 4);
      const rims = lite ? null : new InstancedMesh(rimGeo, chrome, 4);
      const spokes = lite ? null : new InstancedMesh(spokeGeo, chrome, 4);
      root.add(tyres);
      if (rims && spokes) root.add(rims, spokes);
      const wheelPos = [spec.axles[0], spec.axles[1]].flatMap((x) => [-1, 1].map((side) => new Vector3(x, spec.r, side * (spec.width / 2 - spec.inset))));
      const spin = (angle: number) => {
        wheelPos.forEach((p, i) => {
          q.setFromAxisAngle(zAxis, -angle);
          m4.compose(p, q, s.set(spec.r, spec.r, 1));
          tyres.setMatrixAt(i, m4);
          if (rims && spokes) {
            v.copy(p).setZ(p.z + Math.sign(p.z) * 0.004);
            m4.compose(v, q, s.set(spec.r, spec.r, 1));
            rims.setMatrixAt(i, m4);
            spokes.setMatrixAt(i, m4);
          }
        });
        tyres.instanceMatrix.needsUpdate = true;
        if (rims && spokes) {
          rims.instanceMatrix.needsUpdate = true;
          spokes.instanceMatrix.needsUpdate = true;
        }
      };
      spin(0);
      return { root, kind, hue, spin };
    },
    theme(p) {
      paints.forEach((m, i) => m.color.set(HUES[i]).lerp(p.signal, 0.14));
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

/** Bake a flat vertex colour into a geometry (lights share one draw). */
function paintGeo(g: BufferGeometry, hex: string) {
  const c = new Color(hex);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g;
}

/**
 * Motion for one car sitting on a table: `place()` sets its rest pose (position on the table top, heading),
 * `update()` applies the scrubbed roll, hover rev and click zoom, `kick()` sends it off the edge.
 */
export class CarRig {
  readonly car: ToyCar;
  private rest = new Vector3();
  private heading = 0;
  private scale = 1;
  private hover = 0;
  private hoverT = 0;
  private zoom = -1;
  private spin = 0;
  /** how far the scroll rolls it, in car lengths */
  roll = 0.5;

  constructor(car: ToyCar) {
    this.car = car;
  }

  /** rest pose: `pos` on the table top (y = surface), heading in radians around +y, car length in scene units */
  place(pos: Vector3, heading: number, length: number) {
    this.rest.copy(pos);
    this.heading = heading;
    this.scale = length;
    this.car.root.scale.setScalar(length);
  }

  /** world-ish centre for hit-testing (in the parent's space) */
  centre(out: Vector3) {
    return out.copy(this.car.root.position).add(v0.set(0, 0.15 * this.scale, 0));
  }

  setHover(on: boolean) {
    this.hover = on ? 1 : 0;
  }

  kick() {
    if (this.zoom < 0) this.zoom = 0;
  }

  /** bring a zoomed-off car back (call when its scene is re-entered) */
  reset() {
    this.zoom = -1;
  }

  /** `p` 0…1 scrubbed entry progress, `dt` seconds */
  update(p: number, dt: number) {
    const rollD = ease(clamp(p)) * this.roll;
    this.hoverT += (this.hover - this.hoverT) * (1 - Math.exp(-dt * 10));
    let extra = 0;
    let lift = 0;
    if (this.zoom >= 0) {
      this.zoom += dt;
      extra = this.zoom * this.zoom * 9;
      lift = Math.max(0, extra - 2.2) * -0.6;
    }
    const d = rollD + extra;
    const fwd = v0.set(Math.cos(this.heading), 0, -Math.sin(this.heading));
    const root = this.car.root;
    root.position.copy(this.rest).addScaledVector(fwd, d * this.scale);
    root.position.y += (Math.abs(Math.sin(this.hoverT * performance.now() * 0.03)) * 0.015 * this.hoverT + lift * 0.3) * this.scale;
    root.rotation.set(0, this.heading, this.hoverT * 0.03 * Math.sin(performance.now() * 0.05));
    root.visible = this.zoom < 0 || extra < 6;
    // wheels: rolling distance / radius, plus a free spin while revving
    this.spin += this.hoverT * dt * 30;
    const r = SPECS[this.car.kind].r;
    this.car.spin(d / r + this.spin);
  }
}
const v0 = new Vector3();
