// Lädt data/manifest.json, alle Dateien daraus und data/ext/*.json und baut Indizes.
// Läuft im Browser (fetch) und in Node (fs). Reader-Interface:
//   readJson(path)  → Promise<object>   (Pfade relativ zum Repo-Root, z. B. 'data/ships.json')
//   listJson(dir)   → Promise<string[]> (Dateinamen *.json, z. B. ['a2-ships.json'])

const ENTRY_KINDS = {
  stats: { prefix: null, required: ['id'], known: ['id', 'unit', 'group'] },
  ships: {
    prefix: 'ship.',
    required: ['id', 'name', 'category', 'class', 'slots'],
    known: ['id', 'name', 'category', 'class', 'hull', 'tier', 'description', 'slots', 'hardpoints', 'fitting',
      'attributes', 'bonuses', 'roleBonuses', 'requires', 'price', 'art']
  },
  modules: {
    prefix: 'mod.',
    required: ['id', 'name', 'slot'],
    known: ['id', 'name', 'slot', 'hardpoint', 'group', 'category', 'size', 'fitting', 'requires', 'activation',
      'effects', 'price', 'permanent', 'ammo', 'description']
  },
  skills: {
    prefix: 'skill.',
    required: ['id', 'name', 'rank'],
    known: ['id', 'name', 'group', 'rank', 'primary', 'secondary', 'maxLevel', 'requires', 'price', 'effects', 'description']
  },
  ores: {
    prefix: 'ore.',
    required: ['id', 'name', 'volumeM3'],
    known: ['id', 'name', 'volumeM3', 'basePrice', 'securityBand', 'rarity', 'refine', 'requires', 'description']
  },
  items: { prefix: 'item.', required: ['id', 'name'], known: ['id', 'name', 'volumeM3', 'basePrice', 'kind', 'description'] },
  systems: {
    prefix: 'sys.',
    required: ['id', 'name', 'celestials'],
    known: ['id', 'name', 'security', 'region', 'celestials', 'fields']
  },
  missions: {
    prefix: 'msn.',
    required: ['id', 'level'],
    known: ['id', 'level', 'title', 'summary', 'agentCorp', 'requires', 'waves', 'reward', 'loot']
  },
  npcs: {
    prefix: 'npc.',
    required: ['id', 'name'],
    known: ['id', 'name', 'class', 'structure_hp', 'armor_hp', 'shield_hp', 'res', 'dps', 'rangeKm', 'bounty', 'loot']
  }
};

export const ENTRY_KIND_NAMES = Object.keys(ENTRY_KINDS);

/** Für ext-Dateien: Sammlung aus ID-Präfix ableiten (oder `kind` im Dateikopf). */
export function kindOfId(id) {
  const dot = typeof id === 'string' ? id.indexOf('.') + 1 : 0;
  const prefix = dot ? id.slice(0, dot) : '';
  return ENTRY_KIND_NAMES.find((k) => ENTRY_KINDS[k].prefix === prefix) ?? null;
}

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

function emptyData(contract) {
  const data = { contract: contract ?? null, balance: {}, i18n: {}, lists: {}, celestials: {}, fields: {} };
  for (const kind of ENTRY_KIND_NAMES) {
    data[kind] = {};
    data.lists[kind] = [];
  }
  return data;
}

/**
 * Reine Funktion: baut die Datenstruktur aus bereits gelesenen JSON-Objekten.
 * @param {{manifest: object, files: Record<string, object>, ext?: Array<{path: string, json: object}>}} input
 *   files: Schlüssel = Eintrag aus manifest.files (z. B. 'ships.json', 'i18n/de.json')
 * @returns {{data: object, warnings: string[]}}
 */
export function buildData({ manifest, files, ext = [] }) {
  const warnings = [];
  const warn = (msg) => warnings.push(msg);
  const data = emptyData(manifest?.contract);

  function addEntries(kind, entries, source) {
    const spec = ENTRY_KINDS[kind];
    if (!Array.isArray(entries)) {
      warn(`[${source}] "entries" fehlt oder ist kein Array.`);
      return;
    }
    for (const entry of entries) {
      if (!entry || typeof entry.id !== 'string') {
        warn(`[${source}] Eintrag ohne gültige id übersprungen.`);
        continue;
      }
      if (data[kind][entry.id]) {
        warn(`[${source}] Doppelte ID ${entry.id} (${kind}): erster Eintrag gilt, dieser wird ignoriert.`);
        continue;
      }
      if (spec.prefix && !entry.id.startsWith(spec.prefix)) {
        warn(`[${source}] ID ${entry.id} passt nicht zum Präfix ${spec.prefix}.`);
      }
      const missing = spec.required.filter((f) => !(f in entry));
      if (missing.length) warn(`[${source}] ${entry.id}: Pflichtfelder fehlen: ${missing.join(', ')}.`);
      const unknown = Object.keys(entry).filter((f) => !spec.known.includes(f));
      if (unknown.length) warn(`[${source}] ${entry.id}: unbekannte Felder ignoriert: ${unknown.join(', ')}.`);
      data[kind][entry.id] = entry;
      data.lists[kind].push(entry);
      if (kind === 'systems') indexSystem(entry, source);
    }
  }

  function indexSystem(system, source) {
    for (const cel of system.celestials ?? []) {
      if (data.celestials[cel.id]) warn(`[${source}] Doppelte Celestial-ID ${cel.id}.`);
      else data.celestials[cel.id] = { ...cel, systemId: system.id };
    }
    for (const field of system.fields ?? []) {
      if (data.fields[field.id]) warn(`[${source}] Doppelte Field-ID ${field.id}.`);
      else data.fields[field.id] = { ...field, systemId: system.id };
    }
  }

  for (const file of manifest?.files ?? []) {
    const json = files[file];
    if (json === undefined) {
      warn(`[manifest] ${file} fehlt (noch nicht geliefert?) – als leer behandelt.`);
      continue;
    }
    if (file.startsWith('i18n/')) {
      data.i18n[file.slice(5, -5)] = json;
    } else if (file === 'balance.json') {
      data.balance = json;
    } else {
      const kind = file.replace(/\.json$/, '');
      if (!ENTRY_KINDS[kind]) warn(`[manifest] ${file}: unbekannte Sammlung, ignoriert.`);
      else addEntries(kind, json.entries, file);
    }
  }

  // Erweiterungen (data/ext) nach den Basisdateien: bei doppelter ID gewinnt die Basis.
  for (const { path, json } of ext) {
    if (!Array.isArray(json?.entries)) {
      warn(`[${path}] "entries" fehlt – ignoriert.`);
      continue;
    }
    const byKind = new Map();
    for (const entry of json.entries) {
      const kind = json.kind ?? kindOfId(entry?.id);
      if (!kind || !ENTRY_KINDS[kind]) {
        warn(`[${path}] Sammlung für ${entry?.id} nicht bestimmbar (ID-Präfix oder "kind" im Dateikopf nötig).`);
        continue;
      }
      if (!byKind.has(kind)) byKind.set(kind, []);
      byKind.get(kind).push(entry);
    }
    for (const [kind, entries] of byKind) addEntries(kind, entries, path);
  }

  return { data: deepFreeze(data), warnings };
}

/** Liest alles über den Reader und ruft buildData. */
export async function loadData(reader, { onWarn = (m) => console.warn(m) } = {}) {
  const pre = [];
  const manifest = await reader.readJson('data/manifest.json');
  const files = {};
  for (const file of manifest.files ?? []) {
    try {
      files[file] = await reader.readJson(`data/${file}`);
    } catch (err) {
      pre.push(`[manifest] ${file} nicht lesbar: ${err.message}`);
    }
  }
  const ext = [];
  let names = [];
  try {
    names = await reader.listJson('data/ext');
  } catch (err) {
    pre.push(`[ext] Verzeichnis nicht listbar: ${err.message}`);
  }
  for (const name of names) {
    try {
      ext.push({ path: `ext/${name}`, json: await reader.readJson(`data/ext/${name}`) });
    } catch (err) {
      pre.push(`[ext/${name}] nicht lesbar: ${err.message}`);
    }
  }
  const { data, warnings } = buildData({ manifest, files, ext });
  const all = [...pre, ...warnings];
  all.forEach(onWarn);
  return { data, warnings: all };
}

/** Browser-Reader. baseUrl zeigt auf das Repo-Root (URL oder String mit Slash am Ende). */
export function createFetchReader(baseUrl) {
  const base = String(baseUrl);
  const url = (p) => new URL(p, base).href;
  return {
    async readJson(path) {
      const res = await fetch(url(path), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status} für ${path}`);
      return res.json();
    },
    /** Erwartet <dir>/index.json mit Dateinamen (tools/serve.mjs erzeugt sie dynamisch). */
    async listJson(dir) {
      const res = await fetch(url(`${dir}/index.json`), { cache: 'no-store' });
      if (!res.ok) return [];
      const list = await res.json();
      return Array.isArray(list) ? list.filter((n) => typeof n === 'string' && n !== 'index.json') : [];
    }
  };
}

/** Node-Reader (Tests, Tools). */
export function createFsReader(rootDir) {
  const resolve = async (p) => (await import('node:path')).join(rootDir, p);
  return {
    async readJson(path) {
      const fs = await import('node:fs/promises');
      return JSON.parse(await fs.readFile(await resolve(path), 'utf8'));
    },
    async listJson(dir) {
      const fs = await import('node:fs/promises');
      try {
        const names = await fs.readdir(await resolve(dir));
        return names.filter((n) => n.endsWith('.json') && n !== 'index.json').sort();
      } catch {
        return [];
      }
    }
  };
}

/** Reader über ein Objekt { 'data/x.json': {...} } (Tests). */
export function createMemoryReader(files) {
  return {
    async readJson(path) {
      if (!(path in files)) throw new Error(`nicht vorhanden: ${path}`);
      return structuredClone(files[path]);
    },
    async listJson(dir) {
      const prefix = `${dir}/`;
      return Object.keys(files)
        .filter((p) => p.startsWith(prefix) && p.endsWith('.json') && !p.slice(prefix.length).includes('/'))
        .map((p) => p.slice(prefix.length))
        .filter((n) => n !== 'index.json')
        .sort();
    }
  };
}
