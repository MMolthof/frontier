// System "refine": Erz im Stationslager zu Mineralien raffinieren (MASTER_PLAN 5.5).
// Ausbeute = stationBase · (1 + 0,03·Reprocessing) · (1 + 0,02·Refinery Efficiency) · (1 + 0,02·erzspezifischer Skill), abzüglich Steuer.

const fail = (error, message) => ({ ok: false, error, message });
const dockedId = (state) => state.pilot.location.dockedStationId;
const stockOf = (state, id) => (state.assets.stations[id] ??= { items: {} }).items;
const lvl = (state, id) => (id ? state.pilot.skills?.[id]?.level ?? 0 : 0);

export function efficiency(state, data, ore) {
  const rb = data.balance.refine;
  return rb.stationBase * (1 + rb.perReprocessing * lvl(state, 'skill.reprocessing')) * (1 + rb.perRefineryEfficiency * lvl(state, 'skill.refinery_efficiency')) * (1 + rb.perOreSkill * lvl(state, ore.refine?.skill));
}

function plan(state, data, oreId, units) {
  const ore = data.ores[oreId];
  const batch = ore.refine.batch;
  const batches = Math.floor(units / batch);
  const eff = efficiency(state, data, ore);
  const outputs = {};
  for (const [itemId, qty] of Object.entries(ore.refine.outputs)) outputs[itemId] = Math.floor(batches * qty * eff * (1 - data.balance.refine.tax));
  return { ore, batches, batchSize: batch, consumed: batches * batch, efficiency: eff, outputs };
}

export const system = {
  id: 'refine',
  actions: {
    'refine/run': (ctx, p) => {
      const { state, data } = ctx;
      const station = dockedId(state);
      if (!station) return fail('refine.not_docked', 'Raffinerie nur in Stationen.');
      if (!data.celestials[station]?.services?.includes('refinery')) return fail('refine.no_refinery', 'Diese Station hat keine Raffinerie.');
      if (!data.ores?.[p?.oreId]) return fail('refine.bad_ore', 'Unbekanntes Erz.');
      const have = stockOf(state, station)[p.oreId] ?? 0;
      const r = plan(state, data, p.oreId, Math.min(have, Math.floor(p?.units ?? have)));
      if (r.batches <= 0) return fail('refine.too_little', `Mindestens ${r.batchSize} Einheiten ${r.ore.name} im Stationslager nötig.`);
      const stock = stockOf(state, station);
      stock[p.oreId] = have - r.consumed;
      for (const [itemId, n] of Object.entries(r.outputs)) stock[itemId] = (stock[itemId] ?? 0) + n;
      ctx.log(`${r.consumed} ${r.ore.name} raffiniert (Ausbeute ${(r.efficiency * 100).toFixed(0)} %).`, 'good');
      ctx.emit('refine/done', { oreId: p.oreId, outputs: r.outputs });
      return { ok: true, outputs: r.outputs };
    }
  },
  selectors: {
    'refine/preview': (state, data, args) => {
      const ore = data.ores?.[args?.oreId];
      if (!ore) return null;
      const station = dockedId(state);
      const units = Math.floor(args?.units ?? (station ? stockOf(state, station)[ore.id] ?? 0 : 0));
      const r = plan(state, data, ore.id, units);
      return { batches: r.batches, batchSize: r.batchSize, consumed: r.consumed, efficiency: r.efficiency, outputs: r.outputs };
    },
    'refine/efficiency': (state, data, args) => (data.ores?.[args?.oreId] ? efficiency(state, data, data.ores[args.oreId]) : null)
  }
};
