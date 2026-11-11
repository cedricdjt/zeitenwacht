// @ts-check
// Vorschaubilder: rendert einzelne Modelle in eine kleine eigene Leinwand und liefert sie als Daten-URL.
// Für Bauleiste, Wellenvorschau und Menüs. Ergebnisse werden zwischengespeichert.

import * as THREE from 'three';
import { getModel } from '../content/models.js';
import { createModelObject, makeAnimCtx } from './instances.js';
import { configureRenderer, createMaterials } from './look.js';
import { placeWeaponMarker, weaponMarkerModel } from './entities/markers.js';
import { recolorModel } from './entities/variants.js';

/**
 * @typedef {object} ThumbnailOptions
 * @property {number} [size] Kantenlänge in Pixeln (Standard 128)
 * @property {number} [level] Ausbaustufe 1..3 (Standard 1)
 * @property {number} [yaw] Drehung des Modells um Y in Radiant (Standard 0.6: leicht zur Seite gedreht)
 * @property {number} [aim] Zielrichtung eines Turms relativ zum Modell in Radiant (Standard 0)
 * @property {{ accent: string, marker: string, role?: string } | null} [look] Erkennungszeichen einer Waffe des Pools (wie im Spielfeld);
 *   mit `role` (Rollenfarbe) auch die Bemalung in der Akzentfarbe
 */

/**
 * @typedef {object} Thumbnailer
 * @property {(modelId: string, opts?: ThumbnailOptions) => string} render Liefert ein PNG als Daten-URL mit durchsichtigem Hintergrund
 * @property {() => void} dispose
 */

/**
 * Erzeugt einen Vorschaubild-Renderer mit eigener kleiner WebGL-Leinwand.
 * @returns {Thumbnailer}
 */
export function createThumbnailer() {
  /** @type {THREE.WebGLRenderer | null} */
  let renderer = null;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  const materials = createMaterials();
  scene.add(new THREE.HemisphereLight('#f2f6ff', '#b0a48c', 1.9));
  const sun = new THREE.DirectionalLight('#fff3dc', 2.1);
  sun.position.set(2.5, 4, 3);
  scene.add(sun);
  /** @type {Map<string, string>} */
  const cache = new Map();
  const box = new THREE.Box3();
  const sphere = new THREE.Sphere();
  const ctx = makeAnimCtx();

  return {
    render(modelId, opts = {}) {
      const size = opts.size ?? 128;
      const level = opts.level ?? 1;
      const yaw = opts.yaw ?? 0.6;
      const aim = opts.aim ?? 0;
      const look = opts.look && opts.look.marker && opts.look.marker !== 'none' ? opts.look : null;
      const key = `${modelId}|${size}|${level}|${yaw}|${aim}|${look ? look.marker + look.accent + (look.role ?? '') : ''}`;
      const cached = cache.get(key);
      if (cached) return cached;
      if (!renderer) {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        configureRenderer(renderer);
        renderer.shadowMap.enabled = false;
        renderer.setClearColor(0x000000, 0);
      }
      renderer.setPixelRatio(1);
      renderer.setSize(size, size, false);

      const spec = look && look.role ? recolorModel(getModel(modelId), look.role, look.accent) : getModel(modelId);
      const { object, update } = createModelObject(spec, materials, { level, castShadow: false, receiveShadow: false });
      ctx.level = level;
      ctx.aimYaw = aim;
      ctx.charge = 1;
      ctx.active = 1;
      ctx.move = 0;
      ctx.walk = 0.9;
      ctx.t = 0.4;
      update(ctx);
      object.rotation.y = yaw;
      scene.add(object);
      object.updateMatrixWorld(true);
      // Erkennungszeichen wie im Spielfeld: Die Kamera schaut von +Z, dort ist die vordere Kante.
      const markSpec = look ? weaponMarkerModel(look.marker, look.accent) : null;
      /** @type {THREE.Object3D | null} */
      let markObject = null;
      if (look && markSpec) {
        box.setFromObject(object);
        const at = { x: 0, y: 0, z: 0, s: 1 };
        placeWeaponMarker(look.marker, box.isEmpty() ? spec.bounds.max[1] : box.max.y, 0, 1, 1, at);
        const mark = createModelObject(markSpec, materials, { level: 1, castShadow: false, receiveShadow: false });
        ctx.seed = 0;
        mark.update(ctx);
        mark.object.position.set(at.x, at.y, at.z);
        mark.object.scale.setScalar(at.s);
        scene.add(mark.object);
        mark.object.updateMatrixWorld(true);
        markObject = mark.object;
      }

      // Kamera auf die sichtbaren Teile einpassen.
      box.makeEmpty();
      for (const root of markObject ? [object, markObject] : [object]) {
        root.traverse((child) => {
          if (/** @type {THREE.Mesh} */ (child).isMesh && child.visible && child.parent?.visible !== false) box.expandByObject(child);
        });
      }
      if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
      box.getBoundingSphere(sphere);
      const dist = (sphere.radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.02;
      const el = 0.52;
      camera.position.set(sphere.center.x, sphere.center.y + Math.sin(el) * dist, sphere.center.z + Math.cos(el) * dist);
      camera.lookAt(sphere.center);
      camera.near = Math.max(0.05, dist - sphere.radius * 2);
      camera.far = dist + sphere.radius * 2;
      camera.updateProjectionMatrix();

      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      scene.remove(object);
      if (markObject) scene.remove(markObject);
      cache.set(key, url);
      return url;
    },
    dispose() {
      cache.clear();
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
        renderer = null;
      }
      materials.matte.dispose();
      materials.glow.dispose();
    },
  };
}
