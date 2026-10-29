/**
 * Procedural MacBook-/iPhone-style models shared by the desk (gl-desk.ts), the project plinths
 * (gl-devices.ts) and the finale. Units: laptop lid width = 1. Anodised aluminium and titanium are PBR
 * materials lit by the PMREM room environment of whichever scene they sit in.
 */
import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  ShapeGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rrect, screenGeometry, shadowMaterial, shadowShaders } from './gl-kit';

/* Laptop proportions, in units of lid width (≈ a 14" notebook). */
export const BEZEL_SIDE = 0.022;
export const BEZEL_TOP = 0.03;
export const CHIN = 0.034;
export const LID_T = 0.011;
export const BASE_T = 0.024;
export const SCREEN_W = 1 - BEZEL_SIDE * 2;

/** Lid height for a screen of aspect `a` (height / width). */
export const lidHeight = (a: number) => a * SCREEN_W + BEZEL_TOP + CHIN;

/** Speaker grille: a fine dot lattice, drawn from UVs. */
const grilleFrag = /* glsl */ `
  uniform vec2 uCount;
  varying vec2 vUv;
  void main() {
    vec2 g = fract(vUv * uCount) - 0.5;
    float dotMask = 1.0 - smoothstep(0.18, 0.3, length(g));
    if (dotMask < 0.05) discard;
    gl_FragColor = vec4(vec3(0.02), dotMask * 0.9);
  }
`;

export type Laptop = {
  root: Group;
  lid: Group;
  base: Group;
  screenAnchor: Object3D;
  parts: Mesh[];
  aspect: number;
  depth: number;
  screen?: Material;
  shadow: ShaderMaterial;
  lite: boolean;
};

export type ModelKit = {
  /** A laptop whose screen (if given) is drawn with `screen`; `lite` drops keys, grilles, hinge, notch. */
  laptop(aspect: number, screen?: Material, lite?: boolean): Laptop;
  /** Rebuild the lid (and base depth) for a new screen aspect. */
  setAspect(l: Laptop, a: number): void;
  /** Phone group; `userData` holds `{ h, w, depth }`. */
  phone(screen: Material, lite?: boolean): Group;
  /** Contact shadow material (own instance, so its opacity can be dimmed). */
  shadow(opacity?: number, soft?: number): ShaderMaterial;
  disposeLaptop(l: Laptop): void;
  dispose(): void;
};

export function createModels(): ModelKit {
  const geos: BufferGeometry[] = [];
  const mats: Material[] = [];
  const keep = <T extends BufferGeometry>(g: T) => (geos.push(g), g);
  const mat = <T extends Material>(m: T) => (mats.push(m), m);

  const alu = mat(new MeshPhysicalMaterial({ color: '#7b7d83', metalness: 1, roughness: 0.4, envMapIntensity: 1.15 }));
  const aluInner = mat(new MeshPhysicalMaterial({ color: '#3a3b40', metalness: 0.9, roughness: 0.5 }));
  const glass = mat(new MeshPhysicalMaterial({ color: '#040405', metalness: 0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08 }));
  const keyMat = mat(new MeshPhysicalMaterial({ color: '#141416', metalness: 0.1, roughness: 0.62 }));
  const wellMat = mat(new MeshPhysicalMaterial({ color: '#1c1d20', metalness: 0.4, roughness: 0.7 }));
  const padMat = mat(new MeshPhysicalMaterial({ color: '#6c6e74', metalness: 1, roughness: 0.28, side: DoubleSide }));
  const titanium = mat(new MeshPhysicalMaterial({ color: '#9b968e', metalness: 1, roughness: 0.3, envMapIntensity: 1.2 }));
  const sheen = mat(
    new MeshPhysicalMaterial({ color: '#000000', metalness: 0, roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.1, depthWrite: false }),
  );
  const grilleMat = mat(
    new ShaderMaterial({ uniforms: { uCount: { value: [6, 60] } }, vertexShader: shadowShaders.vert, fragmentShader: grilleFrag, transparent: true, depthWrite: false }),
  );
  const keyGeo = keep(new RoundedBoxGeometry(1, 1, 1, 2, 0.18));
  const btnGeo = keep(new RoundedBoxGeometry(1, 1, 1, 2, 0.3));
  const hingeGeo = keep(new CylinderGeometry(0.008, 0.008, 0.78, 20));

  /** Aluminium slab, keyboard well, instanced keys, grilles, trackpad, hinge, soft shadow. */
  const buildBase = (depth: number, shadow: ShaderMaterial, lite: boolean) => {
    const g = new Group();
    const own: BufferGeometry[] = [];
    const k = <T extends BufferGeometry>(x: T) => (own.push(x), x);
    const slab = new Mesh(k(new RoundedBoxGeometry(1, BASE_T, depth, 3, 0.009)), alu);
    slab.position.set(0, -BASE_T / 2, depth / 2);
    g.add(slab);
    const top = 0.0004;
    const wellW = 0.8;
    const wellD = depth * 0.42;
    const wellZ = depth * 0.08 + wellD / 2;
    const well = new Mesh(k(new ShapeGeometry(rrect(wellW, wellD, 0.012), 4)), wellMat);
    well.rotation.x = -Math.PI / 2;
    well.position.set(0, top, wellZ);
    g.add(well);
    if (!lite) {
      // keys: function row + 5 rows, rounded caps
      const rows = [
        { n: 14, h: 0.55 },
        { n: 14, h: 1 },
        { n: 14, h: 1 },
        { n: 13, h: 1 },
        { n: 12, h: 1 },
        { n: 10, h: 1 },
      ];
      const pitchX = (wellW - 0.03) / 14;
      const fullD = (wellD - 0.03) / rows.reduce((s, r) => s + r.h, 0);
      const keys = new InstancedMesh(keyGeo, keyMat, rows.reduce((s, r) => s + r.n, 0));
      const m4 = new Matrix4();
      let n = 0;
      let z = wellZ - wellD / 2 + 0.015;
      rows.forEach((r, ri) => {
        const d = fullD * r.h;
        const wide = (wellW - 0.03) / r.n;
        for (let i = 0; i < r.n; i++) {
          const mid = Math.floor(r.n / 2);
          const w = ri === 5 ? (i === mid ? wide * 3.6 : wide * 0.72) : wide;
          const x = -wellW / 2 + 0.015 + (i + 0.5) * (r.n === 14 ? pitchX : (wellW - 0.03) / r.n);
          m4.makeScale(Math.min(w, pitchX * 3.6) - 0.007, 0.004, d - 0.007);
          m4.setPosition(x, top + 0.002, z + d / 2);
          keys.setMatrixAt(n++, m4);
        }
        z += d;
      });
      keys.count = n;
      g.add(keys);
      for (const side of [-1, 1]) {
        const grille = new Mesh(k(new PlaneGeometry(0.05, wellD * 0.96)), grilleMat);
        grille.rotation.x = -Math.PI / 2;
        grille.position.set(side * (wellW / 2 + 0.042), top + 0.0002, wellZ);
        g.add(grille);
      }
      const hinge = new Mesh(hingeGeo, aluInner);
      hinge.rotation.z = Math.PI / 2;
      hinge.position.set(0, -0.004, 0.006);
      g.add(hinge);
    }
    const pad = new Mesh(k(new ShapeGeometry(rrect(0.42, depth * 0.36, 0.012), 4)), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, top + 0.0003, depth * 0.72);
    g.add(pad);
    const sh = new Mesh(k(new PlaneGeometry(1.5, depth * 1.7)), shadow);
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(0, -BASE_T - 0.002, depth * 0.48);
    sh.renderOrder = -1;
    g.add(sh);
    g.userData.own = own;
    return g;
  };

  /** (Re)build the lid for a screen of aspect `a`: aluminium shell with a hole, bezel, notch, sheen. */
  const setAspect = (l: Laptop, a: number) => {
    if (Math.abs(a - l.aspect) < 0.004) return;
    l.aspect = a;
    l.parts.forEach((m) => {
      l.lid.remove(m);
      m.geometry.dispose();
    });
    l.parts = [];
    const S = SCREEN_W;
    const sh = a * S;
    const lh = sh + BEZEL_TOP + CHIN;
    const cy = CHIN + sh / 2;
    const add = (geo: BufferGeometry, m: Material, z: number, y = 0) => {
      const mesh = new Mesh(geo, m);
      mesh.position.set(0, y, z);
      l.lid.add(mesh);
      l.parts.push(mesh);
      return mesh;
    };
    const ring = rrect(1, lh, 0.03);
    const holeY = cy - lh / 2;
    ring.holes.push(rrect(S + 0.004, sh + 0.004, 0.012, holeY));
    const shell = new ExtrudeGeometry(ring, {
      depth: LID_T - 0.004,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: l.lite ? 1 : 3,
      curveSegments: l.lite ? 5 : 10,
    });
    shell.translate(0, lh / 2, -LID_T + 0.002);
    add(shell, alu, 0);
    const back = new ShapeGeometry(rrect(1, lh, 0.03), 10);
    back.rotateY(Math.PI);
    back.translate(0, lh / 2, -LID_T);
    add(back, alu, 0);
    const bezelShape = rrect(1 - 0.006, lh - 0.006, 0.027);
    bezelShape.holes.push(rrect(S, sh, 0.011, holeY));
    const bezel = new ShapeGeometry(bezelShape, 10);
    bezel.translate(0, lh / 2, 0);
    add(bezel, glass, 0.0022);
    if (!l.lite) {
      // camera lens in the top bezel; nothing ever covers the screen (no notch over the address bar)
      const lens = new ShapeGeometry(rrect(0.007, 0.007, 0.0035), 6);
      lens.translate(0, cy + sh / 2 + BEZEL_TOP / 2, 0);
      add(lens, keyMat, 0.0024);
      add(screenGeometry(S, sh, 0.011), sheen, 0.0026, cy);
    }
    if (l.screen) add(screenGeometry(S, sh, 0.011), l.screen, 0.0005, cy);
    l.screenAnchor.position.set(0, cy, 0.0005);
    const depth = lh * 0.97;
    if (Math.abs(depth - l.depth) > 0.004) {
      l.root.remove(l.base);
      (l.base.userData.own as BufferGeometry[] | undefined)?.forEach((g) => g.dispose());
      l.base = buildBase(depth, l.shadow, l.lite);
      l.root.add(l.base);
      l.depth = depth;
    }
  };

  const laptop = (aspect: number, screen?: Material, lite = false): Laptop => {
    const root = new Group();
    const lid = new Group();
    const screenAnchor = new Object3D();
    lid.add(screenAnchor);
    root.add(lid);
    const shadow = mat(shadowMaterial(0.55, 0.9));
    const l: Laptop = { root, lid, base: new Group(), screenAnchor, parts: [], aspect: 0, depth: 0, screen, shadow, lite };
    setAspect(l, aspect);
    return l;
  };

  /** iPhone-style phone (height 0.56 lid widths): titanium frame, black glass, Dynamic Island, screen. */
  const phone = (screen: Material, lite = false) => {
    const g = new Group();
    const h = 0.56;
    const w = h * 0.4877;
    const depth = h * 0.0563;
    const r = w * 0.17;
    const bevel = depth * 0.22;
    const body = new ExtrudeGeometry(rrect(w - bevel * 2, h - bevel * 2, r - bevel), {
      depth: depth - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: lite ? 2 : 4,
      curveSegments: lite ? 8 : 16,
    });
    body.translate(0, 0, -depth / 2 + bevel);
    g.add(new Mesh(keep(body), titanium));
    const front = depth / 2 + 0.0004;
    const glassFace = new Mesh(keep(new ShapeGeometry(rrect(w - 0.006, h - 0.006, r - 0.003), 16)), glass);
    glassFace.position.z = front;
    g.add(glassFace);
    const b = h * 0.022;
    const scr = new Mesh(keep(screenGeometry(w - b * 2, h - b * 2, r - b)), screen);
    scr.position.z = front + 0.0003;
    g.add(scr);
    const island = new Mesh(keep(new ShapeGeometry(rrect(w * 0.3, w * 0.085, w * 0.0425), 8)), glass);
    island.position.set(0, h / 2 - b - w * 0.075, front + 0.0006);
    g.add(island);
    if (!lite) {
      const shine = new Mesh(keep(screenGeometry(w - b * 2, h - b * 2, r - b)), sheen);
      shine.position.z = front + 0.0008;
      g.add(shine);
      const buttons: [number, number, number][] = [
        [-1, 0.27, 0.035],
        [-1, 0.17, 0.06],
        [-1, 0.07, 0.06],
        [1, 0.15, 0.1],
      ];
      for (const [side, y, len] of buttons) {
        const btn = new Mesh(btnGeo, titanium);
        btn.scale.set(0.004, len * h * 0.5, depth * 0.4);
        btn.position.set(side * (w / 2 + 0.001), y * h, 0);
        g.add(btn);
      }
    }
    g.userData = { h, w, depth };
    return g;
  };

  return {
    laptop,
    setAspect,
    phone,
    /** Contact shadow for a standing phone (separate material so its opacity can be dimmed). */
    shadow: (opacity = 0.5, soft = 0.9) => mat(shadowMaterial(opacity, soft)),
    disposeLaptop(l: Laptop) {
      l.parts.forEach((m) => m.geometry.dispose());
      (l.base.userData.own as BufferGeometry[] | undefined)?.forEach((g) => g.dispose());
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}
