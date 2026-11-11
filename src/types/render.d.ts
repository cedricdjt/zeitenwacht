// Interne Verträge der Bühne: Welt, Figuren und Effekte. Die Bühne (src/render/stage.js) setzt sie zusammen
// und erfüllt nach außen den Vertrag `Stage` aus app.d.ts.
import type * as THREE from 'three';
import type { ModelMaterials } from '../render/instances.js';
import type { Quality, Settings } from './app';
import type { Content, MapDef } from './content';
import type { Enemy, Sim, SimEvent, Tower } from './sim';

/** Was die Bühne ihren Teilen mitgibt. */
export interface RenderEnv {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** Die zwei Materialien aller Modelle (createMaterials() aus look.js). */
  materials: ModelMaterials;
  content: Content;
}

// ---------------------------------------------------------------------------------------------
// Welt: Insel, Umgebung, Licht, Dekoration, Basis und Portale
// ---------------------------------------------------------------------------------------------

export interface World {
  /** Wurzel aller Objekte der Welt; hängt bereits in der Szene. */
  readonly group: THREE.Group;
  /**
   * Baut Insel, Weg, Umgebung, Licht und Dekoration für eine Karte im Kleid eines Zeitalters (ersetzt eine frühere Welt).
   * Hat die Karte Stufen (`map.stages`), zeigt die Insel die Wege, die in diesem Zeitalter gelten (wie Sim.pathStage, gezählt
   * über `content.ages`); Felder künftiger Wege tragen eine zarte Spur, alte Wege vergrasen. Dekoration weicht allen Wegen aller Stufen.
   */
  build(map: MapDef, ageIndex: number): void;
  /**
   * Wechselt zum Kleid eines anderen Zeitalters: Eine Zeitwelle läuft vom Punkt (x, z) über die Insel; hinter ihr sind Boden, Weg,
   * Dekoration und Basis bereits verwandelt. Licht, Himmel, Nebel und Umgebung blenden über die Dauer weich über.
   * Gilt im neuen Zeitalter ein anderer Satz Wege, wechselt auch der Weg mit der Front: Das neue Stück senkt sich ein, das alte
   * wird zum alten Weg, ein neues Tor wächst heran, ein nicht mehr benutztes vergeht.
   */
  transitionTo(ageIndex: number, opts?: { duration?: number; x?: number; z?: number }): void;
  /** Stufe (Zeitalter, ab dem der Satz Wege gilt), deren Wege die Insel zeigt (während einer Welle schon die neue); ohne Stufen 0. */
  readonly pathStage: number;
  /**
   * Hebt Wegstücke hervor: 'coming' = was mit der Stufe `stage` neu hinzukommt (atmet ruhig, vor dem Wechsel); 'new' = was die
   * jetzt geltende Stufe `stage` gegenüber der vorigen neu hat (pulsiert nach dem Wechsel einige Male, dann leise). null = aus.
   */
  setPathHint(hint: { stage: number; kind: 'coming' | 'new' } | null): void;
  /** Hebt das Bodenzeichen eines besonderen Bauplatzes sanft hervor (etwa unter dem Zeiger); null oder ein gewöhnliches Feld = aus. */
  highlightSpecialTile(tile: { tx: number; tz: number } | null): void;
  /** In jedem Bild aufrufen. dt = echte Sekunden. */
  update(dt: number): void;
  /** Meldet, dass auf einem Feld gebaut bzw. ein Turm entfernt wurde: Kleine Bodendeko dort verschwindet bzw. kehrt zurück. */
  setTileOccupied(tx: number, tz: number, occupied: boolean): void;
  /** Blendet ein dezentes Raster über allen bebaubaren Feldern ein oder aus. */
  setGridVisible(visible: boolean): void;
  /** Zeigt die Luftlinien (gepunktete Spur vom Eingang zur Basis in Flughöhe) an oder blendet sie aus. */
  setFlightLines(visible: boolean): void;
  /** Anteil der verbliebenen Leben 0..1; steuert die Größe der Flamme der Basis (ctx.hp des Basismodells). */
  setFlame(fraction: number): void;
  /** Grafikstufe: Schatten, Dichte der Dekoration, Schwebeteilchen. */
  setQuality(quality: Quality): void;
  /** Zustand der laufenden Zeitwelle oder null. radius = aktueller Radius der Wellenfront in Feldern. */
  readonly wave: { x: number; z: number; radius: number; progress: number } | null;
  /** Index des Zeitalters, dessen Kleid die Welt trägt (während einer Welle schon das neue). */
  readonly ageIndex: number;
  /** Aktuelle Belichtung und Bloom-Stärke (während eines Übergangs überblendet); die Bühne übernimmt sie in Renderer und Nachbearbeitung. */
  readonly exposure: number;
  readonly bloom: number;
  /** Größter Abstand eines Inselpunkts vom Ursprung, zum Einpassen der Kamera. */
  readonly radius: number;
  /** Mitte des Basisfeldes und der Eingänge in Weltkoordinaten. */
  readonly base: { x: number; z: number };
  readonly entrances: { x: number; z: number }[];
  /** Lässt die Basis kurz aufleuchten/erzittern (ein Gegner ist durchgekommen). */
  hitBase(): void;
  dispose(): void;
}

/** Was die Bühne über den Vertrag `Stage` (app.d.ts) hinaus anbietet; die Spielsteuerung nutzt es. */
export interface StageExtras {
  /** Hebt das Bodenzeichen eines besonderen Bauplatzes hervor (null = aus). */
  highlightSpecialTile(tile: { tx: number; tz: number } | null): void;
}

// ---------------------------------------------------------------------------------------------
// Figuren: Türme und Gegner samt Anzeigen, die an ihnen hängen
// ---------------------------------------------------------------------------------------------

export interface EntityLayer {
  readonly group: THREE.Group;
  /** Bindet an eine Simulation (null = keine Partie; alles wird geleert). */
  bind(sim: Sim | null): void;
  /** Ereignisse eines Zeitschritts: Schussanimation, Trefferblitz, Erscheinen, Verschwinden, Bau, Ausbau, Modernisierung, Verkauf. */
  handleEvents(events: readonly SimEvent[]): void;
  /**
   * In jedem Bild: Instanzen aller Türme und Gegner aus dem Zustand der Simulation neu befüllen.
   * @param dt echte Sekunden  @param simDt simulierte Sekunden in diesem Bild  @param alpha Interpolationsanteil 0..1
   */
  update(dt: number, simDt: number, alpha: number): void;
  /** Bauvorschau: halbtransparentes Turmmodell der Rolle im aktuellen Zeitalter mit Reichweitenring (grün = gültig, rot = ungültig). */
  setBuildPreview(preview: { archId: string; tx: number; tz: number; valid: boolean } | null): void;
  /** Auswahl: Reichweitenring und Markierung am Turm. */
  setSelectedTower(tower: Tower | null): void;
  /** Zielkreis der Fähigkeit. */
  setAbilityCursor(cursor: { x: number; z: number; radius: number } | null): void;
  /**
   * Weltposition der Mündung eines Turms in seiner aktuellen Pose.
   * @returns false, wenn der Turm noch nie gezeichnet wurde; `out` ist dann ein Punkt 0,8 über der Feldmitte.
   */
  muzzleOf(tower: Tower, out: THREE.Vector3): boolean;
  /** Mittelpunkt des Körpers eines Gegners in Weltkoordinaten (Zielpunkt für Geschosse und Effekte); gilt auch für eben Gestorbene. */
  enemyCenter(enemy: Enemy, out: THREE.Vector3): THREE.Vector3;
  setQuality(quality: Quality): void;
  dispose(): void;
}

// ---------------------------------------------------------------------------------------------
// Effekte: Geschosse, Strahlen, Einschläge, Teilchen, schwebende Zahlen, Bildschirmwackeln
// ---------------------------------------------------------------------------------------------

export interface EffectLayer {
  readonly group: THREE.Group;
  bind(sim: Sim | null): void;
  /** Ereignisse eines Zeitschritts: Mündungsfeuer, Strahlen, Einschläge, Explosionen, Verpuffen, Goldzahlen, Fähigkeit, Zeitalterwechsel. */
  handleEvents(events: readonly SimEvent[]): void;
  /** In jedem Bild: Geschosse der Simulation zeichnen, Teilchen und Strahlen fortschreiben. */
  update(dt: number, simDt: number, alpha: number): void;
  /** Aktuelle Auslenkung der Kamera durch Bildschirmwackeln (die Bühne addiert sie auf die Kameraposition). */
  readonly shake: THREE.Vector3;
  /** Übernimmt Wackeln und schwebende Zahlen aus den Einstellungen. */
  applySettings(settings: Settings): void;
  setQuality(quality: Quality): void;
  dispose(): void;
}
