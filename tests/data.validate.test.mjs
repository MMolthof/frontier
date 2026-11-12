// Tests für tools/validate-data.mjs: echte Daten müssen grün sein, absichtlich kaputte Daten müssen gemeldet werden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT } from './harness.js';
import { readRepo, validateBundle, checkSchema, requirementClosure, CLASS_ORDER, REFERENCE_FITS } from '../tools/validate-data.mjs';

const clone = (o) => JSON.parse(JSON.stringify(o));
const fresh = () => clone(readRepo(REPO_ROOT).bundle);
const entry = (b, file, id) => b.files[file].entries.find((e) => e.id === id);
const run = (b) => validateBundle(b);
const has = (res, part) => res.errors.some((e) => e.includes(part));

test('echte Daten: keine Fehler, keine Warnungen', () => {
  const { bundle, problems } = readRepo(REPO_ROOT);
  assert.deepEqual(problems, []);
  const res = run(bundle);
  assert.deepEqual(res.errors, []);
  assert.deepEqual(res.warnings, []);
});

test('Mengen und feste IDs (Auftrag A2)', () => {
  const { data } = run(fresh());
  const c = data.lists;
  assert.equal(c.ships.length, 14);
  assert.ok(c.modules.length >= 60, 'mind. 60 Module');
  assert.ok(c.skills.length >= 50, 'mind. 50 Skills');
  assert.ok(c.ores.length >= 6, 'mind. 3 Erze + 3 Beispiel-Erze');
  assert.ok(c.systems.length >= 6);
  assert.ok(c.npcs.length >= 12);
  for (let lvl = 1; lvl <= 4; lvl++) assert.ok(c.missions.filter((m) => m.level === lvl).length >= 6, `Stufe ${lvl}`);
  const must = ['ship.pebble', 'mod.miner_1', 'skill.spaceship_command', 'skill.mining', 'skill.mining_frigate', 'sys.aldara', 'cel.aldara.p1.station',
    'item.tritanium', 'item.pyerite', 'item.mexallon', 'item.scrap_metal', 'ore.veldspar', 'ore.scordite', 'ore.pyroxeres',
    'sys.brenn', 'sys.kestor', 'sys.vael', 'sys.drosk', 'sys.corvan',
    'ship.digger', 'ship.delver', 'ship.vault', 'ship.bulwark', 'ship.dart', 'ship.cinder', 'ship.sparrow', 'ship.lance', 'ship.warden', 'ship.corvid', 'ship.bastion', 'ship.sovereign', 'ship.mule'];
  for (const id of must) {
    const kind = id.startsWith('cel.') ? data.celestials : Object.values(data).find((v) => v && typeof v === 'object' && !Array.isArray(v) && id in v);
    assert.ok(kind?.[id], `${id} fehlt`);
  }
  const sec = Object.fromEntries(c.systems.map((s) => [s.id, s.security]));
  assert.deepEqual([sec['sys.aldara'], sec['sys.corvan'], sec['sys.brenn'], sec['sys.kestor'], sec['sys.vael'], sec['sys.drosk']], [1, 0.9, 0.8, 0.5, 0.3, 0.1]);
  const aldara = data.celestials['cel.aldara.p1.station'];
  for (const s of ['market', 'hangar', 'missions', 'refinery', 'industry', 'shipyard']) assert.ok(aldara.services.includes(s));
});

test('Beispiel-IDs aus data/examples bleiben erhalten', () => {
  const { data } = run(fresh());
  for (const id of ['mod.shield_extender_s', 'mod.mining_upgrade_1', 'mod.autocannon_s', 'mod.armor_plate_s', 'mod.rig_cargo_s']) assert.ok(data.modules[id], id);
  for (const id of ['skill.mining_upgrades', 'skill.shield_management', 'skill.hull_upgrades', 'skill.gunnery', 'skill.rigging', 'skill.light_command', 'skill.dart_command']) assert.ok(data.skills[id], id);
  assert.ok(data.npcs['npc.rat_scout'] && data.missions['msn.l1.pirate_patrol']);
});

test('Schiffe: Slots, Hardpoints, Klassen/Hüllen und Kategorien', () => {
  const { data } = run(fresh());
  for (const s of data.lists.ships) {
    assert.ok(s.hardpoints.turret <= s.slots.high && s.hardpoints.launcher <= s.slots.high, s.id);
    if (s.category === 'mining') assert.ok(s.attributes.ore_hold > 0 && s.hardpoints.launcher === 0, s.id);
    if (s.category === 'combat') assert.equal(s.attributes.ore_hold, 0, s.id);
    assert.equal(s.art, s.id);
  }
  const layouts = new Set(data.lists.ships.map((s) => JSON.stringify([s.slots, s.hardpoints])));
  assert.equal(layouts.size, 14, 'jeder Rumpf hat ein eigenes Layout');
});

test('kein Modul in falschem Slot-Typ; alle Module sind auf mindestens einem Schiff nutzbar', () => {
  const { data } = run(fresh());
  const sizeOf = { small: 'small', medium: 'medium', large: 'large' };
  for (const m of data.lists.modules) {
    const hosts = data.lists.ships.filter((s) => s.hull === sizeOf[m.size] && s.slots[m.slot] > 0 && (!m.hardpoint || s.hardpoints[m.hardpoint] > 0));
    assert.ok(hosts.length > 0, `${m.id} passt auf kein Schiff`);
    if (m.slot === 'rig') assert.ok(m.permanent && m.fitting.calibration >= 50 && m.fitting.calibration <= 200, m.id);
  }
});

test('Skills: jedes Schiff und Modul ist erreichbar; Aufstiegspfade', () => {
  const { data } = run(fresh());
  for (const o of [...data.lists.ships, ...data.lists.modules, ...data.lists.ores]) {
    const need = requirementClosure(data.skills, o.requires ?? {});
    for (const [id, lvl] of Object.entries(need)) { assert.ok(data.skills[id], `${o.id}: ${id}`); assert.ok(lvl <= 5); }
  }
  // Bergbaufregatte → Barke
  const barge = requirementClosure(data.skills, data.ships['ship.delver'].requires);
  assert.ok(barge['skill.mining_frigate'] >= 3 && barge['skill.mining'] >= 4 && barge['skill.barge_command'] >= 1);
  // Fregatte → Kreuzer
  const cruiser = requirementClosure(data.skills, data.ships['ship.warden'].requires);
  assert.ok(cruiser['skill.light_command'] >= 3 && cruiser['skill.destroyer_command'] >= 3 && cruiser['skill.cruiser_command'] >= 1);
  // Kreuzer → Schlachtschiff
  const bs = requirementClosure(data.skills, data.ships['ship.sovereign'].requires);
  assert.ok(bs['skill.cruiser_command'] >= 4 && bs['skill.battlecruiser_command'] >= 4);
});

test('Spielstart: Startfitting, Startskills und Startstation sind gültig', async () => {
  const { data } = run(fresh());
  const { createInitialState } = await import('../js/core/state.js');
  const st = createInitialState(data);
  const ship = st.assets.ships[0];
  assert.equal(ship.typeId, 'ship.pebble');
  assert.equal(st.pilot.location.dockedStationId, 'cel.aldara.p1.station');
  assert.deepEqual(ship.fitting.high.slice(0, 2), ['mod.miner_1', 'mod.miner_1']);
  assert.ok(data.celestials[st.pilot.location.dockedStationId].services.includes('market'));
  for (const id of Object.keys(st.pilot.skills)) assert.ok(data.skills[id]);
});

test('Referenz-Fittings passen auf alle 14 Schiffe', () => {
  const { data } = run(fresh());
  for (const s of data.lists.ships) assert.ok(REFERENCE_FITS[s.id], s.id);
});

test('Mini-Schema: Typen, Pflichtfelder, Muster', () => {
  const out = [];
  checkSchema({ type: 'object', required: ['a'], properties: { a: { type: 'integer', minimum: 1 }, b: { pattern: '^x' } }, additionalProperties: false }, { b: 'y', c: 1, a: 0.5 }, '$', out);
  assert.equal(out.length, 3);
});

// ---------------------------------------------------------------- negative Fälle
const NEG = [
  ['Schiff: mehr Turret-Hardpoints als High-Slots', (b) => { entry(b, 'ships.json', 'ship.dart').hardpoints.turret = 9; }, 'Turret-Hardpoints'],
  ['Schiff: Klasse passt nicht zur Hülle', (b) => { entry(b, 'ships.json', 'ship.cinder').hull = 'large'; }, 'verlangt hull'],
  ['Schiff: Resistenz > 1', (b) => { entry(b, 'ships.json', 'ship.dart').attributes.shield_res_em = 1.5; }, 'Maximum'],
  ['Schiff: Kampfschiff mit Erzhalle', (b) => { entry(b, 'ships.json', 'ship.lance').attributes.ore_hold = 500; }, 'ore_hold 0'],
  ['Schiff: Bergbauschiff mit Launcher', (b) => { entry(b, 'ships.json', 'ship.digger').hardpoints.launcher = 1; }, 'Launcher-Hardpoints'],
  ['Schiff: Pflichtfeld fehlt', (b) => { delete entry(b, 'ships.json', 'ship.dart').slots; }, 'Pflichtfeld "slots"'],
  ['Schiff: unbekannter Skill in requires', (b) => { entry(b, 'ships.json', 'ship.warden').requires['skill.gibt_es_nicht'] = 1; }, 'gibt_es_nicht'],
  ['Schiff: art ≠ ID', (b) => { entry(b, 'ships.json', 'ship.dart').art = 'ship.pebble'; }, 'art muss'],
  ['Modul: falscher Slot-Typ für die Gruppe', (b) => { const m = entry(b, 'modules.json', 'mod.shield_extender_s'); m.slot = 'low'; }, 'passt nicht zur Gruppe'],
  ['Modul: Hardpoint in Mid-Slot', (b) => { const m = entry(b, 'modules.json', 'mod.autocannon_s'); m.slot = 'mid'; }, 'nur im High-Slot'],
  ['Modul: Rig ohne Calibration', (b) => { delete entry(b, 'modules.json', 'mod.rig_cargo_s').fitting.calibration; }, 'Rig braucht'],
  ['Modul: Rig nicht permanent', (b) => { delete entry(b, 'modules.json', 'mod.rig_cargo_s').permanent; }, 'permanent'],
  ['Modul: mul ohne stackingGroup', (b) => { delete entry(b, 'modules.json', 'mod.mining_upgrade_1').effects[0].stackingGroup; }, 'stackingGroup'],
  ['Modul: Mining-Laser ohne Turret-Hardpoint', (b) => { entry(b, 'modules.json', 'mod.miner_1').hardpoint = 'launcher'; }, 'Turret-Hardpoints'],
  ['Modul: unbekannte Stat-ID', (b) => { entry(b, 'modules.json', 'mod.shield_extender_s').effects[0].stat = 'shield_unfug'; }, 'unbekannte Stat-ID'],
  ['Modul: appliesTo-Gruppe existiert nicht', (b) => { entry(b, 'skills.json', 'skill.mining').effects[0].appliesTo.moduleGroup = 'laserkanone'; }, 'appliesTo.moduleGroup'],
  ['ID doppelt', (b) => { b.files['skills.json'].entries.push(clone(entry(b, 'skills.json', 'skill.mining'))); }, 'Doppelte ID'],
  ['Skill-Zyklus', (b) => { entry(b, 'skills.json', 'skill.mining').requires['skill.mining_upgrades'] = 1; }, 'Zyklus'],
  ['Skill: primary = secondary', (b) => { entry(b, 'skills.json', 'skill.mining').secondary = 'memory'; }, 'nicht gleich sein'],
  ['Skill: Rank 9', (b) => { entry(b, 'skills.json', 'skill.mining').rank = 9; }, 'Maximum'],
  ['Erz: Output-Item fehlt', (b) => { entry(b, 'ores.json', 'ore.veldspar').refine.outputs['item.nichts'] = 5; }, 'Item "item.nichts"'],
  ['Feld: unbekanntes Erz', (b) => { b.files['systems.json'].entries[0].fields[0].oreWeights['ore.nichts'] = 5; }, 'Erz "ore.nichts"'],
  ['Feld: Erz passt nicht zur Sicherheit', (b) => { const d = b.files['systems.json'].entries.find((s) => s.id === 'sys.drosk'); d.fields[0].oreWeights['ore.veldspar'] = 5; }, 'passt nicht zu Sicherheit'],
  ['System: Tor ohne Gegenstelle', (b) => { const s = b.files['systems.json'].entries[0]; s.celestials.find((c) => c.type === 'gate').toGate = 'cel.brenn.gate.nirgendwo'; }, 'Gegentor'],
  ['System: Gegentor verweist woanders hin', (b) => { const s = b.files['systems.json'].entries.find((x) => x.id === 'sys.brenn'); s.celestials.find((c) => c.id === 'cel.brenn.gate.aldara').to = 'sys.kestor'; }, 'Gegentor'],
  ['System: nicht zusammenhängend', (b) => { const v = b.files['systems.json'].entries.find((x) => x.id === 'sys.vael'); v.celestials = v.celestials.filter((c) => c.id !== 'cel.vael.gate.drosk'); }, 'nicht vom Startsystem'],
  ['System: zu wenige Planeten', (b) => { const s = b.files['systems.json'].entries.find((x) => x.id === 'sys.vael'); s.celestials = s.celestials.filter((c) => c.id !== 'cel.vael.p4' && c.id !== 'cel.vael.p2'); }, 'Planeten'],
  ['System: Stationen mit identischen Services', (b) => { const s = b.files['systems.json'].entries.find((x) => x.id === 'sys.brenn'); const st = s.celestials.filter((c) => c.type === 'station'); st[1].services = [...st[0].services]; }, 'identischen services'],
  ['System: Station ohne Eigentümer-Übersetzung', (b) => { b.files['systems.json'].entries[0].celestials.find((c) => c.type === 'station').owner = 'corp.unbekannt'; }, 'ohne i18n-Eintrag'],
  ['Mission: unbekannter NPC', (b) => { entry(b, 'missions.json', 'msn.l1.pirate_patrol').waves[0].npcs[0].id = 'npc.gespenst'; }, 'NPC'],
  ['Mission: Stufe 5', (b) => { entry(b, 'missions.json', 'msn.l1.pirate_patrol').level = 5; }, 'Maximum'],
  ['Mission: falsche Klassen für Stufe', (b) => { entry(b, 'missions.json', 'msn.l2.raider_camp').requires.maxClass = 'battleship'; }, 'verlangt Klassen'],
  ['Mission: Standing ≠ balance', (b) => { entry(b, 'missions.json', 'msn.l3.marauder_nest').requires.standing = 1; }, 'standingRequired'],
  ['Mission: Agent ohne Missionsstation', (b) => { entry(b, 'missions.json', 'msn.l1.pirate_patrol').agentCorp = 'corp.free_traders'; }, 'Service "missions"'],
  ['Mission: zu wenige in Stufe 4', (b) => { b.files['missions.json'].entries = b.files['missions.json'].entries.filter((m) => !(m.level === 4 && m.id.endsWith('tyrant_throne'))); }, 'Stufe 4 hat nur'],
  ['Mission: NPC-Klasse zu hoch', (b) => { entry(b, 'missions.json', 'msn.l1.pirate_patrol').waves[0].npcs[0].id = 'npc.rat_overlord'; }, 'zu hoch'],
  ['NPC: Loot-Item fehlt', (b) => { entry(b, 'npcs.json', 'npc.rat_scout').loot[0].item = 'item.nichts'; }, 'Item "item.nichts"'],
  ['NPC: Resist fehlt', (b) => { delete entry(b, 'npcs.json', 'npc.rat_scout').res.shield.em; }, 'Pflichtfeld "em"'],
  ['balance: Startfitting-Modul in falscher Position', (b) => { b.files['balance.json'].startFitting.high[2] = 'mod.shield_extender_s'; }, 'falsche Position'],
  ['balance: Startfitting-Modul unbekannt', (b) => { b.files['balance.json'].startFitting.high[2] = 'mod.nichts'; }, 'existiert nicht'],
  ['balance: Startfitting überschreitet Powergrid', (b) => { entry(b, 'ships.json', 'ship.pebble').fitting.powergrid = 1; }, 'Powergrid'],
  ['balance: Startfitting braucht fehlenden Skill', (b) => { b.files['balance.json'].startFitting.high[2] = 'mod.strip_miner_1'; }, 'verlangt'],
  ['balance: Startstation in anderem System', (b) => { b.files['balance.json'].startSystem = 'sys.brenn'; }, 'startSystem'],
  ['balance: Startskill unbekannt', (b) => { b.files['balance.json'].startSkills['skill.nichts'] = 1; }, 'skill.nichts'],
  ['balance: Verhältnis falsch', (b) => { b.files['balance.json'].missions.levelHourlyRatio = [1, 2, 3, 4]; }, 'levelHourlyRatio'],
  ['balance: Attribute ≠ Summe', (b) => { b.files['balance.json'].attributes.start.charisma = 25; }, 'summieren'],
  ['Item: Skillbuch ohne Skill', (b) => { entry(b, 'items.json', 'item.skillbook_mining').id = 'item.skillbook_gespenst'; }, 'Skillbuch'],
  ['i18n: Schlüssel fehlt', (b) => { delete b.files['i18n/de.json'].strings['skillgroup.gunnery']; }, 'skillgroup.gunnery'],
  ['Datei fehlt', (b) => { delete b.files['ores.json']; }, 'Datei fehlt'],
  ['Schema fehlt', (b) => { delete b.schemas.ships; }, 'Schema data/schema/ships.schema.json fehlt']
];
for (const [name, mutate, expected] of NEG) {
  test(`negativ: ${name}`, () => {
    const b = fresh();
    mutate(b);
    const res = run(b);
    assert.ok(res.errors.length > 0, 'es müsste ein Fehler gemeldet werden');
    assert.ok(has(res, expected), `Erwartet "${expected}", erhalten:\n${res.errors.slice(0, 6).join('\n')}`);
  });
}

test('Meldungen nennen Datei und ID', () => {
  const b = fresh();
  entry(b, 'ships.json', 'ship.dart').hardpoints.turret = 9;
  const msg = run(b).errors.find((e) => e.includes('Turret-Hardpoints'));
  assert.match(msg, /^\[ships\.json\] ship\.dart:/);
});

test('ext-Dateien werden mitgeprüft', () => {
  const b = fresh();
  b.ext.push({ path: 'ext/a9-test.json', json: { schema: 1, entries: [{ id: 'npc.test_kaputt', name: 'X', class: 'frigate' }] } });
  assert.ok(has(run(b), 'npc.test_kaputt'));
});

test('CLI: grün auf echten Daten, Exit 1 mit lesbarer Meldung bei kaputten Daten', () => {
  const script = join(REPO_ROOT, 'tools/validate-data.mjs');
  const ok = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /OK/);
  const tmp = mkdtempSync(join(tmpdir(), 'tf-data-'));
  try {
    cpSync(join(REPO_ROOT, 'data'), join(tmp, 'data'), { recursive: true });
    const p = join(tmp, 'data/ships.json');
    const json = JSON.parse(readFileSync(p, 'utf8'));
    json.entries.find((e) => e.id === 'ship.dart').hardpoints.turret = 9;
    writeFileSync(p, JSON.stringify(json));
    const bad = spawnSync(process.execPath, [script, '--root', tmp], { encoding: 'utf8' });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /\[ships\.json\] ship\.dart:/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('Klassenreihenfolge ist konsistent', () => {
  assert.deepEqual(CLASS_ORDER, ['frigate', 'destroyer', 'cruiser', 'battlecruiser', 'battleship']);
});
