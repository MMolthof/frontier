import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toastFor, TOAST_EVENTS, registerToasts } from '../js/ui/shell/toasts.js';
import { createT } from '../js/ui/shell/translate.js';

test('Toast-Tabelle deckt die Events des Master Plans ab und verträgt leere Payloads', () => {
  const t = createT({});
  for (const event of ['travel/arrived', 'travel/docked', 'skills/completed', 'skills/queueEmpty', 'mining/holdFull', 'mining/asteroidDepleted', 'mining/fieldRespawned', 'market/sold', 'market/bought', 'refine/done', 'ships/destroyed', 'missions/completed', 'missions/failed', 'combat/playerDestroyed']) {
    assert.ok(TOAST_EVENTS.includes(event), event);
    assert.ok(toastFor(event, undefined, t).text.length > 0);
    assert.ok(!/\{\w+\}/.test(toastFor(event, {}, t).text), 'Platzhalter bleiben nicht stehen');
  }
  assert.equal(toastFor('unbekannt/event', {}, t), null);
  assert.match(toastFor('skills/completed', { name: 'Bergbau' }, t).text, /Bergbau/);
  assert.equal(toastFor('missions/failed', {}, t).kind, 'error');
});

test('Toasts hängen an game.on und lassen sich abmelden', async () => {
  const handlers = {};
  const fakeGame = { on: (e, fn) => { handlers[e] = fn; return () => { delete handlers[e]; }; } };
  const pushed = [];
  const off = registerToasts(fakeGame, (x) => pushed.push(x), createT({}));
  handlers['mining/holdFull']({});
  assert.equal(pushed.length, 1);
  off();
  assert.equal(Object.keys(handlers).length, 0);
});

