// Fitting-Ansicht (A5): reine, DOM-freie Hilfsfunktionen.
// Keine Stat-Berechnung: alle Werte stammen aus den Selektoren von A4 (MASTER_PLAN 3.9);
// hier wird nur angeordnet, gefiltert, formatiert und in Zustände übersetzt.
// Texte: `t` ist immer game.t (data/i18n/de.json).

import { fmt } from '../../../util/format.js';

export const SLOT_TYPES = ['high', 'mid', 'low', 'rig'];
export const LAYERS = ['shield', 'armor', 'structure'];
export const DAMAGE_TYPES = ['em', 'th', 'kin', 'exp'];

/** Anteil, ab dem ein Fitting-Balken als „knapp“ gilt. */
export const BAR_WARN_AT = 0.9;

// ---------------------------------------------------------------------------------------------
// Kreisring (6.3): High oben, Mid rechts, Rigs unten, Low links
// ---------------------------------------------------------------------------------------------

export const RING = {
  slotSize: 40,     // Durchmesser eines Slots in Ring-Einheiten (≥ 40 px bei voller Breite)
  gap: 4,           // Mindestabstand zwischen Nachbarslots einer Gruppe
  spanDeg: 72,      // maximaler Winkelbereich einer Gruppe (Quadrant 90° minus Lücke)
  maxStepDeg: 26,   // maximaler Winkelabstand zweier Slots
  baseRadius: 140,
  pad: 6
};

const CENTER_DEG = { high: -90, mid: 0, rig: 90, low: 180 };
// Nummerierung in Leserichtung: High links→rechts, Mid oben→unten, Low oben→unten, Rig links→rechts.
const DIRECTION = { high: 1, mid: 1, rig: -1, low: -1 };

const round = (v, digits = 3) => Math.round(v * 10 ** digits) / 10 ** digits;

/**
 * Position aller Slots auf dem Ring. Der Radius wächst, bis Nachbarn sich nicht überlappen.
 * Positionen und Größe in Prozent des quadratischen Containers (CSS skaliert den Container).
 * @param {{high?: number, mid?: number, low?: number, rig?: number}} counts
 */
export function ringLayout(counts, opts = {}) {
  const o = { ...RING, ...opts };
  const stepFor = (n) => (n <= 1 ? 0 : Math.min(o.maxStepDeg, o.spanDeg / (n - 1)));
  let radius = o.baseRadius;
  for (const slot of SLOT_TYPES) {
    const step = stepFor(counts[slot] ?? 0);
    if (step > 0) radius = Math.max(radius, (o.slotSize + o.gap) / (2 * Math.sin((step * Math.PI) / 360)));
  }
  radius = Math.ceil(radius);
  const size = 2 * (radius + o.slotSize / 2 + o.pad);
  const slots = [];
  for (const slot of SLOT_TYPES) {
    const n = counts[slot] ?? 0;
    const step = stepFor(n);
    for (let index = 0; index < n; index++) {
      const angleDeg = CENTER_DEG[slot] + (index - (n - 1) / 2) * step * DIRECTION[slot];
      const rad = (angleDeg * Math.PI) / 180;
      const x = size / 2 + radius * Math.cos(rad);
      const y = size / 2 + radius * Math.sin(rad);
      slots.push({
        slot, index, angleDeg, x, y,
        xPct: round((x / size) * 100), yPct: round((y / size) * 100), sizePct: round((o.slotSize / size) * 100)
      });
    }
  }
  return { radius, size, slotSize: o.slotSize, slots };
}

/** Reihenfolge für die Tastaturnavigation: im Uhrzeigersinn ab High links. */
export function ringOrder(counts) {
  const seq = (slot, reverse) => {
    const list = Array.from({ length: counts[slot] ?? 0 }, (_, index) => ({ slot, index }));
    return reverse ? list.reverse() : list;
  };
  return [...seq('high'), ...seq('mid'), ...seq('rig', true), ...seq('low', true)];
}

/**
 * Pfeiltasten im Ring. Rechts/Unten = weiter im Uhrzeigersinn, Links/Oben = zurück, Home/End.
 * @returns {{slot: string, index: number}|null} neues Ziel oder null, wenn die Taste nicht zuständig ist
 */
export function nextInRing(order, current, key) {
  if (!order.length) return null;
  const at = order.findIndex((o) => current && o.slot === current.slot && o.index === current.index);
  if (key === 'Home') return order[0];
  if (key === 'End') return order[order.length - 1];
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
  if (!step) return null;
  if (at < 0) return order[0];
  return order[(at + step + order.length) % order.length];
}

// ---------------------------------------------------------------------------------------------
// Fehlertexte und Prüfungen
// ---------------------------------------------------------------------------------------------

const num = (v) => fmt(v, Number.isInteger(v) ? 0 : 1);
const hasText = (t, key) => t(key) !== key;
const OVER_CODES = new Set(['fit.powergrid', 'fit.cpu', 'fit.calibration']);

/** Text zu einem Ergebnis/Check: message, sonst error.<code>, sonst ui.fitting.err.<code>. */
export function errorText(t, res) {
  const code = res?.error;
  // Eine message, die nur den Code/Schlüssel wiederholt (fehlender i18n-Eintrag), ist kein Text.
  const useful = res?.message && res.message !== code && res.message !== `error.${code}`;
  if (useful) return res.message;
  if (code) {
    if (hasText(t, `error.${code}`)) return t(`error.${code}`);
    if (hasText(t, `ui.fitting.err.${code}`)) return t(`ui.fitting.err.${code}`);
  }
  return t('ui.fitting.err.unknown');
}

/**
 * Begründung für ein nicht ausrüstbares Modul, mit Zahlen wenn vorhanden.
 * Annahme zu need/have: need = benötigter Gesamtwert, have = verfügbar; bei fit.skill ist need
 * ein Objekt { skillId: stufe } oder eine Liste von Skill-IDs.
 * @param {object} data game.data (für Skillnamen)
 */
export function describeCheck(check, t, data) {
  if (!check || check.ok) return '';
  let text = errorText(t, check);
  const { need, have } = check;
  if (Number.isFinite(need) && Number.isFinite(have)) {
    text += OVER_CODES.has(check.error) && need > have
      ? ` ${t('ui.fitting.over', { over: num(need - have) })}`
      : ` ${t('ui.fitting.needHave', { need: num(need), have: num(have) })}`;
  } else if (check.error === 'fit.skill' && need && typeof need === 'object') {
    const entries = Array.isArray(need) ? need.map((id) => [id, null]) : Object.entries(need);
    const skills = entries
      .map(([id, level]) => `${data?.skills?.[id]?.name ?? id}${level ? ` ${level}` : ''}`)
      .join(', ');
    text += ` ${t('ui.fitting.skillNeed', { skills })}`;
  }
  return text;
}

// ---------------------------------------------------------------------------------------------
// Balken (PG / CPU / Calibration)
// ---------------------------------------------------------------------------------------------

/**
 * @returns {{ratio: number, pct: number, state: 'ok'|'warn'|'over', over: number}}
 *   ratio 0..1 für die Balkenbreite, pct ungeklemmt in Prozent, state für die Farbe
 */
export function barState(used, max, warnAt = BAR_WARN_AT) {
  const u = Number.isFinite(used) ? used : 0;
  const m = Number.isFinite(max) ? max : 0;
  if (!(m > 0)) return { ratio: u > 0 ? 1 : 0, pct: u > 0 ? 100 : 0, state: u > 0 ? 'over' : 'ok', over: Math.max(0, u - m) };
  const ratio = u / m;
  return {
    ratio: Math.min(1, Math.max(0, ratio)),
    pct: ratio * 100,
    state: u > m ? 'over' : ratio >= warnAt ? 'warn' : 'ok',
    over: Math.max(0, u - m)
  };
}

// ---------------------------------------------------------------------------------------------
// Δ-Vorschau (fitting/preview → delta, flach nach Pfad)
// ---------------------------------------------------------------------------------------------

const GROUP_ORDER = ['fitting', 'defense', 'offense', 'mining', 'capacitor', 'nav', 'repair', 'slots'];

// better: 'up' = größer ist besser, 'down' = kleiner ist besser, null = neutral
const PATHS = {
  'fitting.pg.used': { unit: 'MW', digits: 1, better: 'down' },
  'fitting.cpu.used': { unit: 'tf', digits: 1, better: 'down' },
  'fitting.calibration.used': { unit: '', digits: 0, better: 'down' },
  'fitting.pg.max': { unit: 'MW', digits: 1, better: 'up' },
  'fitting.cpu.max': { unit: 'tf', digits: 1, better: 'up' },
  'fitting.calibration.max': { unit: '', digits: 0, better: 'up' },
  'defense.ehp': { unit: 'HP', digits: 0, better: 'up' },
  'defense.shield.hp': { unit: 'HP', digits: 0, better: 'up' },
  'defense.armor.hp': { unit: 'HP', digits: 0, better: 'up' },
  'defense.structure.hp': { unit: 'HP', digits: 0, better: 'up' },
  'offense.dps.total': { unit: 'DPS', digits: 1, better: 'up' },
  'offense.rangeKm': { unit: 'km', digits: 1, better: 'up' },
  'mining.m3PerTick': { unit: 'm³/Tick', digits: 2, better: 'up' },
  'mining.lasers': { unit: '', digits: 0, better: 'up' },
  'mining.oreHold': { unit: 'm³', digits: 0, better: 'up' },
  'mining.cargo': { unit: 'm³', digits: 0, better: 'up' },
  'capacitor.max': { unit: 'GJ', digits: 0, better: 'up' },
  'capacitor.rechargePerTick': { unit: 'GJ/Tick', digits: 1, better: 'up' },
  'capacitor.usePerTick': { unit: 'GJ/Tick', digits: 1, better: 'down' },
  'capacitor.stableForTicks': { unit: 'Ticks', digits: 0, better: 'up' },
  'nav.speed': { unit: 'm/s', digits: 0, better: 'up' },
  'nav.warpSpeed': { unit: 'AU/Tick', digits: 2, better: 'up' },
  'nav.warpTicksPerAu': { unit: 'Ticks/AU', digits: 2, better: 'down' },
  'nav.signature': { unit: 'm', digits: 0, better: 'down' },
  'nav.maxTargets': { unit: '', digits: 0, better: 'up' },
  'nav.lockRangeKm': { unit: 'km', digits: 1, better: 'up' },
  'repair.shieldPerTick': { unit: 'HP/Tick', digits: 1, better: 'up' },
  'repair.armorPerTick': { unit: 'HP/Tick', digits: 1, better: 'up' }
};

/** Beschreibung eines Delta-Pfads: Anzeige-Meta und Label (Schlüssel + Parameter). */
export function describePath(path, t) {
  let m;
  if ((m = /^defense\.(shield|armor|structure)\.res\.(em|th|kin|exp)$/.exec(path))) {
    return {
      unit: '%', digits: 1, better: 'up', scale: 100,
      label: t('ui.fitting.delta.res', { layer: t(`layer.${m[1]}`), dmg: t(`dmg.${m[2]}`) })
    };
  }
  if ((m = /^offense\.dps\.(em|th|kin|exp)$/.exec(path))) {
    return { unit: 'DPS', digits: 1, better: 'up', scale: 1, label: t('ui.fitting.delta.dpsType', { dmg: t(`dmg.${m[1]}`) }) };
  }
  if ((m = /^slots\.high\.hardpoints\.(turret|launcher)\.used$/.exec(path))) {
    return { unit: '', digits: 0, better: null, scale: 1, label: t('ui.fitting.delta.hardpointsUsed', { hp: t(`hardpoint.${m[1]}`) }) };
  }
  if ((m = /^slots\.(high|mid|low|rig)\.used$/.exec(path))) {
    return { unit: '', digits: 0, better: null, scale: 1, label: t('ui.fitting.delta.slotsUsed', { slot: t(`slot.${m[1]}`) }) };
  }
  const meta = PATHS[path];
  const key = `ui.fitting.delta.${path}`;
  if (meta) return { ...meta, scale: 1, label: hasText(t, key) ? t(key) : path };
  return { unit: '', digits: 2, better: null, scale: 1, label: path };
}

const groupRank = (path) => {
  const i = GROUP_ORDER.indexOf(path.split('.')[0]);
  return i < 0 ? GROUP_ORDER.length : i;
};

/**
 * Nur Änderungen anzeigen (Differenzen ≠ 0 nach Rundung).
 * @param {Record<string, number>} delta flache Pfade
 * @returns {Array<{path: string, label: string, value: number, text: string, tone: 'good'|'bad'|'neutral'}>}
 */
export function formatDeltaRows(delta, t) {
  const rows = [];
  for (const [path, raw] of Object.entries(delta ?? {})) {
    if (!Number.isFinite(raw)) continue;
    const d = describePath(path, t);
    const value = raw * d.scale;
    if (Number(Math.abs(value).toFixed(d.digits)) === 0) continue;
    const sign = value > 0 ? '+' : '−';
    const text = `${sign}${fmt(Math.abs(value), d.digits)}${d.unit ? ` ${d.unit}` : ''}`;
    const tone = !d.better ? 'neutral' : (d.better === 'up') === (value > 0) ? 'good' : 'bad';
    rows.push({ path, label: d.label, value, text, tone });
  }
  return rows.sort((a, b) => groupRank(a.path) - groupRank(b.path) || a.path.localeCompare(b.path));
}

// ---------------------------------------------------------------------------------------------
// Statistik-Panel
// ---------------------------------------------------------------------------------------------

const fin = (v) => (Number.isFinite(v) ? v : 0);
const withUnit = (v, digits, unit) => `${fmt(fin(v), digits)}${unit ? ` ${unit}` : ''}`;

/**
 * Wandelt die stats-Form aus 3.9 in eine Anzeigestruktur (kein Rechnen außer Formatierung).
 * @param {object|undefined} stats Ergebnis von fitting/stats
 * @param {object} [data] game.data (für Skillnamen in Fehlertexten)
 */
export function buildPanel(stats, t, data) {
  const s = stats ?? {};
  const budgetDefs = [
    ['pg', 'powergrid', 'MW', 1], ['cpu', 'cpu', 'tf', 1], ['calibration', 'calibration', '', 0]
  ];
  const budget = budgetDefs.map(([id, statId, unit, digits]) => {
    const used = fin(s.fitting?.[id]?.used);
    const max = fin(s.fitting?.[id]?.max);
    const bar = barState(used, max);
    return {
      id, label: t(`stat.${statId}`), used, max, unit, ...bar,
      text: `${fmt(used, digits)} / ${fmt(max, digits)}${unit ? ` ${unit}` : ''}`,
      overText: bar.over > 0 ? t('ui.fitting.over', { over: fmt(bar.over, digits) }) : ''
    };
  });

  const layers = LAYERS.map((id) => ({
    id, label: t(`layer.${id}`), hp: fin(s.defense?.[id]?.hp), hpText: withUnit(s.defense?.[id]?.hp, 0, 'HP')
  }));
  const resist = {
    layers: LAYERS.map((id) => ({ id, label: t(`layer.${id}`) })),
    rows: DAMAGE_TYPES.map((dmg) => ({
      dmg, label: t(`dmg.${dmg}`),
      cells: LAYERS.map((layer) => {
        const value = fin(s.defense?.[layer]?.res?.[dmg]);
        return { layer, value, text: `${fmt(value * 100, 0)} %`, level: Math.min(1, Math.max(0, value)) };
      })
    }))
  };

  const off = s.offense ?? {};
  const dpsRows = DAMAGE_TYPES.filter((d) => fin(off.dps?.[d]) > 0)
    .map((d) => ({ label: t('ui.fitting.delta.dpsType', { dmg: t(`dmg.${d}`) }), text: withUnit(off.dps[d], 1, 'DPS') }));
  const mining = s.mining ?? {};
  const cap = s.capacitor ?? {};
  const nav = s.nav ?? {};
  const rep = s.repair ?? {};

  const stableText = cap.stable
    ? t('ui.fitting.capStable')
    : Number.isFinite(cap.stableForTicks) ? t('ui.fitting.capUnstable', { ticks: fmt(cap.stableForTicks, 0) }) : t('ui.fitting.capUnstableNoTime');

  const sections = [
    {
      id: 'offense', title: t('ui.fitting.section.offense'), visible: fin(off.dps?.total) > 0,
      rows: [
        { label: t('ui.fitting.dpsTotal'), text: withUnit(off.dps?.total, 1, 'DPS'), strong: true },
        ...dpsRows,
        { label: t('stat.weapon_range'), text: withUnit(off.rangeKm, 1, 'km') }
      ]
    },
    {
      id: 'mining', title: t('ui.fitting.section.mining'), visible: fin(mining.lasers) > 0 || fin(mining.m3PerTick) > 0,
      rows: [
        { label: t('ui.fitting.miningYield'), text: withUnit(mining.m3PerTick, 2, 'm³/Tick'), strong: true },
        { label: t('ui.fitting.lasers'), text: fmt(fin(mining.lasers), 0) },
        { label: t('stat.ore_hold'), text: withUnit(mining.oreHold, 0, 'm³') },
        { label: t('stat.cargo'), text: withUnit(mining.cargo, 0, 'm³') }
      ]
    },
    {
      id: 'capacitor', title: t('ui.fitting.section.capacitor'), visible: true,
      rows: [
        { label: t('stat.capacitor'), text: withUnit(cap.max, 0, 'GJ'), strong: true },
        { label: t('ui.fitting.capRecharge'), text: withUnit(cap.rechargePerTick, 1, 'GJ/Tick') },
        { label: t('ui.fitting.capUse'), text: withUnit(cap.usePerTick, 1, 'GJ/Tick') },
        { label: t('ui.fitting.capState'), text: stableText, tone: cap.stable ? 'good' : 'bad' }
      ]
    },
    {
      id: 'nav', title: t('ui.fitting.section.nav'), visible: true,
      rows: [
        { label: t('stat.speed'), text: withUnit(nav.speed, 0, 'm/s') },
        { label: t('stat.warp_speed'), text: withUnit(nav.warpSpeed, 2, 'AU/Tick') },
        { label: t('ui.fitting.warpTime'), text: withUnit(nav.warpTicksPerAu, 2, 'Ticks/AU') },
        { label: t('stat.signature'), text: withUnit(nav.signature, 0, 'm') },
        { label: t('stat.max_targets'), text: fmt(fin(nav.maxTargets), 0) },
        { label: t('stat.lock_range_km'), text: withUnit(nav.lockRangeKm, 1, 'km') }
      ]
    },
    {
      id: 'repair', title: t('ui.fitting.section.repair'), visible: fin(rep.shieldPerTick) > 0 || fin(rep.armorPerTick) > 0,
      rows: [
        { label: t('stat.shield_boost'), text: withUnit(rep.shieldPerTick, 1, 'HP/Tick') },
        { label: t('stat.armor_repair'), text: withUnit(rep.armorPerTick, 1, 'HP/Tick') }
      ]
    }
  ];

  return {
    valid: s.valid !== false,
    budget,
    layers,
    ehp: fin(s.defense?.ehp),
    ehpText: withUnit(s.defense?.ehp, 0, 'HP'),
    resist,
    sections: sections.filter((x) => x.visible),
    errors: (s.errors ?? []).map((e) => ({
      code: e.code, slot: e.slot ?? null, index: e.index ?? null, moduleId: e.moduleId ?? null,
      text: describeCheck({ ...e, error: e.error ?? e.code, ok: false }, t, data)
    }))
  };
}

// ---------------------------------------------------------------------------------------------
// Slots und Modul-Browser
// ---------------------------------------------------------------------------------------------

/** Füllt Slot-Arrays auf die erwartete Länge (fehlende Einträge = leer). */
export function normalizeFitting(raw, counts) {
  const src = raw?.fitting && typeof raw.fitting === 'object' ? raw.fitting : raw ?? {};
  const out = {};
  for (const slot of SLOT_TYPES) {
    const n = counts[slot] ?? 0;
    out[slot] = Array.from({ length: n }, (_, i) => src[slot]?.[i] ?? null);
  }
  return out;
}

/** Zellen je Slot für Ring und Liste. */
export function buildCells(fitting, data, errors = []) {
  const out = {};
  for (const slot of SLOT_TYPES) {
    out[slot] = (fitting[slot] ?? []).map((moduleId, index) => {
      const def = moduleId ? data?.modules?.[moduleId] : null;
      const issue = errors.find((e) => e.slot === slot && e.index === index);
      return {
        slot, index, moduleId,
        name: def?.name ?? moduleId ?? null,
        group: def?.group ?? null,
        category: def?.category ?? null,
        invalid: Boolean(issue),
        issue: issue?.text ?? ''
      };
    });
  }
  return out;
}

/** Ziel-Index zum Einbauen: gewählter freier Slot, sonst der erste freie; -1 wenn keiner frei ist. */
export function chooseTargetIndex(cells, preferred = null) {
  if (Number.isInteger(preferred) && cells[preferred] && !cells[preferred].moduleId) return preferred;
  return cells.findIndex((c) => !c.moduleId);
}

const collator = new Intl.Collator('de');

/** Nach (übersetzter) Gruppe, dann Name. */
export function sortModules(items, t) {
  return [...items].sort((a, b) =>
    collator.compare(t(`modgroup.${a.group}`), t(`modgroup.${b.group}`)) || collator.compare(a.name, b.name));
}

/** Gruppen der Liste mit Anzahl, alphabetisch nach Übersetzung. */
export function listGroups(items, t) {
  const counts = new Map();
  for (const m of items) counts.set(m.group, (counts.get(m.group) ?? 0) + 1);
  return [...counts].map(([id, count]) => ({ id, label: t(`modgroup.${id}`), count }))
    .sort((a, b) => collator.compare(a.label, b.label));
}

/**
 * @param {Array<object>} items Ergebnis von fitting/moduleList (nicht ausrüstbare bleiben sichtbar)
 * @param {{group?: string, search?: string, onlyUsable?: boolean, inStockOnly?: boolean}} filter
 */
export function filterModules(items, filter, t) {
  const q = (filter.search ?? '').trim().toLowerCase();
  return sortModules(items, t).filter((m) => {
    if (filter.group && m.group !== filter.group) return false;
    if (filter.onlyUsable && !m.check?.ok) return false;
    if (filter.inStockOnly && !(m.qtyInStation > 0)) return false;
    if (q) {
      const hay = `${m.name} ${t(`modgroup.${m.group}`)} ${t(`modcat.${m.category}`)}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Kosten-Zeile eines Moduls: "PG 1 · CPU 20" (Calibration nur bei Rigs). */
export function costText(fitting, t) {
  const parts = [];
  if (fitting?.powergrid != null) parts.push(`${t('ui.fitting.pgShort')} ${fmt(fitting.powergrid, 0)}`);
  if (fitting?.cpu != null) parts.push(`${t('ui.fitting.cpuShort')} ${fmt(fitting.cpu, 0)}`);
  if (fitting?.calibration) parts.push(`${t('ui.fitting.calShort')} ${fmt(fitting.calibration, 0)}`);
  return parts.join(' · ');
}
