// Verträge zwischen den Teilen der Anwendung: Bühne (3D-Darstellung), Oberfläche (HUD und Menüs), Ton und Spielsteuerung.
import type { Content, Difficulty, TargetMode } from './content';
import type { Sim, SimEvent, Tower } from './sim';

export type Quality = 'low' | 'medium' | 'high';

/** Einstellungen des Spielers; werden im Browser gespeichert. */
export interface Settings {
  /** Grafikstufe; 'auto' wählt anhand der gemessenen Bildrate. */
  quality: Quality | 'auto';
  /** Lautstärken 0..1. */
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
  /** Bildschirmwackeln bei Einschlägen. */
  shake: boolean;
  /** Nächste Welle automatisch starten. */
  autoStart: boolean;
  /** Schadenszahlen und Goldbeträge über den Köpfen einblenden. */
  floatingText: boolean;
  /** Einführungshinweise wurden schon gezeigt. */
  tutorialDone: boolean;
}

/** Bestwerte je Karte und Schwierigkeitsgrad. Schlüssel: `${mapId}:${difficulty}`. */
export type Records = Record<string, { score: number; wave: number; won: boolean }>;

/** Ein Feld unter dem Mauszeiger. */
export interface TilePick {
  tx: number;
  tz: number;
  /** Getroffener Punkt auf der Bodenebene in Weltkoordinaten. */
  x: number;
  z: number;
  /** Ob das Feld im Spielfeld liegt. */
  inside: boolean;
}

// ---------------------------------------------------------------------------------------------
// Bühne: alles, was in 3D zu sehen ist
// ---------------------------------------------------------------------------------------------

/** Rückmeldungen der Bühne an die Spielsteuerung. */
export interface StageCallbacks {
  /** Der Zeiger steht über einem anderen Feld (null = außerhalb der Bodenebene oder über der Oberfläche). */
  onHover(tile: TilePick | null): void;
  /** Kurzer Klick/Tipp auf die Bodenebene (kein Ziehen). secondary = rechte Maustaste. */
  onClick(tile: TilePick, secondary: boolean): void;
}

export interface Stage {
  /** Baut die Welt der Partie auf und bindet die Bühne an diese Simulation. */
  load(sim: Sim): void;
  /** Entfernt die Partie; es bleibt die Kulisse für das Hauptmenü. */
  unload(): void;
  /** Zeigt ohne Partie eine ruhige Kulisse: Die Insel dreht sich langsam und wandert durch die Zeitalter. */
  showAttract(): void;
  /** Löst Effekte zu den Ereignissen eines Zeitschritts aus. Direkt nach sim.step() mit sim.drainEvents() aufrufen. */
  handleEvents(events: readonly SimEvent[]): void;
  /**
   * Zeichnet ein Bild.
   * @param dt echte Sekunden seit dem letzten Bild
   * @param simDt in diesem Bild simulierte Sekunden (0 bei Pause)
   * @param alpha Anteil 0..1 des angefangenen Zeitschritts, zum Interpolieren zwischen Enemy.px/pz und x/z
   */
  render(dt: number, simDt: number, alpha: number): void;
  /** An die Fenstergröße anpassen. */
  resize(): void;
  /** Übernimmt Grafikstufe und Wackeln aus den Einstellungen. */
  applySettings(settings: Settings): void;

  /** Bauvorschau: halbtransparenter Turm mit Reichweitenring auf einem Feld (null = aus). */
  setBuildPreview(preview: { archId: string; tx: number; tz: number; valid: boolean } | null): void;
  /** Hebt einen Turm hervor und zeigt seine Reichweite (null = nichts gewählt). */
  setSelectedTower(tower: Tower | null): void;
  /** Zielkreis der Fähigkeit auf dem Boden (null = aus). */
  setAbilityCursor(cursor: { x: number; z: number; radius: number } | null): void;
  /** Blendet das Raster der Baufelder ein oder aus. */
  setGridVisible(visible: boolean): void;

  /** Bildschirmposition (CSS-Pixel) eines Weltpunkts; visible = false, wenn er hinter der Kamera liegt. */
  project(x: number, y: number, z: number, out: { x: number; y: number; visible: boolean }): void;
  /** Vorschaubild eines Modells als Daten-URL (wird zwischengespeichert). */
  thumbnail(modelId: string, opts?: { size?: number; level?: number }): string;
  /** Setzt die Kamera auf die Ausgangsansicht zurück. */
  resetCamera(): void;
  /** Kennzahlen des letzten Bildes. */
  readonly info: { fps: number; drawCalls: number; triangles: number; quality: Quality };
  dispose(): void;
}

// ---------------------------------------------------------------------------------------------
// Spielsteuerung: verbindet Simulation, Bühne, Oberfläche und Ton
// ---------------------------------------------------------------------------------------------

/** Zustand einer laufenden Partie, wie ihn die Oberfläche in jedem Bild liest. */
export interface GameView {
  sim: Sim;
  content: Content;
  settings: Settings;
  /** Spieltempo 1, 2 oder 4. */
  speed: number;
  paused: boolean;
  /** Gewählte Turmrolle im Baumodus oder null. */
  buildArch: string | null;
  /** Gewählter Turm oder null. */
  selected: Tower | null;
  /** Fähigkeit ist scharf geschaltet und wartet auf einen Klick ins Feld. */
  abilityArmed: boolean;
  /** Feld unter dem Zeiger oder null. */
  hover: TilePick | null;
}

/** Wünsche der Oberfläche an die Spielsteuerung. */
export interface UiActions {
  newGame(mapId: string, difficulty: Difficulty): void;
  /** Gespeicherte Partie fortsetzen. */
  continueGame(): void;
  restart(): void;
  quitToMenu(): void;
  setPaused(paused: boolean): void;
  setSpeed(speed: number): void;
  startWave(): void;
  /** Baumodus für eine Rolle ein- (Kennung) oder ausschalten (null). */
  chooseBuild(archId: string | null): void;
  selectTower(towerId: number | null): void;
  upgrade(towerId: number): void;
  modernize(towerId: number): void;
  /** Alle Türme modernisieren, soweit das Gold reicht (günstigste zuerst). */
  modernizeAll(): void;
  sell(towerId: number): void;
  setTargetMode(towerId: number, mode: TargetMode): void;
  /** Fähigkeit scharf schalten oder abbrechen. */
  armAbility(armed: boolean): void;
  changeSettings(patch: Partial<Settings>): void;
  resetCamera(): void;
}

export interface MenuInfo {
  /** Zusammenfassung des gespeicherten Spielstands oder null. */
  save: { mapId: string; difficulty: Difficulty; wave: number; totalWaves: number; ageName: string } | null;
  records: Records;
}

export interface ResultInfo {
  won: boolean;
  score: number;
  /** Bisheriger Bestwert vor dieser Partie (0 = keiner). */
  best: number;
  newRecord: boolean;
  /** Erreichte Welle (1-basiert) und Gesamtzahl. */
  wave: number;
  totalWaves: number;
  ageName: string;
  /** Spielzeit in Sekunden (simulierte Zeit). */
  time: number;
  stats: import('./sim').GameStats;
}

/** Was die Oberfläche von außen bekommt. */
export interface UiDeps {
  /** Wurzelelement, in das die Oberfläche ihr DOM baut. Es liegt über der Leinwand und fängt selbst keine Zeigerereignisse ab. */
  root: HTMLElement;
  content: Content;
  actions: UiActions;
  /** Lebendes Einstellungsobjekt der Spielsteuerung (nur lesen; ändern über actions.changeSettings). */
  settings: Settings;
  /** Vorschaubild eines Modells als Daten-URL. */
  thumbnail(modelId: string, opts?: { size?: number; level?: number }): string;
  /** Bildschirmposition (CSS-Pixel) eines Weltpunkts, um Hinweise an Felder oder Türme zu heften. */
  project(x: number, y: number, z: number, out: { x: number; y: number; visible: boolean }): void;
}

export interface Ui {
  /** Hauptmenü zeigen (Titel, Karten- und Schwierigkeitswahl, Fortsetzen, Einstellungen, Anleitung). */
  showMenu(info: MenuInfo): void;
  /** Spielanzeige für eine Partie aufbauen und zeigen. */
  showGame(view: GameView): void;
  /** Pausenmenü ein- oder ausblenden. */
  showPause(visible: boolean): void;
  /** Sieg oder Niederlage zeigen. */
  showResult(info: ResultInfo): void;
  /** In jedem Bild: Anzeige aus dem GameView auffrischen (nur schreiben, was sich geändert hat). */
  update(dt: number): void;
  /** Meldungen zu Ereignissen (Banner beim neuen Zeitalter, Wellenstart, Boss, Hinweise). */
  handleEvents(events: readonly SimEvent[]): void;
  /** Kurze Meldung am Bildschirmrand. */
  toast(text: string, kind?: 'info' | 'warn' | 'good'): void;
  /** Ob gerade ein Menü oder Dialog offen ist, der das Spielfeld verdeckt (dann ignoriert die Spielsteuerung Klicks ins Feld). */
  readonly modal: boolean;
}

// ---------------------------------------------------------------------------------------------
// Ton
// ---------------------------------------------------------------------------------------------

/** Klänge der Bedienung und des Spielablaufs. */
export type UiSound = 'click' | 'hover' | 'open' | 'close' | 'build' | 'upgrade' | 'modernize' | 'sell' | 'error' | 'select' | 'waveStart' | 'waveClear' | 'bossWarning' | 'ageUp' | 'victory' | 'defeat' | 'coin' | 'lifeLost' | 'abilityReady';

export interface AudioEngine {
  /** Nach der ersten Nutzereingabe aufrufen; Browser erlauben Ton erst dann. Mehrfache Aufrufe sind harmlos. */
  unlock(): void;
  applySettings(settings: Settings): void;
  /** Vertont die Ereignisse eines Zeitschritts (Schüsse, Einschläge, Tode, Münzen ...), mit Begrenzung gleichzeitiger Klänge. */
  handleEvents(events: readonly SimEvent[]): void;
  ui(sound: UiSound): void;
  /** Musik und Geräuschkulisse eines Zeitalters (weich überblenden); null = Menümusik. */
  setAge(ageId: string | null): void;
  setPaused(paused: boolean): void;
  /** Spieltempo, damit bei 4-facher Geschwindigkeit nicht alles übereinander klingt. */
  setSpeed(speed: number): void;
}
