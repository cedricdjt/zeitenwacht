# Spezifikation der Simulation

Verbindliche Spielregeln für `src/sim`. Die Datentypen stehen in `src/types/sim.d.ts` und `src/types/content.d.ts`;
bei Widersprüchen gelten die Typen für die Form der Daten und dieses Dokument für das Verhalten.

## Grundsätze

- **Deterministisch**: Gleiche `SimConfig` und gleiche Befehle zu gleichen Zeitschritten ergeben bitgenau denselben Verlauf.
  Zufall nur über `makeRng(config.seed)` aus `src/util/rng.js`. Kein `Math.random()`, kein `Date`, keine Abhängigkeit von der
  Reihenfolge in `Map`/`Set`, die nicht selbst deterministisch ist.
- **Unabhängig**: `src/sim` importiert nichts außer `src/sim/*`, `src/util/rng.js` und `src/util/math.js`. Kein DOM, kein three.js.
- **Fester Zeitschritt**: `SIM_DT = 1 / 60` Sekunden je `step()`.
- Koordinaten und Wegkurven liefert `src/sim/path.js` (`buildPath`, `samplePath`, `tileX`, `tileZ`). Feld (tx, tz) liegt im Spielfeld,
  wenn `0 <= tx < map.width` und `0 <= tz < map.height`.
- Gold, Leben, Kosten, Kopfgelder und Punkte sind ganze Zahlen.
- Fehlerhafte Inhalte (unbekannte Karte, unbekannter Gegner in einer Welle, Wege mit verschiedenen Endfeldern) lassen `createSim` mit
  einer verständlichen Meldung scheitern.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `src/sim/rules.js` | Reine Rechenregeln ohne Zustand: Turmwerte, Kosten, Gegnerwerte, Prämien. Auch von Oberfläche und Bots benutzt. |
| `src/sim/sim.js` | `createSim(config, save?)` und `SIM_DT`. Darf sich auf weitere Dateien in `src/sim` stützen. |
| `src/sim/path.js` | Weggeometrie (fertig, nicht ändern). |
| `src/sim/validate.js` | Prüfung von Inhalten (auch Karten und ihrer Stufen) und Spielständen. |

## Rechenregeln (`rules.js`)

`round5(x)` rundet auf das nächste Vielfache von 5, mindestens 5.

- `waveAge(content, wave)` → `{ age, waveInAge }` für einen fortlaufenden Wellenindex; `totalWaves(content)`.
  Jedes Zeitalter hat so viele Wellen, wie `content.waves[age]` lang ist; die Zeitalter dürfen verschieden lang sein, nichts rechnet
  mit einer festen Anzahl.
- `towerStats(content, arch, tier, level, opts?)` → `TowerStats`, mit `opts = { branch?, super?, mega?, gifts?, giftBranches?, tile?, boons?, modifier? }`
  (ein `Tower` passt als `opts` und bringt über `tower.boons` und `tower.modifier` Zeitgaben und Eigenart der Welle mit).
  Ohne `opts` ergeben sich die Werte eines Turms ohne Zweig und ohne Verschmelzung. Die Reihenfolge ist verbindlich:
  1. Ausgangspunkt ist `arch.stats`.
  2. Darüber die Felder aus `arch.levels[level - 1]` (falls vorhanden).
  3. Darüber `set` des Ausbauzweigs `arch.branches[opts.branch].mod` (nur auf Stufe 3, nur mit `opts.branch >= 0`).
  4. Nur bei `opts.super`: darüber `arch.fusion.core.set` der Kernrolle, dann das `set` der Gabe jeder Zutat aus `opts.gifts` in
     Reihenfolge. Die Gabe einer Zutat ist `giftMod(arch, b)`: `arch.branches[b].gift.mod` mit ihrem Zweig `b = opts.giftBranches[i]`
     (fehlt der Eintrag: 0), sonst `arch.fusion.gift`.
  5. Darüber die Felder aus `arch.tiers[tier].tweak` (falls vorhanden). **Stufenzuwachs bleibt erhalten:** Setzt `levels[level - 1]`
     dasselbe ZAHLENfeld wie der `tweak`, gilt `tweak + (levels[level - 1] - arch.stats)`, mindestens 0. So wachsen etwa Verlangsamung
     und Takt mit dem Zeitalter (tweak) UND mit der Stufe (levels). Für `attack`, `hitsAir`, `hitsGround` gewinnt schlicht der `tweak`.
     Ein `set` aus Schritt 3 oder 4 auf einem Feld, das der `tweak` setzt, wird überschrieben. Ausnahme: Bei `opts.super` gewinnt für
     `attack` das `arch.fusion.core.set` (eine Superwaffe greift in jedem Zeitalter auf die Art ihres Kerns an).
  6. Skalieren: `damage` und `dot` mal `balance.ageDamage[tier] * balance.levelDamage[level - 1]`,
     `range` mal `balance.levelRange[level - 1]`. Alle anderen Felder bleiben, wie sie nach Schritt 5 sind.
  7. Zweig: erst `mul` (Feld mal Faktor), dann `add`.
  8. Nur bei `opts.super`: `damage` und `dot` mal `balance.fusion.damage`, `range` mal `balance.fusion.range`; dann `mul`/`add` von
     `arch.fusion.core`; dann `mul`/`add` der Gabe jeder Zutat in Reihenfolge. Bei `opts.super` UND `opts.mega` (Megawaffe)
     gelten `balance.fusion.megaDamage` und `megaRange` statt `damage` und `range`; der Kern wirkt einmal, alle Gaben aus `opts.gifts`
     (bei einer Megawaffe vier) in Reihenfolge, in Schritt 4 wie hier. `mega` ohne `super` wirkt nicht.
  9. Besonderer Bauplatz: `mul`/`add` von `balance.tiles[opts.tile].mod` (auch nach der Verschmelzung). Eine leere
     oder unbekannte Art wirkt nicht.
  10. Zeitgaben: für jede Kennung in `opts.boons` (Reihenfolge der Wahl) jeder Eintrag von `effect.towers`, dessen Filter passen
      (siehe „Zeitgaben“): `mul`/`add`, dann bei `hitsAir: true` trifft der Turm auch Flieger.
  11. Eigenart der Welle: `mul`/`add` von `content.modifiers[opts.modifier].towers`.
  Hat Schritt 10 oder 11 etwas verändert, gilt danach `pierce <= 1` und `slow <= MAX_SLOW` (0,9).

  `add.damage` und `add.dot` zählen in Standardschüssen des Technikstands (`Wert * baseDamage * ageDamage[tier]`, ohne Stufenfaktor),
  alle anderen Felder in ihrer eigenen Einheit. Nach einem `add` fällt kein Wert unter 0. `mul` und `add` kennen nur Zahlenfelder.
  Eine unbekannte Rolle in `gifts` ist ein Fehler (Ausnahme); Rollen ohne `fusion` in `gifts` steuern nichts bei.
- `tileDef(content, kind)` = `balance.tiles[kind]` oder null (leere Kennung, unbekannte Art, Inhalte ohne `balance.tiles`).
  `tilePrice(content, kind, price)` = `round5(price * tileDef.cost)`; ohne Art, bei `cost == 1` oder bei `price <= 0` bleibt `price`
  (0 bleibt 0, -1 für „gibt es nicht“ bleibt -1).
- `buildCost(content, arch, tier, tile?)` = `round5(arch.cost * balance.ageCost[tier])`, mit `tile` danach `tilePrice`.
- `upgradeCost(content, arch, tier, level, tile?)` = Kosten von `level` auf `level + 1` = `round5(buildCost * balance.levelCost[level - 1])`
  (`buildCost` hier ohne Feld), mit `tile` danach `tilePrice`; für Stufe 3 gibt es keinen Ausbau (-1). Beide Ausbauzweige kosten dasselbe.
- `towerValue(content, arch, tier, level, opts?)` = Baukosten plus alle Ausbaukosten bis `level`. Mit `opts.super`: Neuwert des Kerns auf
  Stufe 3 plus Neuwert auf Stufe 3 jeder Rolle aus `opts.gifts` im selben Technikstand (die Gebühr des Verschmelzens zählt nicht mit).
  Immer ohne Aufschlag eines besonderen Bauplatzes (`opts.tile` wirkt hier nicht).
- `modernizeCost(content, arch, toTier, level, opts?)` = `round5(towerValue(content, arch, toTier, level, opts) * balance.modernizeFactor)`:
  ein fester Anteil des Neuwerts im Zielzeitalter, unabhängig davon, wie viele Zeitalter der Turm überspringt. Mit `opts.tile` danach `tilePrice`.
- `fuseCost(content, arch, tier, mega?)` = Gebühr des Verschmelzens für einen Kern dieser Rolle und dieses Technikstands:
  `round5(balance.fusion.fee * buildCost(content, arch, tier))`; mit `mega === true` (der Kern ist schon Superwaffe, es entsteht eine
  Megawaffe) `round5(balance.fusion.megaFee * buildCost(...))`; genau 0 bei Faktor 0 oder ohne `balance.fusion`. Mit `tile` (Feld des
  Kerns, `fuseCost(content, arch, tier, mega, tile)`) danach `tilePrice`.
- `enemyStats(content, def, age, waveInAge, difficulty)` → `{ hp, armor, shield, bounty, speed }` mit
  `hp = max(1, round(baseHp * ageHp[age] * (1 + waveHpGrowth * waveInAge) * def.hp * difficulty.hp))`,
  `armor = def.armor * baseDamage * ageDamage[age]`, `shield = round(hp * def.shield)`,
  `bounty = max(1, round(baseBounty * ageBounty[age] * def.bounty * difficulty.income))`, `speed = def.speed * difficulty.speed`.
  Maßgeblich ist das Zeitalter der **Welle**, in der der Gegner erscheint, nicht `def.age`.
- `waveBonus(content, age, difficulty)` = `round(balance.waveBonus * baseBounty * ageBounty[age] * difficulty.income)`
  (also `balance.waveBonus` Standard-Kopfgelder des Zeitalters). Makellos-Zuschlag: `round(waveBonus * balance.perfectBonus)`.
- `ageGift(content, age, difficulty)` = `round(balance.ageGift * baseBounty * ageBounty[age] * difficulty.income)`.
- `abilityDamage(content, def, age)` = `def.damage * baseDamage * ageDamage[age]`.
- Zeitgaben und Eigenarten: `boonDef(content, id)`, `modifierDef(content, id)` (oder null); `boonEffects(content, boons)` fasst
  Wirtschaft, Fähigkeit und Regelschalter zusammen (Faktoren multiplizieren sich, Zuschläge addieren sich, `burnSpread` nimmt den
  größten Radius, `lives` = Summe der positiven einmaligen Leben); `boonPrice(price, f)` = `round5(price * f)`, bei `f == 1` oder
  `price <= 0` unverändert, bei `f == 0` genau 0; `boonAbility(def, effects)` = die Fähigkeit mit `cooldown`, `rewind` und
  `slowDuration` mal ihren Faktoren (dieselbe Definition, wenn alle 1 sind); `modifiedEnemyStats(values, def, modifier, bountyFactor)`
  siehe „Wellen mit Eigenart“.

## Zustand zu Beginn

`gold = round(balance.startGold * difficulty.gold)`, `lives = maxLives = difficulty.lives`, Phase `'build'`, `wave = 0`, `age = 0`,
keine Türme, keine Bodenfelder, `abilityCooldown = 0`, `lock = 0`, alle Zähler in `stats` (auch `fusions` und `megas`) 0,
`boons = []`, `boonOffer = []`, `modifier = ''`, `recipes = []`.

## Wege und Luftlinien

`paths[i]` ist die Kurve des i-ten Weges. `airPaths[i]` ist die Flugbahn dazu: eine gerade Strecke vom ersten zum letzten Wegpunkt
(als `PathCurve` mit zwei Stützpunkten), oder bei `map.flyersFollowPath` dieselbe Kurve wie `paths[i]`. Ein Gegner mit `def.flying`
bewegt sich auf `airPaths[path]`, alle anderen auf `paths[path]`; `dist`, `progress` und das Durchkommen beziehen sich auf die
jeweilige Kurve.

Gesperrt (`blocked`) sind die Felder aus `map.blocked` und, wenn das Basisfeld im Spielfeld liegt, zusätzlich seine acht Nachbarfelder
(soweit sie nicht zum Weg gehören).

### Wege, die sich wandeln (`map.stages`)

Eine Karte kann je Zeitalter eine Stufe nennen (`map.stages[i]`, i = Index des Zeitalters; die Grundwege `map.paths` sind Stufe 0).
Eine Stufe mit `paths` und/oder `flyersFollowPath` bringt ab ihrem Zeitalter einen neuen Satz Wege samt Flugbahnen; fehlt `paths`,
gelten die Kurven der vorigen Stufe weiter, fehlt `flyersFollowPath`, dessen Wert. Eine Stufe mit nur `name` und `text` ändert nichts
an den Wegen (die Oberfläche zeigt ihren Text beim Zeitalterwechsel). Erreichbar sind nur Stufen mit Index < Zahl der Zeitalter.

- `sim.pathStages` = die Zeitalter, ab denen ein erreichbarer Satz Wege gilt, aufsteigend, beginnend mit 0 (ohne Stufen `[0]`).
  `sim.pathStage()` = der größte Eintrag, der nicht nach `state.age` liegt. `sim.stagePaths(s)`/`sim.stageAirPaths(s)` = Kurven und
  Flugbahnen, die im Zeitalter `s` gelten (für `s` jenseits der Partie die des letzten Satzes, für eine ungültige Angabe `[]`).
- **Nicht bebaubar** (`canBuild` → `path`) ist jedes Feld, das in IRGENDEINEM erreichbaren Satz Weg ist, von Anfang an und auch nachdem
  es aufgehört hat, Weg zu sein. So wird nie ein Turm verdrängt. Felder nie erreichter Stufen bleiben Bauland.
- `sim.pathMark(tx, tz)`: `'path'` (gehört zum jetzt geltenden Satz), sonst `'future'` (gehört zu einem späteren Satz), sonst
  `'former'` (gehörte nur zu früheren Sätzen), sonst `''` (auch außerhalb des Spielfelds).
- **Wechsel**: in Schritt 7 des Zeitschritts beim Wechsel des Zeitalters, wenn dort ein anderer Satz gilt. Dann lebt kein Gegner und
  keiner wartet. `sim.paths` und `sim.airPaths` bleiben dieselben Listen, ihr Inhalt wird ersetzt (auch ihre Länge kann sich ändern).
  Ereignis `{ type: 'paths', stage }` direkt nach dem Ereignis `age`. Fliegende Geschosse (sie haben nach Schritt 7 kein Ziel mehr)
  fliegen zu Ende, liegende Bodenfelder bleiben, wo sie liegen, bis sie ablaufen. Gegner erscheinen danach reihum über die neuen Wege;
  `SpawnGroup.path` muss im Zeitalter seiner Welle existieren (Prüfung der Inhalte). Fracht, Momente und die Fähigkeit benutzen den
  Weg ihres Gegners in den Listen des laufenden Satzes.
- `wavePreview(o).stage` = Stufe der Wege, auf denen diese Welle läuft (die Stufe des Zeitalters der Welle).
- Der Spielstand braucht nichts Neues: Die Stufe folgt beim Laden aus dem Zeitalter der Welle.

## Ablauf eines Zeitschritts (`step()`)

In den Phasen `'won'` und `'lost'` geschieht nichts. Sonst in dieser Reihenfolge:

1. **Uhren**: `time += SIM_DT`, `tick += 1`; `lock` und `abilityCooldown` laufen gegen 0. In Phase `'build'` wächst `buildTime`, solange `lock == 0`.
2. **Erscheinen** (nur Phase `'wave'`): Jede `SpawnGroup` bringt ihren k-ten Gegner (k ab 0) zur Wellenzeit `delay + k * interval`.
   Ohne `path` wechseln die Gegner der Gruppe reihum durch alle Wege der Karte. Ein neuer Gegner startet bei `dist = 0` mit zufälligem
   `lane` in [-0,28; 0,28] (Bosse: 0) und den Werten aus `enemyStats`. Ereignis `spawn`. `pending` zählt die noch nicht Erschienenen.
3. **Gegner** (in Reihenfolge ihrer `id`):
   - `sinceHit` und `age` wachsen.
   - Verlangsamung: `slowTime` läuft ab; bei 0 ist `slow = 0`. Tempo-Schub: `boostTime` läuft ab; bei 0 ist `boost = 1`.
     `speed = Grundtempo * boost * (1 - slow)`, Grundtempo aus `enemyStats`.
   - Schaden über Zeit (Brand): Solange `dotTime > 0`, verliert der Gegner `dot * f * SIM_DT` mit `f = balance.burnOnSlowed`, wenn er
     gerade verlangsamt ist (`slow > 0`), sonst `f = 1` (erst Schild, dann Lebenspunkte, Rüstung zählt nicht, `sinceHit` wird NICHT
     zurückgesetzt). Stirbt er daran, gilt der Turm als Sieger, der den Effekt zuletzt gesetzt hat.
   - **Ein brennender Gegner (`dotTime > 0`) heilt nicht und lädt nicht:** keine Selbstheilung, keine Heilung durch Heiler, kein Aufladen des Schilds.
   - Selbstheilung: Bei `def.regen > 0` und `sinceHit >= 1` wächst `hp` um `def.regen * maxHp * SIM_DT` bis höchstens `maxHp`.
   - Schild: Bei `maxShield > 0` und `sinceHit >= balance.shieldDelay` lädt der Schild mit `maxShield / balance.shieldRecharge` je Sekunde.
   - Heiler (`def.heal`): heilt jeden ANDEREN lebenden, nicht brennenden Gegner im Umkreis `radius` um `perSecond * dessen maxHp * SIM_DT`.
     Einmal je Sekunde und Heiler ein Ereignis `heal`, falls dabei jemand geheilt wurde.
   - Momente (`def.phases`): Fällt `hp / maxHp` erstmals auf oder unter `phases[phase].at`, tritt der Moment ein: `phase += 1`,
     Ereignis `phase`; mit `spawns` erscheinen die genannten Gegner wie die Fracht eines Trägers (siehe Aufräumen), mit `speed` gilt
     `boost = speed` für `duration` Sekunden. Geprüft wird einmal je Zeitschritt nach dem Schaden über Zeit; mehrere Schwellen in einem
     Schritt treten nacheinander ein.
   - Bewegung: `px/pz` merken, `dist += speed * SIM_DT`. Lage = Punkt der Wegkurve bei `dist` plus `lane` mal Normale `(-dz, dx)`;
     `dx/dz` = Richtung der Kurve; `progress = dist / Länge`.
   - Erreicht `dist` die Weglänge, kommt der Gegner durch: `lives -= def.lives` (nicht unter 0), Ereignis `leak`, Gegner entfernt,
     kein Kopfgeld. Sinkt `lives` auf 0: Phase `'lost'`, Ereignis `lost`, der Zeitschritt endet sofort.
4. **Türme** (in Reihenfolge ihrer `id`), siehe „Türme und Angriffe“.
5. **Geschosse**: `pt = t`, `t += SIM_DT / duration`. Lebt das verfolgte Ziel, wandert der Zielpunkt mit ihm. Bei `t >= 1` Einschlag.
   **Bodenfelder**: Jedes Feld gibt in jedem Zeitschritt jedem lebenden BODENgegner im Abstand <= `radius` seine Verlangsamung und
   seinen Schaden über Zeit wie ein Treffer weiter (Regeln 4 und 5 unter „Treffer“, ohne Schaden und ohne `sinceHit` zu ändern),
   dann läuft `time` ab; abgelaufene Felder werden entfernt.
6. **Aufräumen**: Tote Gegner in Reihenfolge ihrer `id` abhandeln: `gold += bounty`, Punkte, Ereignisse `kill` und `gold` (Grund `bounty`),
   Träger (`def.spawns`) setzen ihre Fracht aus, dann entfernen. Ausgesetzte Gegner erben Weg und `dist` (der k-te um `0,25 * k` zurückversetzt,
   nicht unter 0), bekommen ein zufälliges `lane` und die Werte der laufenden Welle.
7. **Wellenende**: In Phase `'wave'` mit `pending == 0` und ohne lebende Gegner: Geschosse, deren Ziel nicht mehr lebt, vergessen es
   (`targetId = -1`; das täte der nächste Schritt ebenso, so gleicht ein Spielstand der Bauphase dem geladenen Zustand genau). Prämie `waveBonus` gutschreiben (Ereignisse `gold` mit
   Grund `wave` und `waveClear`; `perfect` = kein Leben in dieser Welle verloren, dann kommt der Makellos-Zuschlag dazu), `wave += 1`.
   - War es die letzte Welle: Phase `'won'`, Schlusspunkte, Ereignis `won`.
   - Sonst Phase `'build'`, `buildTime = 0`. Gehört die neue Welle zu einem späteren Zeitalter: `age` wechseln,
     `gold += ageGift(...)`, `lock = AGE_LOCK` (5 Sekunden), Ereignisse `age`, bei einem Wechsel der Wege `paths` (siehe „Wege, die sich
     wandeln“) und `gold` (Grund `age`), danach das Angebot an Zeitgaben (siehe „Zeitgaben“). Liegende Bodenfelder bleiben.
   - Zwischenboss: War die überstandene Welle eine Welle mit Boss (`waveStart.boss`), die NICHT die letzte ihres Zeitalters ist, und
     ging dabei kein Leben verloren (`perfect`), wird direkt nach `waveClear` ein gesperrtes Rezept freigeschaltet (siehe „Rezepte“).
   - Die Prämie ist `waveBonus` (plus Makellos-Zuschlag) mal Faktor der Zeitgaben (`economy.waveBonus`) mal `bonus` der Eigenart der
     Welle, gerundet (bei Faktor 1 unverändert). Vor dem Gutschreiben endet die Eigenart: `state.modifier = ''`, Türme, die sie
     verändert hat, bekommen ihre Werte zurück (siehe „Wellen mit Eigenart“).

## Türme und Angriffe

Wirksame Werte eines Turms: Schaden `stats.damage * (1 + buffDamage)`, Feuerpause `stats.cooldown / (1 + buffRate)`,
Reichweite `stats.range * (1 + buffRange)`.

**Auren**: Ein Turm mit `auraDamage`, `auraRate` oder `auraRange > 0` verstärkt jeden ANDEREN Turm, dessen Feldmitte höchstens `stats.range`
(unverstärkt) entfernt ist. Je Bonusart zählt nur der stärkste Spender, es wird nicht addiert. Auren verändern keine Auren.
Die Boni werden neu berechnet, sobald sich der Turmbestand, eine Stufe oder ein Technikstand ändert, also auch nach jedem Verschmelzen.

**Ziele**: Gültig ist ein lebender Gegner, dessen Abstand zur Feldmitte des Turms höchstens die Reichweite und mindestens `minRange`
beträgt und der zur Bauart passt (`flying` braucht `hitsAir`, sonst `hitsGround`). Zielwahl: `first` = größtes `progress`,
`last` = kleinstes, `strong` = meiste `hp + shield`, `weak` = wenigste, `near` = kleinster Abstand; bei Gleichstand die kleinere `id`.
Ein Turm wählt bei jedem Schuss neu; nur `beam` hält sein Ziel, solange es gültig ist.
Ein Turm mit `zone > 0` bevorzugt Gegner, die in keinem liegenden Bodenfeld stehen; nur wenn es keinen solchen gibt, wählt er
unter allen gültigen. Ebenso ein **Sucher** (`seek: true`): Er bevorzugt Gegner, die seine Wirkung nicht tragen. „Trägt sie“ heißt:
bei `dot > 0` noch mehr als 0,5 s Brand (`dotTime > 0.5`, gleich von wem), bei `slow > 0` noch mehr als 0,5 s Verlangsamung, bei
`mark > 0` noch mehr als 0,5 s Zeichen, bei `push > 0` vor weniger als 1 s zurückgeworfen. Beide Vorlieben zusammen: frei ist, wer
beide erfüllt. Neue Türme beginnen mit `arch.defaultMode ?? 'first'`.
`targetId`, `aimX/aimZ/aimFlying` folgen dem Ziel in jedem Zeitschritt, in dem der Turm eines hat (auch während des Nachladens,
dann nach der Zielwahl des Modus), sonst ist `targetId = -1` und die letzte Ausrichtung bleibt stehen.

**Feuern**: `cooldown` läuft herunter. Ist er `<= 0` und gibt es ein Ziel, feuert der Turm, `lastShot = time`, Ereignis `shot`,
und `cooldown += Feuerpause` (nicht „= Feuerpause“, damit die Feuerrate exakt bleibt). Ohne Ziel bleibt `cooldown` bei höchstens 0 stehen.

| `attack` | Wirkung |
| --- | --- |
| `projectile` | Erzeugt ein Geschoss vom Turm zum Ziel mit `duration = max(0.05, Abstand / projectileSpeed)`. Schaden und Werte werden beim Abschuss festgehalten. Einschlag siehe unten. |
| `hitscan` | Trifft sofort wie ein Einschlag am Ort des Ziels. |
| `beam` | Dauerstrahl: `cooldown` ist der Schadenstakt (üblich 0,1 s). Je Takt Schaden `damage * cooldown * (1 + ramp * min(1, beamTime / rampTime))`. `beamTime` wächst, solange dasselbe Ziel gehalten wird, und fällt beim Zielwechsel oder ohne Ziel auf 0. |
| `pulse` | Braucht mindestens einen gültigen Gegner in Reichweite und trifft dann ALLE gültigen Gegner in Reichweite voll. Ereignis `hit` am Turm mit `splash = Reichweite`. |
| `none` | Kein Angriff; der Turm wirkt nur über seine Aura. |

**Freiwillige Kampfwerte** (Waffen des Pools; `TowerStats.push`, `mark`, `markDuration`, `seek`, `auraBounty`): Fehlen sie, gelten 0 bzw.
false. `towerStats` liefert ein solches Feld nur, wenn die Waffe, ihre Stufe, ihr Zweig, ihr Kern oder eine Gabe es nennt (`set`, oder
`add`, das ein fehlendes Feld als 0 anlegt; `mul` auf ein fehlendes Feld bleibt ohne Wirkung). So bleiben die Werte der klassischen
Waffen Feld für Feld wie vor dem Pool.

**Kopfgeld-Aura** (`auraBounty > 0`): Stirbt ein Gegner (gleich wodurch) an einer Stelle, die höchstens `stats.range` (unverstärkt) von
einem solchen Turm entfernt ist, bringt er `round(bounty * a)` Gold mehr, `a` = größtes `auraBounty` dieser Türme (nichts addiert sich).
`kill.bounty` und `gold.amount` nennen die Summe, `gold.extra` den Zuschlag (nur wenn > 0). Die Aura verändert keine Türme.

**Einschlag** an einem Punkt P mit Ziel Z:
- `splash == 0`: Lebt Z noch, wird Z getroffen; sonst verpufft der Schuss.
- `splash > 0`: Jeder zur Bauart passende lebende Gegner im Abstand d <= `splash` von P wird mit Faktor `1 - 0.5 * d / splash` getroffen.
- `zone > 0`: Am Punkt P entsteht ein Bodenfeld mit `radius = splash`, `time = duration = zone` und den Werten `slow`, `slowDuration`,
  `dot` (mal `1 + buffDamage` des Turms beim Abschuss), `dotDuration` des Schusses. Ereignis `zone`. Der Einschlag selbst trifft
  zusätzlich wie üblich (bei `damage = 0` ohne Wirkung auf Lebenspunkte, aber mit den Effekten 4 und 5).
- Bodenfelder tragen nur `slow` und `dot` weiter, keinen Rückstoß und kein Zeichen. Pulse, Ketten und Flächen geben beides jedem
  Getroffenen.
- `chain > 0` (nur bei `splash == 0` und getroffenem Z): bis zu `chain` Sprünge; jeder Sprung geht zum nächsten noch nicht getroffenen,
  passenden lebenden Gegner im Umkreis `chainRange` um den zuletzt Getroffenen, mit Faktor `0.7^k` beim k-ten Sprung. Ereignis `chain` je Sprung.
- Ereignis `hit` am Punkt P.

**Treffer** auf einen Gegner mit Rohschaden R (schon mit Faktor):
1. Schild: `a = min(shield, R)`; `shield -= a`; `R -= a`.
2. Ist `R > 0`: `hp -= max(R * balance.minDamage, R - armor * (1 - pierce))`.
3. `sinceHit = 0`.
4. Verlangsamung (`slow > 0`): wirksam `e = slow * (1 - def.slowResist)`. Ist `e >= ` aktueller `slow`: `slow = e`, `slowTime = max(slowTime, slowDuration)`.
   Schwächere Verlangsamungen verändern nichts.
5. Schaden über Zeit (`dot > 0`): `dot = max(dot, neuer Wert)`, `dotTime = max(dotTime, dotDuration)`; der Turm wird als Urheber gemerkt.
   Der neue Wert ist `stats.dot * (1 + buffDamage)`.
5a. Zeichen (`mark > 0`): Ist `mark >= vuln`, wird `vuln = mark` und `vulnTime = max(vulnTime, markDuration)`; schwächere ändern nichts.
   Wer ein Zeichen trägt, nimmt von jedem späteren Treffer und von jedem Brand das `(1 + vuln)`-Fache (vor Schild und Rüstung, nach
   den Faktoren der Zeitgaben gegen Flieger und Bosse). Der zeichnende Treffer selbst zählt mit dem Zeichen, das vorher bestand.
   `vulnTime` läuft in Schritt 3 des Ablaufs mit der Verlangsamung herunter; bei 0 ist `vuln = 0`. Bosse tragen es voll.
5b. Rückstoß (`push > 0`, nur wenn der Gegner noch lebt): Liegt der letzte Rückstoß dieses Gegners weniger als 1 s zurück, nichts.
   Sonst `dist -= min(dist, push)` (Bosse `push * 0.5`), Lage neu, `px/pz` = neue Lage, Ereignis `push` (`distance`, `towerId`,
   Lage davor). Auch ein Rückstoß von 0 (am Anfang des Weges) setzt die Sperrsekunde.
6. Der tatsächlich entzogene Betrag (Schild plus Lebenspunkte, höchstens der Bestand) zählt für `tower.damageDealt` und `stats.damageDealt`.
   Je Gegner und Zeitschritt höchstens ein Ereignis `damage` mit der Summe.
7. Bei `hp <= 0` ist der Gegner tot (`alive = false`), der Turm bekommt den Abschuss (`kills`). Abgehandelt wird er in Schritt 6 des Ablaufs.

## Befehle

Alle Befehle liefern `{ ok: true }` oder `{ ok: false, reason }` und ändern bei Ablehnung nichts. In den Phasen `'won'`/`'lost'`: `phase`.

- `canBuild(tx, tz)`: `outside`, `path` (Feld gehört zu einem Weg, auch einem künftigen oder früheren, siehe „Wege, die sich wandeln“), `blocked` (`map.blocked`), `occupied`. Ein besonderer Bauplatz ist
  ein gewöhnliches bebaubares Feld.
- `build(archId, tx, tz)`: `unknown` (Rolle), `locked` (Waffe nicht in `sim.loadout`, `state.wave < arch.unlockWave` ohne `config.unlockAll`, oder `arch.tiers[age]` fehlt),
  die Gründe von `canBuild`, `gold` (Preis `buildCost(content, arch, age, tileAt(tx, tz))`).
  Neuer Turm: `tier = age`, `level = 1`, `mode = arch.defaultMode ?? 'first'`, `cooldown = 0`, `builtWave = state.wave`, `invested = Baukosten`
  (samt Aufschlag des Feldes). Dazu `branch = -1`, `super = false`, `mega = false`, `gifts = []`, `giftBranches = []`, `recipe = ''`, `tile = tileAt(tx, tz)`.
- `upgrade(id, branch?)`: `unknown`, `max` (Stufe 3, also auch jede Superwaffe), `branch`, `gold` (Preis mit `tower.tile`). Stufe + 1, Werte neu.
  Beim Ausbau auf Stufe 3 einer Rolle mit `arch.branches` wählt `branch` den Zweig (ganze Zahl 0 oder 1; ohne Angabe 0; alles andere
  wird mit `branch` abgelehnt) und steht danach in `tower.branch`. Beim Ausbau auf Stufe 2 und bei Rollen ohne Zweige wird die Angabe
  ignoriert, `tower.branch` bleibt -1. Ein gewählter Zweig lässt sich nicht mehr wechseln.
- `fuse(coreId, partIds)`, `canFuse`, `fuseCandidates`, `fuseCost`: siehe „Superwaffen“ und „Megawaffen“.
- `modernize(id)`: `unknown`, `max` (`tier >= age` oder Ausprägung fehlt), `gold` (Preis `modernizeCost(content, arch, age, level, tower)`,
  für eine Super- oder Megawaffe also samt aller Gaben-Rollen, mit dem Aufschlag von `tower.tile`). `tier = age`, Stufe, Zweig, Gaben und Feld
  bleiben, Werte neu, `beamTime = 0`.
- `sell(id)`: `unknown`. Erstattet `invested` voll, wenn `builtWave == state.wave` und Phase `'build'` (Fehlkauf rückgängig machen),
  sonst `floor(invested * balance.sellRefund)`. Fliegende Geschosse des Turms treffen weiter. Gilt unverändert für Superwaffen.
- `setTargetMode(id, mode)`: `unknown`.
- Auskünfte: `buildCost(archId, tx?, tz?)` = Baukosten im aktuellen Zeitalter, mit Feld samt dessen Aufschlag (-1 für eine unbekannte
  Rolle); `upgradeCost`, `modernizeCost`, `fuseCost` eines Turms rechnen sein Feld immer mit. `tileAt(tx, tz)` = Art des besonderen
  Bauplatzes oder '' (auch außerhalb des Spielfelds und für nicht ganzzahlige Felder).
- `startWave()`: `phase` außerhalb der Phase `'build'`, dann `boon`, solange ein Angebot an Zeitgaben offen ist, dann `phase` bei
  `lock > 0`. Schreibt die Frühstart-Prämie gut (Ereignis `gold`, Grund `early`, nur wenn > 0), Phase `'wave'`, setzt die Eigenart
  der Welle in Kraft, Ereignis `waveStart` (`boss` = die Welle enthält einen Gegner mit `def.boss`; `modifier` nur, wenn sie eine hat).
- `chooseBoon(id)`: `phase`, wenn die Partie vorbei oder kein Angebot offen ist; `boon`, wenn `id` nicht im Angebot steht. Sonst siehe
  „Zeitgaben“.
- `earlyBonus()`: 0 außerhalb von Phase `'build'` und vor der allerersten Welle; sonst
  `round(waveBonus(Zeitalter der nächsten Welle) * balance.earlyBonus * max(0, 1 - buildTime / balance.earlyBonusTime) * economy.early)`.
- `useAbility(x, z)`: `cooldown`, wenn `abilityCooldown > 0`. Sonst trifft sie jeden lebenden Gegner im Umkreis `radius` um (x, z),
  bei `radius == 0` JEDEN lebenden Gegner (Flieger nur mit `hitsAir`):
  - bei `damage > 0` Schaden `abilityDamage` ohne Rüstungsabzug (`pierce = 1`);
  - bei `rewind > 0` wird der Gegner zurückgeworfen: `dist = max(0, dist - Grundtempo * rewind * (def.boss ? 0.5 : 1))`, Lage und
    `progress` sofort neu, `px/pz` auf die neue Lage gesetzt;
  - bei `slow > 0` ihre Verlangsamung (Regel 4 unter „Treffer“, also mit `slowResist`).
  `abilityCooldown = def.cooldown`; Ereignis `ability`. Abschüsse zählen für keinen Turm (`towerId = -1`).

## Besondere Bauplätze

`map.tiles` nennt einzelne bebaubare Felder mit einer Art aus `balance.tiles` (Anhöhe, Kraftquelle, Taktstein, Sumpf ...). Ein Turm dort hat
`tower.tile` = die Art, gesetzt beim Bau aus der Lage; sie ändert sich nie, denn Türme ziehen nicht um.

- **Wirkung**: `towerStats` wendet `mod` der Art als Schritt 9 an, nach Zweig und Verschmelzung (nur `mul` und `add`). Auren wirken wie
  gewohnt auf die so berechneten Werte; ein Taktgeber auf einer Anhöhe reicht mit seiner Aura also 20 % weiter.
- **Preise**: Bau, Ausbau, Modernisieren und die Gebühr des Verschmelzens (Feld des Kerns) kosten `tilePrice`, also `round5(Preis * cost)`.
- **Gold im Turm**: `invested` wächst um genau das, was bezahlt wurde, samt Aufschlag. Der Verkauf erstattet wie bei jedem Turm `invested`
  (Fehlkauf) oder `floor(invested * sellRefund)`, also nie mehr als bezahlt. Ein Turm auf dem Sumpf bringt beim Verkauf entsprechend
  mehr zurück, weil mehr in ihm steckt; Gewinn lässt sich damit nicht machen. `towerValue` (Neuwert) kennt keinen Aufschlag.
- **Verschmelzen**: Eine Superwaffe (und Megawaffe) behält das Feld ihres Kerns und damit dessen Wirkung und Aufschlag. Die Felder der Zutaten
  werden frei und behalten ihre Art; ihr `invested` (samt Aufschlag) geht wie immer auf den Kern über.

## Superwaffen

Verschmelzen gibt es nur mit `balance.fusion`; können kann es nur eine Rolle mit `arch.fusion`. Erlaubt in Phase `'build'` und `'wave'`.

- **Kern**: Turm der Stufe 3, keine Superwaffe, Rolle mit `arch.fusion`. **Zutat**: Turm der Stufe 3, keine Superwaffe, Rolle mit
  `arch.fusion`, gleicher Technikstand wie der Kern, auf einem der acht Nachbarfelder des Kerns (`|dtx| <= 1` und `|dtz| <= 1`).
  Beliebige Rollen, auch dreimal dieselbe. Ein Kern nimmt genau `balance.fusion.parts` Zutaten auf.
- `fuse(coreId, partIds)` und `canFuse(coreId, partIds)` prüfen in dieser Reihenfolge und nennen den ersten Grund:
  1. `phase` (Partie vorbei);
  2. Kern: `unknown`, dann `super` (ist schon Superwaffe, Rolle ohne `fusion`, oder `balance.fusion` fehlt), dann `level` (unter Stufe 3);
  3. `count`: `partIds` ist keine Liste mit genau `balance.fusion.parts` Einträgen, nennt eine Zutat doppelt oder den Kern selbst;
  4. jede Zutat in der Reihenfolge von `partIds`: `unknown`, `super` (Superwaffe oder Rolle ohne `fusion`), `level`, `tier`, `adjacent`;
  5. `gold` (Gebühr `fuseCost(content, Kernrolle, Technikstand des Kerns)`).
  Ob ein Rezept gesperrt ist, prüft `fuse` nicht: Eine gesperrte Mischung verschmilzt zur gewöhnlichen Superwaffe.
  `canFuse` führt nichts aus. `fuseCandidates(coreId)` liefert in Reihenfolge der Kennungen alle Türme, die Prüfung 4 für diesen Kern
  bestehen; leer, wenn der Kern unbekannt ist, an Prüfung 2 scheitert oder die Partie vorbei ist. `sim.fuseCost(tower)` = Gebühr mit
  diesem Turm als Kern.
- **Wirkung**: Die Zutaten verschwinden aus `state.towers` (ohne Ereignis `sell`, `towersSold` bleibt), ihre Felder sind frei.
  Der Kern: `super = true`, `gifts` = Rollenkennungen der Zutaten in der Reihenfolge von `partIds` (sie bestimmt die Reihenfolge der
  Gaben in `towerStats`), `giftBranches` = deren Zweige (`tower.branch`, -1 bei Rollen ohne Zweige) in derselben Reihenfolge, `recipe` nach
  „Rezepte“ (das jetzt freie Rezept, das trifft, sonst ''), Stufe 3 und Zweig bleiben, `invested += Summe der invested der Zutaten + Gebühr`, `kills` und `damageDealt`
  der Zutaten werden addiert, `builtWave` = das kleinste `builtWave` von Kern und Zutaten (volle Erstattung beim Verkauf also nur,
  wenn alles vor derselben, noch nicht begonnenen Welle gebaut wurde), Werte neu nach `towerStats`, `beamTime = 0`.
  `cooldown`, Zielwahl, `targetId` und Ausrichtung des Kerns bleiben. `gold -= Gebühr`, `stats.goldSpent += Gebühr`, `stats.fusions += 1`,
  Auren neu, Ereignis `fuse` (`parts` in der Reihenfolge von `partIds`, mit Kennung, Rolle, Zweig und Lage der entfernten Türme).
- **Mitten in der Welle**: Fliegende Geschosse und liegende Bodenfelder der Zutaten wirken unverändert weiter (ihre Werte sind beim
  Abschuss festgehalten, `arch` und `tier` bleiben die der Zutat), gehören aber fortan dem Kern: Ihr `towerId` und der Urheber
  laufender Brände wechseln auf den Kern, sodass Schaden und Abschüsse daraus für die Superwaffe zählen.
- Eine Superwaffe lässt sich nicht weiter ausbauen (`max`) und nicht erneut verschmelzen, weder als Kern noch als Zutat (`super`).
  Modernisieren und Verkaufen wie oben. Für Auren ist sie ein Turm auf einem Feld wie jeder andere.
- Angriffsarten der Kerne (Inhalte, `arch.fusion.core.set`): `beam` (Schaden je Sekunde = `damage`, Takt `cooldown`, Aufheizen über
  `ramp`/`rampTime`, Kette und Brand wirken je Takt), `pulse` (trifft alle passenden Gegner in Reichweite mit `damage`, `slow`, `dot`;
  ohne Fläche, Kette, Bodenfeld), Wurf mit `zone` und `dot` (brennender Boden mit Radius `splash`), `hitscan` mit hoher `chain`.
- Gaben wirken über `TowerStats` und damit nur, wo der Kern das Feld nutzt: Ein Kern mit `attack: 'none'` gewinnt durch Schadens-Gaben
  nichts, ein Kern mit `splash > 0` nichts durch `chain`. Bodenfelder eines Kerns tragen `slow` und `dot` der Gaben weiter.

### Rezepte

- `arch.fusion.recipes?: FusionRecipe[]` (`{ id, name, gifts, core, coreText, locked?, ages? }`). Ein Rezept TRIFFT eine Superwaffe,
  wenn seine `gifts` als Multimenge den Rollen der ersten `recipe.gifts.length` (= `balance.fusion.parts`) Einträge von `gifts` gleichen
  (Reihenfolge und Zweige zählen nicht). Es WIRKT, wenn es trifft und frei ist: ohne `locked` immer (die Flak), mit `locked: true` nur,
  wenn es in der laufenden Partie freigeschaltet ist.
- **Rezept eines Turms**: `tower.recipe` (Kennung oder ''). Beim ersten Verschmelzen setzt `fuse` es auf das erste Rezept der Kernrolle,
  das trifft und nach `state.recipes` frei ist, sonst ''. Danach ändert es sich nie: Die Megawaffe behält es (der zweite Schritt ändert es
  nicht), und ein später freigeschaltetes Rezept verwandelt keine stehende Superwaffe. Ein Turm ohne Verschmelzung hat ''.
- **Rechenregeln** (`rules.js`; `unlocked` ist überall freiwillig, Typ `RecipeUnlocks`):
  - `fusionRecipe(arch, gifts, unlocked?, content?)` → das erste Rezept der Rolle, das trifft und frei ist, sonst null (mit `content`
    auch die Rezepte des Platzes und Einträge nach Platz, siehe „Waffenpool“). `unlocked` ist entweder die
    Liste der freigeschalteten Rezepte (`state.recipes`, für Vorschauen einer Verschmelzung) oder eine Kennung (`tower.recipe` einer
    stehenden Superwaffe; '' = keins). Ohne Angabe gelten nur Rezepte ohne `locked` (so verhalten sich ältere Aufrufer wie bisher).
  - `lockedRecipe(arch, gifts, unlocked?, content?)` → das gesperrte, noch nicht freie Rezept, das diese Zutaten treffen, wenn kein freies trifft,
    sonst null (für „noch nicht freigeschaltet“ in der Vorschau).
  - `recipeLook(arch, tier, gifts, unlocked?, content?)` → `tiers[tier].recipes[id]` des wirkenden Rezepts (beim Kern, sonst bei der
    Waffe, bei der es steht) oder null.
  - `recipeById(content, id)` → `{ recipe, arch }` (Kernrolle) oder null.
  - `towerStats`: Mit Rezept (`fusionRecipe(arch, opts.gifts, opts.recipe ?? opts.recipes)`; `opts.recipe` hat Vorrang) tritt
    `recipe.core` überall an die Stelle von `arch.fusion.core` (Schritt 4 `set`, Vorrang für `attack` vor dem `tweak`, Schritt 8 `mul`/`add`).
    Die Gaben aller Zutaten wirken wie sonst. Der Filter `recipe` einer Zeitgabe (`effect.towers`) fragt dasselbe.
- **So rufen Oberfläche und Darstellung auf** (mit Waffenpool immer `sim.content` als letztes Argument): stehende Superwaffe `t` →
  `fusionRecipe(t.arch, t.gifts, t.recipe, sim.content)`, `recipeLook(t.arch, t.tier, t.gifts, t.recipe, sim.content)`, Werte stehen in
  `t.stats`; Vorschau einer Verschmelzung → `sim.fuseRecipe(coreId, partIds)` oder `fusionRecipe(arch, gifts, sim.state.recipes, sim.content)` und `towerStats(..., { ..., super: true, gifts, giftBranches, recipes: sim.state.recipes })`.
  Ein Aufruf ohne `unlocked` zeigt für eine Superwaffe mit gesperrtem Rezept die gewöhnliche Superwaffe.
- `sim.fuseRecipe(coreId, partIds)` → `{ recipe, locked }`: `recipe` = was `fuse` jetzt ergäbe (`fusionRecipe` mit `state.recipes`;
  ist der Kern schon Superwaffe, sein `tower.recipe`), `locked` = `lockedRecipe(...)` (bei einer Superwaffe als Kern null). Unbekannte
  Türme ergeben `{ recipe: null, locked: null }`. Ob das Verschmelzen erlaubt ist, sagt `canFuse`.
- **Freischalten** (nur gesperrte Rezepte, je Rezept einmal, gilt bis zum Ende der Partie): Die Kennung kommt hinten an `state.recipes`,
  Ereignis `{ type: 'recipe', id, reason }`; sonst ändert sich nichts (keine Werte neu, kein Turm verwandelt). Zwei Wege:
  - `reason: 'boon'`: Eine gewählte Zeitgabe mit `effect.recipe` schaltet dieses Rezept frei (Ereignis direkt nach `boon` bzw. `gold`).
  - `reason: 'boss'`: Zwischenboss ohne Funkenverlust (Schritt 7). Pool = alle Rezepte aller Rollen (in Reihenfolge der Rollen, dann der
    Rezepte) mit `locked`, deren `ages` die Position des Zeitalters der Welle (`state.age`, ab 0) nennt und die noch nicht frei sind.
    Ist er leer, geschieht nichts. Sonst wird `pool[floor(r * Länge)]` frei mit `r = makeRng(hashString('rezept:' + (seed >>> 0) + ':' +
    Welle)).next()` (`Welle` = fortlaufender Index der überstandenen Welle). Der Zufall der Partie bleibt unberührt.
- **Rezept-Gaben im Angebot** (siehe „Zeitgaben“): Eine Gabe mit `effect.recipe` gehört nur zum Pool, solange ihr Rezept gesperrt und
  nicht frei ist. Ist beim Ziehen eine Rezept-Gabe gezogen, fallen alle übrigen Rezept-Gaben aus dem Rest des Pools: höchstens eine je Angebot.
- Darstellung je Zeitalter: `tiers[i].recipes[recipe.id] = { superName, megaName, superShot? }`. Oberfläche und Darstellung nehmen sie statt
  `superName`/`megaName`/`superShot`.
- Rezepte (Inhalte, `src/content/towers.js`): Flak (Schütze + 2 Schützen, frei), Teerfeuer (Brenner + 2 Bremser), Belagerungsgeschütz
  (Panzerknacker + 2 Taktgeber), Dampfkessel (Bremser + 2 Brenner), Kommandoposten (Taktgeber + 2 Schützen), Panzergranate (Werfer + 2
  Panzerknacker), Brennglas (Schütze + Werfer + Brenner), Fesselstrahl (Bremser + Schütze + Panzerknacker); alle außer der Flak gesperrt.
  Weil sie für jede Waffe ihres Platzes gelten, setzt jedes dieser Rezepte die Reichweite (und wo nötig Schaden, Pause, Angriffsart,
  `hitsAir`) auf die Grundwerte der klassischen Waffe, bevor `mul` wirkt: Ein Rezept ist eine feste Waffe, gleich aus welchem Kern
  (für die klassischen Kerne ändert das nichts). Was der Kern sonst mitbringt (Zweig, Rückstoß, Zeichen, Suchen), bleibt.
  Waffengebunden (bei Waffen des Pools, alle gesperrt, je mit Bauplan, der `requires.weapons` = [Kern] trägt): Kopfgeldjäger
  (Zahlmeister + 2 Schützen), Sonnenlanze (Leuchtfeuer + 2 Panzerknacker), Harpune (Netzwerfer + 2 Panzerknacker), Feuerwalze
  (Stampfer + 2 Brenner), Nebelwerfer (Fernwerfer + Giftschütze + Bremser).

## Megawaffen

Zweiter Schritt: Eine Superwaffe (die noch keine Megawaffe ist) nimmt als Kern noch einmal genau `balance.fusion.parts` Zutaten auf und
wird zur Megawaffe. Für die Zutaten gelten dieselben Regeln wie im ersten Schritt (Stufe 3, keine Superwaffe, Rolle mit `fusion`,
gleicher Technikstand, Nachbarfeld). Gleichzeitig dürfen höchstens `balance.fusion.megaLimit` Megawaffen stehen (0 = keine).

- Prüfreihenfolge von `fuse`/`canFuse`, wenn der Kern eine Superwaffe ist (ein gewöhnlicher Kern prüft wie unter „Superwaffen“):
  1. `phase` (Partie vorbei);
  2. Kern: `unknown`; `super`, wenn er schon Megawaffe ist (oder Rolle ohne `fusion` bzw. `balance.fusion` fehlt);
     `limit`, wenn schon `megaLimit` Megawaffen stehen;
  3. `count` wie im ersten Schritt;
  4. jede Zutat in der Reihenfolge von `partIds`: `unknown`, `super`, `level`, `tier`, `adjacent`;
  5. `gold` (Gebühr `fuseCost(content, Kernrolle, Technikstand des Kerns, true)`).
  `fuseCandidates(coreId)` ist für eine Megawaffe und bei erreichter Höchstzahl leer. `sim.fuseCost(tower)` liefert für eine Superwaffe
  die Gebühr der Megawaffe.
- **Wirkung** wie im ersten Schritt (Zutaten verschwinden, Gold, `kills`, `damageDealt`, `builtWave`, Geschosse, Bodenfelder und Brände
  gehen auf den Kern über), außerdem: `mega = true` (`super` bleibt true), `gifts` = bisherige Gaben + Rollen der neuen Zutaten in der
  Reihenfolge von `partIds` (also vier Einträge), `giftBranches` ebenso, `stats.megas += 1` (`stats.fusions` zählt nur den ersten Schritt), Ereignis `fuse`
  mit `mega: true` (im ersten Schritt `mega: false`).
- Eine Megawaffe lässt sich nicht ausbauen (`max`), nicht weiter verschmelzen (`super`) und ist keine Zutat (`super`). Modernisieren:
  Anteil am Neuwert von Kern und allen vier Gaben-Rollen im neuen Zeitalter. Verkaufen wie jeder Turm; danach ist ihr Platz unter
  `megaLimit` frei.

## Waffenpool

Die sechs Rollen sind **Plätze** der Bauleiste (`Content.slots`, `SlotDef { id, name, summary, color, icon, job? }`, Reihenfolge = Bauleiste
und Tasten). Jeder Platz hat mehrere **Waffen** (`TowerArchetypeDef` mit `slot`); die **klassische** Waffe eines Platzes hat dessen Kennung
als `id`. Eine Waffe ohne `slot` ist ihr eigener Platz (ältere Inhalte mit sechs Rollen bleiben so unverändert gültig: sechs Plätze, sechs
klassische Waffen). Ohne `content.slots` werden die Plätze aus den Waffen abgeleitet (`contentSlots`, Name/Farbe/Symbol der klassischen).

- **Bewaffnung** (`Sim.loadout`, eingefroren): je Platz genau eine Waffe, Index = Platz in der Reihenfolge von `contentSlots(content)`.
  Quelle: ein Spielstand mit `loadout` (geprüft wie eine Liste); ein Spielstand ohne `loadout` = klassisch; sonst `SimConfig.loadout`:
  fehlt oder `'classic'` = je Platz die klassische Waffe (`classicLoadout`), `'random'` = `drawLoadout(content, seed)`, eine Liste =
  genau eine bekannte Waffe je Platz in beliebiger Reihenfolge (`orderLoadout`; sonst Fehler „Bewaffnung unlesbar: …“, beim Laden mit
  „Spielstand unlesbar: “ davor). Die Bewaffnung verbraucht keinen Zufall der Partie; die klassische Bewaffnung verläuft bitgenau wie
  vor dem Waffenpool.
- **Ziehung** `drawLoadout(content, seed)`: eigener Zufallsgenerator `makeRng(hashString('waffen:' + (seed >>> 0)))`. Je Versuch je Platz
  in Reihenfolge `list[floor(next() * Länge)]` aus `weaponsOfSlot(content, platz)` (Reihenfolge von `content.archetypes`). Ein Versuch gilt,
  wenn mindestens `min(LOADOUT_AIR = 2, Anzahl der Plätze mit einer Flieger-Waffe)` gezogene Waffen `hitsFliers` sind (`stats.hitsAir`,
  `attack !== 'none'` und `damage > 0` oder `dot > 0`, Werte der Stufe 1: Wer Flieger nur bremst oder zeichnet, zählt nicht). Nach 64 ungültigen Versuchen wird der letzte nachgebessert: Plätze in Reihenfolge, deren Waffe
  keine Flieger trifft, bekommen ihre erste Flieger-Waffe, bis es reicht.
- **Bauen**: `build` lehnt eine bekannte Waffe außerhalb der Bewaffnung mit `locked` ab (vor `unlockWave` und Ausprägung). Alle übrigen
  Regeln gelten je Waffe: Preis (`arch.cost`), Werte, Zweige, Gaben (`Tower.gifts` nennt Waffen, die Gabe kommt von der Waffe und ihrem
  Zweig), Modernisieren (ein Turm behält seine Waffe), Verkauf, Verschmelzen (Kern und Zutaten jeder Waffe mit `fusion`).
- **Nach Platz** gehen: Freischalt-Reihenfolge (alle Waffen eines Platzes haben dasselbe `unlockWave`), Farbe/Name der Aufgabe/Symbol
  (`color`, `role`, `icon` der Waffe = die des Platzes), Filter `roles` der Zeitgaben (`slotOf(arch)`, bei Superwaffen der Kern), und die
  gewöhnlichen Rezepte.
- **Rezepte nach Platz und Waffe**: Ein Eintrag in `FusionRecipe.gifts` nennt einen Platz (trifft jede Waffe des Platzes) oder eine nicht
  klassische Waffe (trifft nur sie). Rezepte bei der klassischen Waffe eines Platzes gelten für jeden Kern des Platzes, Rezepte bei einer
  anderen Waffe nur für sie. Ein Rezept, das eine Waffe nennt oder bei einer nicht klassischen Waffe steht, ist **waffengebunden**;
  `recipeWeapons(content, id)` nennt die Waffen, die es braucht, `recipeFits(content, id, loadout)` sagt, ob eine Partie es bauen kann.
  Kandidaten für einen Kern: seine eigenen Rezepte, dann (ist er nicht klassisch) die der klassischen Waffe seines Platzes; spezifischere
  zuerst (Anzahl der Einträge, die Waffen nennen, plus 1 für ein Rezept bei einer nicht klassischen Waffe), sonst in Listenreihenfolge.
  Getroffen wird, wenn sich die ersten `gifts.length` Zutaten den Einträgen eins zu eins zuordnen lassen. Ohne `content` rechnen
  `fusionRecipe`/`lockedRecipe`/`recipeLook` wie vor dem Waffenpool (nur eigene Rezepte, gleiche Kennungen): richtig für die klassische
  Bewaffnung, für Waffen des Pools muss der Aufrufer `content` übergeben. `recipeLook` sucht das Aussehen zuerst in der Ausprägung des
  Kerns, dann bei der Waffe, bei der das Rezept steht.
- **Nur, was die Partie bauen kann**: Eine Zeitgabe mit `effect.recipe` kommt nur ins Angebot, wenn `recipeFits` gilt; eine Zeitgabe mit
  `requires.weapons` nur, wenn die Bewaffnung mindestens eine dieser Waffen hat; der Pool eines Zwischenbosses enthält nur Rezepte mit
  `recipeFits`. Filter `weapons` einer Zeitgabe (`effect.towers`) trifft Türme dieser Waffen (bei Superwaffen der Kern).
- **Spielstand**: `loadout` (Liste in Reihenfolge der Plätze). Beim Laden wird abgelehnt: ein Turm, dessen Waffe, und eine Gabe, deren
  Waffe nicht in der Bewaffnung ist.
- **Prüfung der Inhalte** (`validate.js`): `content.slots` (falls angegeben) ist eine nicht leere Liste mit eindeutiger `id`, `name`,
  `summary`, `color`, `icon` (nicht leer) und `job` aus `area | slow | armor | burn | aura`. Jeder Platz hat seine klassische Waffe, jede Waffe
  einen bekannten Platz (`slot` falls angegeben ein nicht leerer Text), `name` falls angegeben nicht leer. Mit `content.slots`: `color`,
  `role`, `icon` jeder Waffe gleich denen des Platzes. Jede Waffe erfüllt den `job` ihres Platzes mit `arch.stats` (`area`: `splash > 0`
  oder `pulse`; `slow`: `slow > 0`; `armor`: `pierce > 0`; `burn`: `dot > 0`; `aura`: `auraRate`, `auraDamage`, `auraRange` oder
  `auraBounty > 0` oder ein Zeichen `mark > 0`). Freiwillige Kampfwerte (`push`, `mark`, `markDuration`, `auraBounty`) sind Zahlen ab 0,
  `seek` ein Wahrheitswert, und vollständige Werte mit `mark > 0` brauchen `markDuration > 0`. `look` (falls angegeben, Pflicht
  für nicht klassische Waffen): `accent` Farbe, `marker` aus `none | crystal | vial | pennant | ring | orb | spikes`. Nicht klassische
  Waffen: `unlockWave` wie die klassische; eine Ausprägung genau in den Zeitaltern der klassischen, mit `name`, `flavor`, `shot.kind`,
  `model` = Modell der klassischen im selben Zeitalter (vorerst), mit `fusion` auch `superName` und `megaName`. `tiers[i].recipes` einer
  Waffe darf auch Rezepte der klassischen Waffe ihres Platzes nennen. Zeitgaben: `roles` nennt Plätze, `weapons` und
  `requires.weapons` bekannte Waffen. Ausnahme: Nennt `requires.weapons` nur Waffen, die die Inhalte gar nicht haben (klassische
  Inhalte und der Bauplan eines waffengebundenen Rezepts), wird die Zeitgabe nicht weiter geprüft; angeboten werden kann sie nie.
- **Rechenregeln für Oberfläche und Bots** (`rules.js`): `slotOf(arch)`, `isClassic(arch)`, `weaponById(content, id)`,
  `contentSlots(content)`, `weaponsOfSlot(content, slot)`, `hitsFliers(arch)`, `classicLoadout(content)`, `drawLoadout(content, seed)`,
  `orderLoadout(content, ids)`, `resolveLoadout(content, spec, seed)`, `recipeWeapons`, `recipeFits`, Konstante `LOADOUT_AIR`.

## Zeitgaben

Nach dem letzten Boss eines Zeitalters wählt der Spieler eine von `balance.boons.offer` (ohne Angabe 3) Zeitgaben aus
`content.boons`; sie gelten bis zum Ende der Partie. Ohne `content.boons` gibt es kein Angebot und es wird kein Zufall verbraucht.

- **Angebot**: in Schritt 7 beim Wechsel des Zeitalters, nach den Ereignissen `age`, `paths` und `gold`. Pool = alle noch nicht
  gewählten Gaben, deren `requires` erfüllt ist (`fusion`: es gibt `balance.fusion`; `flying`: eine Welle ab der nächsten bringt
  Flieger; `tiles`: die Karte hat einen besonderen Bauplatz einer der Arten) und die, falls sie ein Rezept freischalten (`effect.recipe`),
  ein noch gesperrtes betreffen. Gezogen werden nacheinander bis zu `offer` verschiedene,
  je mit Wahrscheinlichkeit `weight` (Standard 1) durch die Summe der Gewichte des Rests: `r = rng.next() * Summe`, die erste Gabe
  in Listenreihenfolge, bei der die laufende Summe `r` übersteigt. Nach einer gezogenen Rezept-Gabe verlassen alle anderen
  Rezept-Gaben den Rest (höchstens eine je Angebot). Das ist der Zufall der Partie (er steht im Spielstand).
  Ist der Pool leer, gibt es kein Angebot.
- **Wer wählt**: Mit `SimConfig.boonChoice` steht das Angebot in `state.boonOffer` (Ereignis `boonOffer`), bis `chooseBoon(id)` eine
  Gabe daraus nimmt; bis dahin lehnt `startWave` mit `boon` ab. Ohne `boonChoice` nimmt die Simulation im selben Zeitschritt die erste
  angebotene Gabe (für Aufrufer ohne Oberfläche dafür; ein Angebot bleibt dann nie offen).
- **Wahl**: `state.boons` bekommt die Kennung hinten angehängt, `boonOffer` wird leer, einmalige Gaben (`grant`) wirken sofort:
  `lives > 0` hebt `lives` und `maxLives`, `lives < 0` senkt `lives`, aber nie unter 1; `gold` Standard-Kopfgelder des aktuellen
  Zeitalters (`round(gold * baseBounty * ageBounty[age] * difficulty.income)`, zählt in `goldEarned`). Danach werden die Werte ALLER
  Türme neu berechnet und die Auren neu. Ereignis `boon`, dann bei Gold `gold` (Grund `boon`), dann bei `effect.recipe` das
  Freischalten (Ereignis `recipe` mit Grund `boon`, siehe „Rezepte“).
- **Kampfwerte** (`effect.towers`, Schritt 10 von `towerStats`): Jeder Eintrag wirkt auf einen Turm, wenn alle angegebenen Filter
  passen: `roles` (Platz, bei Super- und Megawaffen der des Kerns), `weapons` (Waffe, ebenso), `branch` (gewählter Zweig, also nur Stufe 3), `tiles` (Art des
  Bauplatzes), `super` (true: Super- und Megawaffen, false: gewöhnliche), `recipe` (Rezept der Superwaffe, `fusionRecipe`).
  Jeder Turm trägt in `tower.boons` dieselbe Liste wie `state.boons`, damit Vorschauen mit dem Turm als `opts` ehrlich sind.
- **Wirtschaft** (`effect.economy`, Faktoren multiplizieren sich über alle Gaben): Bau-, Ausbau-, Modernisierungspreis und Gebühr des
  Verschmelzens sind `boonPrice(Preis samt Aufschlag des Bauplatzes, Faktor)`; das gilt für die Befehle und die Auskünfte
  `buildCost`, `upgradeCost`, `modernizeCost`, `fuseCost` gleichermaßen (die Funktionen in `rules.js` kennen keine Gaben).
  Verkauf: Anteil `min(1, sellRefund * sell)` (der Fehlkauf erstattet weiter alles). Kopfgeld: siehe „Wellen mit Eigenart“
  (`modifiedEnemyStats`). Wellenprämie und Frühstart siehe oben.
- **Fähigkeit** (`effect.ability`): `sim.ability()` und `useAbility` nutzen `boonAbility(content.abilities[age], effects)`. Eine
  laufende Abklingzeit bleibt bei der Wahl, wie sie ist.
- **Regelschalter** (`effect.rules`): `airDamage`/`bossDamage` vervielfachen jeden Treffer (Rohschaden vor Schild und Rüstung, auch
  die Fähigkeit) und jeden Brand-Zeitschritt gegen Flieger bzw. Gegner mit `def.boss` (auch Zwischenbosse). `burnOnSlowed` kommt zu
  `balance.burnOnSlowed` hinzu. `burnSpread > 0`: Stirbt ein Gegner mit `dot > 0` und `dotTime > 0`, bekommt beim Aufräumen (Schritt 6,
  vor der Fracht) der nächste lebende Gegner im Abstand <= `burnSpread` (Gleichstand: kleinere Kennung) dessen Brand wie Regel 5
  (`dot`, Dauer `max(dotTime, 1)`, derselbe Urheber); kein Ereignis. `megaLimit` erhöht `balance.fusion.megaLimit`.
- **Spielstand**: `boons` und `boonOffer` (freiwillig, fehlen = leer). Geprüft: bekannte Kennungen, keine doppelt, das Angebot nennt
  keine gewählte und höchstens `offer` Gaben. Einmalige Gaben stecken schon in Gold und Leben; `maxLives` = Leben des
  Schwierigkeitsgrads + Summe der positiven `grant.lives` der gewählten Gaben. Ein Spielstand mit offenem Angebot lädt mit offenem
  Angebot und verläuft danach genau wie die ungespeicherte Partie.

## Wellen mit Eigenart

`content.modifiers` nennt Eigenarten (Nebel, Eilmarsch ...). Ohne sie hat keine Welle eine.

- **Ziehung** (`drawModifiers(content, seed)` in `sim.js`, beim Erzeugen der Partie): eigener Zufallsgenerator
  `makeRng(hashString('eigenart:' + (seed >>> 0)))`, der Zufall der Partie bleibt unberührt und der Spielstand braucht nichts. Je
  Zeitalter: Kandidaten sind die Wellen ab der zweiten ohne Gegner mit `def.boss`, für die mindestens eine Eigenart passt (alle
  `needs` erfüllt von den gewöhnlichen Gegnern der Welle: `flying`, `ground`, `armored` = Rüstung > 0, `shielded` = Schild > 0,
  `swarm` = eine Gruppe mit mindestens 8). Gezogen werden `balance.modifiers.perAge` (ohne Angabe 2) Wellen ohne Zurücklegen
  (`floor(next() * Anzahl)` aus der Liste in Reihenfolge der Wellen); dann je gezogene Welle, aufsteigend, eine passende Eigenart nach
  `weight`, bevorzugt eine, die im Zeitalter noch nicht vorkam. Reihenfolge der Eigenarten = Reihenfolge der Schlüssel in
  `content.modifiers`.
- **Vorschau**: `wavePreview(o).modifier` = Kennung (fehlt ohne Eigenart); `groups` zählt schon mit `count`.
- **Gegner**: `enemy` gilt für alle Gegner der Welle (auch Fracht und Momente), `air` zusätzlich für Flieger (Faktoren
  multiplizieren sich). `modifiedEnemyStats`: `hp = max(1, round(hp * f.hp))`, `shield = round(hp * def.shield * f.shield)`,
  `armor` und `speed` mal Faktor, `bounty = max(1, round(bounty * f.bounty * economy.bounty))`. `count`: jede Gruppe ohne Boss hat
  `max(1, round(count * f))` Gegner (0 bleibt 0) im selben Zeitraum (`interval * (count - 1) / (neu - 1)`).
- **Türme**: Hat die Eigenart `towers`, gilt bei `startWave` für jeden Turm `tower.modifier = Kennung` und seine Werte werden neu
  berechnet (Schritt 11), samt Auren; ebenso für jeden Turm, der während der Welle gebaut, ausgebaut, modernisiert oder verschmolzen
  wird. Am Wellenende (Schritt 7) wird `tower.modifier = ''` und alles neu berechnet. Ein Spielstand entsteht nur in der Bauphase und
  trägt deshalb nie eine wirkende Eigenart.
- `state.modifier` = Kennung der laufenden Welle, sonst ''. Prämie siehe Schritt 7.

## Inhalte prüfen

`createSim` prüft die Inhalte (`validate.js`) und scheitert mit deutscher Meldung. Zu Zweigen und Verschmelzung:
`arch.branches` braucht genau zwei Einträge mit `name` und `mod`; ein `mod` (auch `fusion.core`, `fusion.gift`) kennt nur `set`, `mul`,
`add`; `set` nur Felder von `TowerStats` mit gültigen Werten, `mul`/`add` nur Zahlenfelder, `mul` nicht negativ. Eine Gabe, die `dot`
(bzw. `slow`) über `set` oder `add` mitbringt, muss auch `dotDuration` (bzw. `slowDuration`) über `set` oder `add` mitbringen.
Eine Zweig-Gabe `branches[b].gift` braucht `name`, `text` und ein gültiges `mod` mit denselben Dauer-Regeln wie `fusion.gift`.
`balance.fusion`: `parts` ganze Zahl 1..8, `damage` und `range` > 0, `fee` >= 0, `megaLimit` ganze Zahl >= 0, `megaDamage` und
`megaRange` > 0, `megaFee` >= 0. Hat eine Rolle `fusion`, muss `balance.fusion` da sein.
Rezepte (`fusion.recipes`): eindeutige `id`, `name` und `coreText` nicht leer, gültiges `core`, `gifts` genau `balance.fusion.parts`
bekannte Rollen mit `fusion`, keine zwei Rezepte einer Rolle mit derselben Multimenge, `locked` (falls angegeben) true oder false, `ages`
(falls angegeben) eine Liste ganzer Zahlen ab 0; jede Ausprägung der Rolle braucht
`recipes[id]` mit `superName` und `megaName`, und `tiers[i].recipes` nennt kein unbekanntes Rezept.
Inhalte ganz ohne `branches`, `fusion` und `balance.fusion` bleiben gültig; dort lehnt `fuse` mit `super` ab.

Besondere Bauplätze: `balance.tiles` ist ein Objekt; jede Art braucht `name` und `icon` (nicht leer), `text`, `color`, ein gültiges `mod`
ohne `set` und `cost > 0`. Die gewählte Karte darf in `tiles` (eine Liste) nur ganzzahlige Felder im Spielfeld nennen, nicht auf einem Weg,
nicht auf einem gesperrten Feld (`map.blocked` und der Platz der Basis), jedes Feld nur einmal, und nur Arten aus `balance.tiles`.
Inhalte ohne `map.tiles` und ohne `balance.tiles` bleiben gültig.

Zeitgaben: `content.boons` ist eine Liste mit eindeutigen `id`, `name`, `text`, `icon` (nicht leer), `weight > 0`; `requires` kennt nur
`tiles` (bekannte Arten), `flying`, `fusion`; `effect` nur `towers`, `economy`, `ability`, `grant`, `rules`, `recipe`. `effect.recipe` nennt
ein bekanntes Rezept mit `locked: true`, und keine zwei Gaben schalten dasselbe Rezept frei. Ein Eintrag in `towers` hat
ein gültiges `mod` ohne `set`, `hitsAir` nur true, bekannte `roles`, `tiles` und `recipe`, `branch` 0 oder 1. Faktoren in `economy`,
`ability` und `rules` sind Zahlen ab 0, `rules.megaLimit` ganz, `grant.lives` ganz, `grant.gold` ab 0. `balance.boons.offer` ganz ab 1.
Eigenarten: `content.modifiers` ist ein Objekt; jede hat `name`, `text`, `icon`, `color`, Faktoren in `enemy`/`air` größer 0, `towers`
ohne `set`, `bonus` ab 0, `weight > 0`, `needs` aus den fünf Bedingungen. `balance.modifiers.perAge` ganz ab 0.

Wege: Jeder Weg (Grundwege und Stufen) besteht aus gültigen Wegpunkten (`buildPath`), führt über kein Feld aus `map.blocked`, und alle
enden auf dem Feld der Basis von Weg 0. Wege einer Stufe folgen außerdem den Eingangsregeln von `MapDef.paths` (Eingang genau ein Feld
außerhalb, alle übrigen Wegpunkte außer der Basis im Spielfeld). `map.stages` ist eine Liste; jeder Eintrag ist null oder hat `name` und
`text` (nicht leer), `paths` (falls angegeben: nicht leer), `flyersFollowPath` (falls angegeben: Wahrheitswert). Eintrag 0 darf weder
`paths` noch `flyersFollowPath` haben. Einträge jenseits der Zahl der Zeitalter sind erlaubt. Besondere Felder dürfen auf keinem Weg
irgendeiner Stufe liegen (auch keiner nie erreichten). `SpawnGroup.path` muss im Zeitalter seiner Welle einen Weg nennen.

## Punkte

Alle Beträge mal `difficulty.score`, gerundet: Abschuss `10 * (age + 1) * def.bounty`; überstandene Welle `100 * (age + 1)`,
ohne Lebensverlust das 1,5-Fache; Sieg zusätzlich `250 * lives`. `age` ist dabei das Zeitalter der Welle.

## Speichern und Laden

`save()` liefert nur in Phase `'build'` und ohne liegende Bodenfelder einen Spielstand (sonst `null`). `createSim(config, save)` stellt Gold, Leben, Welle, Zeitalter,
Türme (mit `invested`, `kills`, Zielwahl, `branch`, `super`, `mega`, `gifts`, `giftBranches`, `recipe`), Statistik, Abklingzeit, die freigeschalteten
Rezepte (`recipes`), die Bewaffnung (`loadout`, siehe „Waffenpool“) und den Zustand des Zufallsgenerators wieder her.
`tower.tile` steht nicht im Spielstand, es folgt beim Laden aus der Lage (`tileAt`). Ebenso die Stufe der Wege: Sie folgt aus dem
Zeitalter der gespeicherten Welle (ein Spielstand direkt nach dem Wechsel lädt die neuen Wege). Ein Turm auf einem Feld, das in
irgendeiner Stufe Weg ist, wird abgelehnt.
Eine geladene Partie verläuft bei gleichen Befehlen genau wie die ungespeicherte.

`boons` und `boonOffer` sind freiwillig (siehe „Zeitgaben“). `recipes` ist freiwillig (fehlt = keins frei) und nennt nur bekannte
Rezepte mit `locked`, keins doppelt. `recipe` je Turm ist freiwillig: Fehlt es (ältere Spielstände), gilt für eine Superwaffe
`fusionRecipe(arch, gifts, recipes des Spielstands)`; ist es angegeben, muss es '' sein oder ein Rezept der Kernrolle, das Kern und
Zutaten trifft (ein freies Rezept wie die Flak gilt auch bei ''). Ein gewöhnlicher Turm mit Rezept wird abgelehnt. `branch`, `super`, `mega`, `gifts` und `giftBranches` sind im Spielstand freiwillig. Ohne `giftBranches` gilt für jede Gabe Zweig 0
(-1 bei Rollen ohne Zweige); mit Angabe muss die Liste so lang wie `gifts` sein und nur gültige Zweige (-1 erlaubt) nennen. Fehlen sie (ältere Spielstände): `branch` = 0 auf Stufe 3 einer Rolle
mit Zweigen, sonst -1 (auch ein gespeichertes -1 gilt dort als 0); `super = false`; `mega = false`; `gifts = []`; `stats.fusions = 0`;
`stats.megas = 0`.
Abgelehnt werden mit Meldung: ein Zweig unter Stufe 3 oder bei einer Rolle ohne Zweige, ein unbekannter Zweig, eine Superwaffe unter
Stufe 3 oder mit einer Rolle ohne `fusion`, eine Superwaffe ohne Gaben, Gaben ohne Superwaffe, unbekannte Rollen oder Rollen ohne
`fusion` als Gabe, `mega` ohne `super`, eine Superwaffe ohne `mega` mit mehr als `balance.fusion.parts` Gaben (sie müsste eine
Megawaffe sein) und eine Megawaffe mit höchstens `parts` Gaben. Darüber hinaus wird die Zahl der Gaben nicht geprüft, und mehr
Megawaffen als `megaLimit` lädt der Spielstand trotzdem (nur neue werden abgelehnt), damit Spielstände eine geänderte Balance überleben.

## Leistung

Bis zu 200 Gegner, 80 Türme, 300 Geschosse und 40 Bodenfelder gleichzeitig; ein Zeitschritt soll deutlich unter 0,3 ms bleiben.
Keine Objekte in den inneren Schleifen erzeugen (Ereignisse ausgenommen). Tote Gegner und fertige Geschosse ohne `splice` in der
Schleife entfernen (verdichten), die Reihenfolge der übrigen bleibt erhalten.
Der Leistungstest (`tests/sim.run.test.mjs`) misst 2000 Zeitschritte in Blöcken von 250 und verlangt für den schnellsten Block
weniger als 0,5 ms je Schritt; so stört fremde Last auf der Maschine nicht, eine echte Verschlechterung aber trifft jeden Block.
