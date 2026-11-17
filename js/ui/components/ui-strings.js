// Standardtexte der Komponenten (Schlüssel ui.*). Fallback, bis data/i18n/de.json sie enthält.

export const UI_STRINGS = {
  'ui.close': 'Schließen',
  'ui.cancel': 'Abbrechen',
  'ui.confirm': 'Bestätigen',
  'ui.over': '+{n} zu viel',
  'ui.slot.high': 'High-Slot',
  'ui.slot.mid': 'Mid-Slot',
  'ui.slot.low': 'Low-Slot',
  'ui.slot.rig': 'Rig-Slot',
  'ui.slot.empty': 'leer',
  'ui.slot.filled': 'belegt',
  'ui.slot.invalid': 'ungültig',
  'ui.hardpoints': 'Geschütze {turret} · Werfer {launcher}',
  'ui.res.em': 'EM',
  'ui.res.th': 'Thermisch',
  'ui.res.kin': 'Kinetisch',
  'ui.res.exp': 'Explosiv',
  'ui.layer.shield': 'Schild',
  'ui.layer.armor': 'Panzerung',
  'ui.layer.structure': 'Struktur',
  'ui.res.caption': 'Resistenzen nach Schicht und Schadensart',
  'ui.table.sort': 'Sortieren nach {name}',
  'ui.ship.alt': 'Schiffssilhouette {name}',
  'ui.empty.default': 'Keine Daten vorhanden.'
};

/** Liefert eine Übersetzungsfunktion: erst `t` (falls gegeben), sonst Standardtexte. */
export function uiText(t) {
  return (key, params = {}) => {
    if (typeof t === 'function') {
      const out = t(key, params);
      if (out !== key) return out;
    }
    const raw = UI_STRINGS[key] ?? key;
    return raw.replace(/\{(\w+)\}/g, (m, n) => (n in params ? String(params[n]) : m));
  };
}
