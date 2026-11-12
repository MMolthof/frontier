// Startet die App im Browser: Daten laden, Registry, Spielstand, Schleife, Shell.
// Bis A3 eine Shell liefert (js/ui/shell/index.js mit `mount(root, game, { views })`),
// rendert ein kleines Notbehelf-Panel (Tick, Geschwindigkeit, Protokoll, Speichern).

import { createFetchReader, loadData } from '../core/data-loader.js';
import { loadRegistry } from '../core/registry.js';
import { createSaveManager, SaveError } from '../core/save.js';
import { createGame } from '../core/game.js';
import { catchUp, createTickLoop } from '../core/tick.js';
import { createLocalStorageAdapter, downloadText, pickTextFile } from './browser.js';
import { h, clear, setText } from './dom.js';
import { fmt, fmtIsk, fmtTicks } from './format.js';

const AUTOSAVE_EVERY_TICKS = 5; // Infrastruktur, kein Spielbalancing

function fallbackPanel(root, game, warnings) {
  const tickEl = h('b');
  const iskEl = h('span', { class: 'boot-isk' });
  const timeEl = h('span', { class: 'boot-mute' });
  const logEl = h('ul', { class: 'boot-log' });
  const msgEl = h('div', { class: 'boot-mute' });
  const speedButtons = game.select('core/speeds').map((scale) =>
    h('button', {
      class: 'boot-btn', type: 'button', dataset: { scale },
      onClick: () => game.dispatch('game/setSpeed', { scale })
    }, scale === 0 ? 'Pause' : `${scale}x`));

  const actions = [
    h('button', { class: 'boot-btn', type: 'button', onClick: () => {
      setText(msgEl, game.dispatch('game/save').ok ? 'Gespeichert.' : 'Speichern fehlgeschlagen.');
    } }, 'Speichern'),
    h('button', { class: 'boot-btn', type: 'button', onClick: () => {
      downloadText('tick-frontier-save.json', game.saves.exportJson(game.state));
    } }, 'Exportieren'),
    h('button', { class: 'boot-btn', type: 'button', onClick: async () => {
      const text = await pickTextFile();
      if (text === null) return;
      try { game.saves.importJson(text); location.reload(); } catch (err) { setText(msgEl, `Import fehlgeschlagen: ${err.message}`); }
    } }, 'Importieren'),
    h('button', { class: 'boot-btn', type: 'button', onClick: () => {
      if (confirm('Neu starten und den Spielstand löschen?')) game.dispatch('game/reset');
    } }, 'Neu starten')
  ];

  clear(root).append(
    h('div', { class: 'boot-card' },
      h('div', { class: 'boot-row' }, iskEl, h('span', null, 'Tick ', tickEl), timeEl),
      h('div', { class: 'boot-row' }, speedButtons),
      h('div', { class: 'boot-row' }, actions), msgEl),
    h('div', { class: 'boot-card' }, h('b', null, 'Protokoll'), logEl),
    ...(warnings.length ? [h('div', { class: 'boot-mute' }, `${warnings.length} Lade-Warnungen (siehe Konsole).`)] : [])
  );

  function update() {
    setText(tickEl, fmt(game.state.tick));
    setText(iskEl, fmtIsk(game.state.account.isk));
    setText(timeEl, `· Spielzeit ${fmtTicks(game.state.tick)}`);
    const scale = game.select('core/speed');
    speedButtons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.scale) === scale)));
    clear(logEl).append(...game.select('core/log', { limit: 8 }).map((e) => h('li', null, `Tick ${fmt(e.tick)}: ${e.text}`)));
  }
  game.subscribe(update);
  update();
}

async function shellExists(url) {
  try { return (await fetch(url, { method: 'HEAD' })).ok; } catch { return false; }
}

export async function boot(root) {
  const base = new URL('../../', import.meta.url);
  const reader = createFetchReader(base);
  const warnings = [];
  const onWarn = (m) => { warnings.push(m); console.warn(m); };

  const { data } = await loadData(reader, { onWarn });
  const registry = await loadRegistry(reader, { onWarn });
  const saves = createSaveManager(createLocalStorageAdapter());

  let state = null;
  try {
    state = saves.load();
  } catch (err) {
    if (!(err instanceof SaveError)) throw err;
    onWarn(`Spielstand unbrauchbar (${err.code}): ${err.message} – starte neu.`);
  }

  const game = createGame({ data, systems: registry.systems, state, now: Date.now, saves, onWarn });
  if (state) catchUp(game, Date.now());
  else game.state.lastRealTime = Date.now();

  game.on('core/ticked', ({ tick }) => { if (tick % AUTOSAVE_EVERY_TICKS === 0) game.save(); });
  addEventListener('beforeunload', () => game.save());
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(); });

  const loop = createTickLoop({ game, now: Date.now });
  loop.start();

  const shellUrl = new URL('js/ui/shell/index.js', base).href;
  if (await shellExists(shellUrl)) {
    const shell = await import(shellUrl);
    shell.mount(root, game, { views: registry.views, warnings });
  } else {
    fallbackPanel(root, game, warnings);
  }
  return { game, loop, registry, warnings };
}
