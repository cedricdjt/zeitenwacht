// @ts-check
// Kameraführung und Zeigereingabe der Spielansicht: verschieben, drehen, zoomen, Klick und Schwebeposition auf dem Boden.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { worldToTileX, worldToTileZ } from '../sim/path.js';
import { clamp, easeInOut } from '../util/math.js';
import { CAMERA_AZIMUTH, CAMERA_ELEVATION, CAMERA_FOV } from './layout.js';

/** @import { StageCallbacks, TilePick } from '../types/app' */

const DEG = Math.PI / 180;
const CLICK_MAX_MOVE = 7;
const CLICK_MAX_MS = 450;

export class CameraRig {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLElement} dom Element, das die Zeigerereignisse empfängt (die Leinwand)
   * @param {StageCallbacks} callbacks
   */
  constructor(camera, dom, callbacks) {
    this.camera = camera;
    this.dom = dom;
    this.callbacks = callbacks;
    this.controls = new OrbitControls(camera, dom);
    const c = this.controls;
    c.enableDamping = true;
    c.dampingFactor = 0.12;
    c.screenSpacePanning = false;
    c.zoomToCursor = true;
    c.rotateSpeed = 0.55;
    c.panSpeed = 1.0;
    c.zoomSpeed = 0.9;
    c.minPolarAngle = (90 - 78) * DEG;
    c.maxPolarAngle = (90 - 22) * DEG;
    c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    /** Spielfeldgröße in Feldern. */
    this.width = 18;
    this.height = 12;
    /** Entfernung der Ausgangsansicht. */
    this.homeDistance = 36;
    /** Laufende Kamerafahrt oder null. @type {{ t: number, duration: number, fromPos: THREE.Vector3, fromTarget: THREE.Vector3, toPos: THREE.Vector3, toTarget: THREE.Vector3 } | null} */
    this.flight = null;
    /** Langsame Dauerdrehung für die Menükulisse. */
    this.attract = false;
    this.interactive = true;
    /** @type {Set<string>} */
    this.keys = new Set();
    this.raycaster = new THREE.Raycaster();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.ndc = new THREE.Vector2();
    this.hit = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
    /** @type {TilePick} */
    this.pick = { tx: 0, tz: 0, x: 0, z: 0, inside: false };
    this.hoverKey = '';
    this.down = { x: 0, y: 0, time: 0, button: -1, active: false, moved: false };

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerLeave = this._onPointerLeave.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onContextMenu = (/** @type {Event} */ e) => e.preventDefault();
    this._onBlur = () => this.keys.clear();
    dom.addEventListener('pointerdown', this._onPointerDown);
    dom.addEventListener('pointermove', this._onPointerMove);
    dom.addEventListener('pointerup', this._onPointerUp);
    dom.addEventListener('pointercancel', this._onPointerLeave);
    dom.addEventListener('pointerleave', this._onPointerLeave);
    dom.addEventListener('contextmenu', this._onContextMenu);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.setHome(18, 12);
    this.jumpHome();
  }

  /**
   * Passt die Ausgangsansicht an Spielfeld und Seitenverhältnis an.
   * @param {number} width Felder in X
   * @param {number} height Felder in Z
   */
  setHome(width, height) {
    this.width = width;
    this.height = height;
    const aspect = this.camera.aspect || 1.6;
    const half = Math.tan((CAMERA_FOV * DEG) / 2);
    const halfX = width / 2 + 3.2;
    const halfZ = height / 2 + 3.2;
    // Oben und unten liegt die Anzeige über dem Bild: nur etwa 76 % der Höhe sind frei.
    const needH = halfX / (half * aspect);
    const needV = (halfZ * Math.sin(CAMERA_ELEVATION * DEG) + 1.2) / (half * 0.76);
    this.homeDistance = Math.max(needH, needV) * 1.04;
    this.controls.minDistance = Math.min(12, this.homeDistance * 0.4);
    this.controls.maxDistance = this.homeDistance * 1.7;
  }

  /**
   * Kameraposition für Richtung, Höhe und Entfernung um ein Ziel.
   * @param {number} azimuthDeg
   * @param {number} elevationDeg
   * @param {number} distance
   * @param {THREE.Vector3} target
   * @param {THREE.Vector3} out
   */
  _orbit(azimuthDeg, elevationDeg, distance, target, out) {
    const az = azimuthDeg * DEG;
    const el = elevationDeg * DEG;
    return out.set(target.x + Math.sin(az) * Math.cos(el) * distance, target.y + Math.sin(el) * distance, target.z + Math.cos(az) * Math.cos(el) * distance);
  }

  /** Setzt die Kamera ohne Fahrt auf die Ausgangsansicht. */
  jumpHome() {
    this.flight = null;
    this.controls.target.set(0, 0, 0.6);
    this._orbit(CAMERA_AZIMUTH, CAMERA_ELEVATION, this.homeDistance, this.controls.target, this.camera.position);
    this.controls.update();
  }

  /**
   * Fährt zur Ausgangsansicht zurück.
   * @param {number} [duration] Sekunden
   */
  reset(duration = 0.7) {
    const toTarget = new THREE.Vector3(0, 0, 0.6);
    this.flight = {
      t: 0,
      duration,
      fromPos: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      toPos: this._orbit(CAMERA_AZIMUTH, CAMERA_ELEVATION, this.homeDistance, toTarget, new THREE.Vector3()),
      toTarget,
    };
  }

  /** Eröffnungsfahrt zu Beginn einer Partie: aus der Ferne und flacher heran. */
  intro() {
    const target = new THREE.Vector3(0, 0, 0.6);
    this.controls.target.copy(target);
    this._orbit(CAMERA_AZIMUTH - 38, CAMERA_ELEVATION - 20, this.homeDistance * 1.45, target, this.camera.position);
    this.controls.update();
    this.reset(2.4);
  }

  /**
   * Menükulisse: langsame Dauerdrehung, keine Eingaben.
   * @param {boolean} on
   */
  setAttract(on) {
    this.attract = on;
    this.controls.autoRotate = on;
    this.controls.autoRotateSpeed = 0.55;
    this.controls.enabled = !on && this.interactive;
    if (on) {
      this.flight = null;
      this.controls.target.set(0, 0, 0.6);
      this._orbit(CAMERA_AZIMUTH + 20, CAMERA_ELEVATION - 12, this.homeDistance * 1.12, this.controls.target, this.camera.position);
      this.controls.update();
    }
  }

  /** @param {number} dt echte Sekunden */
  update(dt) {
    const c = this.controls;
    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, f.t + dt / f.duration);
      const k = easeInOut(f.t);
      this.camera.position.lerpVectors(f.fromPos, f.toPos, k);
      c.target.lerpVectors(f.fromTarget, f.toTarget, k);
      if (f.t >= 1) this.flight = null;
    } else if (!this.attract && this.keys.size > 0) {
      // Tasten: W A S D / Pfeile verschieben, Q und E drehen.
      const forward = this.tmp.subVectors(c.target, this.camera.position).setY(0).normalize();
      const right = this.tmp2.set(-forward.z, 0, forward.x);
      const dist = this.camera.position.distanceTo(c.target);
      const pan = dist * 0.55 * dt;
      let mx = 0;
      let mz = 0;
      if (this.keys.has('w') || this.keys.has('arrowup')) mz += 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) mz -= 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
      if (mx !== 0 || mz !== 0) {
        const dx = (right.x * mx + forward.x * mz) * pan;
        const dz = (right.z * mx + forward.z * mz) * pan;
        c.target.x += dx;
        c.target.z += dz;
        this.camera.position.x += dx;
        this.camera.position.z += dz;
      }
      let rot = 0;
      if (this.keys.has('q')) rot += 1;
      if (this.keys.has('e')) rot -= 1;
      if (rot !== 0) {
        const angle = rot * 1.4 * dt;
        const ox = this.camera.position.x - c.target.x;
        const oz = this.camera.position.z - c.target.z;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        this.camera.position.x = c.target.x + ox * cos - oz * sin;
        this.camera.position.z = c.target.z + ox * sin + oz * cos;
      }
    }
    c.update(dt);
    // Blickpunkt auf der Insel halten.
    const limX = this.width / 2 + 2;
    const limZ = this.height / 2 + 2;
    const tx = clamp(c.target.x, -limX, limX);
    const tz = clamp(c.target.z, -limZ, limZ);
    if (tx !== c.target.x || tz !== c.target.z || c.target.y !== 0) {
      this.camera.position.x += tx - c.target.x;
      this.camera.position.z += tz - c.target.z;
      c.target.set(tx, 0, tz);
    }
  }

  /**
   * Schaltet Eingaben ein oder aus (aus, solange ein Menü offen ist).
   * @param {boolean} on
   */
  setInteractive(on) {
    this.interactive = on;
    this.controls.enabled = on && !this.attract;
    if (!on) {
      this.keys.clear();
      this._emitHover(null);
    }
  }

  /**
   * Feld unter einer Fensterposition.
   * @param {number} clientX
   * @param {number} clientY
   * @returns {TilePick | null}
   */
  pickAt(clientX, clientY) {
    const rect = this.dom.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.ground, this.hit)) return null;
    const p = this.pick;
    p.x = this.hit.x;
    p.z = this.hit.z;
    p.tx = worldToTileX(this.hit.x, this.width);
    p.tz = worldToTileZ(this.hit.z, this.height);
    p.inside = p.tx >= 0 && p.tx < this.width && p.tz >= 0 && p.tz < this.height;
    return p;
  }

  /** @param {TilePick | null} tile */
  _emitHover(tile) {
    const key = tile ? `${tile.tx},${tile.tz}` : '';
    if (key === this.hoverKey && !tile) return;
    this.hoverKey = key;
    this.callbacks.onHover(tile);
  }

  /** @param {PointerEvent} e */
  _onPointerDown(e) {
    this.down.x = e.clientX;
    this.down.y = e.clientY;
    this.down.time = performance.now();
    this.down.button = e.button;
    this.down.active = true;
    this.down.moved = false;
    this.flight = null;
  }

  /** @param {PointerEvent} e */
  _onPointerMove(e) {
    if (this.down.active && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > CLICK_MAX_MOVE) this.down.moved = true;
    if (!this.interactive || this.attract) return;
    if (e.pointerType === 'touch') return;
    this._emitHover(this.pickAt(e.clientX, e.clientY));
  }

  /** @param {PointerEvent} e */
  _onPointerUp(e) {
    const d = this.down;
    if (!d.active) return;
    d.active = false;
    if (!this.interactive || this.attract) return;
    if (d.moved || performance.now() - d.time > CLICK_MAX_MS) return;
    const tile = this.pickAt(e.clientX, e.clientY);
    if (!tile) return;
    if (e.pointerType === 'touch') this._emitHover(tile);
    this.callbacks.onClick(tile, d.button === 2);
  }

  _onPointerLeave() {
    this.down.active = false;
    this._emitHover(null);
  }

  /** @param {KeyboardEvent} e */
  _onKeyDown(e) {
    if (!this.interactive || this.attract || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = /** @type {HTMLElement | null} */ (e.target);
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === 'q' || k === 'e' || k.startsWith('arrow')) {
      this.keys.add(k);
      if (k.startsWith('arrow')) e.preventDefault();
    }
  }

  /** @param {KeyboardEvent} e */
  _onKeyUp(e) {
    this.keys.delete(e.key.toLowerCase());
  }

  dispose() {
    const dom = this.dom;
    dom.removeEventListener('pointerdown', this._onPointerDown);
    dom.removeEventListener('pointermove', this._onPointerMove);
    dom.removeEventListener('pointerup', this._onPointerUp);
    dom.removeEventListener('pointercancel', this._onPointerLeave);
    dom.removeEventListener('pointerleave', this._onPointerLeave);
    dom.removeEventListener('contextmenu', this._onContextMenu);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.controls.dispose();
  }
}
