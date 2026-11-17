import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeDom } from './ui-fake-dom.mjs';
import {
  button, updateButton, meter, updateMeter, statBar, updateStatBar, table, updateTable, tabs, updateTabs,
  openModal, confirmDialog, createToastRegion, tooltip, slotRing, updateSlotRing, slotRingGeometry, slotRingLayout,
  resistMatrix, updateResistMatrix, sparkline, updateSparkline, sparklinePoints, progressTimeline, updateProgressTimeline,
  emptyState, card, shipArt
} from '../js/ui/components/index.js';

const dom = createFakeDom();
dom.install();
const { document, key, FakeEvent } = dom;

test('Button: Klick ruft Handler, deaktiviert bleibt fokussierbar und ignoriert Klicks', () => {
  let clicks = 0;
  const b = button({ label: 'Los', onClick: () => { clicks += 1; } });
  b.click();
  assert.equal(clicks, 1);
  updateButton(b, { disabled: true, reason: 'Nur in der Station' });
  b.click();
  assert.equal(clicks, 1);
  assert.equal(b.getAttribute('aria-disabled'), 'true');
  assert.equal(b.getAttribute('title'), 'Nur in der Station');
  assert.equal(b.hasAttribute('disabled'), false);
  updateButton(b, { disabled: false, label: 'Weiter', pressed: true });
  assert.equal(b.getAttribute('aria-pressed'), 'true');
  assert.equal(b.textContent, 'Weiter');
});

test('Button: Icon-only braucht Beschriftung und erhält sie', () => {
  const b = button({ icon: 'close', ariaLabel: 'Schließen' });
  assert.equal(b.getAttribute('aria-label'), 'Schließen');
  assert.ok(b.classList.contains('c-btn--icon'));
});

test('Meter und StatBar: Werte, Aria und Update in place', () => {
  const m = meter({ label: 'Warp', value: 5, max: 10 });
  assert.equal(m.getAttribute('aria-valuenow'), '5');
  const bar = m.querySelector('.c-meter__bar');
  updateMeter(m, { label: 'Warp', value: 20, max: 10 });
  assert.equal(m.getAttribute('aria-valuenow'), '10', 'wird auf max begrenzt');
  assert.equal(bar.style.width, '100%');
  assert.equal(m.querySelector('.c-meter__bar'), bar, 'Knoten bleibt erhalten');

  const s = statBar({ label: 'Powergrid', value: 30, max: 48, unit: 'MW' });
  assert.equal(s.classList.contains('c-statbar--over'), false);
  updateStatBar(s, { label: 'Powergrid', value: 52, max: 48, unit: 'MW' });
  assert.ok(s.classList.contains('c-statbar--over'));
  assert.match(s.querySelector('.c-statbar__over').textContent, /\+4 zu viel/);
  assert.match(s.getAttribute('aria-valuetext'), /zu viel/);
});

test('Tabelle: Sortierung, aria-sort, Zeilenklick, Update wiederverwendet Zeilen-Elemente', () => {
  const rows = [{ id: 'a', name: 'Zeta', au: 3 }, { id: 'b', name: 'Alpha', au: 1 }, { id: 'c', name: 'Mitte', au: 2 }];
  let clicked = null;
  const el = table({
    caption: 'Objekte', rows, onRowClick: (r) => { clicked = r.id; },
    columns: [{ key: 'name', label: 'Name', sortable: true }, { key: 'au', label: 'AU', sortable: true, align: 'right' }]
  });
  const order = () => el.querySelectorAll('tbody tr').map((tr) => tr.children[0].textContent);
  assert.deepEqual(order(), ['Zeta', 'Alpha', 'Mitte']);
  const sortBtn = el.querySelectorAll('.c-table__sort')[0];
  sortBtn.click();
  assert.deepEqual(order(), ['Alpha', 'Mitte', 'Zeta']);
  assert.equal(el.querySelectorAll('th')[0].getAttribute('aria-sort'), 'ascending');
  sortBtn.click();
  assert.deepEqual(order(), ['Zeta', 'Mitte', 'Alpha']);
  assert.equal(el.querySelectorAll('th')[0].getAttribute('aria-sort'), 'descending');

  const firstRow = el.querySelectorAll('tbody tr')[0];
  updateTable(el, { rows: [{ id: 'a', name: 'Zeta II', au: 3 }, { id: 'c', name: 'Mitte', au: 2 }] });
  assert.equal(el.querySelectorAll('tbody tr').length, 2);
  assert.equal(el.querySelectorAll('tbody tr')[0], firstRow, 'Zeile wiederverwendet');
  assert.equal(firstRow.children[0].textContent, 'Zeta II');
  firstRow.click();
  assert.equal(clicked, 'a');
  assert.equal(el.getAttribute('role'), 'region');
  assert.equal(el.getAttribute('tabindex'), '0');
  updateTable(el, { rows: [] });
  assert.match(el.querySelector('.c-table__empty').textContent, /Keine Daten/);
});

test('Tabs: Pfeiltasten, Home/End, roving tabindex, deaktivierte werden übersprungen', () => {
  const selected = [];
  const el = tabs({ label: 'Reiter', active: 'a', onSelect: (id) => selected.push(id), tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', disabled: true, reason: 'gesperrt' }, { id: 'c', label: 'C' }] });
  document.body.appendChild(el);
  const [a, b, c] = el.children;
  assert.equal(a.getAttribute('tabindex'), '0');
  assert.equal(b.getAttribute('tabindex'), '-1');
  a.focus();
  key(el, 'ArrowRight');
  assert.deepEqual(selected, ['c']);
  assert.equal(c.getAttribute('aria-selected'), 'true');
  assert.equal(document.activeElement, c);
  key(el, 'ArrowRight');
  assert.equal(selected.at(-1), 'a');
  key(el, 'End');
  assert.equal(selected.at(-1), 'c');
  key(el, 'Home');
  assert.equal(selected.at(-1), 'a');
  b.click();
  assert.equal(selected.at(-1), 'a', 'deaktivierter Tab löst nichts aus');
  updateTabs(el, { active: 'c' });
  assert.equal(c.getAttribute('aria-selected'), 'true');
});

test('Modal: Fokusfalle, Esc schließt und gibt den Fokus zurück, Bestätigung liefert true/false', async () => {
  const opener = button({ label: 'Öffnen' });
  document.body.appendChild(opener);
  opener.focus();
  const modal = openModal({ title: 'Titel', content: 'Inhalt', actions: [{ label: 'Eins', value: 1 }, { label: 'Zwei', value: 2 }] });
  const [first, last] = modal.el.querySelectorAll('button');
  assert.equal(document.activeElement, first);
  last.focus();
  const tab = key(modal.el, 'Tab');
  assert.ok(tab.defaultPrevented);
  assert.equal(document.activeElement, first, 'Tab vom letzten springt zum ersten');
  const back = key(modal.el, 'Tab', { shiftKey: true });
  assert.ok(back.defaultPrevented);
  assert.equal(document.activeElement, last);
  assert.equal(modal.el.querySelector('[role="dialog"]').getAttribute('aria-modal'), 'true');
  key(modal.el, 'Escape');
  assert.equal(await modal.closed, undefined);
  assert.equal(document.activeElement, opener);
  assert.equal(modal.el.parentNode, null);

  const pending = confirmDialog({ title: 'Löschen?', message: 'Sicher?', danger: true });
  const dialog = document.body.querySelector('.c-modal__overlay');
  const buttons = dialog.querySelectorAll('button');
  assert.equal(document.activeElement, buttons[0], 'Abbrechen vorfokussiert');
  buttons[1].click();
  assert.equal(await pending, true);
  const pending2 = confirmDialog({ title: 'x', message: 'y' });
  key(document.body.querySelector('.c-modal__overlay'), 'Escape');
  assert.equal(await pending2, false);
});

test('Toasts: max 4, Auto-Dismiss per Timer, Esc und Schließen, Fehler als alert', () => {
  const timers = []; const cleared = [];
  const region = createToastRegion({ timers: { setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout: (id) => cleared.push(id) } });
  assert.equal(region.el.getAttribute('aria-live'), 'polite');
  const ids = [1, 2, 3, 4, 5].map((n) => region.push({ kind: 'info', text: `T${n}` }));
  assert.equal(region.count(), 4, 'ältester wird entfernt');
  assert.equal(region.el.children[0].textContent.startsWith('T2'), true);
  timers[4].fn();
  assert.equal(region.count(), 3);
  const errId = region.push({ kind: 'error', text: 'kaputt' });
  const errNode = region.el.children[region.el.children.length - 1];
  assert.equal(errNode.getAttribute('role'), 'alert');
  key(errNode, 'Escape');
  assert.equal(region.count(), 3);
  const sticky = region.push({ kind: 'info', text: 'bleibt', ttl: 0 });
  assert.ok(sticky > errId);
  region.el.children[0].querySelectorAll('button')[0].click();
  assert.ok(cleared.length >= 1);
  void ids;
});

test('Tooltip verknüpft per aria-describedby und lässt sich mit Esc ausblenden', () => {
  const b = button({ label: 'x' });
  const wrap = tooltip(b, 'Erklärung');
  const tip = wrap.querySelector('[role="tooltip"]');
  assert.equal(b.getAttribute('aria-describedby'), tip.getAttribute('id'));
  key(wrap, 'Escape');
  assert.ok(wrap.classList.contains('c-tip--off'));
});

test('Resist-Matrix: 4x3 mit Prozentwerten, Update in place', () => {
  const stats = { shield_res_em: 0, shield_res_th: 0.2, shield_res_kin: 0.4, shield_res_exp: 0.5, armor_res_em: 0.5, armor_res_th: 0.45, armor_res_kin: 0.25, armor_res_exp: 0.1, structure_res_em: 0, structure_res_th: 0, structure_res_kin: 0, structure_res_exp: 0 };
  const el = resistMatrix({ stats });
  assert.equal(el.querySelectorAll('tbody tr').length, 3);
  assert.equal(el.querySelectorAll('thead th').length, 4);
  const cells = el.querySelectorAll('.c-resist__cell');
  assert.equal(cells.length, 12);
  assert.match(cells[3].textContent, /50 %/);
  const first = cells[0];
  updateResistMatrix(el, { stats: { ...stats, shield_res_em: 0.75 } });
  assert.equal(el.querySelectorAll('.c-resist__cell')[0], first);
  assert.match(first.textContent, /75 %/);
});

test('Sparkline, Timeline, Leerzustand, Karte, Schiffsbild', () => {
  assert.equal(sparklinePoints([]), '');
  assert.equal(sparklinePoints([5, 5, 5], 100, 20).split(' ').every((p) => p.endsWith(',10')), true, 'flache Reihe mittig');
  assert.equal(sparklinePoints([1, 2, 3], 100, 20).split(' ').length, 3);
  const sp = sparkline({ values: [1, 3, 2], label: 'Preis' });
  assert.equal(sp.getAttribute('role'), 'img');
  updateSparkline(sp, { values: [1, 2], label: 'Preis neu' });
  assert.equal(sp.getAttribute('aria-label'), 'Preis neu');

  const tl = progressTimeline({ label: 'Queue', segments: [{ id: 'a', label: 'Mining', ticks: 60, active: true }, { id: 'b', label: 'Gunnery', ticks: 120 }] });
  assert.equal(tl.children.length, 2);
  const keep = tl.children[0];
  updateProgressTimeline(tl, { segments: [{ id: 'a', label: 'Mining', ticks: 30, active: true }] });
  assert.equal(tl.children.length, 1);
  assert.equal(tl.children[0], keep);

  assert.match(emptyState({ title: 'Leer', text: 'Nichts da' }).textContent, /Leer/);
  assert.equal(card({ title: 'T', children: 'x' }).querySelector('h2').textContent, 'T');
  const art = shipArt({ ship: { id: 's', name: 'Pebble', class: 'frigate', hull: 'small' } });
  assert.match(art.querySelector('svg').getAttribute('aria-label'), /Pebble/);
  void FakeEvent;
});
