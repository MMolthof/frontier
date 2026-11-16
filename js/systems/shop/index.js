// System "shop": Module bei der NPC-Station kaufen (MASTER_PLAN 5.7). Gekaufte Module liegen im Stationslager.
// Zivilier-Module (Preis 0) sind nicht käuflich und haben keinen Handelswert.

const fail = (error, message) => ({ ok: false, error, message });
const dockedId = (state) => state.pilot.location.dockedStationId;
const stockOf = (state, id) => (state.assets.stations[id] ??= { items: {} }).items;
const levelOf = (state, id) => state.pilot.skills?.[id]?.level ?? 0;

const reqs = (state, data, requires) => Object.entries(requires ?? {}).map(([id, level]) => ({ id, name: data.skills[id]?.name ?? id, level, have: levelOf(state, id), ok: levelOf(state, id) >= level }));

export const system = {
  id: 'shop',
  actions: {
    'shop/buyModule': (ctx, p) => {
      const { state, data } = ctx;
      const mod = data.modules[p?.moduleId];
      const station = dockedId(state);
      const qty = Math.max(1, Math.floor(p?.qty ?? 1));
      if (!mod) return fail('shop.unknown', 'Unbekanntes Modul.');
      if (!station) return fail('shop.not_docked', 'Module gibt es nur in Stationen.');
      if (!data.celestials[station]?.services?.includes('market')) return fail('shop.no_market', 'Diese Station hat keinen Markt.');
      if (!(mod.price > 0)) return fail('shop.not_for_sale', 'Dieses Modul ist nicht käuflich.');
      const cost = mod.price * qty;
      if (state.account.isk < cost) return fail('shop.no_isk', `Zu wenig ISK (${cost.toLocaleString('de-DE')} nötig).`);
      state.account.isk -= cost;
      const stock = stockOf(state, station);
      stock[mod.id] = (stock[mod.id] ?? 0) + qty;
      ctx.log(`${qty}× ${mod.name} gekauft (${cost.toLocaleString('de-DE')} ISK). Das Modul liegt im Stationslager.`, 'good');
      ctx.emit('shop/bought', { moduleId: mod.id, name: mod.name, qty });
      return { ok: true };
    }
  },
  selectors: {
    /** Modulkatalog mit Filter: { slot?, category?, search? } -> [{ moduleId, name, slot, size, category, group, price, fitting, requires, canUse, owned }] */
    'shop/modules': (state, data, args) => {
      const station = dockedId(state);
      const stock = station ? stockOf(state, station) : {};
      const q = (args?.search ?? '').toLowerCase();
      return data.lists.modules.filter((m) => m.price > 0 && (!args?.slot || m.slot === args.slot) && (!args?.category || m.category === args.category) && (!q || m.name.toLowerCase().includes(q) || m.group.includes(q)))
        .map((m) => {
          const requires = reqs(state, data, m.requires);
          return { moduleId: m.id, name: m.name, slot: m.slot, size: m.size, category: m.category, group: m.group, price: m.price, fitting: m.fitting, requires, canUse: requires.every((r) => r.ok), owned: stock[m.id] ?? 0 };
        }).sort((a, b) => Number(b.canUse) - Number(a.canUse) || a.price - b.price);
    },
    'shop/categories': (state, data) => [...new Set(data.lists.modules.filter((m) => m.price > 0).map((m) => m.category))].sort()
  }
};
