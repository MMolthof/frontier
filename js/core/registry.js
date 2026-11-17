// Lädt js/registry.json und importiert Systeme/Views dynamisch. Fehlende Module werden
// mit Warnung übersprungen (Agenten liefern gestaffelt).
//
// registry.json: { "systems": [ {id, path, order}, … ], "views": [ {id, path, order}, … ] }
// path ist relativ zu js/ (z. B. "systems/mining/index.js"). EINE ZEILE PRO EINTRAG.
// systems exportieren `system`, views exportieren `view`.

const defaultImporter = (path) => import(new URL(`../${path}`, import.meta.url).href);

function sorted(entries) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => (a.entry.order ?? 1000) - (b.entry.order ?? 1000) || a.index - b.index)
    .map((x) => x.entry);
}

async function loadKind(entries, exportName, importer, warn) {
  const out = [];
  const seen = new Set();
  for (const entry of sorted(entries ?? [])) {
    if (!entry || typeof entry.id !== 'string' || typeof entry.path !== 'string') {
      warn(`Registry-Eintrag ungültig: ${JSON.stringify(entry)}`);
      continue;
    }
    if (seen.has(entry.id)) {
      warn(`Registry: doppelte ${exportName}-id ${entry.id} übersprungen.`);
      continue;
    }
    let mod;
    try {
      mod = await importer(entry.path);
    } catch (err) {
      warn(`Registry: ${exportName} ${entry.id} (${entry.path}) nicht ladbar – übersprungen: ${err.message}`);
      continue;
    }
    const exported = mod?.[exportName];
    if (!exported || exported.id !== entry.id) {
      warn(`Registry: ${entry.path} exportiert kein ${exportName} mit id "${entry.id}" – übersprungen.`);
      continue;
    }
    seen.add(entry.id);
    out.push(exported);
  }
  return out;
}

/**
 * @param {{readJson: (path: string) => Promise<object>}} reader
 * @param {{importer?: (path: string) => Promise<object>, onWarn?: (m: string) => void}} [options]
 * @returns {Promise<{systems: object[], views: object[], warnings: string[]}>}
 */
export async function loadRegistry(reader, { importer = defaultImporter, onWarn = (m) => console.warn(m) } = {}) {
  const warnings = [];
  const warn = (m) => { warnings.push(m); onWarn(m); };
  let doc = { systems: [], views: [] };
  try {
    doc = await reader.readJson('js/registry.json');
  } catch (err) {
    warn(`Registry nicht lesbar: ${err.message}`);
  }
  const systems = await loadKind(doc.systems, 'system', importer, warn);
  const views = await loadKind(doc.views, 'view', importer, warn);
  return { systems, views, warnings };
}
