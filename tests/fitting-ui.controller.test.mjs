import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestData, createTestGame } from './harness.js';
import { createFittingMock } from './mocks/fitting-game.js';
import { createFittingController, fittingAvailability } from '../js/ui/views/fitting/controller.js';

const { data } = createTestData();
const make = (opts = {}) => {
  const game = createFittingMock({ data, skills: 'all', ...opts });
  return { game, ctrl: createFittingController(game) };
};

test('Verfügbarkeit: ohne Fitting-System nicht verfügbar, mit Mock verfügbar', () => {
  const bare = createTestGame({ data });
  assert.equal(fittingAvailability(bare).available, false);
  assert.ok(fittingAvailability(bare).missing.includes('fitting/ships'));
  const vm = createFittingController(bare).viewModel();
  assert.equal(vm.available, false); assert.match(vm.reason, /noch nicht verfügbar/);
  assert.equal(fittingAvailability(make().game).available, true);
});

test('View-Model des Starterschiffs: Schiffe, Ring, Zellen, Panel, Browser', () => {
  const { ctrl } = make();
  const vm = ctrl.viewModel();
  assert.equal(vm.docked, true);
  assert.equal(vm.ships.length, 3);
  assert.equal(vm.ship.uid, 'u1'); assert.equal(vm.ship.typeName, 'Pebble'); assert.equal(vm.ship.classId, 'frigate');
  assert.deepEqual(vm.counts, { high: 3, mid: 3, low: 1, rig: 2 });
  assert.equal(vm.ring.slots.length, 9);
  assert.deepEqual(vm.cells.high.map((c) => c.moduleId), ['mod.miner_1', 'mod.miner_1', null]);
  assert.equal(vm.panel.budget.length, 3);
  assert.equal(vm.hardpoints[0].id, 'turret'); assert.equal(vm.hardpoints[0].state, 'warn');
  assert.equal(vm.browser.slot, 'high'); assert.equal(vm.browser.targetIndex, 2);
  assert.ok(vm.browser.items.length > 0 && vm.browser.groups.length > 0);
  assert.ok(vm.ships[0].label.includes('Pebble') && vm.ships[0].label.includes('aktiv'));
});

test('Nicht angedockt: Hinweis statt Ansicht', () => {
  const vm = make({ docked: false }).ctrl.viewModel();
  assert.equal(vm.docked, false);
  assert.match(vm.notice, /nur angedockt/);
  assert.deepEqual(vm.ships, []);
});

test('Lesen ändert nie den State; Fallback (state) und Selektor fitting/layout liefern dasselbe', () => {
  const a = make();
  const before = JSON.stringify(a.game.state);
  a.ctrl.viewModel(); a.ctrl.setHover({ moduleId: 'mod.miner_1' }); a.ctrl.preview(); a.ctrl.viewModel();
  assert.equal(JSON.stringify(a.game.state), before);
  const b = make({ withLayout: true });
  assert.equal(b.game.hasSelector('fitting/layout'), true);
  assert.deepEqual(b.ctrl.viewModel().cells, a.ctrl.viewModel().cells);
});

test('Einbauen: gewählter freier Slot, Lager sinkt, Meldung; Ausbauen gibt zurück', () => {
  const { game, ctrl } = make({ stock: 'all' });
  ctrl.selectTab('mid');
  const mod = ctrl.viewModel().browser.items.find((m) => m.canEquip);
  assert.ok(mod, 'es gibt ein einbaubares Mid-Modul');
  ctrl.selectSlot('mid', 1);
  const stockBefore = game.state.assets.stations['cel.aldara.p1.station'].items[mod.moduleId];
  const res = ctrl.equip(mod.moduleId);
  assert.equal(res.ok, true); assert.equal(res.index, 1);
  assert.match(res.message, /eingebaut/);
  assert.equal(game.state.assets.ships[0].fitting.mid[1], mod.moduleId);
  assert.equal(game.state.assets.stations['cel.aldara.p1.station'].items[mod.moduleId], stockBefore - 1);
  assert.equal(ctrl.viewModel().cells.mid[1].moduleId, mod.moduleId);
  const out = ctrl.unequip('mid', 1);
  assert.equal(out.ok, true); assert.match(out.message, /ausgebaut/);
  assert.equal(game.state.assets.stations['cel.aldara.p1.station'].items[mod.moduleId], stockBefore);
});

test('Ohne gewählten Slot: erster freier; kein freier Slot → Meldung, keine Action', () => {
  const { game, ctrl } = make({ stock: 'all' });
  const mod = ctrl.viewModel().browser.items.find((m) => m.moduleId === 'mod.miner_1');
  // High: 2 von 3 belegt, Hardpoints voll → Mining-Laser scheitert; dafür Slot-voll-Fall mit Low prüfen
  ctrl.selectTab('low');
  const low = ctrl.viewModel().browser.items.find((m) => m.canEquip);
  assert.equal(ctrl.equip(low.moduleId).ok, true);                    // belegt den einzigen Low-Slot
  const full = ctrl.viewModel();
  assert.equal(full.browser.targetIndex, -1);
  assert.ok(full.browser.items.every((m) => !m.canEquip));
  assert.match(full.browser.items.find((m) => m.usable)?.reason ?? 'Kein freier', /Kein freier/);
  let calls = 0; const orig = game.dispatch; game.dispatch = (...a) => { calls++; return orig(...a); };
  const res = ctrl.equip(low.moduleId);
  assert.equal(res.ok, false); assert.match(res.message, /Kein freier/); assert.equal(calls, 0);
  assert.ok(mod);
});

test('Ungültiger Drop: Fehlercode-Text aus der Engine (Slot-Typ), Zustand unverändert', () => {
  const { game, ctrl } = make({ stock: 'all' });
  ctrl.selectTab('mid');
  const mid = ctrl.viewModel().browser.items.find((m) => m.canEquip);
  const before = JSON.stringify(game.state.assets);
  const res = ctrl.equip(mid.moduleId, { slot: 'high', index: 2 });
  assert.equal(res.ok, false); assert.equal(res.error, 'fit.slot_type');
  assert.equal(res.message, data.i18n.de.strings['error.fit.slot_type']);
  assert.equal(JSON.stringify(game.state.assets), before);
  const occupied = ctrl.equip(mid.moduleId, { slot: 'mid', index: 0 });   // frei → ok
  assert.equal(occupied.ok, true);
  assert.equal(ctrl.equip(mid.moduleId, { slot: 'mid', index: 0 }).error, 'fit.slot_occupied');
});

test('Fehlende i18n-Texte der Engine (message = Code) werden durch ui.fitting.err.* ersetzt', () => {
  const { ctrl } = make({ stock: 'all' });
  ctrl.selectTab('high');
  const big = ctrl.viewModel().browser.items.find((m) => m.moduleId.includes('medium') || m.size === 'medium');
  const res = ctrl.equip(big.moduleId, { slot: 'high', index: 2 });
  assert.equal(res.error, 'fit.size');
  assert.equal(res.message, data.i18n.de.strings['ui.fitting.err.fit.size']);
});

test('Rig-Ausbau: erst Bestätigung, ohne Bestätigung bleibt das Rig; mit confirm zerstört und nicht im Lager', () => {
  const { game, ctrl } = make({ stock: 'all' });
  ctrl.selectTab('rig');
  const rig = ctrl.viewModel().browser.items.find((m) => m.canEquip);
  assert.equal(ctrl.equip(rig.moduleId).ok, true);
  const stock = () => game.state.assets.stations['cel.aldara.p1.station'].items[rig.moduleId];
  const stockAfterEquip = stock();
  const ask = ctrl.unequip('rig', 0);
  assert.equal(ask.needsConfirm, true); assert.match(ask.confirm.message, /zerstört/);
  assert.equal(game.state.assets.ships[0].fitting.rig[0], rig.moduleId);
  const done = ctrl.unequip('rig', 0, { confirm: true });
  assert.equal(done.ok, true); assert.match(done.message, /zerstört/);
  assert.equal(game.state.assets.ships[0].fitting.rig[0], null);
  assert.equal(stock(), stockAfterEquip, 'zerstört: nicht zurück ins Lager');
  assert.equal(ctrl.unequip('rig', 0).ok, false, 'leerer Slot');
});

test('Engine verlangt Bestätigung auch bei Nicht-Rig → Dialog statt Fehler', () => {
  const game = createFittingMock({ data });
  const orig = game.dispatch;
  game.dispatch = (type, p) => (type === 'fitting/unequip' && !p.confirm ? { ok: false, error: 'fit.rig_confirm', needsConfirm: true } : orig(type, p));
  const res = createFittingController(game).unequip('high', 0);
  assert.equal(res.needsConfirm, true);
});

test('Δ-Vorschau: Einbau und Ausbau zeigen nur Änderungen; blockierte Module zeigen den Grund', () => {
  const { ctrl } = make({ stock: 'all' });
  ctrl.selectTab('low');
  const armor = ctrl.viewModel().browser.items.find((m) => m.canEquip);
  ctrl.setHover({ moduleId: armor.moduleId });
  const pv = ctrl.viewModel().preview;
  assert.equal(pv.kind, 'equip'); assert.ok(pv.rows.length > 0); assert.ok(pv.rows.every((r) => r.text.startsWith('+') || r.text.startsWith('−')));
  ctrl.selectTab('high');
  ctrl.setHover({ unequip: { slot: 'high', index: 0 } });
  const un = ctrl.preview();
  assert.equal(un.kind, 'unequip'); assert.ok(un.rows.some((r) => r.path === 'mining.m3PerTick' && r.tone === 'bad'));
  ctrl.setHover({ moduleId: 'mod.autocannon_s' });
  assert.ok(ctrl.preview().message.length > 0, 'Waffe passt nicht (Hardpoints/Skill): Grund wird gezeigt');
  ctrl.setHover(null);
  assert.equal(ctrl.preview(), null);
});

test('Skill-Grund mit Skillnamen und Größe/Hardpoint-Gründe in der Modulliste (Starter-Profil)', () => {
  const { ctrl } = make({ stock: 'all', skills: 'starter' });
  ctrl.selectTab('mid');
  const mid = ctrl.viewModel().browser.items;
  assert.ok(mid.every((m) => !m.usable), 'Starter hat keine Mid-Skills: alles grau');
  assert.ok(mid.some((m) => /Benötigt: .*Schild/.test(m.reason)), 'Skillname im Grund');
  ctrl.selectTab('high');
  const items = ctrl.viewModel().browser.items;
  const blocked = items.filter((m) => !m.usable);
  assert.ok(blocked.length > 0 && blocked.every((m) => m.reason.length > 0));
  assert.ok(blocked.some((m) => m.reason.includes(data.skills['skill.gunnery'].name) || /Waffenpl/.test(m.reason) || /Rumpfgröße/.test(m.reason)));
});

test('Filter: Suche, Gruppe, nur ausrüstbare, nur Lager; Gruppe wird beim Tabwechsel/Verschwinden zurückgesetzt', () => {
  const { ctrl } = make({ stock: 'most' });
  ctrl.selectTab('mid');
  const all = ctrl.viewModel().browser;
  const g = all.groups[0];
  ctrl.setFilter({ group: g.id });
  assert.ok(ctrl.viewModel().browser.items.every((m) => m.group === g.id));
  ctrl.setFilter({ onlyUsable: true });
  assert.ok(ctrl.viewModel().browser.items.every((m) => m.usable));
  ctrl.setFilter({ onlyUsable: false, group: '', inStockOnly: true });
  assert.ok(ctrl.viewModel().browser.items.every((m) => m.qtyInStation > 0));
  ctrl.setFilter({ inStockOnly: false, search: 'zzzz-gibt-es-nicht' });
  assert.equal(ctrl.viewModel().browser.items.length, 0);
  ctrl.setFilter({ search: '', group: g.id });
  ctrl.selectTab('low');
  assert.equal(ctrl.ui.group, '');
  ctrl.setFilter({ group: 'gibt_es_nicht' });
  assert.equal(ctrl.viewModel().ui.group, '', 'unbekannte Gruppe wird verworfen');
});

test('Schiffsumschalter wechselt Ring und setzt Auswahl zurück; unbekannte uid fällt auf aktives Schiff', () => {
  const { ctrl } = make();
  ctrl.selectSlot('mid', 1);
  ctrl.selectShip('u3');
  const vm = ctrl.viewModel();
  assert.equal(vm.ship.uid, 'u3'); assert.equal(vm.ship.typeName, 'Warden');
  assert.equal(vm.counts.high, 5); assert.equal(vm.selected, null); assert.equal(ctrl.ui.slot, 'high');
  ctrl.selectShip('gibt-es-nicht');
  assert.equal(ctrl.viewModel().ship.uid, 'u1');
});

test('selectSlot: Slot-Typ-Wechsel, Browser öffnet; Index außerhalb wird verworfen', () => {
  const { ctrl } = make();
  ctrl.selectSlot('low', 0);
  assert.equal(ctrl.ui.browserOpen, true);
  assert.equal(ctrl.viewModel().selected.label, 'Low-Slot 1');
  ctrl.selectSlot('low', 9);
  assert.equal(ctrl.viewModel().selected, null);
  ctrl.selectSlot('xyz', 0);
  assert.equal(ctrl.ui.slot, 'low');
});

test('Werte nur aus Selektoren: Controller ruft für Änderungen ausschließlich game.dispatch', () => {
  const { game, ctrl } = make({ stock: 'all' });
  const dispatched = [];
  const orig = game.dispatch; game.dispatch = (t, p) => { dispatched.push(t); return orig(t, p); };
  ctrl.selectTab('mid');
  ctrl.equip(ctrl.viewModel().browser.items.find((m) => m.canEquip).moduleId);
  ctrl.unequip('mid', 0);
  assert.deepEqual(dispatched, ['fitting/equip', 'fitting/unequip']);
});

test('Referenz-Check: Ring und View-Model funktionieren für alle 14 Schiffe', () => {
  const { ctrl } = make({ extraShips: data.lists.ships.map((s) => s.id).filter((id) => id !== 'ship.pebble') });
  const uids = ctrl.viewModel().ships.map((s) => s.uid);
  assert.equal(uids.length, 14);
  for (const uid of uids) {
    ctrl.selectShip(uid);
    const vm = ctrl.viewModel();
    const total = Object.values(vm.counts).reduce((a, b) => a + b, 0);
    assert.equal(vm.ring.slots.length, total, vm.ship.typeId);
    assert.equal(vm.browser.tabs.length, 4);
  }
});
