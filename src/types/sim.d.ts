// Vertrag der Simulation.
// Die Simulation ist deterministisch (fester Zeitschritt, eigener Zufallsgenerator), kennt weder DOM noch three.js
// und läuft unverändert im Browser und in Node. Darstellung, Oberfläche und Ton LESEN ihren Zustand nur.
import type { PathCurve } from '../sim/path.js';
import type { AbilityDef, Content, Difficulty, EnemyDef, FusionRecipe, MapDef, TargetMode, TowerArchetypeDef, TowerStats } from './content';

export interface SimConfig {
  content: Content;
  mapId: string;
  difficulty: Difficulty;
  /** Startwert des Zufallsgenerators. Gleiche Konfiguration und gleiche Befehle ergeben denselben Verlauf. */
  seed: number;
  /** true: Alle Turmrollen sind von Anfang an baubar (unlockWave wird ignoriert). */
  unlockAll?: boolean;
  /**
   * true: Der Aufrufer zeigt das Angebot der Zeitgaben und ruft `Sim.chooseBoon` auf; bis dahin startet keine Welle (Grund `boon`).
   * Ohne Angabe oder false wählt die Simulation sofort beim Zeitalterwechsel die erste angebotene Gabe (für ältere Aufrufer ohne
   * Oberfläche dafür; ein Angebot bleibt nie offen).
   */
  boonChoice?: boolean;
  /**
   * Bewaffnung der Partie (docs/SIM.md, „Waffenpool“): je Platz genau eine Waffe, die übrigen Waffen des Pools sind nicht baubar.
   * Ohne Angabe oder 'classic': die klassischen Waffen (Kennung = Platz). 'random': gezogen aus `seed` mit `drawLoadout`.
   * Eine Liste: genau eine bekannte Waffe je Platz, in beliebiger Reihenfolge. Beim Laden gilt die Bewaffnung des Spielstands.
   */
  loadout?: 'classic' | 'random' | readonly string[];
}

/**
 * 'build' = Ruhe zwischen den Wellen (auch ganz am Anfang), 'wave' = eine Welle läuft,
 * 'won' = alle Wellen überstanden, 'lost' = keine Leben mehr.
 */
export type Phase = 'build' | 'wave' | 'won' | 'lost';

export interface Enemy {
  /** Eindeutig über die ganze Partie, aufsteigend vergeben. */
  id: number;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  /** Rüstung in Schadenspunkten je Treffer. */
  armor: number;
  /** Index des Weges: Läufer folgen Sim.paths[path], Flieger Sim.airPaths[path]. */
  path: number;
  /** Zurückgelegte Strecke auf dem Weg in Feldern. */
  dist: number;
  /** Anteil des Weges 0..1. */
  progress: number;
  /** Seitlicher Versatz zur Wegmitte in Feldern (etwa -0.28..0.28), damit Gegner nicht im Gänsemarsch laufen. */
  lane: number;
  /** Position in Weltkoordinaten (Bodenebene). */
  x: number;
  z: number;
  /** Position im vorigen Zeitschritt, für die Interpolation der Darstellung. */
  px: number;
  pz: number;
  /** Blick- und Laufrichtung (Einheitsvektor). */
  dx: number;
  dz: number;
  /** Aktuelles Tempo in Feldern pro Sekunde (nach Verlangsamung). */
  speed: number;
  /** Aktuelle Verlangsamung 0..1 und ihre Restdauer in Sekunden. */
  slow: number;
  slowTime: number;
  /** Aktueller Schaden über Zeit je Sekunde und seine Restdauer. */
  dot: number;
  dotTime: number;
  /**
   * Zeichen (Verwundbarkeit, `TowerStats.mark`): Anteil, um den der Gegner mehr Schaden nimmt, und seine Restdauer in Sekunden;
   * 0, wenn er keins trägt. Die Simulation setzt beide immer; freiwillig nur, damit ältere Aufrufer gültig bleiben.
   */
  vuln?: number;
  vulnTime?: number;
  /** Sekunden seit dem letzten erlittenen Schaden. */
  sinceHit: number;
  /** Sekunden seit dem Erscheinen. */
  age: number;
  /** Kopfgeld in Gold. */
  bounty: number;
  /** Anzahl bereits eingetretener Momente aus def.phases. */
  phase: number;
  /** Aktueller Tempo-Faktor aus einem Moment (1 = keiner) und seine Restdauer in Sekunden. */
  boost: number;
  boostTime: number;
  alive: boolean;
}

/** Ein Bodenfeld (z. B. die Pfütze des Bremsers), das Bodengegner in seinem Radius beeinflusst. */
export interface Zone {
  id: number;
  /** Rolle und Technikstand des Turms, der es gelegt hat (für die Darstellung). */
  arch: TowerArchetypeDef;
  tier: number;
  towerId: number;
  x: number;
  z: number;
  radius: number;
  /** Restdauer und Gesamtdauer in Sekunden. */
  time: number;
  duration: number;
}

export interface Tower {
  id: number;
  arch: TowerArchetypeDef;
  /** Technikstand: Index des Zeitalters, dessen Ausprägung der Turm hat (arch.tiers[tier]). */
  tier: number;
  /** Ausbaustufe 1..3. */
  level: number;
  /** Gewählter Ausbauzweig der Stufe 3 (Index in arch.branches) oder -1, solange keiner gewählt ist. */
  branch: number;
  /** true: Der Turm ist eine Superwaffe (Kern, der Zutaten aufgenommen hat). Seine Stufe bleibt 3. */
  super: boolean;
  /** Kennungen der Waffen der aufgenommenen Zutaten (nicht ihrer Plätze) in der Reihenfolge der Aufnahme; leer, solange `super` false ist. */
  gifts: string[];
  /**
   * Ausbauzweig jeder aufgenommenen Zutat, gleich lang wie `gifts` (-1 für Rollen ohne Zweige). Der Zweig wählt die Gabe
   * (`arch.branches[b].gift`, sonst `arch.fusion.gift`).
   */
  giftBranches: number[];
  /** true: Die Superwaffe hat ein zweites Mal Zutaten aufgenommen und ist eine Megawaffe (`super` bleibt true, `gifts` hat vier Einträge). */
  mega: boolean;
  /**
   * Rezept der Superwaffe (`FusionRecipe.id`), festgelegt beim ersten Verschmelzen nach den damals freigeschalteten Rezepten, oder ''
   * (gewöhnliche Superwaffe, kein Turm). Ändert sich nie mehr: Ein später freigeschaltetes Rezept verwandelt keine stehende Waffe.
   * Für Namen und Angriffsbild: `recipeLook(t.arch, t.tier, t.gifts, t.recipe)`.
   */
  recipe: string;
  /** Feld. */
  tx: number;
  tz: number;
  /**
   * Art des besonderen Bauplatzes, auf dem der Turm steht (Schlüssel in `balance.tiles`), oder ''. Folgt aus der Lage
   * (`Sim.tileAt`), wird beim Bau gesetzt und nicht gespeichert.
   */
  tile: string;
  /** Mittelpunkt des Feldes in Weltkoordinaten. */
  x: number;
  z: number;
  /**
   * Die Zeitgaben der Partie (dieselbe Liste wie `SimState.boons`, nicht gespeichert). Steht hier, damit ein Turm als `opts` von
   * `towerStats` die Gaben mitbringt und Vorschauen ehrlich bleiben.
   */
  boons: readonly string[];
  /** Kennung der Eigenart der laufenden Welle, wenn sie Türme verändert (`WaveModifierDef.towers`), sonst ''. */
  modifier: string;
  /** Aktuelle Kampfwerte OHNE Aura-Boni (aus Rolle, Technikstand, Stufe, Zweig, Verschmelzung, besonderem Bauplatz, Zeitgaben und Eigenart der Welle). */
  stats: TowerStats;
  /** Aura-Boni benachbarter Unterstützer als Anteile (0.2 = +20 %). */
  buffDamage: number;
  buffRate: number;
  buffRange: number;
  mode: TargetMode;
  /** Sekunden bis zum nächsten Schuss. */
  cooldown: number;
  /** Kennung des aktuellen Ziels oder -1. */
  targetId: number;
  /** Letzte bekannte Position des Ziels (zum Ausrichten des Modells). */
  aimX: number;
  aimZ: number;
  /** Ob das letzte Ziel flog (für die Neigung des Modells). */
  aimFlying: boolean;
  /** Simulationszeit des letzten Schusses in Sekunden; -Infinity, wenn noch nie gefeuert. */
  lastShot: number;
  /** Sekunden Dauerbeschuss auf das aktuelle Ziel (nur 'beam'). */
  beamTime: number;
  /** Insgesamt in den Turm gestecktes Gold (Bau, Ausbau, Modernisierung, Gebühren), so wie es bezahlt wurde (samt Aufschlag des Bauplatzes). */
  invested: number;
  kills: number;
  damageDealt: number;
  /** Nummer der Welle (SimState.wave), vor deren Start der Turm gebaut wurde; solange sie nicht begonnen hat, gibt der Verkauf alles zurück. */
  builtWave: number;
}

export interface Projectile {
  id: number;
  towerId: number;
  /** Rolle und Technikstand des Schützen zum Zeitpunkt des Schusses (für die Darstellung). */
  arch: TowerArchetypeDef;
  tier: number;
  /** Startpunkt (Feldmitte des Turms). */
  sx: number;
  sz: number;
  /** Zielpunkt; bei verfolgenden Geschossen wird er dem Ziel nachgeführt. */
  tx: number;
  tz: number;
  /** Kennung des verfolgten Gegners oder -1 (Geschoss fliegt auf einen festen Punkt). */
  targetId: number;
  /** Ob das Ziel fliegt (für die Flughöhe der Darstellung). */
  targetFlying: boolean;
  /** Flugfortschritt 0..1 und im vorigen Zeitschritt. */
  t: number;
  pt: number;
  /** Gesamte Flugzeit in Sekunden. */
  duration: number;
}

export interface GameStats {
  kills: number;
  leaks: number;
  goldEarned: number;
  goldSpent: number;
  towersBuilt: number;
  towersSold: number;
  upgrades: number;
  modernizations: number;
  damageDealt: number;
  abilitiesUsed: number;
  /** Wellen ohne verlorenes Leben. */
  perfectWaves: number;
  /** Anzahl verschmolzener Superwaffen. */
  fusions: number;
  /** Anzahl entstandener Megawaffen (zählen nicht zusätzlich in `fusions`). */
  megas: number;
}

export interface SimState {
  /** Simulierte Sekunden seit Beginn. */
  time: number;
  /** Anzahl der Zeitschritte. */
  tick: number;
  phase: Phase;
  gold: number;
  lives: number;
  maxLives: number;
  score: number;
  /**
   * Fortlaufender Index (ab 0) der laufenden Welle bzw. in Phase 'build' der nächsten Welle.
   * In Phase 'won' gleich Sim.totalWaves.
   */
  wave: number;
  /** Index des aktuellen Zeitalters. */
  age: number;
  /** Index der Welle innerhalb ihres Zeitalters. */
  waveInAge: number;
  /** Sekunden seit Beginn der Phase 'build' (für die Frühstart-Prämie). */
  buildTime: number;
  /** Solange > 0 (Sekunden) lässt sich keine Welle starten: Der Anbruch eines Zeitalters wird gefeiert. */
  lock: number;
  /** Noch nicht erschienene Gegner der laufenden Welle. */
  pending: number;
  /** Sekunden, bis die Fähigkeit wieder bereit ist (0 = bereit). */
  abilityCooldown: number;
  /** Lebende Gegner in Reihenfolge ihres Erscheinens. */
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  /** Liegende Bodenfelder in Reihenfolge ihres Entstehens. */
  zones: Zone[];
  stats: GameStats;
  /** Gewählte Zeitgaben (Kennungen aus `content.boons`) in Reihenfolge der Wahl. */
  boons: string[];
  /** Offenes Angebot an Zeitgaben (meist drei Kennungen); leer, wenn keins offen ist. */
  boonOffer: string[];
  /** Eigenart der laufenden Welle (Schlüssel in `content.modifiers`) oder '' (auch in der Bauphase). */
  modifier: string;
  /**
   * In dieser Partie freigeschaltete Rezepte (`FusionRecipe.id` mit `locked`) in Reihenfolge der Freischaltung. Gilt nur für diese
   * Partie (das Rezeptbuch der Oberfläche ist etwas anderes). Vorschauen übergeben die Liste an `fusionRecipe`/`recipeLook`/`towerStats`.
   */
  recipes: string[];
}

/** Ereignisse eines Zeitschritts, für Effekte, Ton und Meldungen. Objektverweise gelten nur bis zum nächsten Zeitschritt. */
export type SimEvent =
  | { type: 'spawn'; enemy: Enemy }
  /** Ein Turm hat gefeuert. x/z = Zielposition. Bei 'beam' einmal je Schadenstakt. */
  | { type: 'shot'; tower: Tower; targetId: number; x: number; z: number; flying: boolean }
  /** Ein Treffer ist eingeschlagen (Einzelziel oder Mittelpunkt des Flächenschadens). */
  | { type: 'hit'; arch: TowerArchetypeDef; tier: number; x: number; z: number; flying: boolean; splash: number }
  /** Ein Gegner hat Schaden genommen (höchstens ein Ereignis je Gegner und Zeitschritt, Schaden aufsummiert). */
  | { type: 'damage'; enemy: Enemy; amount: number; shield: boolean }
  /** Ein Treffer ist auf ein weiteres Ziel übergesprungen (Kette). */
  | { type: 'chain'; arch: TowerArchetypeDef; tier: number; fromX: number; fromZ: number; toX: number; toZ: number; flying: boolean }
  | { type: 'kill'; enemy: Enemy; bounty: number; towerId: number }
  | { type: 'leak'; enemy: Enemy; lives: number }
  /** `extra` = der Teil von `amount`, den eine Kopfgeld-Aura (`TowerStats.auraBounty`) dazugibt (nur bei `bounty`, nur wenn > 0). */
  | { type: 'gold'; amount: number; reason: 'bounty' | 'wave' | 'early' | 'age' | 'sell' | 'boon'; x: number; z: number; extra?: number }
  /** `modifier` = Kennung der Eigenart der Welle, nur wenn sie eine hat. */
  | { type: 'waveStart'; wave: number; age: number; waveInAge: number; boss: boolean; early: number; modifier?: string }
  | { type: 'waveClear'; wave: number; bonus: number; perfect: boolean }
  /** Ein neues Zeitalter ist angebrochen. */
  | { type: 'age'; from: number; to: number; gift: number }
  /**
   * Die Wege haben gewechselt (Karte mit `map.stages`): Sim.paths und Sim.airPaths enthalten jetzt die Kurven der Stufe
   * `stage` (= Sim.pathStage()). Folgt im selben Zeitschritt direkt auf das Ereignis `age`.
   */
  | { type: 'paths'; stage: number }
  /** Eine Zeitgabe ist angeboten worden (`offer`, Kennungen) und wartet auf `Sim.chooseBoon`. Nur mit `SimConfig.boonChoice`. */
  | { type: 'boonOffer'; offer: string[] }
  /** Eine Zeitgabe wurde gewählt (von Hand oder, ohne `SimConfig.boonChoice`, von der Simulation). */
  | { type: 'boon'; id: string }
  /**
   * Ein gesperrtes Rezept ist für den Rest der Partie freigeschaltet: durch eine Zeitgabe (`boon`, direkt nach dem Ereignis `boon`)
   * oder durch einen Zwischenboss ohne Funkenverlust (`boss`, direkt nach `waveClear`).
   */
  | { type: 'recipe'; id: string; reason: 'boon' | 'boss' }
  | { type: 'build'; tower: Tower }
  | { type: 'upgrade'; tower: Tower }
  | { type: 'modernize'; tower: Tower; fromTier: number }
  /** Eine Superwaffe (`mega` false) oder Megawaffe (`mega` true) ist entstanden. `parts` nennt die aufgenommenen (nun entfernten) Türme. */
  | { type: 'fuse'; tower: Tower; parts: { id: number; arch: TowerArchetypeDef; branch: number; x: number; z: number }[]; fee: number; mega: boolean }
  | { type: 'sell'; tower: Tower; refund: number }
  | { type: 'ability'; def: AbilityDef; x: number; z: number }
  | { type: 'heal'; enemy: Enemy }
  /**
   * Ein Treffer mit Rückstoß (`TowerStats.push`) hat den Gegner um `distance` Felder auf seinem Weg zurückgeworfen (Lage springt,
   * `px`/`pz` = neue Lage). `towerId` = Schütze. x/z = Lage vor dem Rückstoß.
   */
  | { type: 'push'; enemy: Enemy; distance: number; towerId: number; x: number; z: number }
  /** Ein angekündigter Moment eines Gegners ist eingetreten (index in def.phases). */
  | { type: 'phase'; enemy: Enemy; index: number }
  /** Ein Bodenfeld ist entstanden. */
  | { type: 'zone'; zone: Zone }
  | { type: 'won' }
  | { type: 'lost' };

export type RejectReason =
  /** zu wenig Gold */ | 'gold'
  /** Feld außerhalb des Spielfelds */ | 'outside'
  /** Feld gehört zum Weg */ | 'path'
  /** Feld ist nicht bebaubar */ | 'blocked'
  /** auf dem Feld steht schon ein Turm */ | 'occupied'
  /** Rolle noch nicht freigeschaltet, in diesem Zeitalter nicht verfügbar oder nicht in der Bewaffnung der Partie */ | 'locked'
  /** höchste Stufe bzw. neuester Technikstand schon erreicht */ | 'max'
  /** in dieser Phase nicht möglich */ | 'phase'
  /** Fähigkeit lädt noch */ | 'cooldown'
  /** Turm ist nicht auf Stufe 3 (Verschmelzen) */ | 'level'
  /** Zutat steht nicht auf einem der acht Nachbarfelder des Kerns */ | 'adjacent'
  /** Kern und Zutaten haben nicht denselben Technikstand */ | 'tier'
  /** Turm ist schon eine Megawaffe, eine Zutat ist eine Superwaffe, oder die Rolle kann nicht verschmelzen */ | 'super'
  /** Es gibt schon so viele Megawaffen, wie `balance.fusion.megaLimit` erlaubt */ | 'limit'
  /** falsche Anzahl Zutaten, doppelte Zutat oder Kern als Zutat */ | 'count'
  /** Ausbauzweig fehlt oder ist unbekannt */ | 'branch'
  /** Erst eine Zeitgabe wählen (Angebot offen), bzw. die Gabe steht nicht im Angebot */ | 'boon'
  /** Turm, Rolle oder Ziel unbekannt */ | 'unknown';

export interface CommandResult {
  ok: boolean;
  reason?: RejectReason;
}

export interface WavePreview {
  /** Fortlaufender Index der Welle. */
  wave: number;
  age: number;
  waveInAge: number;
  boss: boolean;
  hint: string;
  /** Zusammensetzung, zusammengefasst je Gegnerart, in Reihenfolge des ersten Erscheinens. */
  groups: { def: EnemyDef; count: number }[];
  /**
   * Stufe der Wege, auf denen diese Welle läuft (siehe Sim.pathStage). Weicht sie von `Sim.pathStage()` ab, wechseln die Wege
   * vor dieser Welle; ohne `map.stages` immer 0.
   */
  stage: number;
  /** Eigenart der Welle (Schlüssel in `content.modifiers`); fehlt, wenn sie keine hat. Die Zahlen in `groups` enthalten sie schon. */
  modifier?: string;
}

/**
 * Bedeutung eines Feldes für Wege, die sich mit dem Zeitalter wandeln (Sim.pathMark):
 * 'path' = gehört jetzt zu einem Weg; 'future' = wird in einem späteren Zeitalter dieser Partie Weg (künftiger Weg);
 * 'former' = war früher Weg und wird es nicht wieder (alter Weg); '' = nichts davon. Alle drei Arten sind nicht bebaubar.
 */
export type PathMark = 'path' | 'future' | 'former' | '';

/** Gespeicherter Spielstand (nur in Phase 'build' erzeugbar). Reines JSON. */
export interface SaveData {
  version: 1;
  mapId: string;
  difficulty: Difficulty;
  seed: number;
  rng: number;
  time: number;
  wave: number;
  gold: number;
  lives: number;
  score: number;
  abilityCooldown: number;
  nextId: number;
  towers: { arch: string; tier: number; level: number; branch?: number; super?: boolean; mega?: boolean; gifts?: string[]; giftBranches?: number[]; recipe?: string; tx: number; tz: number; mode: TargetMode; invested: number; kills: number; damageDealt: number; builtWave: number }[];
  stats: GameStats;
  /** Gewählte Zeitgaben; fehlt bei älteren Spielständen (= keine). */
  boons?: string[];
  /** Offenes Angebot an Zeitgaben; fehlt oder leer = keins. */
  boonOffer?: string[];
  /** Freigeschaltete Rezepte; fehlt bei älteren Spielständen (= keine). */
  recipes?: string[];
  /** Bewaffnung (`Sim.loadout`); fehlt bei älteren Spielständen (= die klassischen Waffen). */
  loadout?: string[];
}

/** Was eine Verschmelzung an Rezept ergäbe (`Sim.fuseRecipe`). */
export interface FuseRecipeInfo {
  /** Das Rezept, das wirken würde (bei einer Megawaffe das der Superwaffe), oder null. */
  recipe: FusionRecipe | null;
  /** Ein Rezept, das genau diese Zutaten verlangt, aber in dieser Partie noch gesperrt ist (dann ist `recipe` null), oder null. */
  locked: FusionRecipe | null;
}

export interface Sim {
  readonly config: SimConfig;
  readonly content: Content;
  readonly map: MapDef;
  /**
   * Kurven aller Wege, die jetzt gelten. Bei einer Karte mit `map.stages` wechselt der INHALT dieses Feldes beim Zeitalterwechsel
   * (Ereignis `paths`); die Liste selbst bleibt dasselbe Objekt.
   */
  readonly paths: PathCurve[];
  /**
   * Flugbahnen: je Weg die gerade Luftlinie vom Eingang zur Basis (oder der Weg selbst bei flyersFollowPath der Karte bzw. Stufe).
   * Wechselt wie `paths`.
   */
  readonly airPaths: PathCurve[];
  /**
   * Die Stufen, die in dieser Partie Wege bringen, aufsteigend: Zeitalter, ab denen ein neuer Satz Wege gilt. Beginnt immer mit 0;
   * ohne `map.stages` genau [0]. Stufen jenseits der Zahl der Zeitalter fehlen (sie werden nie erreicht).
   */
  readonly pathStages: readonly number[];
  /** Anzahl aller Wellen der Partie. */
  readonly totalWaves: number;
  /**
   * Bewaffnung der Partie: je Platz die gezogene Waffe (Kennung), in der Reihenfolge der Plätze (`contentSlots(content)`), also
   * Index = Platz in der Bauleiste. Nur diese Waffen lassen sich bauen; `build` lehnt alle anderen mit `locked` ab.
   */
  readonly loadout: readonly string[];
  /** Lebendiger Zustand. Außerhalb der Simulation nur lesen. */
  readonly state: SimState;

  /** Rechnet genau einen Zeitschritt (SIM_DT Sekunden). In den Phasen 'won' und 'lost' geschieht nichts. */
  step(): void;
  /** Liefert die seit dem letzten Aufruf angefallenen Ereignisse und leert die Liste. */
  drainEvents(): SimEvent[];

  // --- Befehle des Spielers: jederzeit zwischen zwei Zeitschritten aufrufbar ---
  /** Baut einen Turm der Rolle im aktuellen Zeitalter. */
  build(archId: string, tx: number, tz: number): CommandResult;
  /**
   * Hebt den Turm um eine Stufe. Beim Ausbau auf Stufe 3 wählt `branch` den Ausbauzweig (Index in arch.branches);
   * fehlt die Angabe, gilt Zweig 0. Für Rollen ohne Zweige und für Stufe 2 wird `branch` ignoriert.
   */
  upgrade(towerId: number, branch?: number): CommandResult;
  /**
   * Verschmilzt den Kernturm mit den Zutaten zu einer Superwaffe, oder eine Superwaffe als Kern mit zwei weiteren Zutaten zu einer
   * Megawaffe: Die Zutaten verschwinden, ihr investiertes Gold geht auf den Kern über, ihre Felder werden frei.
   * Regeln in docs/briefs/fusion.md, Prüfreihenfolge in docs/SIM.md.
   */
  fuse(coreId: number, partIds: number[]): CommandResult;
  /** Bringt den Turm auf den Technikstand des aktuellen Zeitalters; die Stufe bleibt erhalten. */
  modernize(towerId: number): CommandResult;
  sell(towerId: number): CommandResult;
  setTargetMode(towerId: number, mode: TargetMode): CommandResult;
  /** Startet die nächste Welle (nur in Phase 'build' und ohne Sperre). */
  startWave(): CommandResult;
  /** Löst die Fähigkeit des aktuellen Zeitalters aus, an einer Weltposition oder (bei radius 0) für die ganze Karte. */
  useAbility(x: number, z: number): CommandResult;
  /**
   * Wählt eine Zeitgabe aus dem offenen Angebot (`state.boonOffer`). Abgelehnt: `phase` (Partie vorbei oder kein Angebot offen),
   * `boon` (Kennung steht nicht im Angebot). Wirkt sofort auf alle Türme, Preise und die Fähigkeit; Ereignis `boon`.
   */
  chooseBoon(id: string): CommandResult;

  // --- Auskünfte ---
  /** Prüft, ob auf dem Feld gebaut werden kann (ohne Blick aufs Gold). */
  canBuild(tx: number, tz: number): CommandResult;
  /**
   * Baukosten der Rolle im aktuellen Zeitalter; mit Feld samt dem Kostenfaktor eines besonderen Bauplatzes dort
   * (ohne Feld: Grundpreis).
   */
  buildCost(archId: string, tx?: number, tz?: number): number;
  /** Kosten der nächsten Stufe oder -1, wenn die höchste Stufe erreicht ist. */
  upgradeCost(tower: Tower): number;
  /** Kosten der Modernisierung oder -1, wenn der Turm auf dem neuesten Stand ist. */
  modernizeCost(tower: Tower): number;
  /** Prüft das Verschmelzen, ohne es auszuführen (mit Blick aufs Gold der Gebühr). */
  canFuse(coreId: number, partIds: number[]): CommandResult;
  /** Türme, die jetzt als Zutat für diesen Kern in Frage kommen; leer, wenn der Turm kein Kern sein kann. */
  fuseCandidates(coreId: number): Tower[];
  /** Gebühr des Verschmelzens für diesen Kern in Gold (für eine Superwaffe als Kern: die Gebühr der Megawaffe). */
  fuseCost(tower: Tower): number;
  /**
   * Welches Rezept das Verschmelzen dieses Kerns mit diesen Zutaten ergäbe, nach den jetzt freigeschalteten Rezepten, und ob die
   * Zutaten ein noch gesperrtes Rezept treffen (für „noch nicht freigeschaltet“ in der Vorschau). Prüft nicht, ob das Verschmelzen
   * erlaubt ist; unbekannte Türme ergeben `{ recipe: null, locked: null }`. Ist der Kern schon Superwaffe, bleibt sein Rezept.
   */
  fuseRecipe(coreId: number, partIds: number[]): FuseRecipeInfo;
  /** Gold, das der Verkauf jetzt brächte. */
  sellValue(tower: Tower): number;
  towerAt(tx: number, tz: number): Tower | null;
  /** Art des besonderen Bauplatzes auf dem Feld (Schlüssel in `content.balance.tiles`) oder '' (auch außerhalb des Spielfelds). */
  tileAt(tx: number, tz: number): string;
  /** Stufe, deren Wege jetzt gelten: der größte Eintrag von `pathStages`, der nicht nach `state.age` liegt. */
  pathStage(): number;
  /**
   * Kurven der Wege, die im Zeitalter `stage` gelten (geerbt von der letzten Stufe mit Wegen). `curve.tiles` nennt die Felder
   * zum Zeichnen der Spuren. Für ein Zeitalter jenseits der Partie die Wege des letzten Zeitalters; leer bei ungültiger Angabe.
   */
  stagePaths(stage: number): readonly PathCurve[];
  /** Flugbahnen zu `stagePaths(stage)`. */
  stageAirPaths(stage: number): readonly PathCurve[];
  /** Jetzige, künftige oder alte Wegfelder unterscheiden (siehe `PathMark`); '' auch außerhalb des Spielfelds. */
  pathMark(tx: number, tz: number): PathMark;
  towerById(id: number): Tower | null;
  enemyById(id: number): Enemy | null;
  /** Vorschau auf die Welle `state.wave + offset`; null, wenn es sie nicht gibt. */
  wavePreview(offset?: number): WavePreview | null;
  /** Aktuelle Frühstart-Prämie in Gold (0 außerhalb der Phase 'build'). */
  earlyBonus(): number;
  /** Fähigkeit des aktuellen Zeitalters, mit den Änderungen der Zeitgaben (Abklingzeit, Rückwurf). */
  ability(): AbilityDef;
  /** Spielstand; null außerhalb der Phase 'build'. */
  save(): SaveData | null;
}
