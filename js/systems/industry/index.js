// System "industry": Module aus Mineralien herstellen (MASTER_PLAN 4.7, vereinfacht ohne Blaupausen).
// Rezept je Modul: Mineralien im Wert von ~55 % des Modulpreises, Bauzeit wächst mit dem Preis. Skill „Industrie“ (Stufe 1) erforderlich.

const fail = (error, message) => ({ ok: false, error, message });
const dockedId = (state) => state.pilot.location.dockedStationId;
const stockOf = (state, id) => (state.assets.stations[id] ??= { items: {} }).items;
const levelOf = (state, id) => state.pilot.skills?.[id]?.level ?? 0;
const SHARES = [['item.tritanium', 0.6], ['item.pyerite', 0.3], ['item.mexallon', 0.1]];
export const INDUSTRY_SKILL = 'skill.industry';

export function recipeFor(data, mod, level = 0) {
  const value = mod.price * 0.55;
  const inputs = {};
  for (const [id, share] of SHARES) {
    const p = data.items?.[id]?.basePrice;
    const n = p ? Math.ceil((value * share) / p) : 0;
    if (n > 0) inputs[id] = n;
  }
  const ticks = Math.max(5, Math.min(240, Math.round(Math.sqrt(mod.price) / 4)));
  return { inputs, ticks: Math.max(3, Math.round(ticks * (1 - 0.04 * level))) };
}
const slotsFor = (state) => 1 + Math.floor(levelOf(state, INDUSTRY_SKILL) / 2);

export const system = {
  id: 'industry',
  init(ctx) { ctx.state.industry ??= { jobs: [], seq: 0 }; },
  actions: {
    'industry/start': (ctx, p) => {
      const { state, data } = ctx;
      const mod = data.modules[p?.moduleId];
      const station = dockedId(state);
      if (!mod || !(mod.price > 0)) return fail('industry.unknown', 'Dieses Modul lässt sich nicht herstellen.');
      if (!station) return fail('industry.not_docked', 'Herstellung nur in Stationen.');
      if (!data.celestials[station]?.services?.includes('industry')) return fail('industry.no_factory', 'Diese Station hat keine Fabrik.');
      const lvl = levelOf(state, INDUSTRY_SKILL);
      if (data.skills[INDUSTRY_SKILL] && lvl < 1) return fail('industry.skill', 'Dir fehlt der Skill Industrie (Stufe 1).');
      if (state.industry.jobs.length >= slotsFor(state)) return fail('industry.no_slot', 'Alle Fabrik-Plätze sind belegt.');
      const r = recipeFor(data, mod, lvl);
      const stock = stockOf(state, station);
      const lack = Object.entries(r.inputs).filter(([id, n]) => (stock[id] ?? 0) < n);
      if (lack.length) return fail('industry.materials', `Es fehlen Mineralien: ${lack.map(([id, n]) => `${n - (stock[id] ?? 0)} ${data.items[id].name}`).join(', ')}.`);
      for (const [id, n] of Object.entries(r.inputs)) stock[id] -= n;
      const job = { id: `j${++state.industry.seq}`, moduleId: mod.id, stationId: station, ticksLeft: r.ticks, ticksTotal: r.ticks, inputs: r.inputs };
      state.industry.jobs.push(job);
      ctx.log(`Herstellung gestartet: ${mod.name} (${r.ticks} Ticks).`);
      ctx.emit('industry/started', { name: mod.name });
      return { ok: true, id: job.id };
    },
    'industry/cancel': (ctx, p) => {
      const { state } = ctx;
      const i = state.industry.jobs.findIndex((j) => j.id === p?.id);
      if (i < 0) return fail('industry.unknown_job', 'Auftrag nicht gefunden.');
      const job = state.industry.jobs[i];
      const stock = stockOf(state, job.stationId);
      for (const [id, n] of Object.entries(job.inputs)) stock[id] = (stock[id] ?? 0) + n;
      state.industry.jobs.splice(i, 1);
      ctx.log('Herstellung abgebrochen, Mineralien zurück im Lager.');
      return { ok: true };
    }
  },
  onTick(ctx) {
    const { state, data } = ctx;
    state.industry ??= { jobs: [], seq: 0 };
    for (const job of [...state.industry.jobs]) {
      job.ticksLeft -= 1;
      if (job.ticksLeft > 0) continue;
      const stock = stockOf(state, job.stationId);
      stock[job.moduleId] = (stock[job.moduleId] ?? 0) + 1;
      state.industry.jobs = state.industry.jobs.filter((j) => j.id !== job.id);
      const name = data.modules[job.moduleId]?.name ?? job.moduleId;
      ctx.log(`Fertig: ${name} liegt im Stationslager von ${data.celestials[job.stationId]?.name ?? job.stationId}.`, 'good');
      ctx.emit('industry/done', { name });
    }
  },
  selectors: {
    'industry/jobs': (state, data) => (state.industry?.jobs ?? []).map((j) => ({ id: j.id, name: data.modules[j.moduleId]?.name ?? j.moduleId, stationName: data.celestials[j.stationId]?.name ?? j.stationId,
      ticksLeft: j.ticksLeft, ticksTotal: j.ticksTotal, pct: 1 - j.ticksLeft / j.ticksTotal })),
    'industry/slots': (state) => ({ used: state.industry?.jobs.length ?? 0, max: slotsFor(state), skillLevel: levelOf(state, INDUSTRY_SKILL) }),
    /** Rezeptliste: { slot?, search? } -> [{ moduleId, name, slot, size, category, price, ticks, inputs[{itemId,name,need,have,ok}], canStart }] */
    'industry/recipes': (state, data, args) => {
      const station = dockedId(state);
      const stock = station ? stockOf(state, station) : {};
      const lvl = levelOf(state, INDUSTRY_SKILL);
      const q = (args?.search ?? '').toLowerCase();
      return data.lists.modules.filter((m) => m.price > 0 && (!args?.slot || m.slot === args.slot) && (!q || m.name.toLowerCase().includes(q))).map((m) => {
        const r = recipeFor(data, m, lvl);
        const inputs = Object.entries(r.inputs).map(([itemId, need]) => ({ itemId, name: data.items[itemId].name, need, have: stock[itemId] ?? 0, ok: (stock[itemId] ?? 0) >= need }));
        return { moduleId: m.id, name: m.name, slot: m.slot, size: m.size, category: m.category, price: m.price, ticks: r.ticks, inputs, canStart: inputs.every((x) => x.ok) };
      }).sort((a, b) => a.price - b.price);
    }
  }
};
