// @ts-check
// Ablauf des Verschmelzens zu einer Superwaffe: Kern wählen, Zutaten an- und abwählen, bestätigen oder abbrechen.
// Der Auswahlzustand hängt als `fusion` am GameView; die Oberfläche liest ihn und schickt Wünsche über die Aktionen.
// Getrennt von der Spielsteuerung, damit auch die Testseite der Oberfläche (dev/ui.html) denselben Ablauf benutzt.

/** @import { GameView, UiActions } from '../types/app' */
/** @import { CommandResult, RejectReason, Sim } from '../types/sim' */
/** @import { RecipeBook, RecipeFind } from './recipebook.js' */

/**
 * Laufende Auswahl für eine Verschmelzung. Das Objekt wird bei jeder Änderung ersetzt (nie verändert),
 * so erkennt die Oberfläche Änderungen am Verweis.
 * @typedef {object} FusionPick
 * @property {number} coreId Kennung des Kernturms
 * @property {readonly number[]} picked Kennungen der gewählten Zutaten in Reihenfolge der Wahl
 */

/** GameView mit dem Auswahlzustand des Verschmelzens. @typedef {GameView & { fusion: FusionPick | null }} FusionView */

/**
 * Zusätzliche Wünsche der Oberfläche rund um Ausbauzweige und Superwaffen (Erweiterung von UiActions).
 * @typedef {object} FusionActions
 * @property {(towerId: number, branch?: number) => void} upgrade Ausbau; `branch` wählt beim Schritt auf Stufe 3 den Zweig
 * @property {(coreId: number) => void} fuseBegin Auswahl der Zutaten für diesen Kern öffnen
 * @property {(towerId: number) => void} fuseToggle Zutat an- oder abwählen
 * @property {() => void} fuseCancel Auswahl schließen
 * @property {() => void} fuseConfirm Mit den gewählten Zutaten verschmelzen
 * @property {(id: string) => void} chooseBoon Eine Zeitgabe aus dem offenen Angebot wählen
 * @property {() => Readonly<RecipeBook>} recipeBook Das Rezeptbuch des Profils (über alle Partien; nur lesen)
 * @property {(id: string, how: RecipeFind) => boolean} discoverRecipe Ein Rezept ins Buch eintragen; true, wenn es neu ist
 * @property {() => LoadoutPlanView} loadoutPlan Bewaffnung der nächsten Partie (Bildschirm „Neues Spiel“)
 * @property {(mode: 'random' | 'classic') => LoadoutPlanView} setLoadoutMode Zufällig oder klassisch (merkt sich das Profil)
 * @property {() => LoadoutPlanView} redrawLoadout Neu ziehen
 */

/**
 * Bewaffnung der nächsten Partie: Art, Startwert und eine Waffe je Platz.
 * @typedef {{ readonly mode: 'random' | 'classic', readonly seed: number, readonly ids: readonly string[] }} LoadoutPlanView
 */

/** Alle Wünsche der Oberfläche. @typedef {UiActions & FusionActions} GameActions */

/**
 * @param {object} host
 * @param {() => Sim | null} host.sim
 * @param {() => FusionView | null} host.view
 * @param {(reason: RejectReason | undefined) => void} host.reject Meldung zu einem abgelehnten Wunsch
 * @param {(result: CommandResult) => void} [host.fused] Nach erfolgreichem Verschmelzen
 * @param {() => void} [host.changed] Die Auswahl hat sich geändert (für Klänge)
 */
export function createFusionControl(host) {
  return {
    /** @param {number} coreId */
    begin(coreId) {
      const sim = host.sim();
      const view = host.view();
      if (!sim || !view) return;
      const need = sim.content.balance.fusion.parts;
      const core = sim.towerById(coreId);
      // Mit leerer Zutatenliste nennt die Simulation zuerst, was am Kern selbst nicht passt; 'count' heißt: Der Kern ist in Ordnung.
      const probe = sim.canFuse(coreId, []);
      if (!core || (!probe.ok && probe.reason !== 'count')) {
        host.reject(probe.reason);
        return;
      }
      const candidates = sim.fuseCandidates(coreId);
      if (candidates.length < need) {
        host.reject('adjacent');
        return;
      }
      if (sim.state.gold < sim.fuseCost(core)) {
        host.reject('gold');
        return;
      }
      view.fusion = { coreId, picked: candidates.length === need ? candidates.map((t) => t.id) : [] };
      if (host.changed) host.changed();
    },
    /**
     * @param {number} towerId
     * @returns {boolean} false, wenn der Turm keine mögliche Zutat ist
     */
    toggle(towerId) {
      const sim = host.sim();
      const view = host.view();
      if (!sim || !view || !view.fusion) return false;
      const { coreId, picked } = view.fusion;
      const need = sim.content.balance.fusion.parts;
      /** @type {number[]} */
      let next;
      if (picked.includes(towerId)) {
        next = picked.filter((id) => id !== towerId);
      } else {
        if (!sim.fuseCandidates(coreId).some((t) => t.id === towerId)) return false;
        // Ist die Auswahl voll, weicht die älteste Wahl der neuen.
        next = picked.length >= need ? picked.slice(picked.length - need + 1) : picked.slice();
        next.push(towerId);
      }
      view.fusion = { coreId, picked: next };
      if (host.changed) host.changed();
      return true;
    },
    cancel() {
      const view = host.view();
      if (view && view.fusion) view.fusion = null;
    },
    confirm() {
      const sim = host.sim();
      const view = host.view();
      if (!sim || !view || !view.fusion) return;
      const { coreId, picked } = view.fusion;
      const result = sim.fuse(coreId, picked.slice());
      if (!result.ok) {
        host.reject(result.reason);
        // Bei Geldmangel bleibt die Auswahl offen; alles andere heißt, dass sie nicht mehr stimmt.
        if (result.reason !== 'gold' && result.reason !== 'count') view.fusion = null;
        return;
      }
      view.fusion = null;
      if (host.fused) host.fused(result);
    },
  };
}
