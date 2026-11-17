// Asteroidenfelder: Erzeugung aus data.fields, Erschöpfung und Respawn (MASTER_PLAN 5.5). Rein, ohne DOM.

/** Wählt zulässige Erze nach Sicherheitsband; fällt auf alle Gewichte zurück, wenn keines passt. */
function usableWeights(def, security, data) {
  const out = {};
  for (const [oreId, w] of Object.entries(def.oreWeights ?? {})) {
    const band = data.ores?.[oreId]?.securityBand;
    if (!band || (security >= band[0] && security <= band[1])) out[oreId] = w;
  }
  return Object.keys(out).length ? out : { ...def.oreWeights };
}

/** @returns {{asteroids: object[], nextId: number, emptySince: number|null}} */
export function generateField(def, data, rng) {
  const security = data.systems?.[def.systemId]?.security ?? 1;
  const weights = usableWeights(def, security, data);
  const [minN, maxN] = def.asteroidCount ?? [10, 20];
  const [minM, maxM] = def.sizeM3 ?? [5000, 30000];
  const count = rng.int(minN, maxN);
  const asteroids = [];
  for (let i = 1; i <= count; i++) {
    const m3 = rng.int(minM, maxM);
    asteroids.push({ id: `a${i}`, oreId: rng.weighted(weights), initialM3: m3, remainingM3: m3 });
  }
  return { asteroids, nextId: count + 1, emptySince: null };
}

export function ensureFields(state, data, rng) {
  for (const def of Object.values(data.fields ?? {})) {
    if (!state.world.fields[def.id]) state.world.fields[def.id] = generateField(def, data, rng);
  }
}

/** Respawn leerer Felder; liefert die IDs der neu gefüllten Felder. */
export function respawnFields(state, data, rng) {
  const done = [];
  for (const [id, field] of Object.entries(state.world.fields)) {
    const def = data.fields?.[id];
    if (!def || field.asteroids.length) continue;
    if (field.emptySince === null) { field.emptySince = state.tick; continue; }
    if (state.tick - field.emptySince >= (def.respawnTicks ?? 1440)) { state.world.fields[id] = generateField(def, data, rng); done.push(id); }
  }
  return done;
}
