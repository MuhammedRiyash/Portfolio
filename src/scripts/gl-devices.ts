/**
 * Act 3 — the work. Each chapter gets a MacBook-style laptop and an iPhone-style phone (gl-models.ts) on its own
 * table — a bevelled wood slab with a project-coloured desk mat, themed miniature props and die-cast cars
 * (gl-props.ts, gl-cars.ts) — drawn by the shared renderer with the canvas lifted above <main>
 * (html.gl-top, transparent clear) — see gl-scene.ts.
 *
 * - Screens: one 16:10 desktop image (1440×900) on the laptop and the matching phone image (390×844 @2x),
 *   both from the chapter's `data-tex-desktop` / `data-tex-phone` (Work.astro), loaded when the chapter nears.
 * - Layout: the phone stands beside the laptop base with a clear gap; props and cars sit around them. Checked
 *   at build time with bounding boxes — a console warning fires if anything intersects a device or another prop.
 * - Props drop / slide / unfold into place as the chapter enters (scrubbed, reversible, staggered); one prop per
 *   table runs a tiny idle loop when motion is allowed. Hover = lift + label tag (DOM, mirrored for screen
 *   readers by the sr-only list in Work.astro); click = hop. Cars: hover revs, click zooms off the table.
 * - Framing: the camera works in CSS pixels (1 unit = 1 px at z = 0). The composition's bounding points are
 *   projected through the real camera and the scale/position are solved so it fits a safe frame inside the
 *   chapter's media column (pinned: also inside the viewport), at any width.
 * - Pinned (≥ 1024×700): each device is scissored to the visible part of its sticky stage so the chapter wipes
 *   cut 3D and DOM together. Lite (unpinned, < 1024 or short viewports): the table scrolls with its media
 *   column, lite laptop/phone, two props and one car per table.
 */
import {
  Box3,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  Matrix4,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Vector3,
  InstancedMesh,
  type Object3D,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { CarRig, type Garage } from './gl-cars';
import { clamp, DEG, ease, MatBook, type Palette } from './gl-kit';
import { BASE_T, lidHeight, type Laptop, type ModelKit } from './gl-models';
import { createPropKit, PROP_SCALE, TABLES, type PropTable } from './gl-props';

/** Laptop screen aspect (height / width): every desktop image is 1440×900. */
const SCREEN_ASPECT = 0.625;
/** Phone height as a fraction of the laptop width. */
const PHONE_H = 0.34;
/** Clear gap between the laptop base and the phone, in laptop widths. */
const GAP = 0.07;
/** Die-cast car length in laptop widths (1:64 next to a 14" notebook). */
const CAR_L = 0.2;

type Device = {
  chapter: HTMLElement;
  stage: HTMLElement;
  media: HTMLElement;
  root: Group;
  laptop: Laptop;
  phone: Group;
  phoneScale: number;
  /** bounding points (root space) used for framing */
  hull: Vector3[];
  screenMat: MeshBasicMaterial;
  phoneMat: MeshBasicMaterial;
  phoneShadow: ShaderMaterial;
  table: PropTable;
  cars: CarRig[];
  /** entry progress of the chapter, 0…1 (opens the lid, slides the phone in, rolls the cars) */
  entry: number;
  /** reveal progress of the props, 0…1 */
  reveal: number;
  /** screen textures requested */
  loaded: boolean;
};

export type Devices = {
  /** built for unpinned chapters (lite tables) */
  lite: boolean;
  /** CSS-px pointer over the canvas: hover the toy car or prop under it; returns whether one is hovered */
  pointer(x: number, y: number): boolean;
  /** CSS-px click: the car under it zooms off the table, a prop hops; returns whether one was hit */
  click(x: number, y: number): boolean;
  /** Place and draw every visible device. Returns whether any device is on screen. */
  render(width: number, height: number): boolean;
  theme(p: Palette): void;
  dispose(): void;
};

/** Cover-fit a texture onto a screen of aspect `screenA` (height / width), top-aligned. */
function cover(t: Texture, screenA: number) {
  const img = t.image as { width: number; height: number };
  const imgA = img.height / img.width;
  if (screenA > imgA) {
    t.repeat.set(imgA / screenA, 1);
    t.offset.set((1 - imgA / screenA) / 2, 0);
  } else {
    t.repeat.set(1, screenA / imgA);
    t.offset.set(0, 1 - screenA / imgA);
  }
}

/** Box of the solid parts of `obj` in world space (skips contact shadows, grilles and other shader overlays). */
function solidBox(obj: Object3D, out: Box3) {
  out.makeEmpty();
  const tmp = new Box3();
  obj.updateWorldMatrix(true, true);
  obj.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || m.material instanceof ShaderMaterial) return;
    if (m instanceof InstancedMesh) {
      m.computeBoundingBox();
      tmp.copy(m.boundingBox!);
    } else {
      m.geometry.computeBoundingBox();
      tmp.copy(m.geometry.boundingBox!);
    }
    out.union(tmp.applyMatrix4(m.matrixWorld));
  });
  return out;
}

export function createDevices(renderer: WebGLRenderer, chapters: HTMLElement[], kit: ModelKit, garage: Garage, env: Texture, lite: boolean): Devices {
  const scene = new Scene();
  scene.environment = env;
  // a soft warm key from the upper left gives the props and the wood their form (the room env does the rest)
  const key = new DirectionalLight('#fff0dc', 1.1);
  key.position.set(-0.55, 1, 0.7);
  scene.add(key);
  const camera = new PerspectiveCamera(30, 1, 10, 20000);
  const mats = new MatBook();
  const props = createPropKit();
  const shadowGeo = new PlaneGeometry(1, 1);

  const loader = new TextureLoader();
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const textures: Texture[] = [];
  const load = (url: string | undefined, m: MeshBasicMaterial, screenA: number) => {
    if (!url) return;
    loader.load(url, (tex) => {
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = anisotropy;
      cover(tex, screenA);
      textures.push(tex);
      m.map = tex;
      m.color.set('#ffffff');
      m.needsUpdate = true;
    });
  };

  /* DOM tag for the hovered prop (positioned per frame; the sr-only list in Work.astro carries the same labels) */
  const tagLayer = document.createElement('div');
  tagLayer.className = 'gl-prop-tags';
  tagLayer.setAttribute('aria-hidden', 'true');
  const tag = document.createElement('span');
  tag.className = 'gl-tag gl-tag--prop';
  tagLayer.append(tag);
  document.body.append(tagLayer);

  const devices: Device[] = [];
  const box = new Box3();
  const box2 = new Box3();
  const carBox = new Box3();
  for (const chapter of chapters) {
    const stage = chapter.querySelector<HTMLElement>('[data-ch-stage]');
    const media = chapter.querySelector<HTMLElement>('[data-ch-media]');
    if (!stage || !media) continue;
    const root = new Group();
    root.visible = false;
    scene.add(root);

    // screens: opaque, depth-writing, nudged forward so they never fight the glass
    const screenMat = mats.add(new MeshBasicMaterial({ color: '#050506', toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    const phoneMat = mats.add(new MeshBasicMaterial({ color: '#050506', toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    const laptop = kit.laptop(SCREEN_ASPECT, screenMat, lite);
    laptop.lid.rotation.x = -14 * DEG;
    root.add(laptop.root);

    const phone = kit.phone(phoneMat, lite);
    const ph = phone.userData as { h: number; w: number; depth: number };
    const phoneScale = PHONE_H / ph.h;
    phone.scale.setScalar(phoneScale);
    root.add(phone);
    const phoneShadow = kit.shadow(0.5, 0.85);
    const pShadow = new Mesh(shadowGeo, phoneShadow);
    pShadow.rotation.x = -Math.PI / 2;
    pShadow.renderOrder = -1;
    root.add(pShadow);

    // the project's table: wood + desk mat + props; 1–2 die-cast cars (one on lite tables)
    const ids = Object.keys(TABLES);
    const id = TABLES[chapter.id] ? chapter.id : ids[devices.length % ids.length];
    const carDefs = TABLES[id].cars.slice(0, lite ? 1 : 2);
    // right edge: past the phone (its turned footprint) with room for a prop
    const phoneW = (ph.w * Math.cos(0.32) + ph.depth * Math.sin(0.32)) * phoneScale;
    const right = 0.5 + GAP + phoneW + 0.16;
    const ext = { left: -0.94, right, back: -0.21, front: 1.16, mat: [-0.6, right - 0.08, -0.09, laptop.depth + 0.17] as [number, number, number, number], top: -BASE_T };
    const table = props.table(id, ext, lite, carDefs.length);
    root.add(table.group);
    const cars = carDefs.map(([kind, hue]) => {
      const rig = new CarRig(garage.make(kind, hue));
      root.add(rig.car.root);
      return rig;
    });

    const d: Device = { chapter, stage, media, root, laptop, phone, phoneScale, hull: [], screenMat, phoneMat, phoneShadow, table, cars, entry: 0, reveal: 0, loaded: false };
    layout(d, pShadow, carDefs, right);
    devices.push(d);
  }

  /** Rest pose: phone beside the base's right edge, cars + props around; hull + overlap checks. */
  function layout(d: Device, pShadow: Mesh, carDefs: (typeof TABLES)[string]['cars'], right: number) {
    const { h, w, depth } = d.phone.userData as { h: number; w: number; depth: number };
    const s = d.phoneScale;
    const yaw = -0.32;
    const lean = 6 * DEG;
    const halfX = ((w * Math.cos(yaw) + depth * Math.abs(Math.sin(yaw))) * s) / 2;
    const px = 0.5 + GAP + halfX;
    const pz = d.laptop.depth * 0.58;
    d.phone.rotation.set(-lean, yaw, 0, 'YXZ');
    d.phone.position.set(px, -BASE_T + ((h * s) / 2) * Math.cos(lean) + 0.001, pz);
    d.phone.userData.rest = d.phone.position.clone();
    d.phone.userData.yaw = yaw;
    pShadow.scale.set(w * s * 1.9, depth * s * 9, 1);
    pShadow.position.set(px, -BASE_T + 0.0015, pz + depth * s * 1.5);
    pShadow.rotation.z = yaw;

    // toy cars in the front band, angled towards the viewer, rolling apart (never towards the devices)
    d.cars.forEach((rig, i) => {
      const [, , x, z, heading] = carDefs[i];
      rig.place(new Vector3(x, d.table.yAt(x, z), z), heading, CAR_L);
      rig.roll = 0.35;
      rig.update(1, 0);
    });

    // bounding points for framing: slab footprint + lid top (opened) + phone top + every prop's rest box
    const lh = lidHeight(SCREEN_ASPECT);
    const lidTilt = 14 * DEG;
    const lidTopZ = -Math.sin(lidTilt) * lh;
    const lidTopY = Math.cos(lidTilt) * lh;
    const slab = new Box3().setFromObject(d.table.group.children[0]);
    const yb = slab.min.y;
    const left = slab.min.x;
    const zf = slab.max.z;
    const zb = Math.min(lidTopZ, slab.min.z);
    d.hull = [
      new Vector3(left, yb, zf),
      new Vector3(right, yb, zf),
      new Vector3(left, yb, zb),
      new Vector3(right, yb, zb),
      new Vector3(-0.5, lidTopY, lidTopZ),
      new Vector3(0.5, lidTopY, lidTopZ),
      new Vector3(px, -BASE_T + h * s, pz),
    ];
    const rests = d.table.restBoxes();
    for (const b of rests) d.hull.push(new Vector3(b.min.x, b.max.y, b.min.z), new Vector3(b.max.x, b.max.y, b.max.z));

    // no interpenetration (rest pose; the slide-ins only move things further out)
    d.root.position.set(0, 0, 0);
    d.root.rotation.set(0, 0, 0);
    d.root.scale.setScalar(1);
    solidBox(d.laptop.root, box);
    solidBox(d.phone, box2);
    const id = d.chapter.id;
    if (box.intersectsBox(box2)) console.warn('[gl-devices] phone intersects the laptop in', id);
    const items = d.table.items;
    rests.forEach((b, i) => {
      if (b.intersectsBox(box) || b.intersectsBox(box2)) console.warn('[gl-devices] prop intersects a device in', id, items[i].key);
      for (let k = i + 1; k < rests.length; k++) if (b.intersectsBox(rests[k])) console.warn('[gl-devices] props intersect in', id, items[i].key, items[k].key);
      if (b.min.x < slab.min.x || b.max.x > slab.max.x || b.min.z < slab.min.z || b.max.z > slab.max.z) console.warn('[gl-devices] prop off the table in', id, items[i].key);
    });
    // …and every car, at rest and at the end of its roll, clears both devices and the props
    for (const p of [0, 1]) {
      d.cars.forEach((rig) => {
        rig.update(p, 0);
        solidBox(rig.car.root, carBox);
        if (carBox.intersectsBox(box) || carBox.intersectsBox(box2)) console.warn('[gl-devices] a toy car intersects a device in', id);
        rests.forEach((b, i) => carBox.intersectsBox(b) && console.warn('[gl-devices] a toy car intersects a prop in', id, items[i].key));
      });
    }
  }

  const p = new Vector3();
  let W = 1;
  let H = 1;
  const t0 = performance.now();
  let lastT = t0;
  const m4 = new Matrix4();
  const q = new Quaternion();
  const sv = new Vector3();
  const yAxis = new Vector3(0, 1, 0);
  const flatQ = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
  /** devices drawn last frame with their scissor band, for hit-testing */
  let drawn: { d: Device; top: number; bottom: number }[] = [];

  const toScreen = (d: Device, v: Vector3) => {
    p.copy(v).applyMatrix4(d.root.matrixWorld).project(camera);
    return [((p.x + 1) / 2) * W, ((1 - p.y) / 2) * H] as const;
  };

  /** toy car or prop under a CSS-px point, if any (cars first: they sit in front) */
  const hit = (x: number, y: number) => {
    const c = new Vector3();
    for (const { d, top, bottom } of drawn) {
      if (y < top || y > bottom) continue;
      for (const rig of d.cars) {
        const [sx, sy] = toScreen(d, rig.centre(c));
        if (Math.hypot(sx - x, sy - y) < Math.max(22, d.root.scale.x * CAR_L * 0.45)) return { d, rig, prop: -1 };
      }
      let best = -1;
      let bestD = Infinity;
      d.table.items.forEach((it, i) => {
        if (it.t < 0.6) return;
        const [fx, fz, h] = it.def.size;
        const [sx, sy] = toScreen(d, c.set(0, h * 0.5, 0).applyMatrix4(it.m));
        const dist = Math.hypot(sx - x, sy - y);
        if (dist < Math.max(18, d.root.scale.x * Math.max(fx, fz, h * 0.6) * PROP_SCALE * 1.05) && dist < bestD) {
          best = i;
          bestD = dist;
        }
      });
      if (best >= 0) return { d, rig: null, prop: best };
    }
    return null;
  };
  let hoverRig: CarRig | null = null;
  let hoverProp: { d: Device; i: number } | null = null;

  /** Projected screen rect (px) of the hull at the current root transform. */
  const rect = { l: 0, r: 0, t: 0, b: 0 };
  const projectHull = (d: Device) => {
    d.root.updateMatrixWorld(true);
    rect.l = rect.t = Infinity;
    rect.r = rect.b = -Infinity;
    for (const v of d.hull) {
      const [x, y] = toScreen(d, v);
      rect.l = Math.min(rect.l, x);
      rect.r = Math.max(rect.r, x);
      rect.t = Math.min(rect.t, y);
      rect.b = Math.max(rect.b, y);
    }
  };

  const place = (d: Device, media: DOMRect, chapter: DOMRect, wipe: number, time: number) => {
    let e: number;
    let u: number;
    let safe: { l: number; r: number; t: number; b: number };
    if (lite) {
      // unpinned: the table rides with its media column; it settles as the column reaches the upper third
      e = clamp((H - media.top) / (H * 0.8));
      u = clamp((H * 0.5 - media.top) / H);
      d.reveal = e;
      const pad = media.width * 0.02;
      safe = { l: media.left - pad, r: media.right + pad, t: media.top, b: media.bottom };
    } else {
      e = Math.min(clamp((H - chapter.top) / H), 1 - wipe);
      u = clamp(-chapter.top / Math.max(1, chapter.height - H));
      // the props land once the stage is half wiped in: from 0.25 to 0.7 viewport heights into the pin
      d.reveal = clamp((-chapter.top / H - 0.25) / 0.45);
      // safe frame: the media column (a little wider to the right), inside the viewport and under the header
      safe = {
        l: Math.max(24, media.left),
        r: Math.min(W - 32, media.right + W * 0.03),
        t: Math.max(96, media.top - H * 0.04),
        b: Math.min(H - 56, media.bottom + H * 0.06),
      };
    }
    const open = ease(clamp(e * 1.3 - 0.05));
    // a gentle turn (±7°) across the chapter, a slightly higher view while it enters
    d.root.rotation.set((12 + (1 - e) * 7) * DEG, (-7 + 14 * u - (1 - e) * 5) * DEG, 0);
    d.laptop.lid.rotation.x = -(4 + 10 * open) * DEG;

    const cx = (safe.l + safe.r) / 2;
    const cy = (safe.t + safe.b) / 2;
    let k = Math.min(safe.r - safe.l, (safe.b - safe.t) * 1.6);
    d.root.scale.setScalar(k);
    d.root.position.set(cx - W / 2, H / 2 - cy, 0);
    // solve scale + offset against the real projection (converges in 2–3 steps)
    for (let i = 0; i < 3; i++) {
      projectHull(d);
      const f = Math.min((safe.r - safe.l) / (rect.r - rect.l), (safe.b - safe.t) / (rect.b - rect.t));
      k *= f;
      d.root.scale.setScalar(k);
      projectHull(d);
      d.root.position.x += cx - (rect.l + rect.r) / 2;
      d.root.position.y -= cy - (rect.t + rect.b) / 2;
    }
    d.root.position.y += Math.sin(time * 0.9) * 0.003 * k;

    // the phone slides in from the right on entry (never towards the laptop)
    const pin = ease(clamp(e * 1.4 - 0.3));
    const rest = d.phone.userData.rest as Vector3;
    d.phone.position.set(rest.x + (1 - pin) * 0.22, rest.y, rest.z);
    d.phone.rotation.y = (d.phone.userData.yaw as number) - (1 - pin) * 0.5;
    d.root.updateMatrixWorld(true);
    d.entry = e;
  };

  const showTag = () => {
    const on = hoverProp && drawn.some((x) => x.d === hoverProp!.d) ? hoverProp : null;
    if (!on) {
      tag.classList.remove('on');
      return;
    }
    const it = on.d.table.items[on.i];
    if (tag.textContent !== it.label) tag.textContent = it.label;
    const [x, y] = toScreen(on.d, on.d.table.anchor(on.i, new Vector3()));
    tag.style.transform = `translate3d(${x.toFixed(1)}px, ${(y - 10).toFixed(1)}px, 0)`;
    tag.classList.add('on');
  };

  return {
    lite,
    theme(pal) {
      mats.theme(pal);
      props.theme(pal);
    },
    pointer(x, y) {
      const h = hit(x, y);
      const rig = h?.rig ?? null;
      if (rig !== hoverRig) {
        hoverRig?.setHover(false);
        rig?.setHover(true);
        hoverRig = rig;
      }
      const prop = h && h.prop >= 0 ? { d: h.d, i: h.prop } : null;
      if (prop?.d !== hoverProp?.d || prop?.i !== hoverProp?.i) {
        hoverProp?.d.table.setHover(-1);
        prop?.d.table.setHover(prop.i);
        hoverProp = prop;
        showTag();
      }
      return !!h;
    },
    click(x, y) {
      const h = hit(x, y);
      if (h?.rig) h.rig.kick();
      else if (h) h.d.table.hop(h.prop);
      return !!h;
    },
    render(width, height) {
      W = width;
      H = height;
      const dist = H / 2 / Math.tan(15 * DEG);
      camera.aspect = W / H;
      camera.near = dist * 0.3;
      camera.far = dist * 2.5;
      camera.position.set(0, 0, dist);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();

      const rects = devices.map((d) => d.chapter.getBoundingClientRect());
      // screen textures load as their chapter comes within a screen or so
      devices.forEach((d, i) => {
        if (d.loaded || rects[i].top > H * 2 || rects[i].bottom < -H) return;
        d.loaded = true;
        load(d.media.dataset.texDesktop, d.screenMat, SCREEN_ASPECT);
        const ph = d.phone.userData as { h: number; w: number };
        const b = ph.h * 0.022;
        load(d.media.dataset.texPhone, d.phoneMat, (ph.h - b * 2) / (ph.w - b * 2));
      });
      const visible = rects.map((r) => r.top < H && r.bottom > 0);
      // cars that zoomed off come back once their chapter has left the screen
      devices.forEach((d, i) => !visible[i] && d.cars.forEach((r) => r.reset()));
      if (!visible.some(Boolean)) {
        tag.classList.remove('on');
        return false;
      }
      const now = performance.now();
      const time = (now - t0) / 1000;
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      drawn = [];

      renderer.setScissorTest(false);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      const stages = devices.map((d, i) => (visible[i] ? d.stage.getBoundingClientRect() : null));
      const wipes = devices.map((d) => parseFloat(d.stage.style.getPropertyValue('--wipe')) || 0);
      // later stages cover earlier ones from their (wiped) top edge down
      const tops = stages.map((s, i) => (s ? s.top + wipes[i] * s.height : Infinity));
      devices.forEach((d, i) => {
        const s = stages[i];
        if (!s) return;
        let bottom = Math.min(H, s.bottom);
        for (let k = i + 1; k < devices.length; k++) bottom = Math.min(bottom, tops[k]);
        const top = Math.floor(Math.max(0, tops[i]));
        bottom = Math.ceil(bottom);
        if (bottom - top < 1) return;
        place(d, d.media.getBoundingClientRect(), rects[i], wipes[i], time);
        d.table.update(d.reveal, time, dt, true, d.root.scale.x);
        const shadowBase = d.table.items.length;
        d.cars.forEach((rig, k) => {
          rig.update(d.entry, dt);
          const c = rig.car.root.position;
          q.setFromAxisAngle(yAxis, rig.car.root.rotation.y).multiply(flatQ);
          m4.compose(p.set(c.x, d.table.yAt(c.x, c.z) + 0.0012, c.z), q, sv.set(CAR_L * 1.25, CAR_L * 0.62, 1));
          d.table.shadows.setMatrixAt(shadowBase + k, m4);
        });
        d.table.shadows.instanceMatrix.needsUpdate = true;
        drawn.push({ d, top, bottom });
        const dim = clamp(1 - (parseFloat(d.stage.style.opacity || '1') || 0));
        renderer.toneMappingExposure = 1 - dim * 0.75;
        d.laptop.shadow.uniforms.uOpacity.value = 0.55 * (1 - dim);
        d.phoneShadow.uniforms.uOpacity.value = 0.5 * (1 - dim);
        d.table.dim(dim);
        d.screenMat.color.setScalar(d.screenMat.map ? 1 - dim * 0.75 : 0.02);
        d.phoneMat.color.setScalar(d.phoneMat.map ? 1 - dim * 0.75 : 0.02);
        devices.forEach((o) => (o.root.visible = o === d));
        renderer.setScissor(0, H - bottom, W, bottom - top);
        renderer.setScissorTest(true);
        renderer.render(scene, camera);
      });
      renderer.setScissorTest(false);
      renderer.toneMappingExposure = 1;
      showTag();
      return true;
    },
    dispose() {
      devices.forEach((d) => {
        kit.disposeLaptop(d.laptop);
        d.table.dispose();
        scene.remove(d.root);
      });
      tagLayer.remove();
      props.dispose();
      shadowGeo.dispose();
      mats.dispose();
      textures.forEach((t) => t.dispose());
    },
  };
}
