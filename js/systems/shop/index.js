// System "shop": Module bei der NPC-Station kaufen (MASTER_PLAN 5.7). Gekaufte Module liegen im Stationslager.
// Zivilier-Module sind käuflich (buyPrice), haben aber keinen Handelswert (price 0): nur verschrotten.

import { stationFactor } from '../market/index.js';

const fail = (error, message) => ({ ok: false, error, message });
const BUYABLE = ['mineral', 'ammo'];
/** Kaufpreis eines Moduls: Zivilier-Module haben einen Kaufpreis (buyPrice), aber keinen Verkaufswert (price 0). */
const modPrice = (m) => (m.buyPrice > 0 ? m.buyPrice : m.price);
const unitPrice = (data, item, station) => Math.max(1, Math.ceil(item.basePrice * stationFactor(station) * (data.balance.market?.buyMarkup ?? 1.3)));
const dockedId = (state) => state.pilot.location.dockedStationId;
const stockOf = (state, id) => (state.assets.stations[id] ??= { items: {} }).items;
const levelOf = (state, id) => state.pilot.skills?.[id]?.level ?? 0;

const reqs = (state, data, requires) => Object.entries(requires ?? {}).map(([id, level]) => ({ id, name: data.skills[id]?.name ?? id, level, have: levelOf(state, id), ok: levelOf(state, id) >= level }));

export const system = {
  id: 'shop',
  actions: {
    'shop/buyItem': (ctx, p) => {
      const { state, data } = ctx;
      const item = data.items?.[p?.itemId];
      const station = dockedId(state);
      const qty = Math.max(1, Math.floor(p?.qty ?? 1));
      if (!item || !BUYABLE.includes(item.kind) || !(item.basePrice > 0)) return fail('shop.unknown', 'Diese Ware wird nicht angeboten.');
      if (!station) return fail('shop.not_docked', 'Kaufen nur in Stationen.');
      if (!data.celestials[station]?.services?.includes('market')) return fail('shop.no_market', 'Diese Station hat keinen Markt.');
      const cost = unitPrice(data, item, station) * qty;
      if (state.account.isk < cost) return fail('shop.no_isk', `Zu wenig ISK (${cost.toLocaleString('de-DE')} nötig).`);
      state.account.isk -= cost;
      const stock = stockOf(state, station);
      stock[item.id] = (stock[item.id] ?? 0) + qty;
      ctx.log(`${qty}× ${item.name} gekauft (${cost.toLocaleString('de-DE')} ISK).`, 'good');
      ctx.emit('shop/bought', { itemId: item.id, name: item.name, qty });
      return { ok: true };
    },
    'shop/buyModule': (ctx, p) => {
      const { state, data } = ctx;
      const mod = data.modules[p?.moduleId];
      const station = dockedId(state);
      const qty = Math.max(1, Math.floor(p?.qty ?? 1));
      if (!mod) return fail('shop.unknown', 'Unbekanntes Modul.');
      if (!station) return fail('shop.not_docked', 'Module gibt es nur in Stationen.');
      if (!data.celestials[station]?.services?.includes('market')) return fail('shop.no_market', 'Diese Station hat keinen Markt.');
      if (!(modPrice(mod) > 0)) return fail('shop.not_for_sale', 'Dieses Modul ist nicht käuflich.');
      const cost = modPrice(mod) * qty;
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
    /** Rohstoffe und Munition zum Kauf: { kind?, search? } -> [{ itemId, name, kind, price, owned }] */
    'shop/items': (state, data, args) => {
      const station = dockedId(state);
      const stock = station ? stockOf(state, station) : {};
      const q = (args?.search ?? '').toLowerCase();
      return Object.values(data.items ?? {}).filter((i) => BUYABLE.includes(i.kind) && i.basePrice > 0 && (!args?.kind || i.kind === args.kind) && (!q || i.name.toLowerCase().includes(q)))
        .map((i) => ({ itemId: i.id, name: i.name, kind: i.kind, price: station ? unitPrice(data, i, station) : i.basePrice, owned: stock[i.id] ?? 0 }))
        .sort((a, b) => a.kind.localeCompare(b.kind) || a.price - b.price);
    },
    /** Modulkatalog mit Filter: { slot?, category?, search? } -> [{ moduleId, name, slot, size, category, group, price, fitting, requires, canUse, owned }] */
    'shop/modules': (state, data, args) => {
      const station = dockedId(state);
      const stock = station ? stockOf(state, station) : {};
      const q = (args?.search ?? '').toLowerCase();
      return data.lists.modules.filter((m) => modPrice(m) > 0 && (!args?.slot || m.slot === args.slot) && (!args?.category || m.category === args.category) && (!q || m.name.toLowerCase().includes(q) || m.group.includes(q)))
        .map((m) => {
          const requires = reqs(state, data, m.requires);
          return { moduleId: m.id, name: m.name, slot: m.slot, size: m.size, category: m.category, group: m.group, price: modPrice(m), civilian: !!m.civilian, fitting: m.fitting, requires, canUse: requires.every((r) => r.ok), owned: stock[m.id] ?? 0 };
        }).sort((a, b) => Number(b.canUse) - Number(a.canUse) || a.price - b.price);
    },
    'shop/categories': (state, data) => [...new Set(data.lists.modules.filter((m) => modPrice(m) > 0).map((m) => m.category))].sort()
  }
};
