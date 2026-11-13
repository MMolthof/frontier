// calcShipStats(ship, pilot, data): Stat-Pipeline nach MASTER_PLAN 5.2 und Regeln 3.8.
// Rein, deterministisch, DOM-frei (wird von A7/A9/A10 importiert).
//
// Reihenfolge je Stat: Basis → Rumpfboni → Rollenboni → Modul-add → set → Modul-mul (Stacking-Penalty)
// → Skill-Effekte (nie bestraft). Effekte mit appliesTo.moduleGroup wirken nur auf Module dieser Gruppe.

import { SLOTS, collectFitErrors, levelOf } from './errors.js';

/** Gewicht des i-ten Effekts (i = 0…) einer Stacking-Gruppe: ≈ 1; 0,87; 0,57; 0,28; 0,11. */
export function penaltyWeight(i) {
  return Math.exp(-((i / 2.67) ** 2));
}

const round2 = (v) => Math.round(v * 100) / 100;
const MUL_STATS_BASE = 1;
const RES_TYPES = ['em', 'th', 'kin', 'exp'];
const LAYERS = ['shield', 'armor', 'structure'];
export const MAX_RESIST = 0.95;

/**
 * Fasst Effekte [{value, group}] zusammen. add → Summe, mul → Faktor.
 * Effekte mit gleicher Gruppe werden nach |Stärke| absteigend sortiert und bestraft.
 */
export function combineEffects(effects, op) {
  const free = [];
  const groups = new Map();
  for (const e of effects) {
    if (e.group) {
      if (!groups.has(e.group)) groups.set(e.group, []);
      groups.get(e.group).push(e.value);
    } else free.push(e.value);
  }
  if (op === 'add') {
    let sum = 0;
    for (const v of free) sum += v;
    for (const list of groups.values()) {
      list.sort((a, b) => Math.abs(b) - Math.abs(a)).forEach((v, i) => { sum += v * penaltyWeight(i); });
    }
    return sum;
  }
  let factor = 1;
  for (const v of free) factor *= v;
  for (const list of groups.values()) {
    list.sort((a, b) => Math.abs(b - 1) - Math.abs(a - 1)).forEach((v, i) => { factor *= 1 + (v - 1) * penaltyWeight(i); });
  }
  return factor;
}

function fittedModules(ship, data) {
  const out = [];
  for (const slot of SLOTS) {
    (ship.fitting?.[slot] ?? []).forEach((moduleId, index) => {
      const mod = moduleId ? data.modules?.[moduleId] : null;
      if (mod) out.push({ slot, index, mod });
    });
  }
  return out;
}

const applies = (effect, group) => !effect.appliesTo || (group !== undefined && effect.appliesTo.moduleGroup === group);

/** Löst einen Stat auf. group (optional) = Modulgruppe der Waffe/des Lasers für appliesTo-Effekte. */
function resolve(env, stat, base, group) {
  const { ship, modules, pilot, data } = env;
  let value = base;
  const bonusApply = (list, withSkill) => {
    for (const b of list ?? []) {
      if (b.stat !== stat || !applies(b, group)) continue;
      const amount = withSkill ? (b.perLevel ?? 0) * levelOf(pilot, b.skill) : b.value;
      if (b.op === 'mul') value *= withSkill ? 1 + amount : amount;
      else if (b.op === 'add') value += amount;
      else if (b.op === 'set') value = amount;
    }
  };
  bonusApply(ship.bonuses, true);
  bonusApply(ship.roleBonuses, false);

  const adds = [];
  const sets = [];
  const muls = [];
  for (const { mod } of modules) {
    for (const e of mod.effects ?? []) {
      if (e.stat !== stat || !applies(e, group)) continue;
      const entry = { value: e.value, group: e.stackingGroup };
      if (e.op === 'add') adds.push(entry);
      else if (e.op === 'set') sets.push(entry);
      else if (e.op === 'mul') muls.push(entry);
    }
  }
  value += combineEffects(adds, 'add');
  if (sets.length) value = sets[sets.length - 1].value;
  value *= combineEffects(muls, 'mul');

  for (const skill of Object.values(data.skills ?? {})) {
    const lvl = levelOf(pilot, skill.id);
    if (!lvl) continue;
    for (const e of skill.effects ?? []) {
      if (e.stat !== stat || !applies(e, group)) continue;
      if (e.op === 'mul') value *= 1 + e.perLevel * lvl;
      else if (e.op === 'add') value += e.perLevel * lvl;
    }
  }
  return value;
}

/** CPU-/PG-/Calibration-Verbrauch eines Moduls (Mining-Upgrades: CPU × cpu_penalty_mining_upgrade). */
export function moduleFittingCost(mod, cpuPenalty = 1) {
  const f = mod.fitting ?? {};
  return {
    powergrid: f.powergrid ?? 0,
    cpu: (f.cpu ?? 0) * (mod.group === 'mining_upgrade' ? cpuPenalty : 1),
    calibration: f.calibration ?? 0
  };
}

/**
 * Berechnet alle Werte eines Schiffs ohne Fehlerliste (interner Kern, auch für Hypothesen).
 */
export function computeStats(ship, pilot, data) {
  const type = data.ships?.[ship.typeId];
  if (!type) throw new Error(`Unbekannter Schiffstyp ${ship.typeId}`);
  const modules = fittedModules(ship, data);
  const attrs = type.attributes ?? {};
  const env = { ship: type, modules, pilot, data };
  const r = (stat, group) => resolve(env, stat, attrs[stat] ?? 0, group);
  const mulStat = (stat, group) => resolve(env, stat, MUL_STATS_BASE, group);

  // --- Fitting-Budget
  const pgBonus = mulStat('powergrid_bonus');
  const cpuBonus = mulStat('cpu_bonus');
  const cpuPenalty = mulStat('cpu_penalty_mining_upgrade');
  const calibrationMax = resolve(env, 'calibration', type.fitting?.calibration ?? 0);
  let pgUsed = 0;
  let cpuUsed = 0;
  let calUsed = 0;
  for (const { mod } of modules) {
    const c = moduleFittingCost(mod, cpuPenalty);
    pgUsed += c.powergrid;
    cpuUsed += c.cpu;
    calUsed += c.calibration;
  }
  const fitting = {
    pg: { used: round2(pgUsed), max: round2((type.fitting?.powergrid ?? 0) * pgBonus) },
    cpu: { used: round2(cpuUsed), max: round2((type.fitting?.cpu ?? 0) * cpuBonus) },
    calibration: { used: round2(calUsed), max: round2(calibrationMax) }
  };

  // --- Slots
  const used = (slot) => (ship.fitting?.[slot] ?? []).filter(Boolean).length;
  const hpUsed = { turret: 0, launcher: 0 };
  for (const { slot, mod } of modules) if (slot === 'high' && mod.hardpoint && mod.hardpoint in hpUsed) hpUsed[mod.hardpoint] += 1;
  const slots = {
    high: {
      total: type.slots?.high ?? 0,
      used: used('high'),
      hardpoints: {
        turret: { used: hpUsed.turret, max: type.hardpoints?.turret ?? 0 },
        launcher: { used: hpUsed.launcher, max: type.hardpoints?.launcher ?? 0 }
      }
    },
    mid: { total: type.slots?.mid ?? 0, used: used('mid') },
    low: { total: type.slots?.low ?? 0, used: used('low') },
    rig: { total: type.slots?.rig ?? 0, used: used('rig') }
  };

  // --- Verteidigung
  const defense = {};
  let ehp = 0;
  for (const layer of LAYERS) {
    const hp = Math.max(0, r(`${layer}_hp`));
    const res = {};
    for (const t of RES_TYPES) res[t] = Math.min(MAX_RESIST, Math.max(0, r(`${layer}_res_${t}`)));
    defense[layer] = { hp, res };
    const avg = RES_TYPES.reduce((s, t) => s + res[t], 0) / RES_TYPES.length;
    ehp += hp / (1 - avg);
  }
  defense.ehp = ehp;

  // --- Waffen, Mining, Reparatur, Kapazität (alle aktiven Module laufen gleichzeitig)
  const rof = mulStat('rof');
  const offense = { dps: { total: 0, em: 0, th: 0, kin: 0, exp: 0 }, rangeKm: 0, weapons: [] };
  const mining = { lasers: 0, m3PerTick: 0, oreHold: r('ore_hold'), cargo: r('cargo'), critChance: r('mining_crit_chance') };
  const repair = { shieldPerTick: 0, armorPerTick: 0 };
  let capUse = 0;
  for (const { mod } of modules) {
    const act = mod.activation;
    if (!act) continue;
    const cycle = act.cycleTicks ?? 1;
    if (act.kind === 'attack') {
      const family = mod.hardpoint === 'launcher' ? 'missile_damage' : 'turret_damage';
      const mult = mulStat(family, mod.group);
      const shots = rof / cycle;
      let dps = 0;
      for (const t of RES_TYPES) {
        const part = (act.damage?.[t] ?? 0) * mult * shots;
        offense.dps[t] += part;
        dps += part;
      }
      offense.dps.total += dps;
      offense.weapons.push({ moduleId: mod.id, dps });
      offense.rangeKm = Math.max(offense.rangeKm, (act.rangeKm ?? 0) * mulStat('weapon_range', mod.group));
      capUse += (act.capUse ?? 0) * shots;
    } else if (act.kind === 'mine') {
      mining.lasers += 1;
      mining.m3PerTick += ((act.yieldM3 ?? 0) * mulStat('mining_yield', mod.group)) / (cycle * mulStat('mining_cycle', mod.group));
      capUse += (act.capUse ?? 0) / cycle;
    } else {
      if (act.kind === 'repair') {
        const amount = act.amount ?? 0;
        if (act.repairs === 'shield') repair.shieldPerTick += (amount * mulStat('shield_boost')) / cycle;
        else if (act.repairs === 'armor') repair.armorPerTick += (amount * mulStat('armor_repair')) / cycle;
      }
      capUse += (act.capUse ?? 0) / cycle;
    }
  }

  const capMax = r('capacitor');
  const rechargeTicks = Math.max(1e-9, r('cap_recharge_ticks'));
  const rechargePerTick = capMax / rechargeTicks;
  const stable = capUse <= rechargePerTick + 1e-9;
  const capacitor = {
    max: capMax,
    rechargePerTick,
    usePerTick: capUse,
    stable,
    stableForTicks: stable ? null : Math.floor(capMax / (capUse - rechargePerTick))
  };

  const warpSpeed = r('warp_speed');
  const warpScale = data.balance?.travel?.warpScale ?? 1;
  const nav = {
    speed: r('speed'),
    warpSpeed,
    warpTicksPerAu: warpSpeed > 0 ? 1 / (warpSpeed * warpScale) : null,
    signature: r('signature'),
    maxTargets: Math.max(0, Math.floor(r('max_targets'))),
    lockRangeKm: r('lock_range_km')
  };

  return { fitting, slots, defense, offense, mining, capacitor, nav, repair };
}

/**
 * Vollständige Stats inkl. Validität (MASTER_PLAN 3.9).
 * @param {{typeId:string, fitting:object}} ship
 * @param {{skills?:Record<string,{level:number}|number>}} pilot
 * @param {object} data  Spieldaten (data.ships, data.modules, data.skills, …)
 */
export function calcShipStats(ship, pilot, data) {
  const core = computeStats(ship, pilot, data);
  const type = data.ships[ship.typeId];
  const errors = collectFitErrors({ ...ship, hull: type.hull, hardpoints: type.hardpoints }, pilot, data, core.fitting);
  return { valid: errors.length === 0, errors, ...core };
}
