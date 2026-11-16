// Schiffs-HUD (unten, nur im All): Ringanzeige, Modulreihe zum Aktivieren, Standortstatus und die passende Hauptaktion.
import { h, setText } from '../../util/dom.js';
import { fmt } from '../../util/format.js';
import { button } from '../components/button.js';
import { moduleIcon } from '../components/module-icon.js';
import { shipGauge } from '../components/gauge.js';

const ROWS = [['high', 'Waffen und Werkzeuge'], ['mid', 'Mittlere Slots'], ['low', 'Untere Slots']];

/** @param {{game: any, notify: (kind: string, text: string) => void}} o */
export function createHud({ game, notify }) {
  const gauge = shipGauge();
  const name = h('strong', { class: 's-hud__name' });
  const stateText = h('span', { class: 's-hud__state' });
  const hpText = h('span', { class: 's-hud__hp u-mute u-num' });
  const slots = h('div', { class: 's-hud__slots', role: 'group', 'aria-label': 'Module' });
  const actions = h('div', { class: 's-hud__actions' });
  const progress = h('span', { class: 'c-meter__track s-hud__progress' }, h('span', { class: 'c-meter__bar' }));
  const el = h('section', { class: 's-hud', 'aria-label': 'Schiffsanzeige', hidden: '' },
    h('div', { class: 's-hud__panel' },
      h('div', { class: 's-hud__gauge' }, gauge.el, hpText),
      h('div', { class: 's-hud__body' }, h('div', { class: 's-hud__head' }, name, stateText), progress, slots, actions)));

  let slotSig = '';
  let actionSig = '';
  let modButtons = [];

  const run = (type, payload) => { const res = game.dispatch(type, payload); if (!res.ok) notify('warn', res.message ?? 'Aktion nicht möglich.'); return res; };

  function activate(mod) {
    const kind = mod?.activation?.kind;
    if (kind === 'mine') return game.state.mining.sessions.length ? run('mining/stop') : run('mining/start');
    if (kind === 'attack') return notify('info', 'Keine Ziele in Reichweite. Kämpfe folgen in einer späteren Iteration.');
    return notify('info', `${mod?.name ?? 'Modul'} wirkt dauerhaft.`);
  }

  function rebuildSlots(ship) {
    const fitting = ship.fitting ?? {};
    const sig = JSON.stringify(fitting);
    if (sig === slotSig) return;
    slotSig = sig;
    modButtons = [];
    slots.replaceChildren();
    for (const [slotType, label] of ROWS) {
      const list = fitting[slotType] ?? [];
      if (!list.length) continue;
      const row = h('div', { class: `s-hud__row s-hud__row--${slotType}`, role: 'group', 'aria-label': label });
      for (const id of list) {
        const mod = id ? game.data.modules?.[id] : null;
        const b = h('button', { type: 'button', class: `s-hud__mod s-hud__mod--${slotType}${mod ? '' : ' s-hud__mod--empty'}`, title: mod ? mod.name : 'Leerer Slot',
          'aria-label': mod ? mod.name : `Leerer ${slotType}-Slot`, ...(mod ? {} : { 'aria-disabled': 'true' }) }, mod ? moduleIcon(mod.category, { size: 24 }) : null);
        if (mod) b.addEventListener('click', () => activate(mod));
        if (mod) modButtons.push({ b, mod });
        row.appendChild(b);
      }
      slots.appendChild(row);
    }
  }

  function contextActions(state, data) {
    const loc = state.pilot.location;
    const cel = data.celestials?.[loc.celestialId];
    const mining = state.mining.sessions.length > 0;
    const list = [];
    if (state.pilot.warp) return { sig: 'warp', list };
    if (cel?.type === 'station') list.push({ label: 'Andocken', type: 'travel/dock', variant: 'primary' });
    if (cel?.type === 'gate') list.push({ label: 'Durch das Tor springen', type: 'travel/jump', variant: 'primary' });
    if (cel?.type === 'belt') list.push(mining ? { label: 'Abbau stoppen', type: 'mining/stop', variant: 'alt' } : { label: 'Abbau starten', type: 'mining/start', variant: 'primary' });
    return { sig: list.map((x) => x.type).join(','), list };
  }

  function update() {
    const state = game.state;
    const ship = state.assets.ships.find((s) => s.uid === state.pilot.activeShipUid);
    const docked = Boolean(state.pilot.location.dockedStationId);
    if (!ship || docked) { if (!el.hasAttribute('hidden')) el.setAttribute('hidden', ''); return; }
    el.removeAttribute('hidden');
    const type = game.data.ships?.[ship.typeId];
    let stats = null;
    try { stats = game.select('fitting/stats', { uid: ship.uid }); } catch { /* ohne Fitting */ }
    const max = {
      shield: stats?.defense?.shield?.hp ?? type?.attributes?.shield_hp ?? 1,
      armor: stats?.defense?.armor?.hp ?? type?.attributes?.armor_hp ?? 1,
      structure: stats?.defense?.structure?.hp ?? type?.attributes?.structure_hp ?? 1
    };
    const dmg = ship.damage ?? {};
    const v = { shield: (dmg.shield ?? max.shield) / max.shield, armor: (dmg.armor ?? max.armor) / max.armor, structure: (dmg.structure ?? max.structure) / max.structure, cap: 1 };
    gauge.update(v);
    setText(hpText, `${fmt(v.shield * 100)} · ${fmt(v.armor * 100)} · ${fmt(v.structure * 100)} %`);
    setText(name, ship.name);
    rebuildSlots(ship);
    const mining = state.mining.sessions.length > 0;
    for (const { b, mod } of modButtons) b.classList.toggle('s-hud__mod--active', mining && mod.activation?.kind === 'mine');

    const loc = state.pilot.location;
    const cel = game.data.celestials?.[loc.celestialId];
    const warp = state.pilot.warp;
    if (warp) {
      setText(stateText, `Warp nach ${game.data.celestials?.[warp.toId]?.name ?? '…'} · noch ${warp.ticksLeft} Ticks`);
      progress.removeAttribute('hidden');
      progress.firstChild.style.width = `${((warp.ticksTotal - warp.ticksLeft) / warp.ticksTotal) * 100}%`;
    } else {
      progress.setAttribute('hidden', '');
      const rate = stats?.mining?.m3PerTick ?? 0;
      setText(stateText, cel?.type === 'belt'
        ? (mining ? `${cel.name} · Abbau ${fmt(rate, 2)} m³/Tick` : `${cel.name} · Laser bereit`)
        : cel ? `bei ${cel.name}` : 'im All');
    }
    const ctx = contextActions(state, game.data);
    if (ctx.sig !== actionSig) {
      actionSig = ctx.sig;
      actions.replaceChildren(...ctx.list.map((a) => button({ label: a.label, variant: a.variant, onClick: () => run(a.type) })));
    }
  }

  return { el, update };
}
