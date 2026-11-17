// System "starter": Zivilier-Grundausrüstung. Rüstet alte Spielstände mit leerem Starterschiff einmalig nach
// und gibt in einer Station kostenlosen Ersatz, wenn dir Bergbaulaser oder Waffe komplett fehlen (kein Soft-Lock).

const fail = (error, message) => ({ ok: false, error, message });
const dockedId = (state) => state.pilot.location.dockedStationId;
const isEmpty = (fitting) => Object.values(fitting ?? {}).flat().every((x) => !x);

/** Welche Start-Module besitzt der Pilot nicht (weder eingebaut im aktiven Schiff noch im Lager dieser Station)? */
function missing(state, data) {
  const ship = state.assets.ships.find((s) => s.uid === state.pilot.activeShipUid);
  const fitted = Object.values(ship?.fitting ?? {}).flat().filter(Boolean);
  const stock = state.assets.stations[dockedId(state)]?.items ?? {};
  const want = [...new Set(Object.values(data.balance.startFitting ?? {}).flat().filter(Boolean))];
  return want.filter((id) => data.modules[id] && !data.modules[id].price && !fitted.includes(id) && !((stock[id] ?? 0) > 0)
    && !sameGroupOwned(data, id, fitted, stock));
}
const sameGroupOwned = (data, id, fitted, stock) => [...fitted, ...Object.keys(stock).filter((k) => stock[k] > 0)]
  .some((other) => data.modules[other] && data.modules[other].group === data.modules[id].group && data.modules[other].slot === data.modules[id].slot);

export const system = {
  id: 'starter',
  init(ctx) {
    const { state, data } = ctx;
    state.flags ??= {};
    if (!state.flags.starterRenamed) { // Starterschiff wurde von „Pebble“ umbenannt: alte Spielstände übernehmen den neuen Namen
      state.flags.starterRenamed = true;
      for (const s of state.assets.ships) if (s.name === 'Pebble' && data.ships[s.typeId]?.name && data.ships[s.typeId].name !== 'Pebble') s.name = data.ships[s.typeId].name;
    }
    if (state.flags.starterLoadout) return;
    state.flags.starterLoadout = true;
    const sf = data.balance.startFitting;
    const ship = state.assets.ships.find((s) => s.typeId === data.balance.startShip);
    if (!sf || !ship || !isEmpty(ship.fitting)) return;
    for (const slot of Object.keys(ship.fitting)) ship.fitting[slot] = ship.fitting[slot].map((_, i) => (data.modules[sf[slot]?.[i]] ? sf[slot][i] : null));
    ctx.log('Zivilier-Ausrüstung für dein Starterschiff nachgerüstet.', 'good');
  },
  actions: {
    'starter/rearm': (ctx) => {
      const { state, data } = ctx;
      const station = dockedId(state);
      if (!station) return fail('starter.not_docked', 'Ersatzausrüstung gibt es nur in Stationen.');
      const need = missing(state, data);
      if (!need.length) return fail('starter.not_needed', 'Du besitzt bereits Bergbaulaser und Waffe.');
      const stock = (state.assets.stations[station] ??= { items: {} }).items;
      for (const id of need) stock[id] = (stock[id] ?? 0) + 1;
      ctx.log(`Kostenlose Zivilier-Ausrüstung im Stationslager: ${need.map((id) => data.modules[id].name).join(', ')}.`, 'good');
      return { ok: true, granted: need };
    }
  },
  selectors: {
    /** Fehlt dem Piloten Grundausrüstung? (Zivilier-Module, die er weder trägt noch lagert) */
    'starter/needsRearm': (state, data) => Boolean(dockedId(state)) && missing(state, data).length > 0
  }
};
