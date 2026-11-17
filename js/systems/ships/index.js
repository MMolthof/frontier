// System "ships": Schiffe kaufen, besteigen, verkaufen (MASTER_PLAN 3.6, 5.4). Eigener Teilbaum: assets.ships, pilot.activeShipUid.
// Schiffe parken in Stationen; nur in derselben Station und mit erfüllten Skill-Anforderungen kann man umsteigen.

const fail = (error, message) => ({ ok: false, error, message });
const dockedId = (state) => state.pilot.location.dockedStationId;
const levelOf = (state, id) => state.pilot.skills?.[id]?.level ?? 0;
const stockOf = (state, id) => (state.assets.stations[id] ??= { items: {} }).items;

export function missingSkills(state, data, requires) {
  return Object.entries(requires ?? {}).map(([id, level]) => ({ id, name: data.skills[id]?.name ?? id, level, have: levelOf(state, id), ok: levelOf(state, id) >= level }));
}

function newShip(state, data, typeId, stationId) {
  const type = data.ships[typeId];
  const max = state.assets.ships.reduce((m, s) => Math.max(m, Number(String(s.uid).replace(/\D/g, '')) || 0), 0);
  const a = type.attributes ?? {};
  return {
    uid: `u${max + 1}`, typeId, name: type.name, stationId,
    fitting: { high: Array(type.slots.high).fill(null), mid: Array(type.slots.mid).fill(null), low: Array(type.slots.low).fill(null), rig: Array(type.slots.rig).fill(null) },
    cargo: {}, oreHold: {}, damage: { shield: a.shield_hp ?? 0, armor: a.armor_hp ?? 0, structure: a.structure_hp ?? 0 }
  };
}

export const system = {
  id: 'ships',
  actions: {
    'ships/buy': (ctx, p) => {
      const { state, data } = ctx;
      const type = data.ships[p?.typeId];
      const station = dockedId(state);
      if (!type) return fail('ships.unknown', 'Unbekanntes Schiff.');
      if (!station) return fail('ships.not_docked', 'Schiffe gibt es nur in Stationen.');
      if (!data.celestials[station]?.services?.includes('shipyard')) return fail('ships.no_shipyard', 'Diese Station hat keine Werft.');
      if (type.price <= 0) return fail('ships.not_for_sale', 'Dieses Schiff ist nicht käuflich.');
      if (state.account.isk < type.price) return fail('ships.no_isk', `Zu wenig ISK (${type.price.toLocaleString('de-DE')} nötig).`);
      state.account.isk -= type.price;
      const ship = newShip(state, data, type.id, station);
      state.assets.ships.push(ship);
      ctx.log(`${type.name} gekauft. Es parkt im Hangar von ${data.celestials[station].name}.`, 'good');
      ctx.emit('ships/bought', { uid: ship.uid, name: type.name });
      return { ok: true, uid: ship.uid };
    },
    'ships/board': (ctx, p) => {
      const { state, data } = ctx;
      const ship = state.assets.ships.find((s) => s.uid === p?.uid);
      const station = dockedId(state);
      if (!ship) return fail('ships.unknown', 'Schiff nicht gefunden.');
      if (!station) return fail('ships.not_docked', 'Umsteigen nur in der Station.');
      if (ship.stationId !== station) return fail('ships.elsewhere', 'Dieses Schiff parkt in einer anderen Station.');
      if (ship.uid === state.pilot.activeShipUid) return fail('ships.already', 'Du fliegst dieses Schiff bereits.');
      const missing = missingSkills(state, data, data.ships[ship.typeId].requires).filter((m) => !m.ok);
      if (missing.length) return fail('ships.skill', `Fehlende Skills: ${missing.map((m) => `${m.name} ${m.level}`).join(', ')}.`);
      state.pilot.activeShipUid = ship.uid;
      state.mining.sessions = [];
      ctx.log(`Umgestiegen auf ${ship.name}.`);
      ctx.emit('ships/boarded', { uid: ship.uid, name: ship.name });
      return { ok: true };
    },
    'ships/sell': (ctx, p) => {
      const { state, data } = ctx;
      const i = state.assets.ships.findIndex((s) => s.uid === p?.uid);
      const ship = state.assets.ships[i];
      const station = dockedId(state);
      if (!ship) return fail('ships.unknown', 'Schiff nicht gefunden.');
      if (ship.uid === state.pilot.activeShipUid) return fail('ships.active', 'Das aktive Schiff kannst du nicht verkaufen.');
      if (!station || ship.stationId !== station) return fail('ships.elsewhere', 'Das Schiff muss in dieser Station parken.');
      const type = data.ships[ship.typeId];
      if (!(type.price > 0)) return fail('ships.not_for_sale', 'Dieses Schiff hat keinen Handelswert.');
      const stock = stockOf(state, station);
      for (const id of Object.values(ship.fitting).flat()) if (id) stock[id] = (stock[id] ?? 0) + 1;
      for (const [id, n] of Object.entries({ ...ship.oreHold, ...ship.cargo })) stock[id] = (stock[id] ?? 0) + n;
      const isk = Math.floor(type.price * (data.balance.market?.sellShipFactor ?? 0.5));
      state.account.isk += isk;
      state.assets.ships.splice(i, 1);
      ctx.log(`${type.name} verkauft für ${isk.toLocaleString('de-DE')} ISK; Module und Ladung liegen im Stationslager.`, 'good');
      ctx.emit('ships/sold', { name: type.name, isk });
      return { ok: true, isk };
    }
  },
  selectors: {
    'ships/list': (state, data) => state.assets.ships.map((s) => {
      const type = data.ships[s.typeId];
      const missing = missingSkills(state, data, type.requires).filter((m) => !m.ok);
      return { uid: s.uid, typeId: s.typeId, name: s.name, className: type.class, category: type.category, stationId: s.stationId,
        stationName: s.stationId ? data.celestials[s.stationId]?.name ?? s.stationId : 'im All', active: s.uid === state.pilot.activeShipUid,
        here: Boolean(dockedId(state)) && s.stationId === dockedId(state), canFly: missing.length === 0, missing, sellValue: Math.floor(type.price * (data.balance.market?.sellShipFactor ?? 0.5)),
        fitted: Object.values(s.fitting).flat().filter(Boolean).length, slots: Object.values(type.slots).reduce((a, b) => a + b, 0) };
    }),
    /** Werft-Katalog: alle käuflichen Schiffe mit Anforderungsstatus. */
    'ships/shop': (state, data) => data.lists.ships.filter((t) => t.price > 0).sort((a, b) => a.price - b.price).map((t) => ({
      typeId: t.id, name: t.name, category: t.category, className: t.class, price: t.price, description: t.description ?? '',
      slots: t.slots, hardpoints: t.hardpoints, oreHold: t.attributes?.ore_hold ?? 0, cargo: t.attributes?.cargo ?? 0, requires: missingSkills(state, data, t.requires),
      canFly: missingSkills(state, data, t.requires).every((m) => m.ok), affordable: state.account.isk >= t.price
    }))
  }
};
