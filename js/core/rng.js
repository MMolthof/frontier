// Seedbarer Zufall (mulberry32). Der Zustand ist eine einzelne uint32 und liegt in state.rngState,
// damit Save/Load den Zufallsstrom exakt fortsetzt (Determinismus).

/** Macht aus beliebigem Seed einen uint32-Startzustand. */
export function seedToState(seed) {
  let s = Number(seed) >>> 0;
  s = (s ^ 0x9e3779b9) >>> 0;
  return s;
}

function makeRng(read, write) {
  const next = () => {
    let a = (read() + 0x6d2b79f5) >>> 0;
    write(a);
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    /** Gleitkommazahl in [0, 1). */
    float: next,
    /** Ganzzahl in [min, max] (inklusive). */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** true mit Wahrscheinlichkeit p. */
    chance: (p) => next() < p,
    /** Zufälliges Element. */
    pick: (list) => list[Math.floor(next() * list.length)],
    /** Schlüssel aus { key: weight } nach Gewicht; null bei leerer/Null-Summe. */
    weighted(weights) {
      const entries = Object.entries(weights).filter(([, w]) => w > 0);
      const total = entries.reduce((acc, [, w]) => acc + w, 0);
      if (total <= 0) return null;
      let roll = next() * total;
      for (const [key, w] of entries) {
        roll -= w;
        if (roll < 0) return key;
      }
      return entries[entries.length - 1][0];
    },
    /** Fisher-Yates, liefert neue Liste. */
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    }
  };
}

/** RNG, der seinen Zustand in `holder[key]` hält (typisch: state.rngState). */
export function createStateRng(holder, key = 'rngState') {
  return makeRng(() => holder[key] >>> 0, (v) => { holder[key] = v; });
}

/** Eigenständiger RNG mit lokalem Zustand (Tests, Tools). */
export function createSeededRng(seed) {
  let s = seedToState(seed);
  return makeRng(() => s, (v) => { s = v; });
}
