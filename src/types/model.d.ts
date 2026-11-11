// Vertrag für prozedurale 3D-Modelle. Alle Modelle entstehen mit dem Baukasten in src/render/kit.js.
import type { BufferGeometry, Euler, Vector3 } from 'three';

export type Vec3 = [number, number, number];
/** Farbe als '#rrggbb' oder 0xrrggbb. */
export type ColorLike = string | number;

/** Optionen, die jedes Primitiv versteht. */
export interface PrimOpts {
  /** Mittelpunkt des Primitivs im Modellraum. Alternative zu `base`. Standard [0,0,0]. */
  at?: Vec3;
  /** Mittelpunkt der Unterseite im Modellraum (praktisch zum Stapeln). Die Drehung `rot` dreht dann um diesen Punkt. */
  base?: Vec3;
  /** Euler-Drehung XYZ in Radiant. */
  rot?: Vec3;
  /** Skalierung des Primitivs vor der Drehung. */
  scale?: number | Vec3;
  /** Grundfarbe. Standard '#ffffff'. */
  color?: ColorLike;
  /** Farbe an der Oberkante: senkrechter Verlauf von `color` (unten) nach `colorTop` (oben). */
  colorTop?: ColorLike;
  /** Abdunklung zur Unterkante hin, 0..1. Wirkt nur ohne `colorTop`. Standard siehe ModelBuilder.defaults. */
  shade?: number;
  /** Zufällige Helligkeitsabweichung je Dreieck, 0..1. Gut für Fels, Laub, Fell. */
  faceJitter?: number;
  /** Zufällige Helligkeitsabweichung des ganzen Primitivs, 0..1. */
  jitter?: number;
  /** true oder Helligkeitsfaktor: unbeleuchtetes, leuchtendes Material (Feuer, Neon, Energie, Fenster bei Nacht). */
  glow?: boolean | number;
  /** Fügt zusätzlich das an der YZ-Ebene gespiegelte Gegenstück hinzu (x wird zu -x): Augen, Hörner, Räder, Arme. */
  mirror?: boolean;
}

export interface BoxOpts extends PrimOpts { /** [Breite x, Höhe y, Tiefe z] */ size: Vec3; }
export interface CylOpts extends PrimOpts { /** Radius unten */ r: number; /** Radius oben (Standard = r) */ rTop?: number; /** Höhe */ h: number; /** Segmente (Standard 8) */ seg?: number; /** ohne Deckel/Boden */ open?: boolean; }
export interface ConeOpts extends PrimOpts { r: number; h: number; /** Segmente (Standard 8) */ seg?: number; }
export interface SphereOpts extends PrimOpts { r: number; /** Unterteilung des Ikosaeders: 0 = 20 Flächen, 1 = 80 (Standard), 2 = 320 */ detail?: number; }
export interface CapsuleOpts extends PrimOpts { /** Radius */ r: number; /** Länge des geraden Mittelstücks; Gesamthöhe = h + 2 r */ h: number; /** Segmente rundum (Standard 6) */ seg?: number; }
export interface DomeOpts extends PrimOpts { r: number; /** Segmente rundum (Standard 8) */ seg?: number; /** Ringe (Standard 3) */ rings?: number; }
export interface TorusOpts extends PrimOpts { /** Ringradius */ r: number; /** Rohrradius */ tube: number; /** Segmente rundum (Standard 12) */ seg?: number; /** Segmente des Rohrs (Standard 5) */ tubeSeg?: number; /** Bogenlänge in Radiant (Standard 2*PI) */ arc?: number; }
export interface PyramidOpts extends PrimOpts { /** [Breite x, Höhe y, Tiefe z] */ size: Vec3; }
export interface ExtrudeOpts extends PrimOpts { /** Umriss in der XY-Ebene, gegen den Uhrzeigersinn */ points: [number, number][]; /** Dicke entlang Z (um z = 0 zentriert) */ depth: number; }
export interface LatheOpts extends PrimOpts { /** Profil als [Radius, Höhe], von unten nach oben. Mit Radius 0 beginnen und enden, sonst bleibt der Körper oben bzw. unten offen. */ points: [number, number][]; /** Segmente rundum (Standard 8) */ seg?: number; }

export interface PartOpts {
  /** Drehpunkt des Teils im Modellraum (Ruhepose). Standard [0,0,0]. */
  pivot?: Vec3;
  /** Name des Elternteils; ohne Angabe hängt das Teil direkt an der Instanz. */
  parent?: string | null;
  /** Das Teil ist erst ab dieser Turmstufe sichtbar (1..3). Standard 1. */
  minLevel?: number;
  /** Das Teil ist nur bis zu dieser Turmstufe sichtbar. Standard 99. */
  maxLevel?: number;
}

/** Lage eines Teils relativ zu seiner Ruhepose. Wird vor jedem animate()-Aufruf zurückgesetzt. */
export interface PoseNode {
  /** Verschiebung gegenüber der Ruhelage, im Koordinatensystem des Elternteils. */
  position: Vector3;
  /** Drehung um den Drehpunkt des Teils. */
  rotation: Euler;
  scale: Vector3;
}
export type Pose = Record<string, PoseNode>;

/** Eingaben für die prozedurale Animation eines Modells. Nicht benötigte Felder sind 0. */
export interface AnimCtx {
  /** Sekunden seit Erscheinen der Instanz; steht bei Spielpause still. */
  t: number;
  /** Zufallswert 0..1 je Instanz, für Phasenversatz. */
  seed: number;
  /** Laufphase in Radiant; wächst mit der zurückgelegten Strecke (2*PI je Schrittzyklus). Gegner. */
  walk: number;
  /** Aktuelle Geschwindigkeit relativ zur Grundgeschwindigkeit, 0 = steht. Gegner. */
  move: number;
  /** Lebenspunkte 0..1. Gegner. */
  hp: number;
  /** 1 direkt nach einem Treffer, klingt in ca. 0,25 s auf 0 ab. Gegner. */
  hurt: number;
  /** Zielrichtung als Drehung um Y in Radiant, 0 = Modell-Vorwärtsrichtung (+Z). Türme. */
  aimYaw: number;
  /** Zielhöhe als Winkel in Radiant, positiv = nach oben. Türme. */
  aimPitch: number;
  /** 1 im Moment des Schusses, klingt in ca. 0,3 s auf 0 ab (Rückstoß, Mündungsblitz). Türme. */
  fire: number;
  /** Ladefortschritt 0..1 (0 direkt nach dem Schuss, 1 schussbereit). Türme. */
  charge: number;
  /** 1, solange der Turm ein Ziel hat, sonst 0 (weich überblendet). Türme. */
  active: number;
  /** Ausbaustufe 1..3. Türme. */
  level: number;
}

export interface PartSpec {
  name: string;
  /** Index des Elternteils in ModelSpec.parts oder -1. Eltern stehen immer vor ihren Kindern. */
  parent: number;
  /** Ruhelage des Drehpunkts relativ zum Drehpunkt des Elternteils (bzw. zum Modellursprung). */
  offset: Vec3;
  /** Drehpunkt im Modellraum. */
  pivot: Vec3;
  /** Beleuchtete Geometrie relativ zum Drehpunkt, mit Vertexfarben; null, wenn leer. */
  geometry: BufferGeometry | null;
  /** Leuchtende Geometrie relativ zum Drehpunkt; null, wenn leer. */
  glowGeometry: BufferGeometry | null;
  minLevel: number;
  maxLevel: number;
}

export interface ModelPoint {
  /** Index des Teils, an dem der Punkt hängt. */
  part: number;
  /** Position relativ zum Drehpunkt dieses Teils. */
  local: Vec3;
}

export interface ModelSpec {
  id: string;
  parts: PartSpec[];
  /** Benannte Punkte, z. B. 'muzzle' (Mündung) oder 'top'. */
  points: Record<string, ModelPoint>;
  /** Prozedurale Animation; verändert nur `pose`. Darf nichts allozieren. */
  animate: ((pose: Pose, ctx: AnimCtx) => void) | null;
  /** Ausdehnung in der Ruhepose. */
  bounds: { min: Vec3; max: Vec3; /** größter waagerechter Abstand vom Ursprung */ radius: number; height: number };
  triangles: number;
  /** Strecke in Feldern je vollem Schrittzyklus (Gegner). Standard 0.6. */
  stride: number;
}

export interface BuildOpts {
  animate?: (pose: Pose, ctx: AnimCtx) => void;
  /** Strecke in Feldern je vollem Schrittzyklus (Gegner). */
  stride?: number;
}

/** Eine Modelldefinition: baut mit dem Baukasten (src/render/kit.js) ein ModelSpec. Wird höchstens einmal aufgerufen. */
export type ModelFactory = () => ModelSpec;

/** Lichtstimmung: Himmel, Sonne, Nebel. Teil des Zeitalter-Themas. */
export interface LightTheme {
  /** Himmelsfarbe im Zenit. */
  skyTop: ColorLike;
  /** Himmelsfarbe am Horizont. */
  skyHorizon: ColorLike;
  /** Farbe unterhalb des Horizonts (Tiefe unter der Insel). Standard = skyHorizon. */
  skyBottom?: ColorLike;
  sunColor: ColorLike;
  /** Stärke des Sonnenlichts (etwa 0.4 bei Nacht bis 3 am Mittag). */
  sunIntensity: number;
  /** Sonnenhöhe über dem Horizont in Grad. */
  sunElevation: number;
  /** Himmelsrichtung der Sonne in Grad (0 = +Z, 90 = +X). */
  sunAzimuth: number;
  /** Stärke von Sonnenscheibe und Hof am Himmel. Standard 1. */
  sunGlow?: number;
  hemiSky: ColorLike;
  hemiGround: ColorLike;
  hemiIntensity: number;
  /** Stärke des Gegenlichts. Standard 0.35. */
  fillIntensity?: number;
  fogColor: ColorLike;
  /** Dichte des exponentiellen Nebels (0 = aus, üblich 0.003..0.02). */
  fogDensity: number;
  /** Belichtung der Tonwertkurve. Standard 1. */
  exposure?: number;
}
