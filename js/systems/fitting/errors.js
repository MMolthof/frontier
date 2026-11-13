// Fehlerobjekte und strukturelle Prüfung eines vorhandenen Fittings (MASTER_PLAN 3.9, 5.1).
// Rein und DOM-frei. Texte kommen aus data.i18n.de.strings["error.<code>"]; die Rückfalltexte
// gelten nur, solange A2 die fehlenden Schlüssel nicht ergänzt hat (siehe Change Request a4-1).

export const SLOTS = ['high', 'mid', 'low', 'rig'];

const FALLBACK_TEXT = {
  'fit.not_docked': 'Fitting ist nur angedockt möglich.',
  'fit.slot_type': 'Dieses Modul passt nicht in diesen Slot.',
  'fit.slot_occupied': 'Der Slot ist bereits belegt.',
  'fit.size': 'Die Modulgröße passt nicht zum Rumpf.',
  'fit.hardpoints': 'Keine freien Waffenplätze mehr.',
  'fit.powergrid': 'Nicht genug Powergrid.',
  'fit.cpu': 'Nicht genug CPU.',
  'fit.calibration': 'Nicht genug Calibration.',
  'fit.skill': 'Dir fehlen Skills für dieses Modul.',
  'fit.no_module': 'Dieses Modul ist nicht verfügbar.',
  'fit.rig_confirm': 'Beim Ausbau wird der Rig zerstört. Bitte bestätigen.',
  'ship.skill': 'Dir fehlen Skills für dieses Schiff.'
};

/** Text zu einem Fehlercode. */
export function errorText(data, code) {
  const strings = data?.i18n?.de?.strings ?? data?.i18n?.de ?? {};
  const own = strings[`error.${code}`];
  if (typeof own === 'string') return own;
  // Altschlüssel aus A2 (vor Contract 1.2): error.fit.no_hardpoint
  if (code === 'fit.hardpoints' && typeof strings['error.fit.no_hardpoint'] === 'string') return strings['error.fit.no_hardpoint'];
  return FALLBACK_TEXT[code] ?? code;
}

export function makeError(data, code, extra = {}) {
  return {
    code,
    slot: extra.slot ?? null,
    index: extra.index ?? null,
    moduleId: extra.moduleId ?? null,
    message: errorText(data, code),
    need: extra.need ?? null,
    have: extra.have ?? null,
    ...(extra.skillId ? { skillId: extra.skillId } : {}),
    ...(extra.hardpoint ? { hardpoint: extra.hardpoint } : {})
  };
}

/** Skill-Stufe aus pilot.skills[id] ({level}) oder Zahl. */
export function levelOf(pilot, skillId) {
  const v = pilot?.skills?.[skillId];
  if (typeof v === 'number') return v;
  return v?.level ?? 0;
}

const EPS = 1e-9;

/**
 * Alle Fehler eines belegten Fittings.
 * @param usage { pg:{used,max}, cpu:{used,max}, calibration:{used,max} }
 */
export function collectFitErrors(ship, pilot, data, usage) {
  const errors = [];
  const fitting = ship.fitting ?? {};
  const hp = { turret: { used: 0, first: null }, launcher: { used: 0, first: null } };
  const hardLimit = ship.hardpoints ?? {};
  for (const slot of SLOTS) {
    (fitting[slot] ?? []).forEach((moduleId, index) => {
      if (!moduleId) return;
      const m = data.modules?.[moduleId];
      if (!m) {
        errors.push(makeError(data, 'fit.no_module', { slot, index, moduleId }));
        return;
      }
      if (m.slot !== slot) errors.push(makeError(data, 'fit.slot_type', { slot, index, moduleId, need: m.slot, have: slot }));
      if (m.size !== ship.hull) errors.push(makeError(data, 'fit.size', { slot, index, moduleId, need: ship.hull, have: m.size }));
      if (slot === 'high' && m.hardpoint && hp[m.hardpoint]) {
        hp[m.hardpoint].used += 1;
        if (hp[m.hardpoint].used > (hardLimit[m.hardpoint] ?? 0) && hp[m.hardpoint].first === null) hp[m.hardpoint].first = { index, moduleId };
      }
      for (const [skillId, need] of Object.entries(m.requires ?? {})) {
        const have = levelOf(pilot, skillId);
        if (have < need) errors.push(makeError(data, 'fit.skill', { slot, index, moduleId, need, have, skillId }));
      }
    });
  }
  for (const kind of ['turret', 'launcher']) {
    const max = hardLimit[kind] ?? 0;
    if (hp[kind].used > max) {
      errors.push(makeError(data, 'fit.hardpoints', { slot: 'high', index: hp[kind].first?.index, moduleId: hp[kind].first?.moduleId, need: hp[kind].used, have: max, hardpoint: kind }));
    }
  }
  for (const [code, key] of [['fit.powergrid', 'pg'], ['fit.cpu', 'cpu'], ['fit.calibration', 'calibration']]) {
    if (usage[key].used > usage[key].max + EPS) errors.push(makeError(data, code, { need: usage[key].used, have: usage[key].max }));
  }
  return errors;
}
