// System "market": NPC-Markt je Station mit Nachfrage, Slippage und Preisverlauf (MASTER_PLAN 5.7).
// Eigener Teilbaum: world.markets[stationId][itemId] = { demand, history[] }. Handelsware: Erze und Mineralien.

const fail = (error, message) => ({ ok: false, error, message });
const dockedId = (state) => state.pilot.location.dockedStationId;
const stockOf = (state, id) => (state.assets.stations[id] ??= { items: {} }).items;

const tradables = (data) => [...Object.values(data.ores ?? {}), ...Object.values(data.items ?? {}).filter((i) => i.kind === 'mineral')];
const tradableMap = (data) => Object.fromEntries(tradables(data).map((e) => [e.id, e]));

/** Stationsabhängiger Preisfaktor 0,92–1,12, deterministisch aus der ID. */
export function stationFactor(stationId) {
  let hash = 2166136261;
  for (const ch of stationId) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  return 0.92 + (hash % 21) / 100;
}

/** Markttiefe in Einheiten: günstigere Waren vertragen größere Mengen. */
const depthOf = (entry) => Math.min(6000, Math.max(300, Math.round(40000 / entry.basePrice)));
const hasMarket = (data, stationId) => data.celestials[stationId]?.services?.includes('market');
const levelOf = (state, id) => state.pilot.skills?.[id]?.level ?? 0;
export const feeOf = (state, data) => Math.max(0, (data.balance.market.feeBase ?? 0.05) - (data.balance.market.feePerTradeLevel ?? 0.01) * levelOf(state, 'skill.trade'));

function ensureMarkets(state, data) {
  const items = tradables(data);
  for (const cel of Object.values(data.celestials)) {
    if (!hasMarket(data, cel.id)) continue;
    const market = (state.world.markets[cel.id] ??= {});
    for (const e of items) market[e.id] ??= { demand: 1, history: [] };
  }
}

/** Rückkaufpreis je Einheit für Module und handelbare Items ohne Nachfrage-Modell; 0 = nicht handelbar. */
export function fixedPrice(data, id) {
  const mb = data.balance.market ?? {};
  const mod = data.modules?.[id];
  if (mod) return mod.price > 0 ? mod.price * (mb.sellModuleFactor ?? 0.5) : 0;
  const it = data.items?.[id];
  return it && it.kind !== 'mineral' && it.kind !== 'skillbook' && it.basePrice > 0 ? it.basePrice * (mb.sellItemFactor ?? 0.7) : 0;
}
const fixedName = (data, id) => data.modules?.[id]?.name ?? data.items?.[id]?.name ?? id;

export function quote(state, data, stationId, itemId, qty) {
  if (!tradableMap(data)[itemId] && fixedPrice(data, itemId) > 0) {
    const unit = fixedPrice(data, itemId) * stationFactor(stationId);
    return { avg: unit, demandAfter: null, priceAfter: unit, net: Math.floor(qty * unit * (1 - feeOf(state, data))) };
  }
  const entry = tradableMap(data)[itemId];
  const slot = state.world.markets[stationId]?.[itemId];
  if (!entry || !slot) return null;
  const mb = data.balance.market;
  const d2 = Math.max(mb.minDemand ?? 0.4, slot.demand * (1 - qty / depthOf(entry)));
  const avg = entry.basePrice * stationFactor(stationId) * (slot.demand + d2) / 2;
  return { avg, demandAfter: d2, priceAfter: entry.basePrice * stationFactor(stationId) * d2, net: Math.floor(qty * avg * (1 - feeOf(state, data))) };
}

export const system = {
  id: 'market',
  init(ctx) { ensureMarkets(ctx.state, ctx.data); },
  actions: {
    'market/sell': (ctx, p) => {
      const { state, data } = ctx;
      const station = dockedId(state);
      if (!station) return fail('market.not_docked', 'Handel nur in Stationen.');
      if (!hasMarket(data, station)) return fail('market.no_market', 'Diese Station hat keinen Markt.');
      if (!tradableMap(data)[p?.itemId] && fixedPrice(data, p?.itemId) > 0) {
        const have = stockOf(state, station)[p.itemId] ?? 0;
        const qty = Math.min(have, Math.floor(p?.qty ?? have));
        if (qty <= 0) return fail('market.nothing', 'Davon liegt nichts im Stationslager.');
        const q = quote(state, data, station, p.itemId, qty);
        stockOf(state, station)[p.itemId] = have - qty;
        state.account.isk += q.net;
        ctx.log(`${qty}× ${fixedName(data, p.itemId)} verkauft für ${q.net.toLocaleString('de-DE')} ISK.`, 'good');
        ctx.emit('market/sold', { itemId: p.itemId, name: fixedName(data, p.itemId), qty, isk: q.net });
        return { ok: true, isk: q.net, qty };
      }
      const entry = tradableMap(data)[p?.itemId];
      if (!entry) return fail('market.bad_item', 'Diese Ware wird hier nicht gehandelt (Zivilier-Module und Skillbücher haben keinen Handelswert).');
      const have = stockOf(state, station)[entry.id] ?? 0;
      const qty = Math.min(have, Math.floor(p?.qty ?? have));
      if (qty <= 0) return fail('market.nothing', 'Davon liegt nichts im Stationslager.');
      ensureMarkets(state, data);
      const q = quote(state, data, station, entry.id, qty);
      stockOf(state, station)[entry.id] = have - qty;
      state.world.markets[station][entry.id].demand = q.demandAfter;
      state.account.isk += q.net;
      ctx.log(`${qty} ${entry.name} verkauft für ${q.net.toLocaleString('de-DE')} ISK (Ø ${q.avg.toFixed(1)}).`, 'good');
      ctx.emit('market/sold', { itemId: entry.id, name: entry.name, qty, isk: q.net });
      return { ok: true, isk: q.net, qty };
    }
  },
  onTick(ctx) {
    const { state, data, rng } = ctx;
    ensureMarkets(state, data);
    const mb = data.balance.market;
    for (const [stationId, items] of Object.entries(state.world.markets)) {
      const f = stationFactor(stationId);
      for (const [itemId, slot] of Object.entries(items)) {
        const entry = data.ores?.[itemId] ?? data.items?.[itemId];
        if (!entry) continue;
        slot.demand += (1 - slot.demand) * (mb.recovery ?? 0.03) + (rng.float() - 0.5) * (mb.noise ?? 0.02);
        slot.demand = Math.min(mb.maxDemand ?? 1.6, Math.max(mb.minDemand ?? 0.4, slot.demand));
        slot.history.push(Math.round(entry.basePrice * f * slot.demand * 100) / 100);
        if (slot.history.length > (mb.historyLength ?? 60)) slot.history.shift();
      }
    }
  },
  selectors: {
    /** Zeilen für den Markt der aktuellen Station. */
    'market/rows': (state, data) => {
      const station = dockedId(state);
      if (!station || !hasMarket(data, station)) return [];
      const map = tradableMap(data);
      return Object.entries(state.world.markets[station] ?? {}).filter(([id]) => map[id]).map(([itemId, slot]) => ({
        itemId, name: map[itemId].name, kind: map[itemId].kind ?? 'ore', price: Math.round(map[itemId].basePrice * stationFactor(station) * slot.demand * 10) / 10,
        demand: slot.demand, stock: stockOf(state, station)[itemId] ?? 0, history: slot.history
      }));
    },
    /** Module und Items aus dem Stationslager mit festem Rückkaufpreis. */
    'market/fixedRows': (state, data) => {
      const station = dockedId(state);
      if (!station || !hasMarket(data, station)) return [];
      const map = tradableMap(data);
      return Object.entries(stockOf(state, station)).filter(([id, q]) => q > 0 && !map[id] && fixedPrice(data, id) > 0).map(([itemId, stock]) => ({
        itemId, name: fixedName(data, itemId), kind: data.modules?.[itemId] ? 'module' : 'item', category: data.modules?.[itemId]?.category ?? null, fixed: true,
        price: Math.round(fixedPrice(data, itemId) * stationFactor(station) * 10) / 10, demand: null, stock, history: []
      })).sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
    },
    'market/quote': (state, data, args) => {
      const station = dockedId(state);
      if (!station || !(args?.qty > 0)) return null;
      return quote(state, data, station, args.itemId, Math.floor(args.qty));
    },
    'market/fee': (state, data) => feeOf(state, data)
  }
};
