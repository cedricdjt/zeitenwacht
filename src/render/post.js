// @ts-check
// Nachbearbeitung für die hohe Grafikstufe: sanftes Überstrahlen (Bloom) leuchtender Flächen.
// Ohne PostFx zeichnet der Renderer direkt; beide Wege verwenden dieselbe Tonwertkurve und sehen bis auf das Leuchten gleich aus.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class PostFx {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   */
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    // Halbe Gleitkommagenauigkeit, damit Werte über 1 (leuchtende Flächen) bis zum Bloom erhalten bleiben; MSAA gegen Treppchen.
    this.target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, this.target);
    this.renderPass = new RenderPass(scene, camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.35, 0.55, 1.12);
    // Schwelle auf den hellsten Farbkanal statt auf die Helligkeit beziehen: So überstrahlen auch satte Farben
    // (rotes Feuer, blaues Neon), während sonnenbeschienene helle Flächen (höchstens etwa 1,06) ruhig bleiben.
    this.bloom.materialHighPassFilter.fragmentShader = /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec3 defaultColor;
      uniform float defaultOpacity;
      uniform float luminosityThreshold;
      uniform float smoothWidth;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D( tDiffuse, vUv );
        float v = max( texel.r, max( texel.g, texel.b ) );
        vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );
        float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );
        gl_FragColor = mix( outputColor, texel, alpha );
      }`;
    /** @type {Record<string, THREE.IUniform>} */ (this.bloom.highPassUniforms).smoothWidth.value = 0.35;
    this.bloom.materialHighPassFilter.needsUpdate = true;
    this.output = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.output);
  }

  /**
   * Stärke, Radius und Schwelle des Leuchtens. Die Schwelle (Standard 1.12) bezieht sich auf den hellsten Farbkanal.
   * @param {number} strength
   * @param {number} [radius]
   * @param {number} [threshold]
   */
  setBloom(strength, radius = this.bloom.radius, threshold = this.bloom.threshold) {
    this.bloom.strength = strength;
    this.bloom.radius = radius;
    this.bloom.threshold = threshold;
  }

  /**
   * Nach einer Größenänderung des Renderers aufrufen.
   * @param {number} width CSS-Pixel
   * @param {number} height CSS-Pixel
   * @param {number} pixelRatio
   */
  setSize(width, height, pixelRatio) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
  }

  /** @param {number} [dt] */
  render(dt) {
    this.composer.render(dt);
  }

  dispose() {
    this.composer.dispose();
    this.target.dispose();
    this.bloom.dispose();
    this.output.dispose();
  }
}
