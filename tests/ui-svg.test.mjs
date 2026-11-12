import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeDom } from './ui-fake-dom.mjs';
import { ICON_NAMES, iconTree, shipTree, shipSvgString, SHIP_CLASSES, svgToString, svgToDom, oreTree, oreColorIndex, hashString } from '../js/ui/components/index.js';

createFakeDom().install();

const REQUIRED_ICONS = ['overview', 'system', 'station', 'hangar', 'market', 'missions', 'industry', 'shipyard', 'fitting', 'mining', 'skills', 'account', 'log', 'settings', 'warp', 'dock', 'undock', 'gate', 'planet', 'moon', 'belt', 'star', 'anomaly', 'ore', 'cargo', 'shield', 'armor', 'structure', 'cap', 'speed', 'warning', 'check', 'close', 'chevron', 'lock', 'info', 'search', 'save', 'import', 'export'];

function balanced(svg) {
  const stack = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    const [, closing, tag, , selfClosing] = m;
    if (selfClosing) continue;
    if (closing) assert.equal(stack.pop(), tag, `schließendes ${tag} ohne Gegenstück`);
    else stack.push(tag);
  }
  return stack.length === 0;
}

test('svgToString escaped Attribute und Text, schließt leere Elemente selbst', () => {
  const out = svgToString(['text', { x: 1, 'data-a': 'a"b<c' }, 'x & y']);
  assert.equal(out, '<text x="1" data-a="a&quot;b&lt;c">x &amp; y</text>');
  assert.equal(svgToString(['circle', { r: 2 }]), '<circle r="2"/>');
});

test('svgToDom erzeugt dieselbe Struktur über h()', () => {
  const el = svgToDom(['g', { class: 'a' }, ['circle', { r: 3 }], 'Text']);
  assert.equal(el.tagName, 'g');
  assert.equal(el.getAttribute('class'), 'a');
  assert.equal(el.children.length, 2);
});

test('alle geforderten Icons sind vorhanden und als SVG wohlgeformt', () => {
  for (const name of REQUIRED_ICONS) assert.ok(ICON_NAMES.includes(name), `Icon ${name} fehlt`);
  for (const name of ICON_NAMES) {
    const svg = svgToString(iconTree(name));
    assert.ok(balanced(svg), name);
    assert.match(svg, /viewBox="0 0 18 18"/);
    assert.match(svg, /aria-hidden="true"/);
  }
});

test('Icon mit Titel ist ein beschriftetes Bild', () => {
  assert.match(svgToString(iconTree('lock', { title: 'Gesperrt' })), /role="img" aria-label="Gesperrt"/);
});

test('Schiffsgenerator: alle Klassen und Hüllen deterministisch und innerhalb der viewBox', () => {
  for (const cls of SHIP_CLASSES) {
    for (const hull of ['small', 'medium', 'large', 'capital']) {
      const ship = { id: `ship.${cls}.${hull}`, class: cls, hull };
      const a = shipSvgString(ship);
      assert.equal(a, shipSvgString(ship), 'nicht deterministisch');
      assert.ok(balanced(a));
      const points = /points="([^"]+)"/.exec(a)[1].split(' ').map((p) => p.split(',').map(Number));
      for (const [x, y] of points) {
        assert.ok(x >= 0 && x <= 100 && y >= 0 && y <= 60, `${ship.id} liegt außerhalb: ${x},${y}`);
      }
    }
  }
  assert.notEqual(shipSvgString({ id: 'a', class: 'cruiser', hull: 'medium' }), shipSvgString({ id: 'b', class: 'cruiser', hull: 'medium' }) + 'x');
  assert.ok(shipTree({ id: 'unbekannt', class: 'raumschiffdings' }));
  assert.ok(shipTree());
});

test('Erz-Icon: Farbindex deterministisch, 1 bis 8', () => {
  for (const id of ['ore.veldspar', 'ore.scordite', 'x', '']) {
    const index = oreColorIndex(id);
    assert.ok(index >= 1 && index <= 8);
    assert.equal(index, oreColorIndex(id));
  }
  assert.match(svgToString(oreTree({ id: 'ore.veldspar' })), /var\(--ore-\d\)/);
  assert.equal(hashString('a'), hashString('a'));
});

test('Keine Emojis in erzeugten Grafiken', () => {
  const emoji = /\p{Extended_Pictographic}/u;
  for (const name of ICON_NAMES) assert.doesNotMatch(svgToString(iconTree(name)), emoji, name);
  for (const cls of [...SHIP_CLASSES, 'unbekannt']) assert.doesNotMatch(shipSvgString({ id: cls, class: cls, hull: 'medium' }), emoji, cls);
});
