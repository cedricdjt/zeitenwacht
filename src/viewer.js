// @ts-check
// Modell-Betrachter für die Entwicklung. Zeigt Modelle im Look des Spiels auf einem Raster aus Spielfeldern.
//
// URL-Parameter:
//   ids=a,b,c      Modell-Kennungen; ein Eintrag mit * am Ende wählt alle mit diesem Anfang (z. B. tower.stone.*)
//                  ohne Angabe: alle Modelle
//   cols=4         Spalten des Rasters           spacing=1.5   Abstand der Modelle in Feldern
//   cam=iso        iso | front | back | side | top | low       zoom=1  größer = näher
//   yaw=0          dreht alle Modelle um Y (Grad)
//   t=1.2          friert die Zeit bei t Sekunden ein (für reproduzierbare Screenshots); ohne Angabe läuft die Animation
//   aim=30         feste Zielrichtung der Türme in Grad (sonst schwenkt sie langsam)
//   fire=0.5       fester Wert für ctx.fire (sonst feuert der Turm alle 1,2 s)
//   level=1        Ausbaustufe 1..3
//   still=1        Gegner stehen (ctx.move = 0)
//   theme=stone    Lichtstimmung eines Zeitalters (sobald vorhanden), sonst neutrales Tageslicht
//   mode=object    zeichnet über createModelObject statt instanziert (muss gleich aussehen)
//   labels=0       Beschriftung aus           stats=1       Dreiecke und Maße in der Beschriftung
//   bg=dddddd      einfarbiger Hintergrund statt Himmel

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getModel, listModelIds } from './content/models.js';
import { InstancedModel, createModelObject, makeAnimCtx } from './render/instances.js';
import { LightRig, NEUTRAL_LIGHT, SkyDome, configureRenderer, createMaterials } from './render/look.js';

/** @import { AnimCtx, LightTheme, ModelSpec } from './types/model' */

const query = new URLSearchParams(location.search);
/** @param {string} key @param {number} fallback */
const num = (key, fallback) => (query.has(key) && query.get(key) !== '' ? Number(query.get(key)) : fallback);

// --- Auswahl der Modelle ---
/** @type {string[]} */
let ids = [];
const idsParam = query.get('ids');
if (idsParam) {
  for (const entry of idsParam.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (entry.endsWith('*')) ids.push(...listModelIds(entry.slice(0, -1)));
    else ids.push(entry);
  }
} else {
  ids = listModelIds();
}
const count = Math.max(1, ids.length);
const cols = Math.max(1, Math.round(num('cols', Math.ceil(Math.sqrt(count * 1.6)))));
const rows = Math.ceil(count / cols);
const spacing = num('spacing', 1.35);

// --- Szene ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
configureRenderer(renderer);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
/** @type {LightTheme} */
let theme = NEUTRAL_LIGHT;
/** @type {string | null} */
let themeGround = null;
const themeId = query.get('theme');
if (themeId) {
  try {
    const mod = await import('./content/themes.js');
    const found = mod.getLightTheme ? mod.getLightTheme(themeId) : null;
    if (found) theme = found;
    else console.warn(`Unbekanntes Thema: ${themeId} (neutrales Tageslicht wird verwendet)`);
    themeGround = mod.getGroundColor ? mod.getGroundColor(themeId) : null;
  } catch (err) {
    console.warn(`Themen nicht verfügbar: ${err}`);
  }
}
const extent = Math.max(cols, rows) * spacing;
const rig = new LightRig(scene, { radius: Math.max(6, extent * 0.75 + 2) });
rig.apply(theme);
if (query.get('bg')) {
  scene.background = new THREE.Color('#' + query.get('bg'));
} else {
  const sky = new SkyDome();
  sky.apply(theme);
  scene.add(sky.mesh);
}
renderer.toneMappingExposure = num('exp', theme.exposure ?? 1);
/** @type {Record<string, THREE.ToneMapping>} */
const TONE_MAPPINGS = { aces: THREE.ACESFilmicToneMapping, neutral: THREE.NeutralToneMapping, agx: THREE.AgXToneMapping, none: THREE.NoToneMapping, reinhard: THREE.ReinhardToneMapping, cineon: THREE.CineonToneMapping };
const tm = query.get('tm');
if (tm && TONE_MAPPINGS[tm] !== undefined) renderer.toneMapping = TONE_MAPPINGS[tm];
if (query.has('sun')) rig.sun.intensity = num('sun', 1);
if (query.has('hemi')) rig.hemi.intensity = num('hemi', 1);
if (query.has('fill')) rig.fill.intensity = num('fill', 0.35);
if (theme.fogDensity > 0) scene.fog = new THREE.FogExp2(new THREE.Color(theme.fogColor).getHex(), theme.fogDensity);

const materials = createMaterials();

// Boden: eine Platte, darauf je Modell ein helleres 1x1-Feld als Maßstab.
const groundColor = new THREE.Color(query.get('ground') ? '#' + query.get('ground') : themeGround ?? '#86b86b');
const slab = new THREE.Mesh(
  new THREE.BoxGeometry(cols * spacing + 1, 0.4, rows * spacing + 1),
  new THREE.MeshLambertMaterial({ color: groundColor.clone().multiplyScalar(0.9) }),
);
slab.position.y = -0.2;
slab.receiveShadow = true;
scene.add(slab);
const tileGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const tileMaterial = new THREE.MeshLambertMaterial({ color: groundColor });

/** @param {number} index */
function slotPosition(index) {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return new THREE.Vector3((col - (cols - 1) / 2) * spacing, 0, (row - (rows - 1) / 2) * spacing);
}

const yaw = (num('yaw', 0) * Math.PI) / 180;
const useObjects = query.get('mode') === 'object';
const showLabels = query.get('labels') !== '0';
const showStats = query.get('stats') === '1';
const level = Math.max(1, Math.min(3, Math.round(num('level', 1))));

/** @type {{ id: string, position: THREE.Vector3, spec: ModelSpec | null, inst: InstancedModel | null, update: ((ctx: AnimCtx) => void) | null, label: HTMLElement | null, root: THREE.Matrix4 }[]} */
const slots = [];
/** @type {object[]} */
const report = [];
ids.forEach((id, index) => {
  const position = slotPosition(index);
  const tile = new THREE.Mesh(tileGeometry, tileMaterial);
  tile.position.copy(position).setY(0.002);
  tile.receiveShadow = true;
  scene.add(tile);

  /** @type {ModelSpec | null} */
  let spec = null;
  let error = '';
  try {
    spec = getModel(id);
  } catch (err) {
    error = String(err instanceof Error ? err.message : err);
    console.error(`Modell ${id}: ${error}`);
  }
  const root = new THREE.Matrix4().compose(position, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
  /** @type {InstancedModel | null} */
  let inst = null;
  /** @type {((ctx: AnimCtx) => void) | null} */
  let update = null;
  if (spec) {
    if (useObjects) {
      const built = createModelObject(spec, materials, { level });
      built.object.applyMatrix4(root);
      scene.add(built.object);
      update = built.update;
    } else {
      inst = new InstancedModel(spec, materials, { capacity: 1 });
      scene.add(inst.group);
    }
    report.push({
      id,
      triangles: spec.triangles,
      height: Number(spec.bounds.height.toFixed(3)),
      radius: Number(spec.bounds.radius.toFixed(3)),
      min: spec.bounds.min.map((v) => Number(v.toFixed(3))),
      max: spec.bounds.max.map((v) => Number(v.toFixed(3))),
      parts: spec.parts.map((p) => p.name),
      points: Object.keys(spec.points),
    });
  } else {
    report.push({ id, error });
  }

  /** @type {HTMLElement | null} */
  let label = null;
  if (showLabels || error) {
    label = document.createElement('div');
    label.className = 'label' + (error ? ' error' : '');
    const short = id.split('.').slice(-2).join('.');
    label.textContent = error ? `${id}: ${error}` : showStats && spec ? `${short} · ${spec.triangles} Dreiecke · h ${spec.bounds.height.toFixed(2)} · r ${spec.bounds.radius.toFixed(2)}` : short;
    document.body.appendChild(label);
  }
  slots.push({ id, position, spec, inst, update, label, root });
});

// --- Kamera ---
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 500);
const zoom = num('zoom', 1);
// Kamera auf die tatsächliche Ausdehnung aller Modelle einpassen.
const content = new THREE.Box3();
for (const slot of slots) {
  const b = slot.spec ? slot.spec.bounds : { min: [-0.4, 0, -0.4], max: [0.4, 0.8, 0.4] };
  content.expandByPoint(new THREE.Vector3(slot.position.x + Math.min(b.min[0], -0.5), 0, slot.position.z + Math.min(b.min[2], -0.5)));
  content.expandByPoint(new THREE.Vector3(slot.position.x + Math.max(b.max[0], 0.5), b.max[1], slot.position.z + Math.max(b.max[2], 0.5)));
}
if (content.isEmpty()) content.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
const contentSphere = content.getBoundingSphere(new THREE.Sphere());
const target = contentSphere.center.clone();
/** @type {Record<string, [number, number]>} Azimut, Höhe in Grad */
const CAMS = { iso: [35, 40], front: [0, 12], back: [180, 12], side: [90, 12], top: [0, 89], low: [30, 20] };
const [camAz, camEl] = CAMS[query.get('cam') ?? 'iso'] ?? CAMS.iso;
function placeCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const half = Math.tan((camera.fov * Math.PI) / 360);
  const dist = (contentSphere.radius / Math.min(half, half * aspect)) * 0.92 / zoom;
  const az = (camAz * Math.PI) / 180;
  const el = (camEl * Math.PI) / 180;
  camera.position.set(target.x + Math.sin(az) * Math.cos(el) * dist, target.y + Math.sin(el) * dist, target.z + Math.cos(az) * Math.cos(el) * dist);
  camera.lookAt(target);
}
placeCamera();
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(target);
controls.update();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const help = /** @type {HTMLElement} */ (document.getElementById('help'));
help.textContent = showLabels ? `${ids.length} Modelle · Stufe ${level} · Parameter: ids, cols, cam, zoom, yaw, t, aim, fire, level, still, theme, mode, stats` : '';
if (!showLabels) help.style.display = 'none';

// --- Animation ---
const frozen = query.has('t');
const fixedAim = query.has('aim') ? (num('aim', 0) * Math.PI) / 180 : null;
const fixedFire = query.has('fire') ? num('fire', 0) : null;
const still = query.get('still') === '1';
const ctx = makeAnimCtx();
const projected = new THREE.Vector3();
const start = performance.now();
let frames = 0;

function frame() {
  const t = frozen ? num('t', 0) : (performance.now() - start) / 1000;
  const phase = (t % 1.2) / 1.2;
  slots.forEach((slot, index) => {
    ctx.t = t;
    ctx.seed = (index * 0.37) % 1;
    ctx.walk = still ? 0 : t * 7 + index;
    ctx.move = still ? 0 : 1;
    ctx.hp = 1;
    ctx.hurt = 0;
    ctx.aimYaw = fixedAim ?? Math.sin(t * 0.6 + index) * 1.2;
    ctx.aimPitch = 0;
    ctx.fire = fixedFire ?? Math.max(0, 1 - (phase * 1.2) / 0.3);
    ctx.charge = fixedFire !== null ? 1 - fixedFire : phase;
    ctx.active = 1;
    ctx.level = level;
    if (slot.inst) {
      slot.inst.begin();
      slot.inst.add(slot.root, ctx);
      slot.inst.end();
    } else if (slot.update) {
      slot.update(ctx);
    }
  });
  controls.update();
  renderer.render(scene, camera);
  for (const slot of slots) {
    if (!slot.label) continue;
    projected.copy(slot.position).add(new THREE.Vector3(0, -0.02, spacing * 0.36)).project(camera);
    slot.label.style.left = `${(projected.x * 0.5 + 0.5) * window.innerWidth}px`;
    slot.label.style.top = `${(-projected.y * 0.5 + 0.5) * window.innerHeight}px`;
  }
  frames++;
  if (frames === 2) {
    Object.assign(window, { __report: report, __ready: true });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
