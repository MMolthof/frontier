import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestData, createTestGame } from './harness.js';
import { createFittingMock } from './mocks/fitting-game.js';
import { installFakeDom } from './fitting-ui.fake-dom.js';

const { data } = createTestData();
let dom, view;

beforeEach(async () => {
  dom = installFakeDom();
  ({ view } = await import('../js/ui/views/fitting/index.js'));
});
afterEach(() => dom.restore());

const mount = (opts = {}) => {
  const game = createFittingMock({ data, skills: 'all', stock: 'all', ...opts });
  view.render(dom.root, game);
  return game;
};
const $ = (sel) => dom.root.querySelector(sel);
const $$ = (sel) => dom.root.querySelectorAll(sel);
const toasts = () => $$('.c-fit-toast').map((e) => e.textContent);
const slotBtn = (slot, i) => $(`[data-fit-focus="slot:${slot}:${i}"]`);
const equipBtn = (id) => $(`[data-fit-focus="mod:${id}"]`);

test('view-Objekt entspricht dem Vertrag; enabled() begründet Nichtverfügbarkeit', () => {
  assert.equal(view.id, 'fitting'); assert.equal(view.group, 'fitting'); assert.equal(view.order, 30);
  assert.equal(typeof view.render, 'function'); assert.equal(typeof view.update, 'function');
  assert.equal(view.enabled(createFittingMock({ data })), true);
  const off = view.enabled(createTestGame({ data }));
  assert.equal(off.enabled, false); assert.match(off.reason, /noch nicht verfügbar/);
});

test('render: Ring mit allen Slots, Hardpoint-Chips, Panel, Browser, Schiffsumschalter', () => {
  mount();
  assert.equal($$('.c-fit-slot').length, 9);                       // Pebble: 3+3+1+2
  assert.equal($$('.c-fit-slot--high').length, 3);
  assert.equal($$('.c-fit-slot.is-filled').length, 2);             // 2 Miner vorausgerüstet
  assert.equal($$('.c-fit-slot.is-empty').length, 7);
  assert.equal(slotBtn('high', 0).getAttribute('aria-pressed'), 'false');
  assert.match(slotBtn('high', 0).getAttribute('aria-label'), /High-Slot 1: Bergbaulaser/);
  assert.match(slotBtn('mid', 0).getAttribute('aria-label'), /Mid-Slot 1, leer/);
  assert.equal(slotBtn('high', 0).styleProps.get('--fit-x').endsWith('%'), true);
  assert.match($('.c-fit-hardpoints').textContent, /Geschützplatz 2\/2/);
  assert.equal($$('.c-fit-bar').length, 3);
  assert.equal($$('.c-fit-res tbody tr').length, 4);
  assert.equal($$('.c-fit-tab').length, 4);
  assert.equal($$('#c-fit-ship option').length, 3);
  assert.ok($('.c-fit-ring__name').textContent === 'Pebble');
  assert.equal($('.c-fit-ring').getAttribute('role'), 'group');
});

test('genau ein Slot im Ring ist per Tab erreichbar (roving tabindex)', () => {
  mount();
  const tab0 = $$('.c-fit-slot').filter((b) => b.getAttribute('tabindex') === '0');
  assert.equal(tab0.length, 1);
});

test('Klick auf Slot wählt ihn, öffnet den Browser für diesen Typ und zeigt das Ziel', () => {
  mount();
  slotBtn('mid', 1).click();
  assert.equal(slotBtn('mid', 1).getAttribute('aria-pressed'), 'true');
  assert.ok(slotBtn('mid', 1).classes.includes('is-selected'));
  assert.equal($('.c-fit-browser').getAttribute('data-open'), 'true');
  assert.ok($('.c-fit-tab--mid').classes.includes('is-active'));
  assert.match($('.c-fit-browser__target').textContent, /Ziel: Mid-Slot 2/);
  assert.match($('.c-fit-selected').textContent, /Mid-Slot 2/);
});

test('Einbauen per Button: Dispatch, Toast, Ring und Panel aktualisieren sich', () => {
  const game = mount();
  slotBtn('mid', 0).click();
  const row = $$('.c-fit-mod').find((li) => equipBtn(li.attrs.get('data-module-id')) && li.querySelector('.c-fit-mod__equip').getAttribute('aria-disabled') === 'false');
  assert.ok(row, 'ein einbaubares Modul ist sichtbar');
  const id = row.attrs.get('data-module-id');
  const pgBefore = $$('.c-fit-bar__text')[0].textContent;
  equipBtn(id).click();
  assert.equal(game.state.assets.ships[0].fitting.mid[0], id);
  assert.ok(toasts().some((t) => /eingebaut/.test(t)));
  assert.ok(slotBtn('mid', 0).classes.includes('is-filled'));
  assert.notEqual($$('.c-fit-bar__text')[0].textContent, pgBefore, 'PG-Balken zeigt neuen Wert');
  assert.ok($$('.c-fit-row').some((r) => r.textContent.includes(game.data.modules[id].name)));
});

test('Doppelklick legt ein; blockierte Module sind aria-disabled, zeigen den Grund und lösen keine Action aus', () => {
  const game = mount({ skills: 'starter' });
  slotBtn('mid', 0).click();
  const blocked = $$('.c-fit-mod.is-blocked')[0];
  assert.ok(blocked); assert.ok(blocked.querySelector('.c-fit-mod__why').textContent.length > 5);
  const btn = blocked.querySelector('.c-fit-mod__equip');
  assert.equal(btn.getAttribute('aria-disabled'), 'true');
  assert.equal(btn.getAttribute('aria-describedby'), blocked.querySelector('.c-fit-mod__why').getAttribute('id'));
  let calls = 0; const orig = game.dispatch; game.dispatch = (...a) => { calls++; return orig(...a); };
  btn.click(); blocked.dispatch('dblclick');
  assert.equal(calls, 0);
  game.dispatch = orig;
  // Doppelklick auf einbaubares Modul (High: Miner-Zeile, Hardpoints voll → es gibt keines) → Low mit Skills
  const g2 = mount({ skills: 'all' });
  $('.c-fit-tab--low').click();
  const ok = $$('.c-fit-mod').find((li) => li.querySelector('.c-fit-mod__equip').getAttribute('aria-disabled') === 'false');
  ok.dispatch('dblclick');
  assert.ok(g2.state.assets.ships[0].fitting.low[0]);
});

test('Hover/Fokus auf Modul zeigt Δ-Vorschau (nur Änderungen), Verlassen leert sie', () => {
  mount();
  $('.c-fit-tab--low').click();
  const row = $$('.c-fit-mod').find((li) => li.querySelector('.c-fit-mod__equip').getAttribute('aria-disabled') === 'false');
  assert.match($('.c-fit-preview').textContent, /Fahre über ein Modul/);
  row.dispatch('mouseenter', {}, false);
  assert.ok($$('.c-fit-delta__row').length > 0);
  assert.match($('.c-fit-preview__title').textContent, /Änderung durch/);
  assert.ok($$('.c-fit-delta__val').every((v) => /^[+−]/.test(v.textContent)));
  row.dispatch('mouseleave', {}, false);
  assert.equal($$('.c-fit-delta__row').length, 0);
  row.querySelector('.c-fit-mod__equip').focus();            // Tastatur: Fokus löst Vorschau aus
  assert.ok($$('.c-fit-delta__row').length > 0);
});

test('Ausbauen (Nicht-Rig) per Liste; Vorschau beim Überfahren des Buttons', () => {
  const game = mount();
  const remove = $('[data-fit-focus="remove:high:0"]');
  remove.dispatch('mouseenter', {}, false);
  assert.match($('.c-fit-preview__title').textContent, /Änderung ohne/);
  remove.click();
  assert.equal(game.state.assets.ships[0].fitting.high[0], null);
  assert.ok(toasts().some((t) => /ausgebaut/.test(t)));
  assert.ok(slotBtn('high', 0).classes.includes('is-empty'));
});

test('Rig-Ausbau: Dialog; Abbrechen ändert nichts, Bestätigen zerstört das Rig', async () => {
  const game = mount();
  $('.c-fit-tab--rig').click();
  const row = $$('.c-fit-mod').find((li) => li.querySelector('.c-fit-mod__equip').getAttribute('aria-disabled') === 'false');
  equipBtn(row.attrs.get('data-module-id')).click();
  const rigId = game.state.assets.ships[0].fitting.rig[0];
  assert.ok(rigId);

  $('[data-fit-focus="remove:rig:0"]').click();
  const dlg = $('dialog');
  assert.ok(dlg && dlg.open, 'Bestätigungsdialog offen');
  assert.match(dlg.textContent, /zerstört/);
  assert.equal(game.state.assets.ships[0].fitting.rig[0], rigId, 'noch eingebaut');
  dlg.querySelectorAll('.c-fit-btn').find((b) => !b.classes.includes('c-fit-btn--danger')).click();   // Abbrechen
  await new Promise((r) => setImmediate(r));
  assert.equal(game.state.assets.ships[0].fitting.rig[0], rigId);
  assert.equal($('dialog'), null);

  $('[data-fit-focus="remove:rig:0"]').click();
  $('dialog .c-fit-btn--danger').click();                            // Bestätigen
  await new Promise((r) => setImmediate(r));
  assert.equal(game.state.assets.ships[0].fitting.rig[0], null);
  assert.ok(toasts().some((t) => /zerstört/.test(t)));
});

test('Pfeiltasten im Ring bewegen den Fokus im Uhrzeigersinn; Entf baut aus', () => {
  const game = mount();
  slotBtn('high', 0).focus();
  const ev = slotBtn('high', 0).dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(ev.defaultPrevented, true);
  assert.equal(dom.document.activeElement, slotBtn('high', 1));
  assert.equal(slotBtn('high', 1).getAttribute('tabindex'), '0');
  assert.equal(slotBtn('high', 0).getAttribute('tabindex'), '-1');
  slotBtn('high', 1).dispatch('keydown', { key: 'ArrowLeft' });
  slotBtn('high', 0).dispatch('keydown', { key: 'ArrowLeft' });
  assert.equal(dom.document.activeElement, slotBtn('low', 0), 'Umlauf nach links springt zum letzten Slot');
  slotBtn('high', 0).dispatch('keydown', { key: 'a' });
  slotBtn('high', 0).dispatch('keydown', { key: 'Delete' });
  assert.equal(game.state.assets.ships[0].fitting.high[0], null, 'Entf auf belegtem Slot baut aus');
});

test('Drag & Drop: gültiger Drop baut ein, ungültiger zeigt den Fehlertext', () => {
  const game = mount();
  $('.c-fit-tab--mid').click();
  const row = $$('.c-fit-mod').find((li) => li.querySelector('.c-fit-mod__equip').getAttribute('aria-disabled') === 'false');
  const id = row.attrs.get('data-module-id');
  const dt = { setData() {}, effectAllowed: '', dropEffect: '' };

  row.dispatch('dragstart', { dataTransfer: dt });
  assert.equal($('.c-fit').getAttribute('data-drag'), 'mid');
  const bad = slotBtn('high', 2).dispatch('drop', { dataTransfer: dt });   // falscher Slot-Typ
  assert.equal(bad.defaultPrevented, true);
  assert.ok(toasts().some((t) => /passt nicht in diesen Slot/.test(t)), 'Fehlertext des Fehlercodes');
  assert.equal($('.c-fit').getAttribute('data-drag'), null);

  $$('.c-fit-mod').find((li) => li.attrs.get('data-module-id') === id).dispatch('dragstart', { dataTransfer: dt });
  slotBtn('mid', 2).dispatch('dragover', { dataTransfer: dt });
  slotBtn('mid', 2).dispatch('drop', { dataTransfer: dt });
  assert.equal(game.state.assets.ships[0].fitting.mid[2], id);
  $$('.c-fit-mod')[0].dispatch('dragend');
  assert.equal($('.c-fit').getAttribute('data-drag'), null);
});

test('Drop ohne laufenden Drag wird ignoriert', () => {
  const game = mount();
  const before = JSON.stringify(game.state.assets);
  slotBtn('mid', 0).dispatch('drop', { dataTransfer: {} });
  assert.equal(JSON.stringify(game.state.assets), before);
});

test('Suche und Gruppenfilter: Eingabefeld bleibt dasselbe Element (Fokus bleibt), Liste filtert', () => {
  mount();
  $('.c-fit-tab--low').click();
  const input = $('#c-fit-search');
  const total = $$('.c-fit-mod').length;
  input.focus();
  input.value = 'zzzz-gibt-es-nicht';
  input.dispatch('input');
  assert.equal($$('.c-fit-mod').length, 0);
  assert.match($('.c-fit-modules__empty').textContent, /Keine Module/);
  assert.equal($('#c-fit-search'), input, 'Feld nicht neu erzeugt');
  assert.equal(dom.document.activeElement, input, 'Fokus erhalten');
  input.value = '';
  input.dispatch('input');
  assert.equal($$('.c-fit-mod').length, total);
  const groupSel = $$('select')[1];
  assert.ok(groupSel.children.length > 2);
  groupSel.value = groupSel.children[1].value;
  groupSel.dispatch('change');
  assert.ok($$('.c-fit-mod').length < total && $$('.c-fit-mod').length > 0);
  const usable = $('#c-fit-usable'); usable.checked = true; usable.dispatch('change');
  assert.ok($$('.c-fit-mod').every((li) => !li.classes.includes('is-blocked')));
});

test('Fokus bleibt nach Aktion auf der passenden Schaltfläche (Wiederherstellung per data-fit-focus)', () => {
  mount();
  const remove = $('[data-fit-focus="remove:high:0"]');
  remove.focus();
  remove.click();
  const active = dom.document.activeElement;
  assert.equal(active.getAttribute('data-fit-focus'), 'slot:high:0', 'nach Ausbau: Fokus auf den nun leeren Slot');
  assert.ok(dom.root.contains(active));
});

test('Schiffsumschalter wechselt das Schiff; Ring baut sich neu auf', () => {
  mount();
  const sel = $('#c-fit-ship');
  assert.equal(sel.children.length, 3);
  assert.equal(sel.value, 'u1');
  sel.value = 'u3'; sel.dispatch('change');
  assert.equal($$('.c-fit-slot').length, 16);                      // Warden 5+3+5+3
  assert.equal($('.c-fit-ring__name').textContent, 'Warden');
});

test('Nicht angedockt: Hinweisbanner mit Begründung, Raster ausgeblendet; Andocken zeigt die Ansicht', () => {
  const game = mount({ docked: false });
  assert.equal($('.c-fit-notice').hidden, false);
  assert.match($('.c-fit-notice').textContent, /nur angedockt möglich/);
  assert.equal($('.c-fit__grid').hidden, true);
  game.dispatch('mock/setDocked', { docked: true });
  view.render(dom.root, game);
  assert.equal($('.c-fit-notice').hidden, true);
  assert.equal($('.c-fit__grid').hidden, false);
  assert.equal($$('.c-fit-slot').length, 9);
});

test('Ohne Fitting-System: Hinweis statt Absturz', () => {
  view.render(dom.root, createTestGame({ data }));
  assert.equal($('.c-fit-empty').hidden, false);
  assert.match($('.c-fit-empty').textContent, /noch nicht verfügbar/);
  assert.equal($('.c-fit__grid').hidden, true);
});

test('update(): höchstens einmal pro Sekunde ohne eigene Aktion, erkennt dann Änderungen von außen', () => {
  const game = mount();
  let nowValue = 1000;
  const real = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  Object.defineProperty(globalThis, 'performance', { value: { now: () => nowValue }, configurable: true, writable: true });
  try {
    view.render(dom.root, game);                               // last = 1000
    game.dispatch('fitting/unequip', { uid: 'u1', slot: 'high', index: 0 });   // Änderung von außen
    nowValue = 1500; view.update(dom.root, game);
    assert.ok(slotBtn('high', 0).classes.includes('is-filled'), 'gedrosselt: noch alter Stand');
    nowValue = 2100; view.update(dom.root, game);
    assert.ok(slotBtn('high', 0).classes.includes('is-empty'), 'nach 1 s aktualisiert');
  } finally {
    if (real) Object.defineProperty(globalThis, 'performance', real);
  }
});

test('update() ohne vorheriges render baut die Ansicht auf', () => {
  const game = createFittingMock({ data, skills: 'all' });
  view.update(dom.root, game);
  assert.equal($$('.c-fit-slot').length, 9);
});

test('Jede Änderung läuft über game.dispatch: Views mutieren den State nie direkt', () => {
  const game = mount();
  const calls = [];
  const orig = game.dispatch; game.dispatch = (t, p) => { calls.push(t); return orig(t, p); };
  const stateBefore = JSON.stringify(game.state);
  slotBtn('mid', 0).click(); $('.c-fit-tab--low').click(); $('#c-fit-search').dispatch('input');
  assert.equal(JSON.stringify(game.state), stateBefore, 'reines Navigieren ändert den State nicht');
  assert.deepEqual(calls, []);
  $('[data-fit-focus="remove:high:1"]').click();
  assert.deepEqual(calls, ['fitting/unequip']);
});

test('Tab-Leiste per Pfeiltaste: Auswahl wechselt UND der Fokus folgt auf den neuen Tab', () => {
  mount();
  $('.c-fit-tab--high').focus();
  const ev = $('.c-fit-tab--high').dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(ev.defaultPrevented, true);
  assert.ok($('.c-fit-tab--mid').classes.includes('is-active'));
  assert.equal(dom.document.activeElement.getAttribute('data-fit-focus'), 'tab:mid');
  assert.equal($('.c-fit-tab--mid').getAttribute('tabindex'), '0');
  assert.equal($('.c-fit-tab--high').getAttribute('tabindex'), '-1');
  $('.c-fit-tab--mid').dispatch('keydown', { key: 'End' });
  assert.equal(dom.document.activeElement.getAttribute('data-fit-focus'), 'tab:rig');
  $('.c-fit-tab--rig').dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(dom.document.activeElement.getAttribute('data-fit-focus'), 'tab:high', 'Umlauf');
  $('.c-fit-tab--low').click();
  assert.equal(dom.document.activeElement.getAttribute('data-fit-focus'), 'tab:low');
});
