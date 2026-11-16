// UI-Smoke-Test mit simuliertem Browser (jsdom). Nur für die Entwicklung: `npm i --no-save jsdom && node tools/smoke-ui.mjs`.
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="app"></div></body></html>', { url: 'https://example.test/frontier/', pretendToBeVisual: true });
for (const k of ['window', 'document', 'location', 'Node', 'Element', 'HTMLElement', 'localStorage']) { try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); } }
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
const R = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const { createFsReader, loadData } = await import(`${R}/js/core/data-loader.js`);
const { loadRegistry } = await import(`${R}/js/core/registry.js`);
const { createGame } = await import(`${R}/js/core/game.js`);
const { mount } = await import(`${R}/js/ui/shell/index.js`);
const reader = createFsReader(R);
const warnings = [];
const { data } = await loadData(reader, { onWarn: (m) => warnings.push(m) });
const registry = await loadRegistry(reader, { onWarn: (m) => warnings.push(m) });
const game = createGame({ data, systems: registry.systems, now: () => 0, onWarn: (m) => warnings.push(m) });
const root = document.getElementById('app');
const shell = mount(root, game, { views: registry.views, warnings });
const sleep = (ms = 8) => new Promise((r) => setTimeout(r, ms));
const view = () => root.querySelector('.l-view');
const text = () => view().textContent.replace(/\s+/g, ' ').trim();
const errs = () => warnings.filter((w) => /warf|Fehler/.test(w));
async function go(hash) { location.hash = hash; await sleep(15); shell.router.refresh(); await sleep(8); }
let failed = 0;
const check = (name, cond, extra = '') => { if (!cond) { failed++; console.log('FAIL', name, String(extra).slice(0, 300)); } else console.log('ok  ', name); };
const btn = (label, scope = root) => [...scope.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(label));
async function click(el) { el.dispatchEvent(new dom.window.Event('click', { bubbles: true })); await sleep(15); }
async function visit(hash, expect) { await go(hash); const t = text(); check(hash, errs().length === 0 && (!expect || t.includes(expect)), `${errs().join('|')} || ${t.slice(0, 200)}`); }

console.log('Start-Warnungen:', warnings.length);
check('HUD versteckt in der Station', root.querySelector('.s-hud').hasAttribute('hidden'));
check('Zielleiste sichtbar', !root.querySelector('.s-guide').hasAttribute('hidden'), root.querySelector('.s-guide').textContent);
for (const [h, e] of [['#/stationhub', 'Abdocken'], ['#/shipyard', 'Werft'], ['#/fitting', 'Schiffswerte'], ['#/skills/training', 'Training'], ['#/skills/catalog', 'Raumschiffkommando'], ['#/skills/attributes', 'Attribute'], ['#/market/buy', 'Module kaufen'], ['#/hangar/ships', 'Pebble'], ['#/hangar/items', 'Stationslager'], ['#/market/sell', 'Verkaufen'], ['#/industry/refinery', 'Raffinerie'], ['#/system/overview', 'Overview']]) await visit(h, e);

// Modul kaufen und im Fitting einbauen
await go('#/market/buy');
const row = [...root.querySelectorAll('.v-mod')].find((r) => r.textContent.includes('Bergbaulaser I ') && !r.textContent.includes('Bergbaulaser II'));
check('Miner I im Shop', !!row, text().slice(0, 200));
await click(btn('Kaufen', row));
check('Modul gekauft', (game.state.assets.stations['cel.aldara.p1.station'].items['mod.miner_1'] ?? 0) === 1);
await go('#/fitting');
const slotBtns = [...root.querySelectorAll('.c-slot--high')];
check('Slot-Ring mit Slots', slotBtns.length === 3, slotBtns.length);
await click(slotBtns[0]);
const mrow = [...root.querySelectorAll('.v-mod')].find((r) => r.textContent.includes('Bergbaulaser I ') && !r.textContent.includes('Bergbaulaser II'));
check('Miner I im Browser', !!mrow, text().slice(0, 200));
await click(btn('Ersetzen', mrow));
check('Miner I eingebaut', game.state.assets.ships[0].fitting.high[0] === 'mod.miner_1', JSON.stringify(game.state.assets.ships[0].fitting));
// Skills
await go('#/skills/training');
const trainBtn = btn('Trainieren');
if (trainBtn) { await click(trainBtn); check('Training eingereiht', game.state.pilot.queue.length === 1, JSON.stringify(game.state.pilot.queue)); }
else check('Trainieren-Knopf vorhanden', false, text().slice(0, 300));
// Abdocken -> HUD
await go('#/stationhub'); await click(btn('Abdocken'));
check('Abdocken -> Systemübersicht', location.hash.includes('system'), location.hash);
check('HUD sichtbar im All', !root.querySelector('.s-hud').hasAttribute('hidden'));
check('HUD zeigt Module', root.querySelectorAll('.s-hud__mod').length >= 3, root.querySelectorAll('.s-hud__mod').length);
await visit('#/system/overview', 'Overview');
const beltRow = [...root.querySelectorAll('.v-ov-row')].find((r) => r.textContent.includes('Gürtel'));
await click(beltRow);
check('Selected Item zeigt Warpen', !!btn('Warpen'), text().slice(0, 300));
await click(btn('Warpen')); game.advance(10); await sleep(20);
check('im Gürtel', game.data.celestials[game.state.pilot.location.celestialId]?.type === 'belt');
check('Zielleiste: Abbau', root.querySelector('.s-guide').textContent.includes('Bergbau') || root.querySelector('.s-guide').textContent.includes('Laser'), root.querySelector('.s-guide').textContent);
const laserBtn = [...root.querySelectorAll('.s-hud__mod')].find((b) => !b.className.includes('empty'));
await click(laserBtn);
check('Abbau per HUD-Modul', game.state.mining.sessions.length === 1, game.state.mining.sessions.length);
game.advance(30); await sleep(20);
check('HUD-Modul aktiv', root.querySelector('.s-hud__mod--active') !== null);
await go('#/fitting'); check('Fitting im All nur lesbar (Hinweis)', text().includes('docke an'), text().slice(0, 200));
// Dunkles Design
const themeBtn = btn('Dunkles Design'); await click(themeBtn);
check('Dunkles Design gesetzt', document.documentElement.getAttribute('data-theme') === 'dark');
check('keine Fehler-Warnungen', errs().length === 0, errs().join('|'));
console.log(failed ? `${failed} FEHLER` : 'ALLES OK');
process.exit(failed ? 1 : 0);
