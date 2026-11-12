#!/usr/bin/env node
// Validiert alle Spieldaten (data/*.json, data/ext/*.json, data/i18n/*.json) gegen data/schema/*.schema.json
// und prüft Querverweise, Slot-/Hardpoint-Regeln, Skill-Zyklen, Gate-Gegenstellen, Missionsstufen und Startdaten.
//   node tools/validate-data.mjs                 Standardprüfung, Exit-Code 1 bei Fehlern
//   node tools/validate-data.mjs --report        zusätzlich Balance-Rechnung (Ertrag, Missionen, Skillpunkte, Aufstiegspfade)
//   node tools/validate-data.mjs --root <ordner> anderes Repo-Root prüfen (Standard: Repo dieses Skripts)
// Node 20+, keine Pakete. Läd die Daten über js/core/data-loader.js (buildData).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildData, ENTRY_KIND_NAMES } from '../js/core/data-loader.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT = resolve(HERE, '..');

export const SKILL_GROUPS = ['spaceship_command', 'gunnery', 'missiles', 'industry', 'engineering', 'electronics', 'shields', 'armor', 'navigation', 'trade', 'science'];
export const CLASS_ORDER = ['frigate', 'destroyer', 'cruiser', 'battlecruiser', 'battleship'];
const HULL_OF = { frigate: 'small', destroyer: 'small', cruiser: 'medium', barge: 'medium', hauler: 'medium', battlecruiser: 'large', battleship: 'large' };
// erlaubte Slot-Summen je Klasse (Vertrag: Fregatte 8–11, Zerstörer 11–14, Kreuzer 12–16; Toleranz −1/+2)
const SLOT_TOTAL = { frigate: [7, 13], destroyer: [10, 16], cruiser: [11, 18], barge: [9, 15], hauler: [8, 14], battlecruiser: [14, 21], battleship: [16, 24] };
const GROUP_SLOT = {
  projectile_turret: 'high', energy_turret: 'high', hybrid_turret: 'high', light_missile_launcher: 'high', heavy_missile_launcher: 'high', torpedo_launcher: 'high',
  mining_laser: 'high', strip_miner: 'high', survey_scanner: 'high',
  shield_extender: 'mid', shield_booster: 'mid', shield_resist: 'mid', afterburner: 'mid', microwarpdrive: 'mid', cap_recharger: 'mid', signal_amplifier: 'mid',
  armor_plate: 'low', armor_repairer: 'low', armor_resist: 'low', hull_reinforcement: 'low', reactor_control: 'low', coprocessor: 'low', mining_upgrade: 'low',
  gyrostabilizer: 'low', heat_sink: 'low', magnetic_stabilizer: 'low', ballistic_control: 'low'
};
const SLOTS = ['high', 'mid', 'low', 'rig'];
const SIZE_OF_HULL = { small: 'small', medium: 'medium', large: 'large' };
const SERVICES = ['market', 'hangar', 'missions', 'refinery', 'industry', 'shipyard'];
const LEVEL_CLASSES = [['frigate', 'destroyer'], ['destroyer', 'cruiser'], ['cruiser', 'battlecruiser'], ['battlecruiser', 'battleship']];
const SCHEMA_OF = { 'stats.json': 'stats', 'ships.json': 'ships', 'modules.json': 'modules', 'skills.json': 'skills', 'ores.json': 'ores', 'items.json': 'items', 'systems.json': 'systems', 'missions.json': 'missions', 'npcs.json': 'npcs', 'balance.json': 'balance' };

// ---------------------------------------------------------------- Mini-JSON-Schema (draft-07-Teilmenge)
export function checkSchema(schema, value, path, out) {
  const t = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
  const types = schema.type ? [].concat(schema.type) : null;
  if (types) {
    const actual = t(value);
    const ok = types.some((x) => x === actual || (x === 'number' && actual === 'integer'));
    if (!ok) { out.push(`${path}: Typ ${actual} statt ${types.join('|')}`); return; }
  }
  if ('const' in schema && value !== schema.const) out.push(`${path}: Wert ${JSON.stringify(value)} statt ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) out.push(`${path}: Wert ${JSON.stringify(value)} nicht in ${JSON.stringify(schema.enum)}`);
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) out.push(`${path}: ${value} < Minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) out.push(`${path}: ${value} > Maximum ${schema.maximum}`);
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) out.push(`${path}: Text zu kurz`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) out.push(`${path}: "${value}" passt nicht zu ${schema.pattern}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) out.push(`${path}: weniger als ${schema.minItems} Einträge`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) out.push(`${path}: mehr als ${schema.maxItems} Einträge`);
    if (schema.uniqueItems && new Set(value.map((x) => JSON.stringify(x))).size !== value.length) out.push(`${path}: doppelte Einträge`);
    if (schema.items) value.forEach((v, i) => checkSchema(schema.items, v, `${path}[${i}]`, out));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    for (const r of schema.required ?? []) if (!(r in value)) out.push(`${path}: Pflichtfeld "${r}" fehlt`);
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) out.push(`${path}: weniger als ${schema.minProperties} Einträge`);
    if (schema.propertyNames) for (const k of keys) if (!new RegExp(schema.propertyNames.pattern).test(k)) out.push(`${path}: Schlüssel "${k}" ungültig`);
    const props = schema.properties ?? {};
    const patterns = Object.entries(schema.patternProperties ?? {}).map(([p, s]) => [new RegExp(p), s]);
    for (const k of keys) {
      if (props[k]) checkSchema(props[k], value[k], `${path}.${k}`, out);
      const hits = patterns.filter(([re]) => re.test(k));
      for (const [, s] of hits) checkSchema(s, value[k], `${path}.${k}`, out);
      if (!props[k] && !hits.length) {
        if (schema.additionalProperties === false) out.push(`${path}: unbekanntes Feld "${k}"`);
        else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') checkSchema(schema.additionalProperties, value[k], `${path}.${k}`, out);
      }
    }
  }
}

// ---------------------------------------------------------------- Hilfen
const sum = (a) => a.reduce((x, y) => x + y, 0);
export const spForLevel = (rank, level, base = 250, exp = 2.5) => Math.ceil(base * rank * 2 ** (exp * (level - 1)));

/** Transitive Skill-Voraussetzungen ({skillId: höchste benötigte Stufe}). */
export function requirementClosure(skills, requires) {
  const need = {};
  const visit = (id, lvl) => {
    if (!skills[id] || (need[id] ?? 0) >= lvl) return;
    need[id] = lvl;
    for (const [dep, l] of Object.entries(skills[id].requires ?? {})) visit(dep, l);
  };
  for (const [id, lvl] of Object.entries(requires ?? {})) visit(id, lvl);
  return need;
}

export const REFERENCE_FITS = {
  'ship.pebble': { high: ['mod.miner_1', 'mod.miner_1', 'mod.survey_scanner_s'], mid: ['mod.shield_extender_s', 'mod.cap_recharger_s', 'mod.afterburner_s'], low: ['mod.mining_upgrade_1'], rig: ['mod.rig_cargo_s', 'mod.rig_mining_s'] },
  'ship.digger': { high: ['mod.miner_1', 'mod.miner_1', 'mod.miner_1', 'mod.survey_scanner_s'], mid: ['mod.shield_extender_s', 'mod.afterburner_s', 'mod.cap_recharger_s'], low: ['mod.mining_upgrade_1', 'mod.mining_upgrade_1', 'mod.armor_plate_s'], rig: ['mod.rig_cargo_s', 'mod.rig_mining_s'] },
  'ship.delver': { high: ['mod.strip_miner_1', 'mod.strip_miner_1', 'mod.strip_miner_1'], mid: ['mod.shield_extender_m', 'mod.shield_booster_m'], low: ['mod.mining_upgrade_m1', 'mod.mining_upgrade_m1', 'mod.mining_upgrade_m1'], rig: ['mod.rig_cargo_m', 'mod.rig_mining_m', 'mod.rig_armor_m'] },
  'ship.vault': { high: ['mod.strip_miner_1', 'mod.strip_miner_1', 'mod.survey_scanner_m'], mid: ['mod.shield_extender_m', 'mod.afterburner_m', 'mod.cap_recharger_m'], low: ['mod.mining_upgrade_m1', 'mod.armor_plate_m'], rig: ['mod.rig_cargo_m', 'mod.rig_mining_m', 'mod.rig_power_m'] },
  'ship.bulwark': { high: ['mod.strip_miner_1', 'mod.strip_miner_1', 'mod.survey_scanner_m'], mid: ['mod.shield_extender_m', 'mod.shield_extender_m', 'mod.shield_booster_m', 'mod.shield_resist_m'], low: ['mod.armor_plate_m', 'mod.mining_upgrade_m1'], rig: ['mod.rig_cargo_m', 'mod.rig_shield_m', 'mod.rig_armor_m'] },
  'ship.dart': { high: ['mod.autocannon_s', 'mod.autocannon_s', 'mod.autocannon_s', 'mod.launcher_s'], mid: ['mod.shield_extender_s', 'mod.shield_booster_s', 'mod.afterburner_s'], low: ['mod.armor_plate_s', 'mod.armor_plate_s', 'mod.armor_plate_s'], rig: ['mod.rig_weapon_s', 'mod.rig_shield_s', 'mod.rig_nav_s'] },
  'ship.cinder': { high: ['mod.autocannon_s', 'mod.autocannon_s', 'mod.autocannon_s'], mid: ['mod.shield_extender_s', 'mod.afterburner_s'], low: ['mod.armor_plate_s', 'mod.armor_plate_s', 'mod.armor_repairer_s', 'mod.gyrostabilizer_s'], rig: ['mod.rig_armor_s', 'mod.rig_weapon_s'] },
  'ship.sparrow': { high: ['mod.launcher_s', 'mod.launcher_s', 'mod.launcher_s'], mid: ['mod.shield_extender_s', 'mod.shield_booster_s', 'mod.afterburner_s', 'mod.signal_amplifier_s'], low: ['mod.ballistic_control_s', 'mod.armor_plate_s'], rig: ['mod.rig_shield_s', 'mod.rig_nav_s'] },
  'ship.lance': { high: ['mod.autocannon_s', 'mod.autocannon_s', 'mod.autocannon_s', 'mod.autocannon_s', 'mod.autocannon_s', 'mod.autocannon_s', 'mod.launcher_s'], mid: ['mod.shield_extender_s', 'mod.afterburner_s'], low: ['mod.gyrostabilizer_s', 'mod.armor_plate_s', 'mod.armor_plate_s'], rig: ['mod.rig_weapon_s', 'mod.rig_nav_s'] },
  'ship.warden': { high: ['mod.rail_cannon_m', 'mod.rail_cannon_m', 'mod.rail_cannon_m', 'mod.rail_cannon_m', 'mod.launcher_m'], mid: ['mod.shield_extender_m', 'mod.afterburner_m', 'mod.cap_recharger_m'], low: ['mod.armor_plate_m', 'mod.armor_plate_m', 'mod.armor_repairer_m', 'mod.magnetic_stabilizer_m', 'mod.armor_resist_m'], rig: ['mod.rig_armor_m', 'mod.rig_weapon_m', 'mod.rig_nav_m'] },
  'ship.corvid': { high: ['mod.launcher_m', 'mod.launcher_m', 'mod.launcher_m', 'mod.launcher_m', 'mod.pulse_cannon_m'], mid: ['mod.shield_extender_m', 'mod.shield_extender_m', 'mod.shield_booster_m', 'mod.afterburner_m', 'mod.signal_amplifier_m'], low: ['mod.ballistic_control_m', 'mod.hull_reinforcement_m', 'mod.armor_plate_m'], rig: ['mod.rig_shield_m', 'mod.rig_nav_m', 'mod.rig_power_m'] },
  'ship.bastion': { high: ['mod.rail_cannon_l', 'mod.rail_cannon_l', 'mod.rail_cannon_l', 'mod.rail_cannon_l', 'mod.rail_cannon_l', 'mod.launcher_l'], mid: ['mod.shield_extender_l', 'mod.afterburner_l', 'mod.cap_recharger_l', 'mod.shield_booster_l'], low: ['mod.armor_plate_l', 'mod.armor_plate_l', 'mod.armor_repairer_l', 'mod.magnetic_stabilizer_l', 'mod.reactor_control_l'], rig: ['mod.rig_armor_l', 'mod.rig_weapon_l'] },
  'ship.sovereign': { high: ['mod.rail_cannon_l', 'mod.rail_cannon_l', 'mod.rail_cannon_l', 'mod.rail_cannon_l', 'mod.rail_cannon_l', 'mod.rail_cannon_l', 'mod.launcher_l'], mid: ['mod.shield_extender_l', 'mod.shield_extender_l', 'mod.afterburner_l', 'mod.cap_recharger_l', 'mod.shield_booster_l'], low: ['mod.armor_plate_l', 'mod.armor_plate_l', 'mod.armor_repairer_l', 'mod.magnetic_stabilizer_l', 'mod.magnetic_stabilizer_l', 'mod.reactor_control_l'], rig: ['mod.rig_armor_l', 'mod.rig_weapon_l'] },
  'ship.mule': { high: [], mid: ['mod.afterburner_m', 'mod.shield_extender_m', 'mod.cap_recharger_m'], low: ['mod.armor_plate_m', 'mod.hull_reinforcement_m', 'mod.coprocessor_m'], rig: ['mod.rig_cargo_m', 'mod.rig_cargo_m', 'mod.rig_nav_m'] }
};

// ---------------------------------------------------------------- Hauptprüfung
/**
 * @param {{manifest:object, files:Record<string,object>, ext?:Array<{path:string,json:object}>, schemas:Record<string,object>}} input
 * @returns {{errors:string[], warnings:string[], data:object}}
 */
export function validateBundle({ manifest, files, ext = [], schemas }) {
  const errors = [];
  const warnings = [];
  const E = (file, id, msg) => errors.push(`[${file}]${id ? ` ${id}:` : ''} ${msg}`);
  const W = (file, id, msg) => warnings.push(`[${file}]${id ? ` ${id}:` : ''} ${msg}`);

  const built = buildData({ manifest, files, ext });
  built.warnings.forEach((w) => errors.push(`[loader] ${w}`));
  const data = built.data;
  const { ships, modules, skills, ores, items, systems, missions, npcs } = data;
  const stats = data.stats;
  const L = data.lists;

  // --- 1. Schema ---------------------------------------------------------
  for (const [file, name] of Object.entries(SCHEMA_OF)) {
    const json = files[file];
    if (json === undefined) { E(file, null, 'Datei fehlt'); continue; }
    const schema = schemas[name];
    if (!schema) { E(file, null, `Schema data/schema/${name}.schema.json fehlt`); continue; }
    if (name === 'balance') {
      const o = []; checkSchema(schema, json, '$', o); o.forEach((m) => E(file, 'balance', m));
      continue;
    }
    const top = []; checkSchema({ ...schema, properties: { schema: schema.properties.schema, entries: { type: 'array', minItems: 1 } } }, json, '$', top);
    top.forEach((m) => E(file, null, m));
    const entrySchema = schema.properties.entries.items;
    (json.entries ?? []).forEach((entry, i) => { const o = []; checkSchema(entrySchema, entry, '$', o); o.forEach((m) => E(file, entry?.id ?? `#${i}`, m)); });
  }
  for (const { path, json } of ext) {
    for (const entry of json.entries ?? []) {
      const kind = json.kind ?? ENTRY_KIND_NAMES.find((k) => data.lists[k].includes(entry));
      const schema = kind && schemas[kind];
      if (!schema) continue;
      const o = []; checkSchema(schema.properties.entries.items, entry, '$', o); o.forEach((m) => E(path, entry.id, m));
    }
  }
  const i18nSchema = schemas.i18n;
  for (const [lang, json] of Object.entries(data.i18n)) {
    if (!i18nSchema) { E(`i18n/${lang}.json`, null, 'Schema i18n.schema.json fehlt'); break; }
    const o = []; checkSchema(i18nSchema, json, '$', o); o.forEach((m) => E(`i18n/${lang}.json`, null, m));
  }
  const strings = data.i18n.de?.strings ?? {};

  // --- 2. Stats ----------------------------------------------------------
  const statIds = new Set(L.stats.map((s) => s.id));
  const needStat = (file, id, stat, where) => { if (!statIds.has(stat)) E(file, id, `${where}: unbekannte Stat-ID "${stat}" (nicht in stats.json)`); };
  const moduleGroups = new Set(L.modules.map((m) => m.group));
  const checkApplies = (file, id, a) => {
    if (!a) return;
    if (a.moduleGroup && !moduleGroups.has(a.moduleGroup)) E(file, id, `appliesTo.moduleGroup "${a.moduleGroup}" existiert in keinem Modul`);
    if (a.oreSkill && !skills[a.oreSkill]) E(file, id, `appliesTo.oreSkill "${a.oreSkill}" ist kein Skill`);
  };
  const checkReq = (file, id, req, where = 'requires') => {
    for (const [sid, lvl] of Object.entries(req ?? {})) {
      if (!skills[sid]) E(file, id, `${where}: Skill "${sid}" existiert nicht`);
      else if (lvl > (skills[sid].maxLevel ?? 5)) E(file, id, `${where}: Stufe ${lvl} über maxLevel von ${sid}`);
    }
  };

  // --- 3. Skills ---------------------------------------------------------
  for (const s of L.skills) {
    const f = 'skills.json';
    if (s.primary === s.secondary) E(f, s.id, 'primary und secondary dürfen nicht gleich sein');
    checkReq(f, s.id, s.requires);
    if (s.requires?.[s.id]) E(f, s.id, 'Skill verlangt sich selbst');
    for (const fx of s.effects ?? []) { needStat(f, s.id, fx.stat, 'effects'); checkApplies(f, s.id, fx.appliesTo); }
  }
  // Zyklen (DFS)
  const color = {};
  const cyc = (id, stack) => {
    if (color[id] === 2) return;
    if (color[id] === 1) { E('skills.json', id, `Voraussetzungs-Zyklus: ${[...stack, id].join(' → ')}`); return; }
    color[id] = 1;
    for (const dep of Object.keys(skills[id]?.requires ?? {})) if (skills[dep]) cyc(dep, [...stack, id]);
    color[id] = 2;
  };
  for (const s of L.skills) cyc(s.id, []);
  for (const g of SKILL_GROUPS) if (!L.skills.some((s) => s.group === g)) E('skills.json', null, `Skill-Gruppe "${g}" ohne Skills`);

  // --- 4. Module ---------------------------------------------------------
  const modNames = new Map();
  for (const m of L.modules) {
    const f = 'modules.json';
    if (modNames.has(m.name)) W(f, m.id, `Name "${m.name}" doppelt (auch ${modNames.get(m.name)})`); else modNames.set(m.name, m.id);
    checkReq(f, m.id, m.requires);
    for (const fx of m.effects ?? []) {
      needStat(f, m.id, fx.stat, 'effects'); checkApplies(f, m.id, fx.appliesTo);
      if (fx.op === 'mul' && !fx.stackingGroup) E(f, m.id, `mul-Effekt auf ${fx.stat} ohne stackingGroup`);
    }
    if (m.slot === 'rig') {
      if (m.category !== 'rig') E(f, m.id, 'Slot-Typ rig verlangt category "rig"');
      if (!m.permanent) E(f, m.id, 'Rigs müssen permanent:true sein');
      const cal = m.fitting?.calibration;
      if (cal === undefined || cal < 50 || cal > 200) E(f, m.id, `Rig braucht fitting.calibration zwischen 50 und 200 (ist ${cal})`);
      if (m.fitting?.powergrid || m.fitting?.cpu) E(f, m.id, 'Rigs verbrauchen nur Calibration');
      if (m.activation) E(f, m.id, 'Rigs haben keine Aktivierung');
    } else {
      if (m.category === 'rig') E(f, m.id, `category "rig" nur im Slot-Typ rig (ist ${m.slot})`);
      if (m.permanent) E(f, m.id, 'permanent nur bei Rigs');
      if (m.fitting?.powergrid === undefined || m.fitting?.cpu === undefined) E(f, m.id, 'fitting.powergrid und fitting.cpu müssen angegeben sein');
      if (m.fitting?.calibration) E(f, m.id, 'calibration nur bei Rigs');
    }
    if (m.hardpoint && m.slot !== 'high') E(f, m.id, `Hardpoint ${m.hardpoint} ist nur im High-Slot möglich (Slot ist ${m.slot})`);
    const expected = GROUP_SLOT[m.group];
    if (m.slot !== 'rig') {
      if (!expected) E(f, m.id, `Gruppe "${m.group}" ist im Validator nicht als Slot-Typ hinterlegt (tools/validate-data.mjs GROUP_SLOT ergänzen)`);
      else if (expected !== m.slot) E(f, m.id, `Slot-Typ ${m.slot} passt nicht zur Gruppe ${m.group} (erwartet ${expected})`);
    }
    const a = m.activation;
    if (a) {
      if (a.kind === 'attack') {
        if (!a.damage || sum(Object.values(a.damage)) <= 0) E(f, m.id, 'attack braucht damage > 0');
        if (!a.rangeKm) E(f, m.id, 'attack braucht rangeKm');
        if (!m.hardpoint) E(f, m.id, 'Angriffsmodul braucht hardpoint turret|launcher');
      }
      if (a.kind === 'mine') { if (!a.yieldM3 || !a.cycleTicks) E(f, m.id, 'mine braucht yieldM3 und cycleTicks'); if (m.hardpoint !== 'turret') E(f, m.id, 'Mining-Laser sind Turret-Hardpoints'); }
      if (a.kind === 'repair' && (!a.repairs || !a.amount)) E(f, m.id, 'repair braucht repairs und amount');
      if (a.kind === 'scan' && !a.rangeKm) E(f, m.id, 'scan braucht rangeKm');
    } else if (m.hardpoint) E(f, m.id, 'Modul mit Hardpoint braucht activation');
    if (m.group === 'mining_laser' || m.group === 'strip_miner') if (m.activation?.kind !== 'mine') E(f, m.id, 'Mining-Modul ohne activation.kind "mine"');
  }
  const groupSlot = {};
  for (const m of L.modules) { groupSlot[m.group] ??= m.slot; if (groupSlot[m.group] !== m.slot) E('modules.json', m.id, `Gruppe ${m.group} liegt in mehreren Slot-Typen`); }

  // --- 5. Schiffe --------------------------------------------------------
  const shipNames = new Set();
  for (const s of L.ships) {
    const f = 'ships.json';
    if (!s.slots || !s.hardpoints || !s.fitting || !s.attributes) continue; // Schemafehler wurde bereits gemeldet
    if (shipNames.has(s.name)) W(f, s.id, `Name "${s.name}" doppelt`); shipNames.add(s.name);
    checkReq(f, s.id, s.requires);
    for (const b of s.bonuses ?? []) { if (!skills[b.skill]) E(f, s.id, `bonuses: Skill "${b.skill}" existiert nicht`); needStat(f, s.id, b.stat, 'bonuses'); }
    for (const r of s.roleBonuses ?? []) { needStat(f, s.id, r.stat, 'roleBonuses'); checkApplies(f, s.id, r.appliesTo); }
    for (const k of Object.keys(s.attributes ?? {})) needStat(f, s.id, k, 'attributes');
    if (HULL_OF[s.class] && s.hull !== HULL_OF[s.class]) E(f, s.id, `Klasse ${s.class} verlangt hull ${HULL_OF[s.class]} (ist ${s.hull})`);
    if (s.art !== s.id) E(f, s.id, `art muss der Schiffs-ID entsprechen (ist ${s.art})`);
    const { high, mid, low, rig } = s.slots ?? {};
    const total = high + mid + low + rig;
    const rng = SLOT_TOTAL[s.class];
    if (rng && (total < rng[0] || total > rng[1])) E(f, s.id, `Slot-Summe ${total} außerhalb ${rng[0]}–${rng[1]} für ${s.class}`);
    if (s.hardpoints) {
      if (s.hardpoints.turret > high) E(f, s.id, `Turret-Hardpoints (${s.hardpoints.turret}) > High-Slots (${high})`);
      if (s.hardpoints.launcher > high) E(f, s.id, `Launcher-Hardpoints (${s.hardpoints.launcher}) > High-Slots (${high})`);
    }
    const a = s.attributes ?? {};
    if (s.category === 'mining') {
      if (!(a.ore_hold > 0)) E(f, s.id, 'Bergbauschiff braucht ore_hold > 0');
      if (s.hardpoints?.launcher > 0) E(f, s.id, 'Bergbauschiffe haben keine Launcher-Hardpoints');
      if (!(s.hardpoints?.turret >= 1)) E(f, s.id, 'Bergbauschiff braucht mindestens einen Turret-Hardpoint für Laser');
      if (![...(s.bonuses ?? []), ...(s.roleBonuses ?? [])].some((b) => b.stat === 'mining_yield' || b.stat === 'ore_hold' || b.stat === 'mining_crit_chance')) E(f, s.id, 'Bergbauschiff ohne Ertrags-/Hallenbonus');
      if ((s.bonuses ?? []).some((b) => b.stat === 'turret_damage' || b.stat === 'missile_damage')) E(f, s.id, 'Bergbauschiff darf keine Waffenboni haben');
    } else if (s.category === 'combat') {
      if (a.ore_hold !== 0) E(f, s.id, 'Kampfschiff braucht ore_hold 0');
      if ([...(s.bonuses ?? []), ...(s.roleBonuses ?? [])].some((b) => String(b.stat).startsWith('mining_'))) E(f, s.id, 'Kampfschiff darf keine Mining-Boni haben');
      if (!(s.hardpoints?.turret + s.hardpoints?.launcher > 0)) E(f, s.id, 'Kampfschiff ohne Waffen-Hardpoints');
    } else if (s.category === 'industrial') {
      if (a.ore_hold !== 0) E(f, s.id, 'Frachter braucht ore_hold 0');
      if (!(a.cargo >= 10000)) E(f, s.id, 'Frachter braucht cargo ≥ 10000');
    }
  }

  // --- 6. Erze, Items ----------------------------------------------------
  for (const o of L.ores) {
    const f = 'ores.json';
    checkReq(f, o.id, o.requires);
    if (o.securityBand?.[0] > o.securityBand?.[1]) E(f, o.id, 'securityBand: min > max');
    for (const it of Object.keys(o.refine?.outputs ?? {})) {
      if (!items[it]) E(f, o.id, `refine.outputs: Item "${it}" existiert nicht`);
      else if (items[it].kind !== 'mineral') E(f, o.id, `refine.outputs: ${it} ist kein Mineral`);
    }
    if (o.refine?.skill && !skills[o.refine.skill]) E(f, o.id, `refine.skill "${o.refine.skill}" existiert nicht`);
    if (o.refine?.skill && skills[o.refine.skill]?.group !== 'science') E(f, o.id, 'refine.skill sollte ein Wissenschafts-Skill sein');
  }
  for (const it of L.items) {
    if (it.kind === 'skillbook') {
      const sk = skills['skill.' + it.id.replace(/^item\.skillbook_/, '')];
      if (!sk) E('items.json', it.id, 'Skillbuch verweist auf keinen existierenden Skill (item.skillbook_<name> ↔ skill.<name>)');
      else if (sk.price !== it.basePrice) E('items.json', it.id, `basePrice ${it.basePrice} ≠ Skillpreis ${sk.price}`);
    }
  }
  const lootRef = (file, id, loot) => { for (const l of loot ?? []) if (!items[l.item]) E(file, id, `loot: Item "${l.item}" existiert nicht`); };

  // --- 7. Systeme --------------------------------------------------------
  const stationsByCorp = {};
  for (const sys of L.systems) {
    const f = 'systems.json';
    const cels = sys.celestials ?? [];
    const byId = Object.fromEntries(cels.map((c) => [c.id, c]));
    if (Math.round(sys.security * 10) / 10 !== sys.security) E(f, sys.id, 'security muss eine Dezimalstelle haben');
    if (cels.filter((c) => c.type === 'star').length !== 1) E(f, sys.id, 'genau ein Stern erwartet');
    const planets = cels.filter((c) => c.type === 'planet').length;
    if (planets < 3 || planets > 7) E(f, sys.id, `${planets} Planeten (erlaubt 3–7)`);
    const stations = cels.filter((c) => c.type === 'station');
    if (stations.length < 1 || stations.length > 2) E(f, sys.id, `${stations.length} Stationen (erlaubt 1–2)`);
    if (stations.length === 2 && JSON.stringify([...stations[0].services].sort()) === JSON.stringify([...stations[1].services].sort())) E(f, sys.id, 'Stationen mit identischen services');
    if (!(sys.fields.length >= 2 && sys.fields.length <= 5)) E(f, sys.id, `${sys.fields.length} Felder (erlaubt 2–5)`);
    const fieldIds = new Set(sys.fields.map((x) => x.id));
    const usedFields = new Set();
    for (const c of cels) {
      if (c.type === 'station') {
        const p = byId[c.parent];
        if (!p || !['planet', 'moon'].includes(p.type)) E(f, c.id, 'Station braucht parent (planet|moon) im selben System');
        if (!c.services?.length) E(f, c.id, 'Station ohne services');
        if (!c.owner) E(f, c.id, 'Station ohne owner'); else { (stationsByCorp[c.owner] ??= []).push(c); if (!strings[c.owner]) E(f, c.id, `owner "${c.owner}" ohne i18n-Eintrag`); }
      }
      if (c.type === 'moon' && byId[c.parent]?.type !== 'planet') E(f, c.id, 'Mond braucht parent (planet)');
      if (c.type === 'belt' || c.type === 'anomaly') {
        if (!fieldIds.has(c.fieldId)) E(f, c.id, `fieldId "${c.fieldId}" existiert nicht in ${sys.id}`);
        else { if (usedFields.has(c.fieldId)) E(f, c.id, `fieldId ${c.fieldId} mehrfach verwendet`); usedFields.add(c.fieldId); }
      }
      if (c.type === 'gate') {
        const tgt = data.systems[c.to];
        const back = data.celestials[c.toGate];
        if (!tgt) E(f, c.id, `Tor-Ziel ${c.to} existiert nicht`);
        else if (!back) E(f, c.id, `Gegentor ${c.toGate} existiert nicht`);
        else {
          if (back.type !== 'gate') E(f, c.id, `${c.toGate} ist kein Tor`);
          if (back.systemId !== c.to) E(f, c.id, `Gegentor ${c.toGate} liegt nicht in ${c.to}`);
          if (back.to !== sys.id) E(f, c.id, `Gegentor ${c.toGate} führt nach ${back.to} statt ${sys.id}`);
          if (back.toGate !== c.id) E(f, c.id, `Gegentor ${c.toGate} verweist auf ${back.toGate} statt auf ${c.id}`);
        }
      }
    }
    for (const fl of sys.fields) {
      if (!usedFields.has(fl.id)) E(f, fl.id, 'Feld hat keinen Gürtel/keine Anomalie');
      if (fl.hidden && fl.kind !== 'anomaly') E(f, fl.id, 'versteckte Felder müssen kind "anomaly" sein');
      if (fl.asteroidCount[0] > fl.asteroidCount[1] || fl.sizeM3[0] > fl.sizeM3[1]) E(f, fl.id, 'Bereich min > max');
      for (const oid of Object.keys(fl.oreWeights)) {
        const o = ores[oid];
        if (!o) { E(f, fl.id, `oreWeights: Erz "${oid}" existiert nicht`); continue; }
        if (sys.security < o.securityBand[0] || sys.security > o.securityBand[1]) E(f, fl.id, `Erz ${oid} (Band ${o.securityBand.join('–')}) passt nicht zu Sicherheit ${sys.security}`);
      }
    }
  }
  // Zusammenhang (BFS ab Startsystem)
  const start = data.balance.startSystem;
  if (data.systems[start]) {
    const seen = new Set([start]); const q = [start];
    while (q.length) {
      const cur = q.shift();
      for (const c of data.systems[cur].celestials) if (c.type === 'gate' && data.systems[c.to] && !seen.has(c.to)) { seen.add(c.to); q.push(c.to); }
    }
    for (const s of L.systems) if (!seen.has(s.id)) E('systems.json', s.id, `nicht vom Startsystem ${start} aus erreichbar`);
  }

  // --- 8. NPCs, Missionen ------------------------------------------------
  for (const n of L.npcs) lootRef('npcs.json', n.id, n.loot);
  const perLevel = [0, 0, 0, 0];
  const bal = data.balance;
  for (const m of L.missions) {
    const f = 'missions.json';
    if (m.level < 1 || m.level > 4) { E(f, m.id, `Stufe ${m.level} ungültig (1–4)`); continue; }
    perLevel[m.level - 1]++;
    if (!m.id.startsWith(`msn.l${m.level}.`)) E(f, m.id, `ID passt nicht zu Stufe ${m.level}`);
    for (const w of m.waves ?? []) for (const n of w.npcs) if (!npcs[n.id]) E(f, m.id, `NPC "${n.id}" existiert nicht`);
    lootRef(f, m.id, m.loot);
    const [lo, hi] = LEVEL_CLASSES[m.level - 1];
    if (m.requires?.minClass !== lo || m.requires?.maxClass !== hi) E(f, m.id, `Stufe ${m.level} verlangt Klassen ${lo}–${hi} (ist ${m.requires?.minClass}–${m.requires?.maxClass})`);
    const st = bal.missions?.standingRequired?.[m.level - 1];
    if (st !== undefined && m.requires?.standing !== st) E(f, m.id, `Standing ${m.requires?.standing} ≠ balance.missions.standingRequired[${m.level - 1}] = ${st}`);
    if (m.reward?.isk?.[0] > m.reward?.isk?.[1]) E(f, m.id, 'reward.isk: min > max');
    const stn = (stationsByCorp[m.agentCorp] ?? []).filter((c) => c.services.includes('missions'));
    if (!stn.length) E(f, m.id, `agentCorp ${m.agentCorp} besitzt keine Station mit Service "missions"`);
    // Schwierigkeit: Klassen der NPCs
    const maxNpc = Math.max(...(m.waves ?? []).flatMap((w) => w.npcs.map((n) => CLASS_ORDER.indexOf(npcs[n.id]?.class ?? 'frigate'))));
    if (maxNpc > m.level) E(f, m.id, `NPC-Klasse zu hoch für Stufe ${m.level}`);
  }
  perLevel.forEach((n, i) => { if (n < 6) E('missions.json', null, `Stufe ${i + 1} hat nur ${n} Missionen (mind. 6)`); });
  if (L.npcs.length < 12) E('npcs.json', null, `nur ${L.npcs.length} NPCs (mind. 12)`);
  for (const c of CLASS_ORDER) if (!L.npcs.some((n) => n.class === c)) E('npcs.json', null, `keine NPCs der Klasse ${c}`);

  // --- 9. Balance / Spielstart -------------------------------------------
  const bf = 'balance.json';
  const ship = ships[bal.startShip];
  if (!ship) E(bf, 'startShip', `${bal.startShip} existiert nicht`);
  const station = data.celestials[bal.startStation];
  if (!station || station.type !== 'station') E(bf, 'startStation', `${bal.startStation} ist keine Station`);
  else {
    if (station.systemId !== bal.startSystem) E(bf, 'startStation', `Station liegt in ${station.systemId}, nicht in startSystem ${bal.startSystem}`);
    for (const s of ['market', 'hangar']) if (!station.services.includes(s)) E(bf, 'startStation', `Startstation braucht Service ${s}`);
  }
  if (!data.systems[bal.startSystem]) E(bf, 'startSystem', `${bal.startSystem} existiert nicht`);
  checkReq(bf, 'startSkills', bal.startSkills, 'startSkills');
  if (ship) for (const [sid, lvl] of Object.entries(ship.requires)) if ((bal.startSkills?.[sid] ?? 0) < lvl) E(bf, 'startSkills', `Startschiff verlangt ${sid} ${lvl}`);
  const att = bal.attributes;
  if (att) {
    const vals = Object.values(att.start ?? {});
    if (sum(vals) !== att.total) E(bf, 'attributes', `Startattribute summieren sich auf ${sum(vals)} statt ${att.total}`);
    if (vals.some((v) => v < att.min || v > att.max)) E(bf, 'attributes', 'Startattribut außerhalb min/max');
  }
  if (JSON.stringify(bal.missions?.levelHourlyRatio) !== JSON.stringify([1, 3, 7.5, 30])) E(bf, 'missions', 'levelHourlyRatio muss [1,3,7.5,30] sein');
  if (JSON.stringify(bal.missions?.standingRequired) !== JSON.stringify([0, 1, 3, 5])) E(bf, 'missions', 'standingRequired muss [0,1,3,5] sein');
  if (bal.speeds && !(bal.speeds[0] === 0 && bal.speeds.every((v, i, a) => i === 0 || v > a[i - 1]))) E(bf, 'speeds', 'speeds muss mit 0 beginnen und aufsteigen');
  if (ship?.slots && ship.hardpoints && ship.fitting && bal.startFitting) fitCheck(bf, 'startFitting', ship, bal.startFitting, bal.startSkills, true);

  function fitCheck(file, label, shipDef, fit, haveSkills, checkSkills) {
    let pg = 0, cpu = 0, cal = 0, turret = 0, launcher = 0;
    for (const slot of SLOTS) {
      const list = fit[slot] ?? [];
      if (list.length > shipDef.slots[slot]) E(file, label, `${slot}: ${list.length} Einträge, Schiff hat ${shipDef.slots[slot]} Slots`);
      list.forEach((mid, i) => {
        if (mid === null || mid === undefined) return;
        const m = modules[mid];
        if (!m) { E(file, label, `${slot}[${i}]: Modul "${mid}" existiert nicht`); return; }
        if (m.slot !== slot) E(file, label, `${slot}[${i}]: ${mid} hat Slot-Typ ${m.slot} (falsche Position)`);
        if (m.size !== SIZE_OF_HULL[shipDef.hull]) E(file, label, `${slot}[${i}]: ${mid} hat Größe ${m.size}, Rumpf ist ${shipDef.hull}`);
        pg += m.fitting?.powergrid ?? 0; cpu += m.fitting?.cpu ?? 0; cal += m.fitting?.calibration ?? 0;
        if (m.hardpoint === 'turret') turret++;
        if (m.hardpoint === 'launcher') launcher++;
        if (checkSkills) for (const [sid, lvl] of Object.entries(m.requires)) if ((haveSkills?.[sid] ?? 0) < lvl) E(file, label, `${mid} verlangt ${sid} ${lvl}`);
      });
    }
    if (pg > shipDef.fitting.powergrid) E(file, label, `Powergrid ${pg} > ${shipDef.fitting.powergrid}`);
    if (cpu > shipDef.fitting.cpu) E(file, label, `CPU ${cpu} > ${shipDef.fitting.cpu}`);
    if (cal > shipDef.fitting.calibration) E(file, label, `Calibration ${cal} > ${shipDef.fitting.calibration}`);
    if (turret > shipDef.hardpoints.turret) E(file, label, `Turret-Hardpoints ${turret} > ${shipDef.hardpoints.turret}`);
    if (launcher > shipDef.hardpoints.launcher) E(file, label, `Launcher-Hardpoints ${launcher} > ${shipDef.hardpoints.launcher}`);
    return { pg, cpu, cal, turret, launcher };
  }
  // Referenz-Fittings: jedes Schiff muss sinnvoll ausrüstbar sein
  for (const s of L.ships) {
    const fit = REFERENCE_FITS[s.id];
    if (!s.slots || !s.hardpoints || !s.fitting) continue;
    if (!fit) { W('validate-data', s.id, 'kein Referenz-Fitting in REFERENCE_FITS'); continue; }
    fitCheck('validate-data', `Referenz-Fitting ${s.id}`, s, fit, null, false);
  }

  // --- 10. Erreichbarkeit über Skills ------------------------------------
  for (const s of L.ships) for (const sid of Object.keys(requirementClosure(skills, s.requires))) if (!skills[sid]) E('ships.json', s.id, `Skill ${sid} nicht erreichbar`);
  const sourced = new Set([...L.ships.flatMap((s) => Object.keys(s.requires)), ...L.modules.flatMap((m) => Object.keys(m.requires))]);
  for (const sk of L.skills) if (!sourced.size && !sk) E('skills.json', sk.id, 'unerreichbar');

  // --- 11. i18n-Abdeckung ------------------------------------------------
  const need = (key, where) => { if (!(key in strings)) E('i18n/de.json', null, `Schlüssel "${key}" fehlt (${where})`); };
  for (const s of L.stats) need(`stat.${s.id}`, 'Stat');
  for (const g of SKILL_GROUPS) need(`skillgroup.${g}`, 'Skill-Gruppe');
  for (const g of moduleGroups) need(`modgroup.${g}`, 'Modul-Gruppe');
  for (const c of new Set(L.ships.map((s) => s.class))) need(`class.${c}`, 'Schiffsklasse');
  for (const c of new Set(L.ships.map((s) => s.category))) need(`category.${c}`, 'Schiffskategorie');
  for (const sv of SERVICES) need(`service.${sv}`, 'Service');
  for (const sl of SLOTS) need(`slot.${sl}`, 'Slot');
  for (const s of L.systems) need(`region.${s.region}`, 'Region');

  return { errors, warnings, data };
}

// ---------------------------------------------------------------- Dateisystem
export function readRepo(root = DEFAULT_ROOT) {
  const rd = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
  const manifest = rd('data/manifest.json');
  const files = {};
  const problems = [];
  for (const f of manifest.files) {
    try { files[f] = rd(`data/${f}`); } catch (err) { problems.push(`[${f}] nicht lesbar: ${err.message}`); }
  }
  const ext = [];
  const extDir = join(root, 'data/ext');
  if (existsSync(extDir)) for (const n of readdirSync(extDir).filter((x) => x.endsWith('.json')).sort()) {
    try { ext.push({ path: `ext/${n}`, json: rd(`data/ext/${n}`) }); } catch (err) { problems.push(`[ext/${n}] nicht lesbar: ${err.message}`); }
  }
  const schemas = {};
  const sdir = join(root, 'data/schema');
  if (existsSync(sdir)) for (const n of readdirSync(sdir).filter((x) => x.endsWith('.schema.json'))) schemas[n.replace('.schema.json', '')] = rd(`data/schema/${n}`);
  return { bundle: { manifest, files, ext, schemas }, problems };
}

// ---------------------------------------------------------------- Balance-Bericht
/** Berechnet die Balance-Kennzahlen aus den Daten (Näherungsmodell, siehe docs/handoff/a2.md). */
export function balanceReport(data) {
  const { ships, modules, skills, ores, items } = data;
  const bal = data.balance;
  const tph = bal.economy?.ticksPerHour ?? 60;
  const fee = bal.market.feeBase;
  const R = {};
  const lv = (levels, id) => levels[id] ?? 0;
  // Abbau-Rate in m³/Tick für ein Referenz-Fitting
  const mineRate = (shipId, levels) => {
    const ship = ships[shipId]; const fit = REFERENCE_FITS[shipId];
    let perTick = 0; const mults = [];
    for (const mid of [...fit.high]) {
      const m = modules[mid]; if (m?.activation?.kind !== 'mine') continue;
      perTick += m.activation.yieldM3 / m.activation.cycleTicks;
    }
    let mult = 1;
    for (const [sid, l] of Object.entries(levels)) for (const fx of skills[sid]?.effects ?? []) if (fx.stat === 'mining_yield' && fx.op === 'mul') mult *= 1 + fx.perLevel * l;
    for (const b of ship.bonuses) if (b.stat === 'mining_yield') mult *= 1 + b.perLevel * lv(levels, b.skill);
    for (const r of ship.roleBonuses) if (r.stat === 'mining_yield') mult *= r.value;
    const stack = []; for (const mid of [...fit.low, ...fit.rig]) for (const fx of modules[mid]?.effects ?? []) if (fx.stat === 'mining_yield') stack.push(fx.value);
    stack.sort((a, b) => b - a).forEach((v, i) => { mult *= 1 + (v - 1) * Math.exp(-((i / 2.67) ** 2)); });
    return perTick * mult;
  };
  const field = (fid) => data.fields[fid];
  const iskPerM3 = (fid) => {
    const w = field(fid).oreWeights; const tot = sum(Object.values(w));
    return sum(Object.entries(w).map(([o, x]) => x * ores[o].basePrice / ores[o].volumeM3)) / tot;
  };
  const start = bal.startSkills;
  const startRate = mineRate(bal.startShip, { ...start });
  // Startfitting (2 Miner) statt Referenz
  const sf = bal.startFitting; let base = 0; for (const mid of sf.high) if (mid && modules[mid].activation?.kind === 'mine') base += modules[mid].activation.yieldM3 / modules[mid].activation.cycleTicks;
  const sShip = ships[bal.startShip];
  let mult = 1;
  for (const [sid, l] of Object.entries(start)) for (const fx of skills[sid]?.effects ?? []) if (fx.stat === 'mining_yield') mult *= 1 + fx.perLevel * l;
  for (const b of sShip.bonuses) if (b.stat === 'mining_yield') mult *= 1 + b.perLevel * (start[b.skill] ?? 0);
  for (const r of sShip.roleBonuses) if (r.stat === 'mining_yield') mult *= r.value;
  const m3Tick = base * mult;
  const belt = 'field.aldara.belt1';
  R.starter = { m3PerTick: m3Tick, iskPerM3: iskPerM3(belt), grossPerTick: m3Tick * iskPerM3(belt), grossPerHour: m3Tick * iskPerM3(belt) * tph, netPerHour: m3Tick * iskPerM3(belt) * tph * (1 - fee), ticksPerHour: tph, holdFillTicks: sShip.attributes.ore_hold / m3Tick };
  R.starter.netPerRealHour1x = R.starter.netPerTick = m3Tick * iskPerM3(belt) * (1 - fee);
  R.starter.netPerRealHour1x = R.starter.netPerTick * (3600000 / bal.liveTickMs);
  // alle Bergbauschiffe, Stufe 1 und Stufe 5 der Bergbau-Skills
  R.mining = Object.values(ships).filter((s) => s.category === 'mining').map((s) => {
    const hold = s.attributes.ore_hold;
    const lowL = { 'skill.mining': 1, 'skill.mining_frigate': 1, 'skill.astrogeology': 0 };
    const hiL = { 'skill.mining': 5, 'skill.mining_frigate': 5, 'skill.astrogeology': 5, 'skill.digger_command': 5, 'skill.delver_command': 5, 'skill.vault_command': 5, 'skill.bulwark_command': 5 };
    const lowRate = mineRate(s.id, { ...lowL, ...(s.id === 'ship.pebble' ? {} : { [s.bonuses[0]?.skill]: 1 }) });
    const hiRate = mineRate(s.id, hiL);
    return { id: s.id, m3Tick1: lowRate, m3Tick5: hiRate, iskHour1: lowRate * iskPerM3(belt) * tph * (1 - fee), iskHour5: hiRate * iskPerM3(belt) * tph * (1 - fee), hold, fillTicks1: hold / lowRate };
  });
  // Missionen (Referenzmodell)
  const refDps = bal.economy.missionRefDps, over = bal.economy.missionOverheadTicks;
  const avg4 = (r) => (r.em + r.th + r.kin + r.exp) / 4;
  const ehp = (n) => n.shield_hp / (1 - avg4(n.res.shield)) + n.armor_hp / (1 - avg4(n.res.armor)) + n.structure_hp;
  const price = (id) => items[id]?.basePrice ?? 0;
  const lvl = [0, 1, 2, 3].map(() => ({ n: 0, ticks: 0, total: 0 }));
  R.missions = data.lists.missions.map((m) => {
    const l = m.level - 1; let t = over[l], bounty = 0, loot = 0;
    for (const w of m.waves) for (const { id, count } of w.npcs) { const n = data.npcs[id]; for (let i = 0; i < count; i++) { t += ehp(n) / refDps[l]; bounty += n.bounty; for (const x of n.loot) loot += x.chance * (x.qty[0] + x.qty[1]) / 2 * price(x.item); } }
    for (const x of m.loot) loot += x.chance * (x.qty[0] + x.qty[1]) / 2 * price(x.item);
    const isk = (m.reward.isk[0] + m.reward.isk[1]) / 2; const total = isk + bounty + loot;
    lvl[l].n++; lvl[l].ticks += t; lvl[l].total += total;
    return { id: m.id, level: m.level, ticks: t, total, hourly: total * 60 / t };
  });
  const hourly = lvl.map((x) => x.total / x.ticks * 60);
  R.missionHourly = hourly; R.missionRatio = hourly.map((h) => h / hourly[0]);
  // Skillpunkte
  const sp = (rank, L) => spForLevel(rank, L, bal.skills.baseSp, bal.skills.levelExponent);
  R.spRank1 = [1, 2, 3, 4, 5].map((L) => sp(1, L));
  const att = bal.attributes.start;
  const spTick = (s) => att[s.primary] + att[s.secondary] / 2;
  // Aufstiegspfad zu einem Schiff: nötige Skills (Gesamt-SP/Zeit/Bücher) abzüglich Startskills
  R.path = (shipId) => {
    const ship = ships[shipId]; const need = requirementClosure(skills, ship.requires);
    let sps = 0, ticks = 0, books = 0; const list = [];
    for (const [sid, L] of Object.entries(need)) {
      const have = start[sid] ?? 0; if (have >= L) continue;
      const s = skills[sid]; const gain = sp(s.rank, L) - (have ? sp(s.rank, have) : 0);
      sps += gain; ticks += gain / spTick(s); if (!have) books += s.price; list.push(`${sid.slice(6)} ${L}`);
    }
    const fit = REFERENCE_FITS[shipId]; let fitCost = 0; for (const slot of SLOTS) for (const mid of fit[slot]) fitCost += modules[mid].price;
    return { ship: shipId, shipPrice: ship.price, skillBooks: books, fitCost, totalIsk: ship.price + books + fitCost, sp: sps, trainingTicks: ticks, trainingRealHours1x: ticks * bal.liveTickMs / 3600000, skills: list };
  };
  return R;
}

// ---------------------------------------------------------------- CLI
function printReport(R, data) {
  const f = (n, d = 0) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: d });
  console.log('\n=== Balance-Bericht (1 Stunde = ' + R.starter.ticksPerHour + ' Ticks) ===');
  console.log(`Starter-Bergbau (${data.balance.startShip}, Aldara Gürtel 1): ${f(R.starter.m3PerTick, 3)} m³/Tick, ${f(R.starter.iskPerM3, 1)} ISK/m³`);
  console.log(`  brutto ${f(R.starter.grossPerHour)} ISK/h, netto nach ${data.balance.market.feeBase * 100} % Gebühr ${f(R.starter.netPerHour)} ISK/h; Erzhalle voll nach ${f(R.starter.holdFillTicks)} Ticks`);
  console.log(`  bei liveTickMs ${data.balance.liveTickMs} (1x): ${f(R.starter.netPerRealHour1x)} ISK pro Echtstunde`);
  console.log('Bergbauschiffe (Referenz-Fitting, Aldara Gürtel 1, ISK/h netto):');
  for (const m of R.mining) console.log(`  ${m.id.padEnd(14)} Skills I: ${f(m.m3Tick1, 2).padStart(6)} m³/Tick ${f(m.iskHour1).padStart(8)} ISK/h | Skills V: ${f(m.m3Tick5, 2).padStart(6)} m³/Tick ${f(m.iskHour5).padStart(8)} ISK/h | Halle ${f(m.hold).padStart(6)} m³, voll nach ${f(m.fillTicks1)} Ticks`);
  console.log('Missionen (Stundenertrag aus Kopfgeld+ISK+Beute, Referenzmodell):');
  R.missionHourly.forEach((h, i) => console.log(`  Stufe ${i + 1}: ${f(h).padStart(8)} ISK/h  Verhältnis ${f(R.missionRatio[i], 2)}`));
  console.log('Skillpunkte Rank 1, Stufe I–V: ' + R.spRank1.map((x) => f(x)).join(' / '));
  for (const id of ['ship.dart', 'ship.digger', 'ship.delver', 'ship.warden', 'ship.bastion', 'ship.sovereign']) {
    const p = R.path(id);
    console.log(`Pfad ${id}: Schiff ${f(p.shipPrice)} + Bücher ${f(p.skillBooks)} + Fitting ${f(p.fitCost)} = ${f(p.totalIsk)} ISK; ${f(p.sp)} SP = ${f(p.trainingTicks)} Ticks = ${f(p.trainingRealHours1x, 1)} h bei 1x`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const rootIdx = args.indexOf('--root');
  const root = rootIdx >= 0 ? resolve(args[rootIdx + 1]) : DEFAULT_ROOT;
  const { bundle, problems } = readRepo(root);
  const { errors, warnings, data } = validateBundle(bundle);
  problems.forEach((p) => errors.push(p));
  warnings.forEach((w) => console.warn(`WARN  ${w}`));
  errors.forEach((e) => console.error(`FEHLER ${e}`));
  const c = data.lists;
  console.log(`\nGeprüft: ${c.ships.length} Schiffe, ${c.modules.length} Module, ${c.skills.length} Skills, ${c.ores.length} Erze, ${c.items.length} Items, ${c.systems.length} Systeme, ${c.missions.length} Missionen, ${c.npcs.length} NPCs.`);
  if (args.includes('--report') && !errors.length) printReport(balanceReport(data), data);
  if (errors.length) { console.error(`\n${errors.length} Fehler, ${warnings.length} Warnungen – Daten ungültig.`); process.exit(1); }
  console.log(`OK – keine Fehler, ${warnings.length} Warnungen.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
