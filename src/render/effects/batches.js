// @ts-check
// Zeichenstapel der Effektschicht: je Stapel EIN Zeichenaufruf für beliebig viele Exemplare.
//   GlowBatch  = weiche Leuchtflecken und Leuchtstriche (Funken, Strahlen, Blitze, Spuren), zur Kamera gedreht
//   DecalBatch = Ringe und Scheiben flach auf dem Boden (Flächenschaden, Druckwellen, Staubringe, Zeitglocke)
//   ZoneBatch  = die glänzenden Pfützen des Bremsers auf dem Weg
//   TextBatch  = schwebende Zahlen aus einem gemeinsamen Canvas-Atlas
// Alle Stapel werden in jedem Bild neu befüllt; dabei wird nichts alloziert.

import * as THREE from 'three';

/** Gemeinsame Helligkeit des Umgebungslichts für die Stapel, die beleuchtet wirken sollen (Pfützen). */
export const sceneLight = { value: new THREE.Color(1, 1, 1) };

/** GLSL: Tonwertkurve und Ausgabefarbraum wie bei den eingebauten Materialien, Ergebnis mit vormultipliziertem Alpha. */
const FINISH = /* glsl */ `
  vec4 finish(vec3 col, float a, float occlude) {
    #ifdef TONE_MAPPING
      col = toneMapping(col);
    #endif
    vec4 o = linearToOutputTexel(vec4(col, 1.0));
    return vec4(o.rgb * a, a * occlude);
  }`;

/**
 * Einstellungen für "vormultipliziertes" Mischen: Alpha 0 im Ergebnis addiert nur Licht, Alpha 1 deckt den Hintergrund ab.
 * So lassen sich additive und deckende Exemplare in einem Zeichenaufruf mischen.
 * @returns {THREE.ShaderMaterialParameters}
 */
function premultiplied() {
  return {
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  };
}

/**
 * Legt ein instanziertes Attribut an.
 * @param {THREE.InstancedBufferGeometry} geometry
 * @param {string} name
 * @param {number} capacity
 * @param {number} size
 * @returns {{ array: Float32Array, attr: THREE.InstancedBufferAttribute }}
 */
function instanced(geometry, name, capacity, size) {
  const array = new Float32Array(capacity * size);
  const attr = new THREE.InstancedBufferAttribute(array, size);
  attr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute(name, attr);
  return { array, attr };
}

/**
 * Lädt nur den benutzten Teil eines Attributs hoch.
 * @param {THREE.InstancedBufferAttribute} attr
 * @param {number} count Anzahl der Exemplare
 */
function upload(attr, count) {
  if (count === 0) return;
  attr.clearUpdateRanges();
  attr.addUpdateRange(0, count * attr.itemSize);
  attr.needsUpdate = true;
}

/** Einheitsquadrat aus zwei Dreiecken mit dem Attribut `corner` (-1..1). */
function quadGeometry() {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  g.setAttribute('corner', new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

// ---------------------------------------------------------------------------------------------
// Leuchtflecken und Leuchtstriche
// ---------------------------------------------------------------------------------------------

/** Form eines Leuchtflecks: weich auslaufend. */
export const SHAPE_SOFT = 0;
/** Form: weicher Hof mit hellem Kern (Strahlen, Leuchtspuren). */
export const SHAPE_CORE = 1;
/** Form: fast gleichmäßig gefüllte Scheibe mit weichem Rand (Körnchen, Tropfen). */
export const SHAPE_DOT = 2;

export class GlowBatch {
  /** @param {number} capacity */
  constructor(capacity) {
    this.capacity = capacity;
    this.count = 0;
    const g = quadGeometry();
    this.a = instanced(g, 'iA', capacity, 4);
    this.b = instanced(g, 'iB', capacity, 4);
    this.color = instanced(g, 'iColor', capacity, 4);
    this.misc = instanced(g, 'iMisc', capacity, 2);
    g.instanceCount = 0;
    this.geometry = g;
    this.material = new THREE.ShaderMaterial({
      ...premultiplied(),
      vertexShader: /* glsl */ `
        attribute vec2 corner;
        attribute vec4 iA;     // Anfang xyz, Breite
        attribute vec4 iB;     // Ende xyz, frei
        attribute vec4 iColor; // rgb (über 1 = leuchtet nach), Alpha
        attribute vec2 iMisc;  // Deckkraft-Anteil (0 = additiv, 1 = deckend), Form
        varying vec3 vLocal;
        varying vec4 vColor;
        varying vec2 vMisc;
        void main() {
          vec3 a = (viewMatrix * vec4(iA.xyz, 1.0)).xyz;
          vec3 b = (viewMatrix * vec4(iB.xyz, 1.0)).xyz;
          float hw = iA.w * 0.5;
          vec3 d = b - a;
          float len = length(d);
          vec3 dir = vec3(1.0, 0.0, 0.0);
          vec3 side = vec3(0.0, 1.0, 0.0);
          if (len > 1e-4) {
            dir = d / len;
            vec3 s = cross(dir, normalize((a + b) * 0.5));
            float sl = length(s);
            side = sl > 1e-4 ? s / sl : vec3(0.0, 1.0, 0.0);
          }
          vec3 p = (corner.x < 0.0 ? a : b) + dir * corner.x * hw + side * corner.y * hw;
          float l = len / max(hw, 1e-5);
          vLocal = vec3(corner.x < 0.0 ? -1.0 : l + 1.0, corner.y, l);
          vColor = iColor;
          vMisc = iMisc;
          gl_Position = projectionMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vLocal;
        varying vec4 vColor;
        varying vec2 vMisc;
        ${FINISH}
        void main() {
          float dx = max(max(-vLocal.x, vLocal.x - vLocal.z), 0.0);
          float f = clamp(1.0 - length(vec2(dx, vLocal.y)), 0.0, 1.0);
          float soft = f * f * (3.0 - 2.0 * f);
          float a;
          vec3 col = vColor.rgb;
          if (vMisc.y < 0.5) {
            a = soft * soft;
          } else if (vMisc.y < 1.5) {
            float core = smoothstep(0.5, 0.85, f);
            a = soft * soft * 0.55 + core * 0.45;
            col = mix(col, max(col, vec3(1.0)) * 1.15, core * 0.7);
          } else {
            a = smoothstep(0.0, 0.3, f);
          }
          a *= vColor.a;
          if (a < 0.003) discard;
          gl_FragColor = finish(col, a, vMisc.x);
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.name = 'fx:glow';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 30;
  }

  begin() {
    this.count = 0;
  }

  /**
   * Leuchtstrich von A nach B (A = B ergibt einen runden Fleck).
   * @param {number} ax @param {number} ay @param {number} az
   * @param {number} bx @param {number} by @param {number} bz
   * @param {number} width Breite bzw. Durchmesser in Feldern
   * @param {number} r @param {number} g @param {number} b lineare Farbe, Werte über 1 leuchten nach
   * @param {number} alpha
   * @param {number} [solid] 0 = additiv, 1 = deckend
   * @param {number} [shape] SHAPE_*
   */
  streak(ax, ay, az, bx, by, bz, width, r, g, b, alpha, solid = 0, shape = SHAPE_SOFT) {
    if (this.count >= this.capacity || alpha <= 0.004 || width <= 0) return;
    const i = this.count++;
    const i4 = i * 4;
    const a = this.a.array;
    a[i4] = ax;
    a[i4 + 1] = ay;
    a[i4 + 2] = az;
    a[i4 + 3] = width;
    const bb = this.b.array;
    bb[i4] = bx;
    bb[i4 + 1] = by;
    bb[i4 + 2] = bz;
    const c = this.color.array;
    c[i4] = r;
    c[i4 + 1] = g;
    c[i4 + 2] = b;
    c[i4 + 3] = alpha;
    const m = this.misc.array;
    m[i * 2] = solid;
    m[i * 2 + 1] = shape;
  }

  /**
   * Runder Leuchtfleck.
   * @param {number} x @param {number} y @param {number} z
   * @param {number} size Durchmesser in Feldern
   * @param {number} r @param {number} g @param {number} b
   * @param {number} alpha
   * @param {number} [solid]
   * @param {number} [shape]
   */
  blob(x, y, z, size, r, g, b, alpha, solid = 0, shape = SHAPE_SOFT) {
    this.streak(x, y, z, x, y, z, size, r, g, b, alpha, solid, shape);
  }

  end() {
    const n = this.count;
    this.geometry.instanceCount = n;
    this.mesh.visible = n > 0;
    upload(this.a.attr, n);
    upload(this.b.attr, n);
    upload(this.color.attr, n);
    upload(this.misc.attr, n);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ---------------------------------------------------------------------------------------------
// Ringe und Scheiben auf dem Boden
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {object} RingOpts
 * @property {number} [y] Höhe über dem Boden (Standard 0.03)
 * @property {number} [inner] Innenradius als Anteil des Außenradius (0 = Scheibe, 0.9 = dünner Ring; Standard 0.8)
 * @property {number} [soft] Weichheit der Kanten als Anteil des Radius (Standard 0.08)
 * @property {number} [fill] Deckkraft der Fläche innerhalb des Rings relativ zum Ring (Standard 0)
 * @property {number} [solid] 0 = additiv, 1 = deckend (Standard 1)
 * @property {number} [gain] Helligkeitsfaktor der Farbe (über 1.2 leuchtet nach; Standard 1)
 * @property {number} [hold] Anteil der Lebensdauer mit voller Deckkraft, bevor der Ring verblasst (Standard 0.3)
 * @property {number} [delay] Verzögerung in Sekunden
 */

const RING_FLOATS = 16;

export class DecalBatch {
  /** @param {number} capacity */
  constructor(capacity) {
    this.capacity = capacity;
    /** Anzahl lebender Ringe. */
    this.live = 0;
    /** Zustand je Ring: x, y, z, r0, r1, inner, soft, fill, solid, r, g, b, alpha, age, life, hold */
    this.data = new Float32Array(capacity * RING_FLOATS);
    const g = quadGeometry();
    this.pos = instanced(g, 'iPos', capacity, 4);
    this.shape = instanced(g, 'iShape', capacity, 4);
    this.color = instanced(g, 'iColor', capacity, 4);
    g.instanceCount = 0;
    this.geometry = g;
    /** Halbe Ausdehnung des Bereichs, in dem Ringe sichtbar sind (x, z), und Breite des weichen Randes. */
    this.clip = new THREE.Vector3(1e4, 1e4, 1);
    this.material = new THREE.ShaderMaterial({
      ...premultiplied(),
      uniforms: { uClip: { value: this.clip } },
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      vertexShader: /* glsl */ `
        attribute vec2 corner;
        attribute vec4 iPos;   // Mitte xyz, Außenradius
        attribute vec4 iShape; // Innenradius-Anteil, Weichheit, Füllung, Deckkraft-Anteil
        attribute vec4 iColor;
        varying vec2 vUv;
        varying vec2 vWorld;
        varying vec4 vShape;
        varying vec4 vColor;
        void main() {
          vUv = corner;
          vShape = iShape;
          vColor = iColor;
          vec3 p = iPos.xyz + vec3(corner.x, 0.0, corner.y) * iPos.w;
          vWorld = p.xz;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uClip;
        varying vec2 vUv;
        varying vec2 vWorld;
        varying vec4 vShape;
        varying vec4 vColor;
        ${FINISH}
        void main() {
          float r = length(vUv);
          float outer = 1.0 - smoothstep(1.0 - vShape.y, 1.0, r);
          float ring = outer * smoothstep(vShape.x - vShape.y, vShape.x, r);
          float a = max(ring, outer * vShape.z) * vColor.a;
          // Außerhalb der Insel (abgerundetes Rechteck um das Spielfeld) weich ausblenden, damit kein Ring in der Luft hängt.
          vec2 q = abs(vWorld) - uClip.xy + 1.5;
          float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 1.5;
          a *= 1.0 - smoothstep(0.0, uClip.z, d);
          if (a < 0.003) discard;
          gl_FragColor = finish(vColor.rgb, a, vShape.w);
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.name = 'fx:decals';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
  }

  /**
   * Ein Ring, der in `life` Sekunden von r0 auf r1 wächst und dabei verblasst.
   * @param {number} x @param {number} z
   * @param {number} r0 @param {number} r1
   * @param {number} life
   * @param {THREE.Color} color
   * @param {number} alpha
   * @param {RingOpts} [o]
   */
  ring(x, z, r0, r1, life, color, alpha, o) {
    let i = this.live;
    if (i >= this.capacity) {
      // Voll: den ältesten (relativ zur Lebensdauer am weitesten fortgeschrittenen) Ring ersetzen.
      let best = 0;
      let bestT = -1;
      for (let k = 0; k < this.capacity; k++) {
        const t = this.data[k * RING_FLOATS + 13] / this.data[k * RING_FLOATS + 14];
        if (t > bestT) {
          bestT = t;
          best = k;
        }
      }
      i = best;
    } else {
      this.live++;
    }
    const d = this.data;
    const k = i * RING_FLOATS;
    const gain = o?.gain ?? 1;
    d[k] = x;
    d[k + 1] = o?.y ?? 0.03;
    d[k + 2] = z;
    d[k + 3] = r0;
    d[k + 4] = r1;
    d[k + 5] = o?.inner ?? 0.8;
    d[k + 6] = o?.soft ?? 0.08;
    d[k + 7] = o?.fill ?? 0;
    d[k + 8] = o?.solid ?? 1;
    d[k + 9] = color.r * gain;
    d[k + 10] = color.g * gain;
    d[k + 11] = color.b * gain;
    d[k + 12] = alpha;
    d[k + 13] = -(o?.delay ?? 0);
    d[k + 14] = Math.max(life, 0.01);
    d[k + 15] = o?.hold ?? 0.3;
  }

  /** @param {number} dt */
  update(dt) {
    const d = this.data;
    let n = 0;
    const pos = this.pos.array;
    const shape = this.shape.array;
    const color = this.color.array;
    for (let i = 0; i < this.live; i++) {
      const k = i * RING_FLOATS;
      d[k + 13] += dt;
      const age = d[k + 13];
      const life = d[k + 14];
      if (age >= life) {
        // Letzten lebenden Ring an diese Stelle holen.
        this.live--;
        if (i < this.live) d.copyWithin(k, this.live * RING_FLOATS, (this.live + 1) * RING_FLOATS);
        i--;
        continue;
      }
      if (age < 0) continue;
      const t = age / life;
      const grow = 1 - (1 - t) * (1 - t) * (1 - t);
      const hold = d[k + 15];
      const fade = t < hold ? 1 : 1 - (t - hold) / (1 - hold);
      const appear = Math.min(1, age / 0.05);
      const n4 = n * 4;
      pos[n4] = d[k];
      pos[n4 + 1] = d[k + 1];
      pos[n4 + 2] = d[k + 2];
      pos[n4 + 3] = d[k + 3] + (d[k + 4] - d[k + 3]) * grow;
      shape[n4] = d[k + 5];
      shape[n4 + 1] = d[k + 6];
      shape[n4 + 2] = d[k + 7];
      shape[n4 + 3] = d[k + 8];
      color[n4] = d[k + 9];
      color[n4 + 1] = d[k + 10];
      color[n4 + 2] = d[k + 11];
      color[n4 + 3] = d[k + 12] * fade * fade * (3 - 2 * fade) * appear;
      n++;
    }
    this.geometry.instanceCount = n;
    this.mesh.visible = n > 0;
    upload(this.pos.attr, n);
    upload(this.shape.attr, n);
    upload(this.color.attr, n);
  }

  clear() {
    this.live = 0;
    this.geometry.instanceCount = 0;
    this.mesh.visible = false;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ---------------------------------------------------------------------------------------------
// Pfützen
// ---------------------------------------------------------------------------------------------

const ZONE_SEGMENTS = 40;

export class ZoneBatch {
  /** @param {number} capacity */
  constructor(capacity) {
    this.capacity = capacity;
    this.count = 0;
    const g = new THREE.InstancedBufferGeometry();
    // Fächer aus Dreiecken: `fan` = (Winkel, 0 in der Mitte bzw. 1 am Rand).
    const fan = new Float32Array(ZONE_SEGMENTS * 3 * 2);
    for (let s = 0; s < ZONE_SEGMENTS; s++) {
      const a0 = (s / ZONE_SEGMENTS) * Math.PI * 2;
      const a1 = ((s + 1) / ZONE_SEGMENTS) * Math.PI * 2;
      // Reihenfolge so, dass die Oberseite (+Y) vorn ist.
      fan.set([0, 0, a1, 1, a0, 1], s * 6);
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ZONE_SEGMENTS * 9), 3));
    g.setAttribute('fan', new THREE.BufferAttribute(fan, 2));
    this.pos = instanced(g, 'iPos', capacity, 4);
    this.color = instanced(g, 'iColor', capacity, 4);
    this.rim = instanced(g, 'iRim', capacity, 4);
    g.instanceCount = 0;
    this.geometry = g;
    this.uniforms = { uTime: { value: 0 }, uLight: sceneLight };
    this.material = new THREE.ShaderMaterial({
      ...premultiplied(),
      uniforms: this.uniforms,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      vertexShader: /* glsl */ `
        attribute vec2 fan;
        attribute vec4 iPos;   // Mitte xyz, Radius
        attribute vec4 iColor; // rgb, Zufallswert 0..1
        attribute vec4 iRim;   // rgb, Deckkraft
        uniform float uTime;
        varying vec2 vP;
        varying float vR;
        varying vec4 vColor;
        varying vec4 vRim;
        void main() {
          float th = fan.x;
          float s = iColor.w * 6.2832;
          float k = 1.0 + 0.085 * sin(3.0 * th + s * 3.0) + 0.05 * sin(5.0 * th - s * 7.0 + uTime * 0.9)
                  + 0.03 * sin(2.0 * th + s + uTime * 1.4);
          vec2 dir = vec2(cos(th), sin(th)) * fan.y * k;
          vP = dir;
          vR = fan.y;
          vColor = iColor;
          vRim = iRim;
          vec3 p = iPos.xyz + vec3(dir.x, 0.0, dir.y) * iPos.w;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uLight;
        uniform float uTime;
        varying vec2 vP;
        varying float vR;
        varying vec4 vColor;
        varying vec4 vRim;
        ${FINISH}
        void main() {
          if (vColor.w >= 2.0) {
            // Brandfeld (Superwaffe des Werfers): verkohlter Boden, in dem Glutadern ruhig auf- und abglimmen,
            // dazu ein warmer Saum. Die Glut ist unbeleuchtet, damit sie auch nachts liest; kein Flackern.
            // Ab 4: brennender Teer (das Feld bremst auch): dunkel glänzende Masse, schmalere Glutadern, ruhiger.
            float tar = step(4.0, vColor.w);
            float s = fract(vColor.w) * 6.2832;
            vec3 fire = vColor.rgb;
            vec3 char = mix(fire * 0.18 + vec3(0.07, 0.045, 0.035), fire * 0.06 + vec3(0.075, 0.055, 0.05), tar) * (0.55 + 0.45 * uLight);
            vec2 w = vP * 3.2;
            float vein = abs(sin(w.x * 2.3 + sin(w.y * 1.7 + s) * 1.4 + s * 3.0))
                       * abs(sin(w.y * 2.1 + sin(w.x * 1.3 - s) * 1.2 - s * 2.0));
            float breathe = 0.75 + 0.25 * sin(uTime * 1.6 + s * 4.0 + vR * 3.0);
            // Glutadern = schmale Täler zwischen den Schollen.
            float glow = (1.0 - smoothstep(0.0, mix(0.16, 0.085, tar), vein)) * breathe * mix(1.0, 0.85, tar);
            float heart = (1.0 - smoothstep(0.0, 0.75, vR)) * mix(0.4, 0.12, tar) * breathe;
            float hem = smoothstep(0.66, 0.86, vR) * (1.0 - smoothstep(0.86, 1.0, vR));
            vec3 hot = fire * 1.6 + vec3(0.3, 0.15, 0.0) * glow;
            vec3 col = mix(char, hot, clamp(glow * 0.9 + heart + hem * 0.45, 0.0, 1.0));
            col = mix(col, vRim.rgb * 1.2, hem * 0.2);
            // Teer: zwei weiche Glanzlichter wie auf der Pfütze des Bremsers.
            vec2 g1 = vP - vec2(-0.28 + 0.03 * sin(uTime * 0.7 + s), -0.3);
            vec2 g2 = vP - vec2(0.26, 0.2);
            float gloss = smoothstep(0.26, 0.0, length(g1 * vec2(1.0, 1.9))) * 0.4 + smoothstep(0.14, 0.0, length(g2 * vec2(1.6, 1.0))) * 0.25;
            col += tar * gloss * (0.15 + 0.6 * uLight) * (1.0 - glow);
            float edge = 1.0 - smoothstep(0.82, 1.0, vR);
            float a = (0.8 + 0.15 * glow) * edge * vRim.a;
            gl_FragColor = finish(col, a, 0.82);
            return;
          }
          // Körper: zur Mitte etwas dunkler (Tiefe), zwei weiche Glanzlichter wie auf einer Flüssigkeit.
          vec3 body = vColor.rgb * mix(0.82, 1.06, smoothstep(0.0, 0.9, vR)) * uLight;
          float s = vColor.w * 6.2832;
          vec2 h1 = vP - vec2(-0.30 + 0.03 * sin(uTime * 0.8 + s), -0.34);
          vec2 h2 = vP - vec2(0.28, 0.18 + 0.03 * sin(uTime * 0.6 + s * 2.0));
          float gloss = smoothstep(0.30, 0.0, length(h1 * vec2(1.0, 1.9))) * 0.55
                      + smoothstep(0.16, 0.0, length(h2 * vec2(1.6, 1.0))) * 0.35;
          vec3 col = body + gloss * (0.2 + 0.8 * uLight);
          float rim = smoothstep(0.84, 0.9, vR);
          col = mix(col, vRim.rgb, rim * 0.9);
          float edge = 1.0 - smoothstep(0.975, 1.0, vR);
          float a = mix(0.9, 1.0, rim) * edge * vRim.a;
          gl_FragColor = finish(col, a, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.name = 'fx:zones';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  begin() {
    this.count = 0;
  }

  /**
   * @param {number} x @param {number} y @param {number} z
   * @param {number} radius
   * @param {THREE.Color} color Farbe der Flüssigkeit
   * @param {THREE.Color} rim Randfarbe (Rollenfarbe)
   * @param {number} seed 0..1; plus 2 für ein Brandfeld statt einer Pfütze (dann ist `color` die Glutfarbe), plus 4 für
   *   brennenden Teer (ein Brandfeld, das auch bremst)
   * @param {number} alpha
   */
  add(x, y, z, radius, color, rim, seed, alpha) {
    if (this.count >= this.capacity) return;
    const i4 = this.count++ * 4;
    const p = this.pos.array;
    p[i4] = x;
    p[i4 + 1] = y;
    p[i4 + 2] = z;
    p[i4 + 3] = radius;
    const c = this.color.array;
    c[i4] = color.r;
    c[i4 + 1] = color.g;
    c[i4 + 2] = color.b;
    c[i4 + 3] = seed;
    const r = this.rim.array;
    r[i4] = rim.r;
    r[i4 + 1] = rim.g;
    r[i4 + 2] = rim.b;
    r[i4 + 3] = alpha;
  }

  /** @param {number} time */
  end(time) {
    const n = this.count;
    this.uniforms.uTime.value = time;
    this.geometry.instanceCount = n;
    this.mesh.visible = n > 0;
    upload(this.pos.attr, n);
    upload(this.color.attr, n);
    upload(this.rim.attr, n);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ---------------------------------------------------------------------------------------------
// Schwebende Zahlen
// ---------------------------------------------------------------------------------------------

const ATLAS_COLS = 8;
const ATLAS_ROWS = 8;
const CELL_W = 128;
const CELL_H = 64;
const TEXT_FLOATS = 8;

/** Schwebende, zur Kamera gedrehte Texte. Jeder unterschiedliche Text wird einmal in ein Feld des Atlas gemalt. */
export class TextBatch {
  /** @param {number} capacity Höchstzahl gleichzeitig sichtbarer Texte */
  constructor(capacity) {
    this.capacity = capacity;
    this.live = 0;
    /** Zustand je Text: x, y, z, Größe, Atlasfeld, Alter, Lebensdauer, Steighöhe */
    this.data = new Float32Array(capacity * TEXT_FLOATS);
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS_COLS * CELL_W;
    this.canvas.height = ATLAS_ROWS * CELL_H;
    this.ctx = /** @type {CanvasRenderingContext2D} */ (this.canvas.getContext('2d'));
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.anisotropy = 4;
    /** Atlasfeld je Schlüssel "Farbe|Text". @type {Map<string, number>} */
    this.cells = new Map();
    /** Schlüssel je Atlasfeld. @type {(string | null)[]} */
    this.cellKeys = new Array(ATLAS_COLS * ATLAS_ROWS).fill(null);
    /** Zeitpunkt der letzten Benutzung je Atlasfeld. */
    this.cellUsed = new Float64Array(ATLAS_COLS * ATLAS_ROWS);
    /** Breite des gemalten Textes je Atlasfeld als Anteil der Feldbreite. */
    this.cellWidth = new Float32Array(ATLAS_COLS * ATLAS_ROWS);
    this.clock = 0;

    const g = quadGeometry();
    this.pos = instanced(g, 'iPos', capacity, 4);
    this.uv = instanced(g, 'iUv', capacity, 4);
    g.instanceCount = 0;
    this.geometry = g;
    this.material = new THREE.ShaderMaterial({
      ...premultiplied(),
      depthTest: false,
      uniforms: { map: { value: this.texture } },
      vertexShader: /* glsl */ `
        attribute vec2 corner;
        attribute vec4 iPos; // Anker xyz, Höhe des Schriftfelds in Feldern
        attribute vec4 iUv;  // Atlasfeld: u, v, Deckkraft, Breitenfaktor
        varying vec2 vUv;
        varying float vAlpha;
        void main() {
          vec3 c = (viewMatrix * vec4(iPos.xyz, 1.0)).xyz;
          vec2 ext = vec2(${(CELL_W / CELL_H).toFixed(1)}, 1.0) * iPos.w * 0.5;
          c.xy += corner * ext * vec2(iUv.w, 1.0);
          vUv = iUv.xy + (vec2(corner.x * iUv.w, corner.y) * 0.5 + 0.5) * vec2(${(1 / ATLAS_COLS).toFixed(5)}, ${(1 / ATLAS_ROWS).toFixed(5)});
          vAlpha = iUv.z;
          gl_Position = projectionMatrix * vec4(c, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        varying vec2 vUv;
        varying float vAlpha;
        ${FINISH}
        void main() {
          vec4 t = texture2D(map, vUv);
          float a = t.a * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = finish(t.rgb, a, 1.0);
        }`,
    });
    this.material.toneMapped = false;
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.name = 'fx:text';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 60;
  }

  /**
   * Liefert das Atlasfeld eines Textes und malt ihn bei Bedarf.
   * @param {string} text
   * @param {string} color CSS-Farbe der Schrift
   * @param {string} outline CSS-Farbe der Kontur
   * @returns {number}
   */
  cell(text, color, outline) {
    const key = `${color}|${text}`;
    this.clock++;
    let index = this.cells.get(key);
    if (index !== undefined) {
      this.cellUsed[index] = this.clock;
      return index;
    }
    // Freies oder am längsten unbenutztes Feld nehmen.
    index = 0;
    for (let i = 0; i < this.cellUsed.length; i++) {
      if (this.cellUsed[i] < this.cellUsed[index]) index = i;
    }
    const oldKey = this.cellKeys[index];
    if (oldKey !== null) this.cells.delete(oldKey);
    this.cells.set(key, index);
    this.cellKeys[index] = key;
    this.cellUsed[index] = this.clock;
    const ctx = this.ctx;
    const x = (index % ATLAS_COLS) * CELL_W;
    const y = Math.floor(index / ATLAS_COLS) * CELL_H;
    ctx.clearRect(x, y, CELL_W, CELL_H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, CELL_W, CELL_H);
    ctx.clip();
    ctx.font = '800 40px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const width = Math.min(ctx.measureText(text).width + 14, CELL_W - 4);
    ctx.lineWidth = 9;
    ctx.strokeStyle = outline;
    ctx.strokeText(text, x + CELL_W / 2, y + CELL_H / 2 + 2, CELL_W - 14);
    ctx.fillStyle = color;
    ctx.fillText(text, x + CELL_W / 2, y + CELL_H / 2 + 2, CELL_W - 14);
    ctx.restore();
    this.cellWidth[index] = width / CELL_W;
    this.texture.needsUpdate = true;
    return index;
  }

  /**
   * Lässt einen Text aufsteigen und verblassen.
   * @param {string} text
   * @param {number} x @param {number} y @param {number} z Anker in Weltkoordinaten
   * @param {string} color
   * @param {string} outline
   * @param {{ size?: number, life?: number, rise?: number }} [o] size = Höhe des Schriftfelds in Feldern
   */
  add(text, x, y, z, color, outline, o) {
    let i = this.live;
    const d = this.data;
    if (i >= this.capacity) {
      // Voll: den ältesten Text fallen lassen (alle rücken eins auf).
      d.copyWithin(0, TEXT_FLOATS, this.capacity * TEXT_FLOATS);
      i = this.capacity - 1;
    } else {
      this.live++;
    }
    const k = i * TEXT_FLOATS;
    d[k] = x;
    d[k + 1] = y;
    d[k + 2] = z;
    d[k + 3] = o?.size ?? 0.5;
    d[k + 4] = this.cell(text, color, outline);
    d[k + 5] = 0;
    d[k + 6] = o?.life ?? 0.9;
    d[k + 7] = o?.rise ?? 0.75;
  }

  /** @param {number} dt */
  update(dt) {
    const d = this.data;
    const pos = this.pos.array;
    const uv = this.uv.array;
    let n = 0;
    for (let i = 0; i < this.live; i++) {
      const k = i * TEXT_FLOATS;
      d[k + 5] += dt;
      const t = d[k + 5] / d[k + 6];
      if (t >= 1) continue;
      // Überlebende nach vorn rücken (Reihenfolge = Alter bleibt erhalten).
      if (n !== i) d.copyWithin(n * TEXT_FLOATS, k, k + TEXT_FLOATS);
      const m = n * TEXT_FLOATS;
      const cell = d[m + 4];
      const rise = 1 - (1 - t) * (1 - t);
      // Kurz aufploppen, dann ruhig steigen; im letzten Drittel verblassen.
      const pop = t < 0.14 ? 0.6 + 0.5 * (t / 0.14) : 1.1 - 0.1 * Math.min(1, (t - 0.14) / 0.12);
      const n4 = n * 4;
      pos[n4] = d[m];
      pos[n4 + 1] = d[m + 1] + d[m + 7] * rise;
      pos[n4 + 2] = d[m + 2];
      pos[n4 + 3] = d[m + 3] * pop;
      uv[n4] = (cell % ATLAS_COLS) / ATLAS_COLS;
      uv[n4 + 1] = 1 - (Math.floor(cell / ATLAS_COLS) + 1) / ATLAS_ROWS;
      uv[n4 + 2] = Math.min(1, t / 0.08) * (t < 0.62 ? 1 : 1 - (t - 0.62) / 0.38);
      uv[n4 + 3] = this.cellWidth[cell];
      n++;
    }
    this.live = n;
    this.geometry.instanceCount = n;
    this.mesh.visible = n > 0;
    upload(this.pos.attr, n);
    upload(this.uv.attr, n);
  }

  clear() {
    this.live = 0;
    this.geometry.instanceCount = 0;
    this.mesh.visible = false;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
