// Inhalte des Spiels als reine Daten: Zeitalter, Türme, Gegner, Wellen, Karten, Balance.
// Dateien in src/content, die diese Daten liefern, dürfen weder three.js noch DOM benutzen,
// denn die Simulation (und damit Node-Tests) importiert sie.
import type { ColorLike, LightTheme } from './model';

export type Difficulty = 'easy' | 'normal' | 'hard';

/** Zielwahl eines Turms: vorderster, hinterster, stärkster, schwächster, nächster Gegner. */
export type TargetMode = 'first' | 'last' | 'strong' | 'weak' | 'near';

// ---------------------------------------------------------------------------------------------
// Zeitalter
// ---------------------------------------------------------------------------------------------

/** Farben des Geländes in einem Zeitalter. */
export interface TerrainPalette {
  /** Bodenfarbe 1. */
  groundA: ColorLike;
  /** Bodenfarbe 2; wird fleckig mit groundA gemischt. */
  groundB: ColorLike;
  /** Oberfläche des Weges. */
  path: ColorLike;
  /** Kante des abgesenkten Weges, meist etwas dunkler als `path`. */
  pathEdge: ColorLike;
  /** Erdschicht direkt unter der Grasnarbe am Inselrand. */
  soil: ColorLike;
  /** Fels der Inselflanken. */
  rock: ColorLike;
}

/** Eine Sorte Dekoration, die auf der Insel verstreut wird. */
export interface ScatterRule {
  /** Modell-Kennung, z. B. 'prop.stone.pine'. */
  model: string;
  /** Relative Häufigkeit innerhalb ihrer Zone. */
  weight: number;
  /**
   * Wo das Objekt stehen darf:
   * 'shore' = Uferstreifen rund um das Spielfeld (Standard),
   * 'rim'   = direkt an der Inselkante,
   * 'field' = auf freien Feldern des Spielfelds; nur kleine, flache Bodendeko, sie weicht, sobald dort gebaut wird,
   * 'far'   = ferne Kulisse auf einem weiten Ring um die Insel (Berge, Schiffe, Skyline), meist stark vergrößert,
   * 'block' = auf den gesperrten Feldern der Karte (MapDef.blocked): Jedes gesperrte Feld bekommt genau ein solches
   *           Objekt, das das Feld sichtbar füllt (Felsblock, Teich, Ruine), damit man sieht, dass dort nicht gebaut werden kann.
   */
  zone?: 'shore' | 'rim' | 'field' | 'far' | 'block';
  /** Zufällige Größe [von, bis]. Standard [0.85, 1.2]. */
  scale?: [number, number];
  /** Objekte dieser Sorte stehen gern in Gruppen dieser Größe. Standard 1. */
  cluster?: number;
}

/** Umgebung unterhalb und rund um die schwebende Insel. */
export interface AbyssTheme {
  /** 'clouds' = Wolkenmeer, 'sea' = Wasserfläche, 'mist' = Dunst, 'city' = Lichtermeer einer Stadt bei Nacht. */
  kind: 'clouds' | 'sea' | 'mist' | 'city';
  /** Hauptfarbe. */
  color: ColorLike;
  /** Zweite Farbe (Wolkenschatten, Wellenkämme, Lichter). */
  color2: ColorLike;
}

/** Schwebeteilchen in der Luft über der Insel. */
export interface AmbientParticles {
  kind: 'none' | 'pollen' | 'fireflies' | 'leaves' | 'dust' | 'embers' | 'smoke' | 'rain' | 'snow' | 'sparks' | 'petals';
  color: ColorLike;
  /** 0..1 */
  density: number;
}

/** Stimmung der Hintergrundmusik (wird im Browser erzeugt, keine Audiodateien). */
export interface MusicTheme {
  /** Schläge pro Minute. */
  tempo: number;
  /** Grundton als MIDI-Nummer (60 = c'). */
  root: number;
  /** Tonleiter als Halbtonschritte über dem Grundton, z. B. [0, 2, 4, 7, 9]. */
  scale: number[];
  /** Klangfarbe der Melodie. */
  lead: 'flute' | 'pluck' | 'reed' | 'bell' | 'strings' | 'brass' | 'organ' | 'piano' | 'synth' | 'pad';
  /** Klangfarbe der Begleitung. */
  backing: 'drone' | 'pluck' | 'strings' | 'organ' | 'pad' | 'synth';
  /** Schlagwerk. */
  percussion: 'none' | 'handdrum' | 'frame' | 'march' | 'kit' | 'electronic';
  /** 0 = ruhig und spärlich, 1 = dicht und treibend. */
  energy: number;
}

export interface AgeDef {
  /** Kurze Kennung in Kleinbuchstaben, z. B. 'stone'. Teil der Modell-Kennungen. */
  id: string;
  /** Anzeigename, z. B. 'Steinzeit'. */
  name: string;
  /** Zeitangabe, z. B. 'um 10 000 v. Chr.'. */
  subtitle: string;
  /** Ein Satz für das Banner beim Anbruch des Zeitalters. */
  tagline: string;
  /** Akzentfarbe der Bedienoberfläche in diesem Zeitalter. */
  accent: string;
  light: LightTheme;
  terrain: TerrainPalette;
  /** Verstreute Dekoration. */
  scatter: ScatterRule[];
  /** Richtwert für die Zahl großer Objekte in Ufer- und Randzone. */
  scatterCount: number;
  /** Richtwert für die Zahl kleiner Bodendeko auf dem Spielfeld. */
  fieldCount: number;
  /** Modell der eigenen Basis am Ende des Weges. */
  baseModel: string;
  abyss: AbyssTheme;
  particles: AmbientParticles;
  music: MusicTheme;
  /** Stärke des Überstrahlens leuchtender Flächen (hohe Grafikstufe), etwa 0.25 am Tag bis 0.8 bei Nacht. */
  bloom: number;
}

// ---------------------------------------------------------------------------------------------
// Türme
// ---------------------------------------------------------------------------------------------

/** Vollständig aufgelöste Kampfwerte eines Turms (eine Rolle, ein Zeitalter, eine Stufe). */
export interface TowerStats {
  /**
   * Art des Angriffs:
   * 'projectile' = Geschoss mit Flugzeit, 'hitscan' = trifft sofort, 'beam' = Dauerstrahl auf ein Ziel,
   * 'pulse' = trifft in festen Abständen alle Gegner im Umkreis, 'none' = kein Angriff (reiner Unterstützer).
   */
  attack: 'projectile' | 'hitscan' | 'beam' | 'pulse' | 'none';
  /** Schaden je Treffer (bei 'beam' je Sekunde). */
  damage: number;
  /** Sekunden zwischen zwei Schüssen (bei 'beam' ohne Bedeutung). */
  cooldown: number;
  /** Reichweite in Feldern. */
  range: number;
  /** Mindestabstand zum Ziel in Feldern (0 = keiner). */
  minRange: number;
  /** Fluggeschwindigkeit des Geschosses in Feldern pro Sekunde (nur 'projectile'). */
  projectileSpeed: number;
  /** Radius des Flächenschadens in Feldern (0 = Einzelziel). */
  splash: number;
  /** Verlangsamung als Anteil 0..1 (0.4 = Gegner sind 40 % langsamer); 0 = keine. */
  slow: number;
  /** Dauer der Verlangsamung in Sekunden. */
  slowDuration: number;
  /** Schaden über Zeit je Sekunde (Brand, Gift); 0 = keiner. */
  dot: number;
  /** Dauer des Schadens über Zeit in Sekunden. */
  dotDuration: number;
  /** Anteil der Rüstung, der ignoriert wird, 0..1. */
  pierce: number;
  /** Anzahl zusätzlicher Ziele, auf die der Treffer überspringt (0 = keins). */
  chain: number;
  /** Größter Abstand eines Sprungs in Feldern. */
  chainRange: number;
  /**
   * Bodenfeld: Dauer in Sekunden, die am Einschlagpunkt ein Feld mit Radius `splash` liegen bleibt (0 = keines).
   * Bodengegner im Feld erhalten fortlaufend dessen Verlangsamung (`slow`, hält `slowDuration` Sekunden nach dem Verlassen an)
   * und dessen Schaden über Zeit (`dot`, `dotDuration`). So arbeitet die Pfütze des Bremsers.
   */
  zone: number;
  /** Bei 'beam': Der Schaden wächst über `rampTime` Sekunden Dauerbeschuss auf das (1 + ramp)-Fache. */
  ramp: number;
  rampTime: number;
  /** Kann fliegende Gegner treffen. */
  hitsAir: boolean;
  /** Kann Gegner am Boden treffen. */
  hitsGround: boolean;
  /** Aura: Türme im Umkreis `range` richten um diesen Anteil mehr Schaden an (0.2 = +20 %); 0 = keine Aura. */
  auraDamage: number;
  /** Aura: Türme im Umkreis feuern um diesen Anteil schneller. */
  auraRate: number;
  /** Aura: Türme im Umkreis haben um diesen Anteil mehr Reichweite. */
  auraRange: number;
  // Freiwillige Felder der Waffen des Pools (docs/SIM.md, „Türme und Angriffe“). Fehlen sie, gelten 0 bzw. false; `towerStats`
  // liefert sie nur, wenn die Waffe oder eine Veränderung sie nennt.
  /**
   * Rückstoß: Ein Treffer wirft den Gegner so viele Felder auf seinem Weg zurück (Bosse halb). Ein Gegner lässt sich höchstens
   * einmal je 1 s zurückwerfen (Ereignis `push`).
   */
  push?: number;
  /**
   * Zeichen (Verwundbarkeit): Ein getroffener Gegner nimmt `markDuration` Sekunden lang um diesen Anteil mehr Schaden von allem,
   * auch Brand (0.2 = +20 %). Das stärkste Zeichen zählt, Zeichen addieren sich nicht. Sichtbar als `Enemy.vuln`/`vulnTime`.
   */
  mark?: number;
  markDuration?: number;
  /**
   * Sucher: Der Turm wählt unter seinen Zielen zuerst die, die seine Wirkung noch nicht (oder nur noch kurz) tragen: nicht brennend
   * bei `dot`, nicht verlangsamt bei `slow`, ohne Zeichen bei `mark`, nicht frisch zurückgeworfen bei `push`.
   */
  seek?: boolean;
  /**
   * Kopfgeld-Aura: Stirbt ein Gegner im Umkreis `range` dieses Turms (unverstärkt), bringt er um diesen Anteil mehr Kopfgeld.
   * Es zählt der stärkste Turm, nichts addiert sich.
   */
  auraBounty?: number;
}

/** Die Zahlenfelder von TowerStats (auch die freiwilligen). */
export type NumericStat = { [K in keyof TowerStats]-?: NonNullable<TowerStats[K]> extends number ? K : never }[keyof TowerStats];

/**
 * Eine Veränderung von Kampfwerten (Ausbauzweig, Kern oder Zutat einer Superwaffe).
 * `set` überschreibt Grundwerte VOR der Skalierung durch die Balance (wie `levels`), `mul` und `add` wirken DANACH,
 * erst `mul`, dann `add`. `add.damage` und `add.dot` zählen in Standardschüssen des Technikstands
 * (Wert * baseDamage * ageDamage[tier]), alle anderen Felder in ihrer eigenen Einheit.
 */
export interface StatMod {
  set?: Partial<TowerStats>;
  mul?: Partial<Record<NumericStat, number>>;
  add?: Partial<Record<NumericStat, number>>;
}

/** Einer von zwei Ausbauzweigen, zwischen denen der Spieler beim Ausbau auf Stufe 3 wählt. */
export interface TowerBranchDef {
  /** Kurzer Name, z. B. 'Doppelschuss'. */
  name: string;
  /** Was der Zweig bewirkt, in einem Satz. */
  summary: string;
  /** Kennung des Symbols der Bedienoberfläche. */
  icon: string;
  mod: StatMod;
  /**
   * Die Gabe, die ein Turm dieser Rolle mit diesem Zweig als ZUTAT einer Superwaffe beisteuert (docs/briefs/fusion.md, 5.2).
   * Ohne Angabe gilt `arch.fusion.gift` mit `giftName`/`giftText`.
   */
  gift?: { mod: StatMod; name: string; text: string };
}

/** Was eine Rolle in einer Superwaffe tut (docs/briefs/fusion.md). */
export interface TowerFusionDef {
  /** Zusätzliche Veränderung, wenn ein Turm dieser Rolle der KERN einer Superwaffe ist. */
  core: StatMod;
  /** Was der Kern gewinnt, in einem Satz. */
  coreText: string;
  /** Was ein Turm dieser Rolle als ZUTAT einer Superwaffe beisteuert, gleich welcher Rolle der Kern ist. */
  gift: StatMod;
  /** Name der Gabe, ein bis zwei Wörter, z. B. 'Brandsatz'. */
  giftName: string;
  /** Was die Gabe bewirkt, in einem Satz. */
  giftText: string;
  /**
   * Rezepte (docs/briefs/fusion.md, 8): Nennen die ersten `balance.fusion.parts` Zutaten einer Superwaffe genau diese Rollen,
   * ersetzt das Rezept `core` und `coreText`; Namen und Angriffsbild stehen je Zeitalter in `TowerTierDef.recipes`.
   * Rezepte der klassischen Waffe eines Platzes gelten für jeden Kern dieses Platzes; Rezepte einer anderen Waffe nur für sie.
   */
  recipes?: FusionRecipe[];
}

/** Eine besondere Superwaffe aus einem bestimmten Kern und bestimmten Zutaten, z. B. die Flak aus drei Schützen. */
export interface FusionRecipe {
  /** Kennung, Schlüssel in `TowerTierDef.recipes`, z. B. 'flak'. */
  id: string;
  /** Kurzname, z. B. 'Flak'. */
  name: string;
  /**
   * Zutaten als Multimenge (Reihenfolge und Zweige egal); genau `balance.fusion.parts` Einträge. Jeder Eintrag ist ein PLATZ (die
   * Kennung eines Platzes, z. B. 'bremser': trifft jede Waffe dieses Platzes) oder eine WAFFE des Pools, die nicht klassisch ist
   * (z. B. 'frostturm': trifft nur sie). Ein Rezept, das eine Waffe nennt oder bei einer nicht klassischen Waffe steht, ist
   * waffengebunden (docs/SIM.md, „Waffenpool“).
   */
  gifts: string[];
  /** Ersetzt `fusion.core` der Kernrolle; die Gaben der Zutaten wirken wie sonst. */
  core: StatMod;
  /** Ersetzt `fusion.coreText`. */
  coreText: string;
  /**
   * true: Das Rezept wirkt erst, wenn es in der laufenden Partie freigeschaltet ist (`SimState.recipes`, docs/briefs/fusion.md, 11);
   * bis dahin ergibt die Mischung die gewöhnliche Superwaffe. Ohne Angabe gilt es immer (die Flak).
   */
  locked?: boolean;
  /**
   * Nur für gesperrte Rezepte: Positionen der gespielten Zeitalter (ab 0), deren Zwischenboss es als Belohnung ziehen kann (der
   * „Pool“ eines Zeitalters sind alle noch gesperrten Rezepte, die seine Position nennen). Ohne Angabe nur über eine Zeitgabe.
   */
  ages?: number[];
}

/** Namen und Angriffsbild einer Rezept-Superwaffe in einem Zeitalter. */
export interface RecipeLook {
  superName: string;
  megaName: string;
  /** Angriff der Super- und Megawaffe; ohne Angabe gilt `superShot` der Ausprägung. */
  superShot?: ShotVisual;
}

/** Klänge beim Schuss, die die Audio-Engine erzeugen kann. */
export type ShotSound =
  | 'none' | 'sling' | 'throw' | 'bow' | 'crossbow' | 'catapult' | 'ballista' | 'horn' | 'drum' | 'bell'
  | 'musket' | 'cannon' | 'mortar' | 'rifle' | 'gatling' | 'mg' | 'howitzer' | 'flame' | 'steam' | 'tesla'
  | 'rocket' | 'laser' | 'railgun' | 'plasma' | 'pulse' | 'frost' | 'net' | 'splash' | 'chime';

/** Klänge beim Einschlag, die die Audio-Engine erzeugen kann. */
export type ImpactSound =
  | 'none' | 'thud' | 'stone' | 'wood' | 'metal' | 'arrow' | 'explosion' | 'bigExplosion' | 'fire' | 'splash' | 'zap' | 'frost' | 'energy' | 'glass';

/** Darstellung und Klang eines Angriffs. Für die Simulation ohne Bedeutung. */
export interface ShotVisual {
  /**
   * 'model' = fliegendes Geschossmodell, 'tracer' = kurzer Leuchtstrich (Kugeln), 'beam' = stehender Strahl,
   * 'bolt' = Blitz/Energieentladung, 'flame' = Flammenstoß, 'pulse' = Ring breitet sich vom Turm aus, 'none' = unsichtbar.
   */
  kind: 'model' | 'tracer' | 'beam' | 'bolt' | 'flame' | 'pulse' | 'none';
  /** Geschossmodell für kind 'model', z. B. 'shot.arrow'. */
  model?: string;
  /** Leitfarbe (Strahl, Leuchtspur, Einschlag). */
  color: ColorLike;
  /** Bogenhöhe der Flugbahn in Feldern (0 = gerade, 1.5 = hoher Wurf). */
  arc?: number;
  /** Geschoss dreht sich im Flug (Steine, Fässer). */
  tumble?: boolean;
  /** Spur hinter dem Geschoss. */
  trail?: 'none' | 'smoke' | 'spark' | 'fire' | 'energy' | 'frost';
  /** Effekt an der Mündung. */
  muzzle?: 'none' | 'flash' | 'smoke' | 'spark' | 'energy';
  /** Effekt beim Einschlag. */
  impact: 'none' | 'dust' | 'spark' | 'explosion' | 'fire' | 'frost' | 'energy' | 'splash' | 'net';
  /** Klang beim Schuss. */
  sound: ShotSound;
  /** Klang beim Einschlag. Standard 'none'. */
  impactSound?: ImpactSound;
}

/** Die Ausprägung einer Turmrolle in einem Zeitalter. */
export interface TowerTierDef {
  /** Anzeigename, z. B. 'Steinschleuderer'. */
  name: string;
  /** Ein stimmungsvoller Satz. */
  flavor: string;
  /** Modell-Kennung, z. B. 'tower.stone.shooter'. */
  model: string;
  shot: ShotVisual;
  /** Abweichungen von den berechneten Werten, für alle Stufen dieses Zeitalters. */
  tweak?: Partial<TowerStats>;
  /** Name der Superwaffe mit diesem Turm als Kern, z. B. 'Donnerschleuder'. */
  superName?: string;
  /** Name der Megawaffe mit diesem Turm als Kern, eine Stufe größer als `superName`. */
  megaName?: string;
  /** Wie der Angriff einer Super- oder Megawaffe mit diesem Turm als Kern aussieht und klingt; ohne Angabe gilt `shot`. */
  superShot?: ShotVisual;
  /** Namen und Angriffsbild der Rezept-Superwaffen in diesem Zeitalter, Schlüssel = `FusionRecipe.id`. */
  recipes?: Record<string, RecipeLook>;
}

/**
 * Kleines Erkennungszeichen einer Waffe am geteilten Modell ihres Platzes (docs/briefs/fusion.md, 12), in `WeaponLook.accent`:
 * 'none' = keins (die klassischen Waffen), 'crystal' = Eiskristall auf der Spitze, 'vial' = Phiole am Turm,
 * 'pennant' = Wimpel an einer Stange, 'ring' = Leuchtring um den Sockel, 'orb' = kleine schwebende Kugel über dem Turm,
 * 'spikes' = Zackenkranz oben. Die Darstellung fällt bei Unbekanntem auf 'none' zurück.
 */
export type WeaponMarker = 'none' | 'crystal' | 'vial' | 'pennant' | 'ring' | 'orb' | 'spikes';

/** Aussehen einer Waffe über das geteilte Modell ihres Platzes hinaus. Für die Simulation ohne Bedeutung. */
export interface WeaponLook {
  /** Akzentfarbe der Waffe (Erkennungszeichen, Leuchten, Bauleiste); deutlich anders als die Farbe des Platzes. */
  accent: ColorLike;
  /** Erkennungszeichen am Modell. */
  marker: WeaponMarker;
}

/**
 * Was jede Waffe eines Platzes können muss (geprüft an den Werten der Stufe 1 im ersten Zeitalter, `arch.stats`):
 * 'area' = Fläche (`splash > 0`) oder Puls, 'slow' = Verlangsamung (`slow > 0`), 'armor' = durchschlägt Rüstung (`pierce > 0`),
 * 'burn' = Schaden über Zeit (`dot > 0`), 'aura' = Unterstützung: eine Aura für Nachbarn (`auraRate`, `auraDamage`, `auraRange` oder
 * `auraBounty > 0`) oder ein Zeichen auf Gegnern (`mark > 0`).
 */
export type SlotJob = 'area' | 'slow' | 'armor' | 'burn' | 'aura';

/**
 * Ein Platz der Bauleiste (docs/briefs/fusion.md, 12): eine Aufgabe, für die jede Partie genau eine Waffe zieht. Die Reihenfolge
 * in `Content.slots` ist die Reihenfolge der Bauleiste und der Tasten 1 bis 6. Rollenfarbe, Symbol, Freischalt-Reihenfolge,
 * Filter der Zeitgaben und die gewöhnlichen Rezepte gehen nach dem Platz, nicht nach der Waffe.
 */
export interface SlotDef {
  /** Kennung des Platzes; zugleich die Kennung seiner klassischen Waffe, z. B. 'schuetze'. */
  id: string;
  /** Name der Aufgabe, z. B. 'Schütze'; jede Waffe des Platzes trägt ihn als `role`. */
  name: string;
  /** Was jede Waffe dieses Platzes leistet, ein Satz. */
  summary: string;
  /** Farbe des Platzes; jede Waffe des Platzes trägt sie als `color`. */
  color: string;
  /** Kennung des Symbols; jede Waffe des Platzes trägt es als `icon`. */
  icon: string;
  /** Was jede Waffe dieses Platzes können muss; ohne Angabe nichts Bestimmtes. */
  job?: SlotJob;
}

/**
 * Eine Waffe (früher „Turmrolle“) mit ihrer Ahnenreihe durch die Zeitalter. Jede Waffe gehört zu einem Platz (`slot`); die klassische
 * Waffe eines Platzes hat dessen Kennung als `id`. Regeln für Waffen des Pools: docs/SIM.md, „Waffenpool“.
 */
export interface TowerArchetypeDef {
  /** Kurze Kennung, z. B. 'schuetze' oder 'frostturm'. Über alle Waffen eindeutig. */
  id: string;
  /**
   * Platz der Waffe (Kennung aus `Content.slots`). Ohne Angabe der Platz mit der Kennung der Waffe: So bleiben ältere Inhalte mit
   * sechs Rollen gültig, jede Rolle ist ihr eigener Platz und ihre klassische Waffe.
   */
  slot?: string;
  /** Name der Waffe über alle Zeitalter, z. B. 'Frostturm' (Auswahl der Bewaffnung, Rezeptbuch); ohne Angabe `role`. */
  name?: string;
  /** Name der Aufgabe, z. B. 'Schütze'; bei Inhalten mit `slots` gleich `SlotDef.name` des Platzes. */
  role: string;
  /** Was die Waffe kann, in einem Satz. */
  summary: string;
  /** Erkennungsfarbe des Platzes über alle Zeitalter; bei Inhalten mit `slots` gleich `SlotDef.color`. */
  color: string;
  /** Kennung des Symbols des Platzes; bei Inhalten mit `slots` gleich `SlotDef.icon`. */
  icon: string;
  /** Akzentfarbe und Erkennungszeichen der Waffe; Pflicht für jede Waffe, die nicht die klassische ihres Platzes ist. */
  look?: WeaponLook;
  /**
   * Art ihres Schadens über Zeit, nur für die Beschriftung (Oberfläche): 'fire' = Brand (Standard), 'poison' = Gift, 'ember' = Glut.
   * Gilt für den Schaden über Zeit der Waffe selbst, ihrer Zweige und ihrer Gabe. Für die Simulation ohne Bedeutung.
   */
  dotKind?: 'fire' | 'poison' | 'ember';
  /**
   * Fortlaufender Index der Welle (ab 0), ab der die Waffe baubar ist (0 = von Anfang an). Entfällt mit SimConfig.unlockAll.
   * Gleich für alle Waffen eines Platzes (die Freischalt-Reihenfolge geht nach dem Platz).
   */
  unlockWave: number;
  /** Zielwahl neu gebauter Türme dieser Rolle. Standard 'first'. */
  defaultMode?: TargetMode;
  /** Baukosten im ersten Zeitalter; spätere Zeitalter skalieren über Balance.ageCost. */
  cost: number;
  /** Werte der Stufe 1 im ersten Zeitalter; Stufen und spätere Zeitalter skalieren über die Balance. */
  stats: TowerStats;
  /**
   * Besonderheiten je Stufe (Index 0 = Stufe 1): Felder, die `stats` auf dieser Stufe überschreiben,
   * z. B. größerer Flächenradius oder stärkere Verlangsamung. Schaden und Reichweite wachsen ohnehin über die Balance.
   */
  levels?: [Partial<TowerStats>, Partial<TowerStats>, Partial<TowerStats>];
  /**
   * Zwei Ausbauzweige der Stufe 3. Sind sie angegeben, wählt der Spieler beim Ausbau auf Stufe 3 einen davon;
   * `levels[2]` gilt dann für beide, der Zweig kommt obendrauf.
   */
  branches?: [TowerBranchDef, TowerBranchDef];
  /** Rolle in Superwaffen; ohne Angabe kann die Rolle weder Kern noch Zutat sein. */
  fusion?: TowerFusionDef;
  /**
   * Eine Ausprägung je Zeitalter (Index = Index des Zeitalters); null, wenn es die Rolle in einem Zeitalter nicht gibt.
   * Eine Waffe des Pools hat eine Ausprägung in jedem Zeitalter, in dem die klassische Waffe ihres Platzes eine hat, und nutzt
   * dort (vorerst) deren Modell (`model`).
   */
  tiers: (TowerTierDef | null)[];
}

// ---------------------------------------------------------------------------------------------
// Gegner und Wellen
// ---------------------------------------------------------------------------------------------

/** Angekündigter Moment eines Gegners (meist eines Bosses), sobald seine Lebenspunkte erstmals unter einen Anteil fallen. */
export interface EnemyPhase {
  /** Anteil der Lebenspunkte 0..1, bei dessen Unterschreiten der Moment einmalig eintritt. */
  at: number;
  /** Setzt diese Gegner an Ort und Stelle aus. */
  spawns?: { enemy: string; count: number };
  /** Vervielfacht das Tempo für `duration` Sekunden (z. B. 2 für einen Galopp). */
  speed?: number;
  duration?: number;
}

export interface EnemyDef {
  /** Kennung, z. B. 'wolf'. Über alle Zeitalter eindeutig. */
  id: string;
  /** Kennung des Zeitalters. */
  age: string;
  name: string;
  /** Ein Satz für die Wellenvorschau. */
  description: string;
  /** Modell-Kennung, z. B. 'enemy.stone.wolf' oder 'boss.stone.mammoth'. */
  model: string;
  boss: boolean;
  flying: boolean;
  /** Lebenspunkte als Vielfaches des Standardgegners seines Zeitalters. */
  hp: number;
  /** Tempo in Feldern pro Sekunde. */
  speed: number;
  /** Rüstung als Anteil des Standardschusses seines Zeitalters (0 = keine). Wird je Treffer abgezogen. */
  armor: number;
  /** Schild als Vielfaches der eigenen Lebenspunkte (0 = keiner). Fängt Schaden ab und lädt sich nach einer Pause wieder auf. */
  shield: number;
  /** Selbstheilung in Anteilen der maximalen Lebenspunkte pro Sekunde (0 = keine). */
  regen: number;
  /** Widerstand gegen Verlangsamung 0..1 (1 = immun). */
  slowResist: number;
  /** Beim Tod erscheinen diese Gegner an seiner Stelle. */
  spawns?: { enemy: string; count: number };
  /** Heilt andere Gegner im Umkreis (Anteil ihrer maximalen Lebenspunkte pro Sekunde). */
  heal?: { radius: number; perSecond: number };
  /** Kopfgeld als Vielfaches des Standardgegners seines Zeitalters. */
  bounty: number;
  /** Leben (Funken), die verloren gehen, wenn er die Basis erreicht. */
  lives: number;
  /** Hauptfarbe der Figur als '#rrggbb'; färbt ihre Staubwolke beim Verschwinden. */
  color: string;
  /** Angekündigte Momente bei bestimmtem Lebensstand, absteigend nach `at`. */
  phases?: EnemyPhase[];
  /** Größenfaktor des Modells. Standard 1. */
  scale?: number;
  /** Trefferradius in Feldern. Standard 0.25. */
  radius?: number;
}

/** Eine Gruppe gleicher Gegner innerhalb einer Welle. */
export interface SpawnGroup {
  /** Kennung des Gegners. */
  enemy: string;
  count: number;
  /** Sekunden zwischen zwei Gegnern der Gruppe. */
  interval: number;
  /** Sekunden nach Wellenbeginn, zu denen der erste erscheint. */
  delay: number;
  /** Index des Weges auf Karten mit mehreren Wegen; ohne Angabe wechseln die Gegner reihum. */
  path?: number;
}

export interface WaveDef {
  groups: SpawnGroup[];
  /** Hinweis für die Vorschau, z. B. 'Viele schnelle Gegner'. */
  hint?: string;
}

// ---------------------------------------------------------------------------------------------
// Karten
// ---------------------------------------------------------------------------------------------

export interface MapDef {
  id: string;
  name: string;
  description: string;
  /** Felder in X. */
  width: number;
  /** Felder in Z. */
  height: number;
  /**
   * Wege als Wegpunkte [tx, tz]; aufeinanderfolgende Punkte liegen in einer Zeile oder Spalte.
   * Der erste Punkt ist der Eingang, der letzte die Basis. Der Eingang liegt genau EIN Feld außerhalb des Spielfelds
   * (tx = -1, tx = width, tz = -1 oder tz = height) im Uferstreifen; dort steht das Zeitportal. Die Basis liegt ebenfalls
   * ein Feld außerhalb ODER im Spielfeld; liegt sie im Spielfeld, gelten ihre acht Nachbarfelder als Platz der Basis und
   * sind nicht bebaubar. Alle übrigen Wegpunkte liegen im Spielfeld. Alle Wege enden auf demselben Feld.
   */
  paths: [number, number][][];
  /** Felder, auf denen nicht gebaut werden kann (Teiche, Felsen). */
  blocked: [number, number][];
  /** true: Flieger folgen dem Weg. Standard false: Flieger nehmen die gerade Luftlinie vom Eingang zur Basis. */
  flyersFollowPath?: boolean;
  /**
   * Besondere Bauplätze (docs/briefs/fusion.md, Abschnitt 6): ein Feld mit einer Eigenschaft aus `balance.tiles[kind]`.
   * Nie auf dem Weg, nie auf einem gesperrten Feld (auch nicht am Platz der Basis), jedes Feld höchstens einmal.
   * Ohne Angabe hat die Karte keine besonderen Felder.
   */
  tiles?: { tx: number; tz: number; kind: string }[];
  /**
   * Karten, die sich mit dem Zeitalter wandeln (docs/briefs/fusion.md, Abschnitt 7): Index = Stelle des Zeitalters in der
   * laufenden Partie (0 = erstes Zeitalter). Eintrag 0 fehlt normalerweise oder ist null, denn die Grundwege `paths` sind
   * Stufe 0; er darf keine eigenen Wege haben. Eine Stufe mit `paths` gilt ab ihrem Zeitalter, eine Stufe ohne `paths` trägt nur
   * Name und Text; spätere Zeitalter erben die zuletzt festgelegten Wege. Jedes Feld, das in irgendeiner erreichbaren Stufe Weg
   * ist, ist von Anfang an nicht bebaubar. Einträge jenseits der Zahl der Zeitalter sind erlaubt und werden nie erreicht.
   * Ohne Angabe bleibt der Weg die ganze Partie über derselbe.
   */
  stages?: (MapStage | null)[];
  /** Startwert für die zufällige Dekoration. */
  seed: number;
}

/** Eine Stufe einer sich wandelnden Karte, siehe `MapDef.stages`. */
export interface MapStage {
  /**
   * Wege ab diesem Zeitalter, nach denselben Regeln wie `MapDef.paths` (Eingang ein Feld draußen, alle enden auf dem Feld der
   * Basis der Grundwege). Ohne Angabe gelten die Wege der vorigen Stufe weiter. Die Anzahl der Wege darf sich ändern.
   */
  paths?: [number, number][][];
  /** Wie `MapDef.flyersFollowPath`, ab diesem Zeitalter; ohne Angabe gilt der Wert der vorigen Stufe (zuerst der der Karte). */
  flyersFollowPath?: boolean;
  /** Überschrift für die Karte des Zeitalterwechsels, z. B. 'Die Furt ist gefallen'. Deutsch, wenige Wörter. */
  name: string;
  /** Ein bis zwei kurze Sätze, was sich ändert. */
  text: string;
}

// ---------------------------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------------------------

/** Eine Art besonderer Bauplätze (Anhöhe, Kraftquelle ...), siehe `MapDef.tiles` und docs/SIM.md. */
export interface SpecialTileDef {
  /** Name, ein bis zwei Wörter, z. B. 'Anhöhe'. */
  name: string;
  /** Was ein Turm dort gewinnt oder zahlt, ehrlich und kurz (auch, für wen es nichts bringt). */
  text: string;
  /** Farbe der Bodenmarke; hebt sich von den sechs Rollenfarben ab und ist auf dem Boden jedes Zeitalters lesbar. */
  color: ColorLike;
  /** Kennung des Symbols der Bedienoberfläche. */
  icon: string;
  /**
   * Veränderung der Kampfwerte eines Turms auf diesem Feld, ganz zuletzt (nach Zweig und Verschmelzung).
   * Nur `mul` und `add`; `set` ist nicht erlaubt.
   */
  mod: StatMod;
  /** Faktor auf Bau-, Ausbau- und Modernisierungskosten und die Gebühr des Verschmelzens für einen Turm hier (1 = unverändert). */
  cost: number;
}

export interface DifficultyDef {
  name: string;
  description: string;
  /** Faktor auf die Lebenspunkte der Gegner. */
  hp: number;
  /** Faktor auf das Tempo der Gegner. */
  speed: number;
  /** Faktor auf das Startgold. */
  gold: number;
  /** Leben zu Beginn. */
  lives: number;
  /** Faktor auf Kopfgelder und Wellenprämien. */
  income: number;
  /** Faktor auf die Punktzahl. */
  score: number;
}

/** Alle Stellschrauben der Spielbalance an einem Ort. */
export interface Balance {
  /** Gold zu Beginn (vor dem Faktor des Schwierigkeitsgrads). */
  startGold: number;
  /** Lebenspunkte des Standardgegners im ersten Zeitalter. */
  baseHp: number;
  /** Kopfgeld des Standardgegners im ersten Zeitalter. */
  baseBounty: number;
  /** Schaden des Standardschusses im ersten Zeitalter; Bezugsgröße für die Rüstung der Gegner. */
  baseDamage: number;
  /** Faktor je Zeitalter auf den Turmschaden. */
  ageDamage: number[];
  /** Faktor je Zeitalter auf Bau- und Ausbaukosten. */
  ageCost: number[];
  /** Faktor je Zeitalter auf die Lebenspunkte der Gegner. */
  ageHp: number[];
  /** Faktor je Zeitalter auf Kopfgelder und Prämien. */
  ageBounty: number[];
  /** Zuwachs der Gegner-Lebenspunkte je Welle innerhalb eines Zeitalters (0.12 = +12 % je Welle). */
  waveHpGrowth: number;
  /** Faktoren der Stufen 1 bis 3 auf den Schaden. */
  levelDamage: [number, number, number];
  /** Faktoren der Stufen 1 bis 3 auf die Reichweite. */
  levelRange: [number, number, number];
  /** Kosten des Ausbaus auf Stufe 2 und Stufe 3 als Vielfaches der Baukosten. */
  levelCost: [number, number];
  /** Modernisieren kostet diesen Anteil dessen, was der Turm mit seiner Stufe im aktuellen Zeitalter neu kosten würde. */
  modernizeFactor: number;
  /** Anteil des investierten Goldes, den der Verkauf zurückgibt. */
  sellRefund: number;
  /** Prämie für eine überstandene Welle in Standard-Kopfgeldern des Zeitalters (waveBonus * baseBounty * ageBounty[Zeitalter]). */
  waveBonus: number;
  /** Zuschlag auf die Wellenprämie als Anteil, wenn in der Welle kein Leben verloren ging. */
  perfectBonus: number;
  /** Höchste Frühstart-Prämie als Vielfaches der Wellenprämie; sie schmilzt über `earlyBonusTime` Sekunden auf 0. */
  earlyBonus: number;
  earlyBonusTime: number;
  /** Gold-Geschenk beim Anbruch eines neuen Zeitalters in Standard-Kopfgeldern des neuen Zeitalters. */
  ageGift: number;
  /** Faktor, mit dem Schaden über Zeit auf verlangsamte Gegner wirkt (Zunder-Kombo), z. B. 1.5. */
  burnOnSlowed: number;
  /** Mindestanteil des Schadens, der trotz Rüstung immer ankommt. */
  minDamage: number;
  /** Sekunden ohne Treffer, bis ein Schild wieder lädt, und Ladezeit von leer auf voll. */
  shieldDelay: number;
  shieldRecharge: number;
  /** Superwaffen: Verschmelzen eines Kernturms mit benachbarten Türmen (docs/briefs/fusion.md). */
  fusion: {
    /** Anzahl der Zutaten, die ein Kern aufnimmt. */
    parts: number;
    /** Faktor auf Schaden und Brand der Superwaffe gegenüber ihrem Kern auf Stufe 3. */
    damage: number;
    /** Faktor auf die Reichweite. */
    range: number;
    /** Gebühr des Verschmelzens als Vielfaches der Baukosten der Kernrolle im Technikstand des Kerns (0 = kostenlos). */
    fee: number;
    /** Höchstzahl gleichzeitig bestehender Megawaffen je Spiel. */
    megaLimit: number;
    /** Faktor auf Schaden und Brand einer Megawaffe (statt `damage`). */
    megaDamage: number;
    /** Faktor auf die Reichweite einer Megawaffe (statt `range`). */
    megaRange: number;
    /** Gebühr des zweiten Verschmelzens als Vielfaches der Baukosten der Kernrolle (statt `fee`). */
    megaFee: number;
  };
  /**
   * Arten besonderer Bauplätze nach Kennung (`MapDef.tiles[i].kind`). Ältere Inhalte ohne diesen Eintrag bleiben gültig,
   * solange keine Karte besondere Felder nennt.
   */
  tiles: Record<string, SpecialTileDef>;
  /** Zeitgaben (docs/briefs/fusion.md, 9): Größe des Angebots beim Zeitalterwechsel. Ohne Angabe 3. */
  boons?: {
    /** Anzahl der Zeitgaben, die zur Wahl stehen (ganze Zahl ab 1). */
    offer: number;
  };
  /** Wellen mit Eigenart (docs/briefs/fusion.md, 10). Ohne Angabe 2 je Zeitalter. */
  modifiers?: {
    /** Anzahl der Wellen je Zeitalter, die eine Eigenart tragen (ganze Zahl ab 0). */
    perAge: number;
  };
  difficulty: Record<Difficulty, DifficultyDef>;
}

// ---------------------------------------------------------------------------------------------
// Zeitgaben und Wellen mit Eigenart (docs/briefs/fusion.md, 9 und 10; Regeln in docs/SIM.md)
// ---------------------------------------------------------------------------------------------

/**
 * Veränderung der Kampfwerte durch eine Zeitgabe, wahlweise nur für bestimmte Türme. Alle angegebenen Filter müssen passen.
 * Wirkt in `towerStats` nach dem besonderen Bauplatz (Schritt 10), also auf die fertigen Werte.
 */
export interface BoonTowerMod {
  /** Nur `mul` und `add` (kein `set`); `add.damage`/`add.dot` in Standardschüssen wie überall. */
  mod: StatMod;
  /** true: Die betroffenen Türme treffen zusätzlich Flieger. */
  hitsAir?: boolean;
  /** Nur Türme dieser PLÄTZE (Kennungen aus `Content.slots`; bei Super- und Megawaffen zählt der Platz des Kerns). */
  roles?: string[];
  /** Nur Türme dieser Waffen (bei Super- und Megawaffen zählt die Waffe des Kerns). */
  weapons?: string[];
  /** Nur Türme mit diesem Ausbauzweig (Stufe 3, Index in `arch.branches`). */
  branch?: number;
  /** Nur Türme auf besonderen Bauplätzen dieser Arten (Schlüssel in `balance.tiles`). */
  tiles?: string[];
  /** true: nur Super- und Megawaffen; false: nur gewöhnliche Türme. */
  super?: boolean;
  /** Nur Superwaffen dieses Rezepts (`FusionRecipe.id`). */
  recipe?: string;
}

/** Was eine Zeitgabe bewirkt. Alle Teile sind freiwillig und lassen sich kombinieren; Faktoren mehrerer Gaben multiplizieren sich. */
export interface BoonEffect {
  /** Kampfwerte, in Reihenfolge. */
  towers?: BoonTowerMod[];
  /**
   * Wirtschaft, alles Faktoren (1 = unverändert): Kopfgeld (`bounty`), Wellenprämie samt Makellos-Zuschlag (`waveBonus`),
   * Frühstart-Prämie (`early`), Bau-, Ausbau-, Modernisierungspreise und Gebühr des Verschmelzens (`build`, `upgrade`,
   * `modernize`, `fuse`; danach auf ein Vielfaches von 5 gerundet), Anteil beim Verkauf (`sell`, höchstens 100 %).
   */
  economy?: { bounty?: number; waveBonus?: number; early?: number; build?: number; upgrade?: number; modernize?: number; fuse?: number; sell?: number };
  /** Zeitglocke, Faktoren auf `cooldown`, `rewind` und `slowDuration` der Fähigkeit jedes Zeitalters. */
  ability?: { cooldown?: number; rewind?: number; slowDuration?: number };
  /** Einmalig bei der Wahl: Leben (auch negativ; nie unter 1; positive Werte heben auch `maxLives`) und Gold in Standard-Kopfgeldern des Zeitalters. */
  grant?: { lives?: number; gold?: number };
  /**
   * Regelschalter: `burnSpread` = Radius in Feldern, in dem der Brand eines sterbenden Gegners auf den nächsten lebenden überspringt
   * (0 = nie); `burnOnSlowed` = Zuschlag auf `balance.burnOnSlowed`; `airDamage`/`bossDamage` = Faktor auf Schaden und Brand gegen
   * Flieger bzw. Bosse; `megaLimit` = zusätzliche Megawaffen.
   */
  rules?: { burnSpread?: number; burnOnSlowed?: number; airDamage?: number; bossDamage?: number; megaLimit?: number };
  /**
   * Schaltet bei der Wahl dieses gesperrte Rezept (`FusionRecipe.id` mit `locked`) für den Rest der Partie frei. Eine solche Gabe
   * wird nur angeboten, solange das Rezept gesperrt ist, und höchstens eine davon je Angebot.
   */
  recipe?: string;
}

/** Eine Zeitgabe: ein bleibender Vorteil, gewählt beim Wechsel des Zeitalters. */
export interface BoonDef {
  /** Kennung, eindeutig, z. B. 'zunder'. */
  id: string;
  /** Name, ein bis drei Wörter. */
  name: string;
  /** Was sie bewirkt, ehrlich, mit Zahlen, ein bis zwei Sätze. */
  text: string;
  /** Kennung des Symbols der Bedienoberfläche. */
  icon: string;
  /** Akzentfarbe der Karte; ohne Angabe die des Zeitalters. */
  color?: ColorLike;
  /** Relative Häufigkeit im Angebot. Standard 1. */
  weight?: number;
  /**
   * Nur anbieten, wenn: `tiles` = die Karte hat mindestens einen besonderen Bauplatz einer dieser Arten; `flying` = eine spätere
   * Welle der Partie bringt Flieger; `fusion` = Superwaffen gibt es (`balance.fusion`); `weapons` = die Bewaffnung der Partie
   * enthält mindestens eine dieser Waffen. Eine Gabe mit `effect.recipe` kommt außerdem nur, wenn die Partie das Rezept bauen kann.
   */
  requires?: { tiles?: string[]; flying?: boolean; fusion?: boolean; weapons?: string[] };
  effect: BoonEffect;
}

/** Faktoren auf die Werte von Gegnern einer Welle (1 = unverändert). `count` vervielfacht die Zahl je Gruppe bei gleicher Dauer. */
export interface EnemyFactors {
  hp?: number;
  speed?: number;
  armor?: number;
  shield?: number;
  bounty?: number;
  count?: number;
}

/** Eigenart einer Welle (Nebel, Eilmarsch ...), angekündigt in der Wellenvorschau. */
export interface WaveModifierDef {
  name: string;
  /** Was die Welle anders macht und was sie dafür bringt, ein bis zwei Sätze mit Zahlen. */
  text: string;
  icon: string;
  color: ColorLike;
  /** Faktoren für alle Gegner der Welle (auch Fracht und Momente). */
  enemy?: EnemyFactors;
  /** Faktoren nur für Flieger, zusätzlich zu `enemy`. */
  air?: EnemyFactors;
  /** Wirkt auf alle Türme, solange die Welle läuft (nur `mul`/`add`, Schritt 11 in `towerStats`). */
  towers?: StatMod;
  /** Faktor auf Wellenprämie und Makellos-Zuschlag. */
  bonus?: number;
  /**
   * Nur für Wellen, deren gewöhnliche Gegner (ohne Bosse) das haben: 'flying' Flieger, 'ground' Läufer, 'armored' Rüstung,
   * 'shielded' Schild, 'swarm' eine Gruppe mit mindestens 8 Gegnern.
   */
  needs?: ('flying' | 'ground' | 'armored' | 'shielded' | 'swarm')[];
  /** Relative Häufigkeit. Standard 1. */
  weight?: number;
}

/** Die Fähigkeit, die der Spieler von Hand auslöst. Je Zeitalter eine Ausprägung. */
export interface AbilityDef {
  name: string;
  description: string;
  /** Kennung des Symbols. */
  icon: string;
  /** Sekunden bis zur erneuten Nutzung. */
  cooldown: number;
  /** Wirkungsradius in Feldern; 0 = wirkt auf alle Gegner der Karte, ohne Zielen. */
  radius: number;
  /** Wirft jeden getroffenen Gegner um so viele Sekunden seines Weges zurück (Bosse um die Hälfte); 0 = nicht. */
  rewind: number;
  /** Schaden als Vielfaches des Standardschusses des Zeitalters. */
  damage: number;
  /** Verlangsamung 0..1 und ihre Dauer. */
  slow: number;
  slowDuration: number;
  /** Trifft auch Flieger. */
  hitsAir: boolean;
  /** Darstellung: 'rockfall' | 'arrows' | 'fire' | 'cannonade' | 'airstrike' | 'orbital' ... (frei, die Darstellung fällt bei Unbekanntem auf 'explosion' zurück). */
  effect: string;
  color: ColorLike;
  sound: ImpactSound;
}

/** Alles zusammen. */
export interface Content {
  ages: AgeDef[];
  /** Alle Waffen (der Pool), die klassischen zuerst. Eine Partie baut nur die ihrer Bewaffnung (`Sim.loadout`). */
  archetypes: TowerArchetypeDef[];
  /**
   * Die Plätze der Bauleiste in ihrer Reihenfolge. Ohne Angabe ist jede Waffe ohne `slot` ihr eigener Platz (ältere Inhalte);
   * Name, Farbe und Symbol kommen dann von der Waffe.
   */
  slots?: SlotDef[];
  enemies: Record<string, EnemyDef>;
  /** Wellen je Zeitalter (äußerer Index = Index des Zeitalters). */
  waves: WaveDef[][];
  maps: MapDef[];
  /** Eine Fähigkeit je Zeitalter (Index = Index des Zeitalters). */
  abilities: AbilityDef[];
  balance: Balance;
  /** Zeitgaben; ohne sie gibt es beim Zeitalterwechsel kein Angebot. */
  boons?: BoonDef[];
  /** Eigenarten von Wellen nach Kennung; ohne sie hat keine Welle eine. */
  modifiers?: Record<string, WaveModifierDef>;
}
