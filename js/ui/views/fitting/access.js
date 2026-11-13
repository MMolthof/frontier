// EINE Stelle für den Zugriff auf die Belegung der Slots.
//
// Lücke in MASTER_PLAN 3.9: Kein Selektor verrät, WELCHES Modul in welchem Slot steckt
// (fitting/ships liefert nur Metadaten, fitting/stats nur Summen). Die Ansicht braucht das für
// Ring und Liste. Bis der Lead den Change Request a5-1 entschieden hat (Selektor `fitting/layout`):
//   1. bevorzugt game.select('fitting/layout', { uid }) – falls A4 ihn liefert,
//   2. sonst reiner LESEzugriff auf state.assets.ships[].fitting (3.4, Form `{high:[id|null], …}`).
// Geschrieben wird nie; jede Änderung läuft über game.dispatch.

/**
 * @returns {object|null} `{high:[…], mid:[…], low:[…], rig:[…]}` oder `{ fitting: {…} }` oder null
 */
export function readFitting(game, uid) {
  if (game.hasSelector('fitting/layout')) {
    try {
      const res = game.select('fitting/layout', { uid });
      if (res) return res;
    } catch { /* Fallback unten */ }
  }
  const ship = game.state?.assets?.ships?.find((s) => s.uid === uid);
  return ship?.fitting ?? null;
}
