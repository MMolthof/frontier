// Zielleiste: zeigt den nächsten sinnvollen Schritt (wie die „Opportunities“ in EVE) mit Knopf. Wird pro Schritt ausblendbar.
import { h, setText } from '../../util/dom.js';
import { fmt } from '../../util/format.js';
import { button } from '../components/button.js';

const sum = (o) => Object.values(o ?? {}).reduce((a, b) => a + b, 0);

/** Nächster Schritt aus dem Spielzustand. @returns {{id: string, text: string, cta?: {label: string, type?: string, payload?: object, hash?: string}}} */
export function nextStep(game) {
  const { state, data } = game;
  const ship = state.assets.ships.find((s) => s.uid === state.pilot.activeShipUid);
  const loc = state.pilot.location;
  const cel = data.celestials?.[loc.celestialId];
  const docked = Boolean(loc.dockedStationId);
  const holdUnits = sum(ship?.oreHold);
  const fitted = Object.values(ship?.fitting ?? {}).flat().filter(Boolean).map((id) => data.modules?.[id]);
  const miner = fitted.find((m) => m.activation?.kind === 'mine');
  const mining = state.mining.sessions.length > 0;
  const stock = docked ? state.assets.stations[loc.dockedStationId]?.items ?? {} : {};
  const stockOre = Object.entries(stock).filter(([id]) => data.ores?.[id]).reduce((a, [, n]) => a + n, 0);
  const hasView = (id) => game.hasSelector?.('skills/queue') || id !== 'skills';

  if (!miner) return { id: 'fit', text: 'Dein Schiff hat keinen Bergbaulaser. Rüste im Fitting einen ein.', cta: { label: 'Zum Fitting', hash: '#/fitting' } };
  if (state.pilot.warp) return { id: 'warp', text: 'Du bist im Warp. Gleich angekommen.' };
  if (docked) {
    if (holdUnits > 0) return { id: 'unload', text: `Entlade dein Erz (${fmt(holdUnits)} Einheiten) in den Hangar.`, cta: { label: 'Alles entladen', type: 'inv/unloadAll' } };
    if (stockOre > 0) return { id: 'sell', text: `Im Lager liegen ${fmt(stockOre)} Einheiten Erz. Verkaufe sie am Markt oder raffiniere sie.`, cta: { label: 'Zum Markt', hash: '#/market/sell' } };
    const earned = state.account.isk > (data.balance?.startIsk ?? 0);
    if (!earned) return { id: 'undock-first', text: 'Docke ab, warpe zum Asteroidengürtel und baue Erz ab. Mit dem Gewinn kaufst du bessere Module.', cta: { label: 'Abdocken', type: 'travel/undock' } };
    const better = Object.values(data.modules ?? {}).find((m) => m.group === 'mining_laser' && m.price > 0 && m.id === 'mod.miner_1');
    const stockModule = stock[better?.id] > 0;
    if (miner.price === 0 && better) {
      if (stockModule) return { id: 'fit-better', text: `Rüste ${better.name} im Fitting aus: mehr Ertrag als dein ${miner.name}.`, cta: { label: 'Zum Fitting', hash: '#/fitting' } };
      if (state.account.isk >= better.price) return { id: 'buy-better', text: `Du kannst dir ${better.name} leisten (${fmt(better.price)} ISK). Das lohnt sich.`, cta: { label: 'Zum Modul-Shop', hash: '#/market/buy' } };
    }
    if (hasView('skills') && !state.pilot.queue.length) return { id: 'train', text: 'Starte ein Skill-Training. Es läuft auch weiter, wenn du fliegst.', cta: { label: 'Zu den Skills', hash: '#/skills/catalog' } };
    return { id: 'undock', text: 'Docke ab und baue mehr Erz ab.', cta: { label: 'Abdocken', type: 'travel/undock' } };
  }
  if (cel?.type === 'belt') {
    if (!mining) return { id: 'mine', text: 'Du bist im Gürtel. Starte den Bergbau: im Schiffs-HUD unten den Laser anklicken.', cta: { label: 'Abbau starten', type: 'mining/start' } };
    return holdUnits > 0 && ship && sum(ship.oreHold) > 0
      ? { id: 'mining', text: `Die Laser arbeiten (${fmt(holdUnits)} Einheiten Erz an Bord). Genug? Dann zurück zur Station.`, cta: { label: 'Zur Systemübersicht', hash: '#/system/overview' } }
      : { id: 'mining0', text: 'Die Laser arbeiten. Stelle oben 20x oder 60x ein, das geht schneller.' };
  }
  if (holdUnits > 0) return { id: 'return', text: 'Warpe zurück zur Station, docke an und entlade das Erz.', cta: { label: 'Zur Systemübersicht', hash: '#/system/overview' } };
  return { id: 'goto-belt', text: 'Warpe zu einem Asteroidengürtel, dort kannst du Erz abbauen.', cta: { label: 'Zur Systemübersicht', hash: '#/system/overview' } };
}

/** @param {{game: any, navigate: (hash: string) => void, notify: (kind: string, text: string) => void}} o */
export function createGuide({ game, navigate, notify }) {
  const label = h('strong', { class: 's-guide__label' }, 'Nächstes Ziel');
  const text = h('span', { class: 's-guide__text' });
  const slot = h('span', { class: 's-guide__cta' });
  const close = button({ label: 'Ausblenden', variant: 'ghost', onClick: () => { dismissed = current; update(); } });
  const el = h('section', { class: 's-guide', 'aria-label': 'Nächstes Ziel', hidden: '' }, label, text, slot, close);
  let dismissed = null;
  let current = null;
  let shown = '';

  function update() {
    const step = nextStep(game);
    current = step.id;
    if (dismissed === step.id) { if (!el.hasAttribute('hidden')) el.setAttribute('hidden', ''); return; }
    el.removeAttribute('hidden');
    setText(text, step.text);
    const sig = `${step.id}|${step.cta?.label ?? ''}`;
    if (sig === shown) return;
    shown = sig;
    slot.replaceChildren();
    if (step.cta) {
      slot.appendChild(button({ label: step.cta.label, variant: 'primary', onClick: () => {
        if (step.cta.hash) return navigate(step.cta.hash);
        const res = game.dispatch(step.cta.type, step.cta.payload);
        if (!res.ok) notify('warn', res.message ?? 'Aktion nicht möglich.');
        return res;
      } }));
    }
  }
  return { el, update };
}
