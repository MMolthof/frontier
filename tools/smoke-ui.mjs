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
{ // Civilian Mode im HUD: Schriftzug und ausgegraute Module
  const g = window.__game ?? game;
  g.dispatch('travel/undock');
  g.state.pilot.cap = { pct: 0, civilian: true };
  await new Promise((r) => setTimeout(r, 50));
  g.advance?.(1);
  const hud = document.querySelector('.s-hud');
  const mode = hud?.querySelector('.s-hud__capmode');
  if (!hud || !mode || mode.hasAttribute('hidden') || !hud.classList.contains('s-hud--civilian')) { failed++; console.log('FAIL Civilian-Mode-Anzeige'); } else console.log('ok   Civilian-Mode-Anzeige');
  g.state.pilot.cap = { pct: 100, civilian: false };
  g.dispatch('travel/dock');
}
{ // gesperrter Button zeigt den Grund beim Klick
  const { button } = await import(`${R}/js/ui/components/button.js`);
  const holder = document.createElement('div'); document.body.appendChild(holder);
  const b = button({ label: 'Test', disabled: true, reason: 'Zu wenig ISK' }); holder.appendChild(b);
  b.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  const why = holder.querySelector('.c-btn__why');
  if (!why || why.textContent !== 'Zu wenig ISK') { failed++; console.log('FAIL Sperrgrund sichtbar'); } else console.log('ok   Sperrgrund sichtbar');
  holder.remove();
}
check('HUD versteckt in der Station', root.querySelector('.s-hud').hasAttribute('hidden'));
check('Zielleiste sichtbar', !root.querySelector('.s-guide').hasAttribute('hidden'), root.querySelector('.s-guide').textContent);
for (const [h, e] of [['#/stationhub', 'Abdocken'], ['#/shipyard', 'Werft'], ['#/fitting', 'Schiffswerte'], ['#/skills/training', 'Training'], ['#/skills/catalog', 'Raumschiffkommando'], ['#/skills/attributes', 'Attribute'], ['#/market/buy', 'Kaufen in'], ['#/hangar/ships', 'Wayfarer'], ['#/hangar/items', 'Stationslager'], ['#/market/sell', 'Verkaufen'], ['#/industry/refinery', 'Raffinerie'], ['#/system/overview', 'Overview']]) await visit(h, e);

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
// Modul verkaufen (fester Rückkaufpreis), Rohstoffe kaufen, Produktion
game.state.account.isk += 60000;
await go('#/market/buy');
const row2 = [...root.querySelectorAll('.v-mod')].find((r) => r.textContent.includes('Bergbaulaser I ') && !r.textContent.includes('Bergbaulaser II'));
await click(btn('Kaufen', row2));
await go('#/market/sell');
check('Modul im Verkaufen-Reiter', text().includes('Module und Items') && text().includes('Bergbaulaser I'), text().slice(0, 300));
const isk1 = game.state.account.isk;
const srow = [...root.querySelectorAll('.v-trade')].find((r) => r.textContent.includes('Bergbaulaser I'));
await click(btn('Verkaufen', srow));
check('Modul verkauft', game.state.account.isk > isk1, `${isk1} -> ${game.state.account.isk}`);
await go('#/market/buy');
await click(btn('Rohstoffe und Munition'));
check('Rohstoffe im Kaufen-Reiter', text().includes('Tritanium'), text().slice(0, 200));
const trow = [...root.querySelectorAll('.v-mod')].find((r) => r.textContent.includes('Tritanium'));
await click(btn('Kaufen', trow));
check('Tritanium gekauft', (game.state.assets.stations['cel.aldara.p1.station'].items['item.tritanium'] ?? 0) >= 100);
await visit('#/industry/production', 'Module herstellen');
game.state.pilot.skills['skill.industry'] = { sp: 250, level: 1 }; await sleep(10); shell.router.refresh(); await sleep(10);
check('Produktion: Herstellen-Knöpfe', [...root.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Herstellen'), text().slice(0, 200));
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
