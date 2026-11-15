import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeDom } from './ui-fake-dom.mjs';
import { slotRing, updateSlotRing, slotRingGeometry, slotRingLayout } from '../js/ui/components/index.js';

createFakeDom().install();

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

test('Slot-Ring: Reihenfolge oben/rechts/unten/links, keine Überlappung für 0 bis 8 Slots je Typ', () => {
  const single = slotRingLayout({ high: 1, mid: 1, low: 1, rig: 1 });
  assert.deepEqual(single.map((s) => s.type), ['high', 'mid', 'rig', 'low']);
  assert.ok(single.every((s) => typeof s.angle === 'number'), 'angle vorhanden');
  const byType = Object.fromEntries(single.map((s) => [s.type, s]));
  assert.ok(byType.high.y < -100 && Math.abs(byType.high.x) < 1, 'High oben');
  assert.ok(byType.mid.x > 100, 'Mid rechts');
  assert.ok(byType.rig.y > 100, 'Rig unten');
  assert.ok(byType.low.x < -100, 'Low links');
  const types = ['high', 'mid', 'low', 'rig'];
  for (let n = 0; n <= 8; n++) {
    for (let others = 0; others <= 8; others += 4) {
      const counts = Object.fromEntries(types.map((tp, i) => [tp, i === 0 ? n : others]));
      const geo = slotRingGeometry(counts);
      assert.ok(geo.size >= 12);
      for (let i = 0; i < geo.slots.length; i++) {
        for (let j = i + 1; j < geo.slots.length; j++) {
          assert.ok(dist(geo.slots[i], geo.slots[j]) >= geo.size, `Überlappung bei ${JSON.stringify(counts)}: ${i}/${j}`);
        }
      }
    }
  }
  assert.equal(slotRingGeometry({ high: 4, mid: 4, low: 4, rig: 4 }).size >= 32, true, 'normale Schiffe bekommen große Slots');
});

test('Slot-Ring: Beschriftungen, Zustände und Auswahl', () => {
  const picked = [];
  const ring = slotRing({
    ship: { id: 'ship.pebble', name: 'Pebble', class: 'frigate', hull: 'small' },
    slots: { high: ['Miner', null], mid: [null], low: [{ id: 'm', label: 'Panzerplatte', invalid: true }], rig: [] },
    hardpoints: { turret: 2, launcher: 0 }, onSelect: (type, index) => picked.push([type, index])
  });
  const slots = ring.querySelectorAll('.c-slot');
  assert.equal(slots.length, 4);
  const labels = slots.map((s) => s.getAttribute('aria-label'));
  assert.ok(labels.some((l) => l.startsWith('High-Slot 2') && l.includes('leer')));
  assert.ok(labels.some((l) => l.includes('ungültig') && l.includes('Panzerplatte')));
  assert.ok(ring.querySelector('.c-slot--invalid'));
  assert.match(ring.querySelector('.c-slotring__hp').textContent, /Geschütze 2/);
  slots[1].click();
  assert.deepEqual(picked[0], ['high', 1]);
  const before = ring.querySelectorAll('.c-slot')[0];
  updateSlotRing(ring, { slots: { high: [{ id: 'x', label: 'Laser' }, null], mid: [null], low: [null], rig: [] } });
  assert.equal(ring.querySelectorAll('.c-slot')[0], before, 'gleiche Slotzahl: kein Neuaufbau');
  assert.ok(ring.querySelectorAll('.c-slot')[0].getAttribute('aria-label').includes('Laser'));
  updateSlotRing(ring, { readOnly: true });
  slots[1].click();
  assert.equal(picked.length, 1);
});

