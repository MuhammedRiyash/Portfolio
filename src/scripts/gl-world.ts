/**
 * "A Day in the Stack" — the world drawn behind <main> by the shared renderer (gl-scene.ts).
 *
 * One scene: the desk (gl-desk.ts) floats above a cut-away, dollhouse-style building (gl-city.ts) whose floors are
 * the product stack. The camera director turns scroll into a path through the day:
 *   09:00 hero   — a 3/4 view of the desk from a little above; agents hover by the laptop, code types, coffee steams
 *   11:00 stack  — pull back and up; code blocks leave the screen and drop into the building
 *         floors — descend the cut face floor by floor (shop → API → ledger → vault → CI), tags with leader lines
 *         whole  — the full cross-section
 *   23:30 flood  — back at the desk at night: agents docked in the cradle, terminal says `deployed ✓`, city lights
 *                  in the window, a small deploy rocket lifts off the desk and out of frame before the footer floods
 *
 * Lighting is a three-point rig per act (warm key, cool fill, rim to separate silhouettes from the dark page) plus a
 * hemisphere ambient and a soft backdrop light pool; exposure, colours and directions are keyed to the clock
 * (`RIG`). The PMREM room environment stays for reflections. Theme tokens set the ground and the accent;
 * `theme()` re-colours in place, nothing is rebuilt.
 */
import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Scene,
  Vector2,
  Vector3,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CarRig, type CarKind, type Garage } from './gl-cars';
import { createCity, LAYER_Y } from './gl-city';
import { createDesk } from './gl-desk';
import { clamp, createBackdrop, ease, GlowField, lerp, MatBook, shadowMaterial, smooth, type Palette } from './gl-kit';
import type { ModelKit } from './gl-models';
import { LAYERS, stackPhase } from './stack-map';

export type WorldState = {
  /** hero scrolled away, 0…1 */
  hero: number;
  /** stack section progress, 0…1 (see stack-map.ts) */
  stack: number;
  /** flood (finale) progress, 0…1; > 0 switches to the night desk */
  flood: number;
  /** night only: fraction of the viewport (from the top) hidden above the flood stage */
  viewTop?: number;
  /** clock hour (9 … 23.5) */
  hour: number;
};

export type Hit = { kind: 'agent' | 'car'; i: number };

export type LayerTag = { x: number; y: number; px: number; py: number; o: number; on: number };

export type World = {
  scene: Scene;
  camera: PerspectiveCamera;
  /** tone-mapping exposure for this frame (the renderer applies it) */
  exposure: number;
  resize(width: number, height: number): void;
  setPointer(x: number, y: number): void;
  update(dt: number, s: WorldState): void;
  theme(p: Palette): void;
  /** CSS-px hit test against agents and desk cars */
  pick(x: number, y: number): Hit | null;
  hover(hit: Hit | null): void;
  click(hit: Hit): void;
  /** CSS-px positions of the five floor tags (label point, prop point for the leader line, visibility, active) and the hovered agent */
  tags(): { layers: LayerTag[]; agent: { x: number; y: number; text: string } | null };
  dispose(): void;
};

const DESK = new Vector3(0, 2.05, -0.25);

type Pose = { eye: Vector3; look: Vector3 };
const pose = (ex: number, ey: number, ez: number, lx: number, ly: number, lz: number): Pose => ({ eye: new Vector3(ex, ey, ez), look: new Vector3(lx, ly, lz) });

/*
 * Light rig by hour. Directions point FROM the light towards the scene (normalised in applyRig).
 * [hour, key colour, key, fill colour, fill, rim colour, rim, sky, hemi, env, exposure, pool colour, pool]
 */
type Rig = [number, string, number, string, number, string, number, string, number, number, number, string, number];
const RIG: Rig[] = [
  [9, '#ffd9ad', 2.5, '#bcd0ff', 0.75, '#fff0d6', 2.4, '#e6ecff', 0.62, 0.62, 1.0, '#f2cf9e', 0.1],
  [13, '#fff1de', 2.1, '#cddbff', 0.65, '#ffffff', 1.8, '#eef2ff', 0.45, 0.45, 0.95, '#e4dccd', 0.08],
  [17.5, '#ffc58e', 1.9, '#9aa6ff', 0.6, '#ffb27a', 2.0, '#c7b4cf', 0.5, 0.5, 0.98, '#ffb27a', 0.1],
  [20.5, '#ff9e5e', 1.3, '#7a86ff', 0.5, '#ff9a5c', 1.9, '#7d6fa8', 0.4, 0.4, 1.0, '#ff9a5c', 0.12],
  [23.5, '#7f95ff', 0.35, '#4d5cb0', 0.22, '#7f97ff', 2.2, '#26306a', 0.28, 0.26, 0.98, '#3d55d6', 0.18],
];
/* key from the upper left (the sun through a window, then the low evening sun), fill from the camera side, rim from behind */
const KEY_AM = new Vector3(-0.55, 0.72, 0.42);
const KEY_PM = new Vector3(-0.85, 0.35, 0.4);
const KEY_NIGHT = new Vector3(-0.2, 0.5, -0.85);
const FILL = new Vector3(0.75, 0.3, 0.6);
const RIM = new Vector3(0.3, 0.55, -1);

export function createWorld(kit: ModelKit, garage: Garage, env: Texture, mobile: boolean): World {
  const scene = new Scene();
  scene.environment = env;
  scene.fog = new Fog('#000', 10, 28);
  const camera = new PerspectiveCamera(34, 1, 0.05, 60);
  const mats = new MatBook();
  const glow = new GlowField(mobile ? 80 : 128);
  scene.add(glow.mesh);
  const backdrop = createBackdrop();
  scene.add(backdrop.mesh);
  let pal: Palette | null = null;

  /* lights: hemisphere ambient + key / fill / rim directionals + the monitor (night key) */
  const hemi = new HemisphereLight('#e8eeff', '#2a2420', 1);
  const key = new DirectionalLight('#ffffff', 3);
  const fill = new DirectionalLight('#bfd2ff', 1);
  const rim = new DirectionalLight('#ffffff', 2);
  const monitor = new PointLight('#cfe0ff', 0, 2.4, 1.4);
  scene.add(hemi, key, key.target, fill, fill.target, rim, rim.target, monitor);

  /* desk + city */
  const desk = createDesk(kit, mats, glow, mobile);
  desk.group.position.copy(DESK);
  scene.add(desk.group);
  const city = createCity(mats, glow, mobile);
  scene.add(city.group);
  // the rocket is drawn on its own: on its pad in the basement by day, lifting off the desk corner at night
  scene.add(city.rocket);
  // soft shadow under the floating desk, on nothing: a faint halo that grounds it in the dark
  const deskShadow = new InstancedMesh(new PlaneGeometry(1, 1), shadowMaterial(0.35, 0.9), 1);
  deskShadow.setMatrixAt(0, new Matrix4().compose(new Vector3(DESK.x, DESK.y - 0.12, DESK.z), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2), new Vector3(2.2, 1.4, 1)));
  scene.add(deskShadow);

  /* die-cast cars on the desk, in front of the laptop: a muscle car rolling in, a JDM coupe on a short orange track */
  const carDefs: [CarKind, number, number, number, number][] = mobile
    ? [['muscle', 0, 0.28, 0.36, 2.9]]
    : [
        ['muscle', 0, 0.3, 0.36, 2.9],
        ['jdm', 1, -0.28, 0.4, 0.1],
      ];
  const rigs = carDefs.map(([kind, hue, x, z, heading]) => {
    const rig = new CarRig(garage.make(kind, hue));
    rig.place(new Vector3(x, 0.006 + (kind === 'jdm' ? 0.006 : 0), z), heading, 0.09);
    rig.roll = 0.6;
    desk.group.add(rig.car.root);
    return rig;
  });
  if (!mobile) {
    const track = new InstancedMesh(new RoundedBoxGeometry(0.32, 0.006, 0.05, 2, 0.002), mats.satin((_p, c) => c.set('#ff7a1a'), { roughness: 0.4 }), 1);
    track.setMatrixAt(0, new Matrix4().compose(new Vector3(-0.2, 0.006, 0.405), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.1), new Vector3(1, 1, 1)));
    desk.group.add(track);
  }
  const carShadowMat = shadowMaterial(0.5, 0.8);
  const carShadows = new InstancedMesh(new PlaneGeometry(1, 1), carShadowMat, rigs.length);
  desk.group.add(carShadows);

  /* code drops: glowing blocks that leave the laptop screen and fall into the building while pulled back */
  const dropN = mobile ? 8 : 18;
  const dropMat = mats.flat((p, c) => c.copy(p.signal));
  const drops = new InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 1, 0.2), dropMat, dropN);
  drops.frustumCulled = false;
  scene.add(drops);
  const dropTargets = Array.from({ length: dropN }, (_, i) => new Vector3(-1.2 + ((i * 7) % dropN) * (2.4 / dropN), LAYER_Y[Math.min(LAYERS - 1, i % LAYERS)] - 0.2, 0.2 + (i % 3) * 0.12));
  const dropGlow = glow.alloc(dropN);

  /* night: the rocket exhaust */
  const exhaustN = mobile ? 5 : 9;
  const exhaustGlow = glow.alloc(exhaustN);
  const ROCKET_PAD = new Vector3(DESK.x - 0.66, DESK.y + 0.006, DESK.z - 0.34);

  /* camera poses (world space) */
  const P = {
    hero: pose(DESK.x + 0.88, DESK.y + 1.16, DESK.z + 2.42, DESK.x + 0.1, DESK.y + 0.06, DESK.z - 0.04),
    pull: pose(2.8, 3.0, 7.4, 0.1, 0.4, 0),
    whole: pose(3.2, -0.55, 8.9, 0.05, -1.12, 0),
    night: pose(DESK.x - 0.95, DESK.y + 0.7, DESK.z + 1.85, DESK.x + 0.06, DESK.y + 0.12, DESK.z - 0.1),
  };
  const layerPose = (i: number) => pose(1.85, LAYER_Y[i] + 0.55, 5.0, 0.32, LAYER_Y[i] - 0.04, 0.05);
  const layerPoses = LAYER_Y.map((_, i) => layerPose(i));

  /* responsive framing: the subject moves out from under the copy */
  let W = 1;
  let H = 1;
  let aspect = 1;
  const frame = { heroX: 0, heroY: 0, stackX: 0, stackY: 0, dist: 1, nightDist: 1 };
  const layout = () => {
    aspect = W / H;
    if (aspect < 0.8) {
      camera.fov = 50;
      Object.assign(frame, { heroX: 0, heroY: 0.18, stackX: 0, stackY: 0.04, dist: 1.28, nightDist: 1.5 });
    } else if (aspect < 1.25) {
      camera.fov = 42;
      Object.assign(frame, { heroX: 0.08, heroY: 0.08, stackX: 0.12, stackY: 0.02, dist: 1.12, nightDist: 1.2 });
    } else {
      camera.fov = 32;
      Object.assign(frame, { heroX: 0.19, heroY: 0.01, stackX: 0.22, stackY: 0, dist: 1, nightDist: 1 });
    }
  };

  const eye = new Vector3();
  const look = new Vector3();
  const tmp = new Vector3();
  const tmp2 = new Vector3();
  const lean = new Vector2();
  const leanTarget = new Vector2();
  const lerpPose = (a: Pose, b: Pose, t: number) => {
    eye.copy(a.eye).lerp(b.eye, t);
    look.copy(a.look).lerp(b.look, t);
  };
  const scaleFrom = (dist: number) => {
    // pull the eye back along the view line on narrow screens
    tmp.copy(eye).sub(look).multiplyScalar(dist);
    eye.copy(look).add(tmp);
  };

  let time = 0;
  let flowK = 0;
  let nightMode = false;
  let labels = 0;
  let activeLayer = 0;
  const m4 = new Matrix4();
  const q = new Quaternion();
  const sv = new Vector3();
  const yAxis = new Vector3(0, 1, 0);
  const flatQ = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
  const cA = new Color();
  const cB = new Color();
  const dir = new Vector3();

  const world: World = {} as World;
  world.exposure = 1;

  const mixHex = (out: Color, a: string, b: string, t: number) => out.copy(cA.set(a).lerp(cB.set(b), t));
  const applyRig = (hour: number) => {
    let i = 0;
    while (i < RIG.length - 2 && hour > RIG[i + 1][0]) i++;
    const a = RIG[i];
    const b = RIG[i + 1];
    const t = clamp((hour - a[0]) / (b[0] - a[0]));
    mixHex(key.color, a[1], b[1], t);
    key.intensity = lerp(a[2], b[2], t);
    mixHex(fill.color, a[3], b[3], t);
    fill.intensity = lerp(a[4], b[4], t);
    mixHex(rim.color, a[5], b[5], t);
    rim.intensity = lerp(a[6], b[6], t);
    mixHex(hemi.color, a[7], b[7], t);
    hemi.intensity = lerp(a[8], b[8], t);
    scene.environmentIntensity = lerp(a[9], b[9], t);
    world.exposure = lerp(a[10], b[10], t);
    mixHex(backdrop.u.uGlow.value, a[11], b[11], t);
    backdrop.u.uStrength.value = lerp(a[12], b[12], t);
    if (pal) {
      // the theme tints the ambient a little: navy for Midnight, green for Forest
      hemi.color.lerp(pal.signal, 0.06);
      hemi.groundColor.copy(pal.bg).lerp(cA.set('#3a2c22'), 0.5);
      backdrop.u.uGlow.value.lerp(pal.bg, 0.15);
    }
    // key swings from the morning window to the low evening sun, then the window light from behind at night
    const k = smooth(9, 20.5, hour);
    dir.copy(KEY_AM).lerp(KEY_PM, k).lerp(KEY_NIGHT, smooth(20.5, 23.5, hour)).normalize();
    key.position.copy(dir).multiplyScalar(10);
    fill.position.copy(FILL).normalize().multiplyScalar(10);
    rim.position.copy(RIM).normalize().multiplyScalar(10);
  };

  const update = (dt: number, st: WorldState) => {
    time += dt;
    const ph = stackPhase(st.stack);
    nightMode = st.flood > 0;
    const night = nightMode ? 1 : smooth(17, 21.5, st.hour);
    applyRig(nightMode ? 23.5 : st.hour);

    /* camera */
    lean.x += (leanTarget.x - lean.x) * (1 - Math.exp(-dt * 3));
    lean.y += (leanTarget.y - lean.y) * (1 - Math.exp(-dt * 3));
    let offX: number;
    let offY: number;
    if (nightMode) {
      eye.copy(P.night.eye);
      look.copy(P.night.look);
      eye.y += st.flood * 0.12;
      offX = frame.heroX * 0.15;
      // centre the desk in the part of the flood stage that is on screen
      offY = -(st.viewTop ?? 0) / 2;
      scaleFrom(frame.nightDist);
    } else {
      lerpPose(P.hero, P.pull, ph.pull);
      if (ph.active > 0 || ph.pull > 0.99) {
        const i0 = Math.floor(ph.active);
        const i1 = Math.min(LAYERS - 1, i0 + 1);
        const f = ease(ph.active - i0);
        const enter = smooth(0.3, 0.42, st.stack);
        tmp.copy(layerPoses[i0].eye).lerp(layerPoses[i1].eye, f);
        tmp2.copy(layerPoses[i0].look).lerp(layerPoses[i1].look, f);
        eye.lerp(tmp, enter);
        look.lerp(tmp2, enter);
      }
      if (ph.assemble > 0) {
        eye.lerp(P.whole.eye, ph.assemble);
        look.lerp(P.whole.look, ph.assemble);
      }
      const s = ph.pull;
      offX = lerp(frame.heroX, frame.stackX, s);
      offY = lerp(frame.heroY, frame.stackY, s);
      scaleFrom(frame.dist);
    }
    eye.x += lean.x * 0.12;
    eye.y += lean.y * 0.06;
    camera.position.copy(eye);
    camera.lookAt(look);
    camera.setViewOffset(W, H, -offX * W, offY * H, W, H);
    camera.updateMatrixWorld();

    /* backdrop light pool sits behind whatever the camera looks at */
    tmp.copy(look).project(camera);
    backdrop.u.uCenter.value.set(tmp.x, tmp.y);
    backdrop.u.uRadius.value.set(aspect < 0.8 ? 1.1 : 0.7, aspect < 0.8 ? 0.7 : 1.0);

    /* desk + cars */
    desk.update(dt, time, { night, active: ph.pull < 0.98 || nightMode, eye });
    const deskVisible = nightMode || ph.assemble < 1;
    desk.group.visible = deskVisible;
    rigs.forEach((r, i) => {
      r.update(nightMode ? 1 : 1 - st.hero * 0.9, dt);
      const c = r.car.root.position;
      q.setFromAxisAngle(yAxis, r.car.root.rotation.y).multiply(flatQ);
      m4.compose(tmp.set(c.x, 0.0065, c.z), q, sv.set(0.12, 0.065, 1));
      carShadows.setMatrixAt(i, m4);
    });
    carShadows.instanceMatrix.needsUpdate = true;

    /* city: lit interiors come up as the camera arrives; hidden at night (the desk owns the frame) */
    city.update(dt, time, { night, settle: nightMode ? 1 : clamp(0.25 + st.stack * 1.1 + time * 0.004), focus: nightMode ? -1 : ph.active, lit: nightMode ? 0 : smooth(0.05, 0.3, st.stack) });
    // hidden at the desk (its rooftop would peek in under the hero desk) and at night
    city.group.visible = !nightMode && st.stack > 0.015;

    /* code drops: only while pulled back, a stream from the screen into the building */
    const flow = nightMode ? 0 : ph.pull * (1 - ph.assemble);
    flowK += (flow - flowK) * (1 - Math.exp(-dt * 6));
    desk.screenWorld(tmp2);
    for (let i = 0; i < dropN; i++) {
      const life = (time * 0.28 + i / dropN) % 1;
      const k = ease(life);
      tmp.copy(tmp2).lerp(dropTargets[i], k);
      tmp.y += Math.sin(Math.PI * life) * 0.6;
      const a = flowK > 0.02 ? flowK * Math.sin(Math.PI * Math.min(1, life * 1.15)) : 0;
      const sz = 0.012 + (i % 3) * 0.004 + flowK * 0.02;
      q.setFromAxisAngle(sv.set(0.3, 1, 0.2).normalize(), time * (1 + (i % 4)) + i);
      m4.compose(tmp, q, sv.set(sz * 2.2, sz * 0.6, sz).multiplyScalar(a > 0.01 ? 1 : 0.0001));
      drops.setMatrixAt(i, m4);
      if (pal) glow.set(dropGlow + i, tmp, sz * 9, pal.signal, a * 0.7);
    }
    drops.instanceMatrix.needsUpdate = true;

    /* night: monitor glow is the key light; the deploy rocket lifts off the desk corner and leaves the frame */
    desk.screenWorld(tmp);
    monitor.position.copy(tmp).add(sv.set(0, 0.04, 0.16));
    monitor.intensity = night * 2.6;
    const rk = nightMode ? ease(clamp((st.flood - 0.06) * 2.0)) : 0;
    if (nightMode) {
      city.rocket.position.set(ROCKET_PAD.x, ROCKET_PAD.y + rk * rk * 2.4, ROCKET_PAD.z);
      city.rocket.scale.setScalar(0.5);
    } else {
      city.rocket.position.copy(city.rocketHome);
      city.rocket.scale.setScalar(1);
    }
    city.rocket.updateMatrixWorld();
    // exhaust: a faint idle glow on the pad, a trail once it lifts
    for (let i = 0; i < exhaustN; i++) {
      const u = (time * 2.2 + i / exhaustN) % 1;
      tmp.copy(city.rocket.position);
      tmp.y -= 0.01 + u * (0.05 + rk * 0.35);
      tmp.x += Math.sin(i * 3.1 + time * 7) * 0.006 * (1 + u * 3);
      const on = nightMode ? (rk > 0.001 ? 1 : 0.25) : 0;
      if (pal) glow.set(exhaustGlow + i, tmp, (0.05 + u * 0.1) * (0.6 + rk), i % 3 ? pal.signal : cA.set('#ffd28a'), on * (1 - u) * 0.9);
    }

    labels = nightMode ? 0 : ph.labels;
    activeLayer = ph.active;
    glow.flush();
  };

  const project = (v: Vector3) => {
    v.project(camera);
    return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H, z: v.z };
  };

  let hovered: Hit | null = null;

  Object.assign(world, {
    scene,
    camera,
    resize(width: number, height: number) {
      W = width;
      H = height;
      camera.aspect = W / H;
      layout();
      camera.updateProjectionMatrix();
    },
    setPointer(x: number, y: number) {
      leanTarget.set(x, y);
    },
    update,
    theme(p: Palette) {
      pal = p;
      (scene.fog as Fog).color.copy(p.bg);
      backdrop.u.uBg.value.copy(p.bg);
      mats.theme(p);
      desk.theme(p);
      city.theme(p);
    },
    pick(x: number, y: number) {
      if (nightMode || !desk.group.visible) return null;
      let best: Hit | null = null;
      let bestD = Infinity;
      desk.agents.forEach((a, i) => {
        if (a.job >= 0) return;
        tmp.copy(a.pos);
        desk.group.localToWorld(tmp);
        tmp2.copy(tmp).add(sv.set(0, 0.06, 0));
        const p0 = project(tmp);
        const r = Math.max(14, Math.abs(project(tmp2).y - p0.y) * 1.2);
        const d = Math.hypot(p0.x - x, p0.y - y);
        if (d < r && d < bestD) {
          bestD = d;
          best = { kind: 'agent', i };
        }
      });
      rigs.forEach((r, i) => {
        r.centre(tmp);
        desk.group.localToWorld(tmp);
        const p0 = project(tmp);
        const d = Math.hypot(p0.x - x, p0.y - y);
        if (d < 26 && d < bestD) {
          bestD = d;
          best = { kind: 'car', i };
        }
      });
      return best;
    },
    hover(hit: Hit | null) {
      hovered = hit;
      desk.hoverAgent(hit?.kind === 'agent' ? hit.i : -1);
      rigs.forEach((r, i) => r.setHover(hit?.kind === 'car' && hit.i === i));
    },
    click(hit: Hit) {
      if (hit.kind === 'agent') desk.sendAgent(hit.i);
      else rigs[hit.i]?.kick();
    },
    tags() {
      const layers = city.tagAnchors.map((a, i) => {
        tmp.copy(a);
        city.group.localToWorld(tmp);
        const p = project(tmp);
        tmp.copy(city.propAnchors[i]);
        city.group.localToWorld(tmp);
        const pp = project(tmp);
        const on = clamp(1 - Math.abs(activeLayer - i));
        return { x: p.x, y: p.y, px: pp.x, py: pp.y, o: labels * (0.35 + on * 0.65) * (p.z < 1 ? 1 : 0), on };
      });
      let agent: { x: number; y: number; text: string } | null = null;
      if (hovered?.kind === 'agent' && !nightMode) {
        const a = desk.agents[hovered.i];
        tmp.copy(a.pos).add(sv.set(0, 0.11, 0));
        desk.group.localToWorld(tmp);
        const p = project(tmp);
        agent = { x: p.x, y: p.y, text: a.task };
      }
      return { layers, agent };
    },
    dispose() {
      desk.dispose();
      city.dispose();
      glow.dispose();
      mats.dispose();
      backdrop.dispose();
      drops.geometry.dispose();
      deskShadow.geometry.dispose();
      carShadows.geometry.dispose();
      carShadowMat.dispose();
    },
  });
  return world;
}
