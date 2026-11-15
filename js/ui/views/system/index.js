// Sonnensystem: Überblick-Tabelle, Orbitkarte (Warp-Ziele wählen) und Sternkarte (Tore).
import { h } from '../../../util/dom.js';
import { fmt } from '../../../util/format.js';
import { card } from '../../components/card.js';
import { meter } from '../../components/meter.js';
import { icon } from '../../components/icon.js';
import { table } from '../../components/table.js';
import { emptyState } from '../../components/empty-state.js';
import { actionButton, goto, liveView, msgLine } from '../live.js';

const TYPE = { star: 'Stern', planet: 'Planet', moon: 'Mond', station: 'Station', belt: 'Asteroidengürtel', gate: 'Sternentor', anomaly: 'Anomalie' };
const SEC = (s) => (s >= 0.8 ? 'high' : s >= 0.5 ? 'mid' : 'low');

function statusCard(ov, ctl) {
  const here = ov.rows.find((r) => r.here);
  let text; let extra = null;
  if (ov.docked) {
    text = `Angedockt: ${here?.name ?? 'Station'}`;
    extra = actionButton({ label: 'Abdocken', icon: 'undock', variant: 'primary', run: ctl.run, type: 'travel/undock' });
  } else if (ov.warping) {
    text = 'Im Warp';
  } else {
    text = `Im All bei ${here?.name ?? '–'}`;
    if (here?.type === 'station') extra = actionButton({ label: 'Andocken', icon: 'dock', variant: 'primary', run: ctl.run, type: 'travel/dock' });
  }
  return card({ title: `${ov.name} · Sicherheit ${fmt(ov.security, 1)}`, children: h('div', { class: 'l-stack' },
    h('div', { class: 'l-row' }, h('span', { class: `s-sec s-sec--${SEC(ov.security)}`, 'aria-hidden': 'true' }), h('strong', null, text), extra),
    msgLine(ctl.ui.msg)) });
}

function warpMeter(game) {
  const w = game.state.pilot.warp;
  if (!w) return null;
  return card({ title: 'Warp', children: meter({ label: 'Warp-Fortschritt', value: w.ticksTotal - w.ticksLeft, max: w.ticksTotal, text: `noch ${w.ticksLeft} Ticks` }) });
}

function rowButtons(row, ctl) {
  const list = row.actions.map((a) => {
    if (a === 'warp') return actionButton({ label: `Warpen (${row.warpTicks} T)`, icon: 'warp', run: ctl.run, type: 'travel/warp', payload: { celestialId: row.id } });
    if (a === 'dock') return actionButton({ label: 'Andocken', icon: 'dock', variant: 'primary', run: ctl.run, type: 'travel/dock' });
    if (a === 'jump') return actionButton({ label: 'Springen', icon: 'gate', variant: 'primary', run: ctl.run, type: 'travel/jump' });
    return actionButton({ label: 'Abbauen', icon: 'mining', variant: 'primary', run: () => goto({ viewId: 'mining', sub: 'field' }) });
  });
  return h('span', { class: 'l-row' }, ...list);
}

function overviewTab(ov, ctl) {
  const rows = ov.rows;
  return card({ title: 'Überblick', subtitle: 'Alle Himmelskörper im System nach Entfernung.', children: table({
    caption: 'Himmelskörper', rows, rowKey: (r) => r.id,
    columns: [
      { key: 'name', label: 'Name', render: (r) => h('span', { class: 'l-row' }, icon(r.type === 'star' ? 'star' : r.type, { size: 16 }), r.name, r.here ? h('span', { class: 'u-mute' }, ' (hier)') : null) },
      { key: 'type', label: 'Typ', render: (r) => TYPE[r.type] ?? r.type },
      { key: 'distanceAu', label: 'Distanz', align: 'right', render: (r) => `${fmt(r.distanceAu, 2)} AU` },
      { key: 'act', label: 'Aktion', render: (r) => rowButtons(r, ctl) }
    ] }) });
}

const ORBIT = 400;
const c = ORBIT / 2;
function orbitMap(ov, game, ctl) {
  const maxAu = Math.max(...ov.rows.map((r) => r.au), 1);
  const rad = (au) => (au ? 36 + 150 * (au / maxAu) : 0);
  const at = (r, off = 0) => {
    const a = (r.angleDeg * Math.PI) / 180;
    return { x: c + rad(r.au) * Math.cos(a) - off * Math.sin(a), y: c + rad(r.au) * Math.sin(a) + off * Math.cos(a) };
  };
  const pos = {};
  for (const r of ov.rows) pos[r.id] = at(r, r.type === 'station' ? 14 : r.type === 'moon' ? 11 : 0);
  const rings = [...new Set(ov.rows.filter((r) => r.type === 'planet' || r.type === 'belt' || r.type === 'gate').map((r) => r.au))];
  const nodes = ov.rows.map((r) => {
    const p = pos[r.id];
    let shape;
    if (r.type === 'star') shape = h('circle', { cx: p.x, cy: p.y, r: 12, class: 'v-orbit__star' });
    else if (r.type === 'station') shape = h('rect', { x: p.x - 5, y: p.y - 5, width: 10, height: 10, class: 'v-orbit__station' });
    else if (r.type === 'gate') shape = h('polygon', { points: `${p.x},${p.y - 8} ${p.x + 7},${p.y + 6} ${p.x - 7},${p.y + 6}`, class: 'v-orbit__gate' });
    else if (r.type === 'belt') shape = h('g', { class: 'v-orbit__belt' }, [[-6, -3], [0, 4], [6, -2], [-2, -8], [4, 7]].map(([dx, dy]) => h('circle', { cx: p.x + dx, cy: p.y + dy, r: 2 })));
    else shape = h('circle', { cx: p.x, cy: p.y, r: r.type === 'moon' ? 3 : 7, class: 'v-orbit__planet' });
    const g = h('g', { class: ['v-orbit__node', ctl.ui.sel === r.id ? 'v-orbit__node--sel' : null], tabindex: '0', role: 'button', 'aria-label': `${r.name}, ${TYPE[r.type]}` },
      h('circle', { cx: p.x, cy: p.y, r: 16, class: 'v-orbit__hit' }), shape,
      r.type === 'star' || r.type === 'moon' ? null : h('text', { x: p.x, y: p.y + 22, class: 'v-orbit__label', 'text-anchor': 'middle' }, r.name.replace(/^.* – /, '')));
    const pick = () => { ctl.ui.sel = r.id; ctl.repaint(); };
    g.addEventListener('click', pick);
    g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
    return g;
  });
  let ship = null;
  const w = game.state.pilot.warp;
  const from = w ? pos[w.fromId] : pos[ov.rows.find((r) => r.here)?.id];
  const to = w ? pos[w.toId] : null;
  if (from) {
    const f = w ? (w.ticksTotal - w.ticksLeft) / w.ticksTotal : 0;
    const x = to ? from.x + (to.x - from.x) * f : from.x;
    const y = to ? from.y + (to.y - from.y) * f : from.y;
    ship = h('g', null, to ? h('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y, class: 'v-orbit__route' }) : null, h('circle', { cx: x, cy: y, r: 6, class: 'v-orbit__ship' }));
  }
  return h('svg', { viewBox: `0 0 ${ORBIT} ${ORBIT}`, class: 'v-orbit', role: 'group', 'aria-label': 'Systemkarte' },
    ...rings.map((au) => h('circle', { cx: c, cy: c, r: rad(au), class: 'v-orbit__ring' })), ...nodes, ship);
}

function selectionCard(ov, ctl) {
  const r = ov.rows.find((x) => x.id === ctl.ui.sel);
  if (!r) return card({ title: 'Auswahl', children: h('p', { class: 'u-mute' }, 'Wähle einen Himmelskörper auf der Karte.') });
  return card({ title: r.name, subtitle: `${TYPE[r.type]} · ${fmt(r.distanceAu, 2)} AU entfernt`, children: h('div', { class: 'l-stack' },
    r.services.length ? h('p', { class: 'u-mute' }, `Dienste: ${r.services.join(', ')}`) : null,
    r.actions.length ? rowButtons(r, ctl) : h('p', { class: 'u-mute' }, r.here ? 'Du bist hier.' : ov.docked ? 'Erst abdocken, dann warpen.' : 'Jetzt nicht möglich.')) });
}

function starMap(stars, ctl) {
  if (!stars.length) return emptyState({ title: 'Keine Systemdaten' });
  const xs = stars.map((s) => s.x); const ys = stars.map((s) => s.y);
  const pad = 50;
  const x0 = Math.min(...xs) - pad; const y0 = Math.min(...ys) - pad;
  const w = Math.max(...xs) - x0 + pad; const hh = Math.max(...ys) - y0 + pad;
  const byId = Object.fromEntries(stars.map((s) => [s.id, s]));
  const lines = [];
  for (const s of stars) for (const n of s.neighbors) if (byId[n] && s.id < n) lines.push(h('line', { x1: s.x, y1: s.y, x2: byId[n].x, y2: byId[n].y, class: 'v-orbit__ring' }));
  const nodes = stars.map((s) => {
    const g = h('g', { class: ['v-orbit__node', ctl.ui.sel === s.id ? 'v-orbit__node--sel' : null], tabindex: '0', role: 'button', 'aria-label': `${s.name}, Sicherheit ${fmt(s.security, 1)}` },
      s.here ? h('circle', { cx: s.x, cy: s.y, r: 19, class: 'v-star__here' }) : null,
      h('circle', { cx: s.x, cy: s.y, r: 12, class: `v-star v-star--${SEC(s.security)}` }),
      h('text', { x: s.x, y: s.y + 30, class: 'v-orbit__label', 'text-anchor': 'middle' }, s.name));
    const pick = () => { ctl.ui.sel = s.id; ctl.repaint(); };
    g.addEventListener('click', pick);
    g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
    return g;
  });
  return h('svg', { viewBox: `${x0} ${y0} ${w} ${hh}`, class: 'v-orbit', role: 'group', 'aria-label': 'Sternkarte' }, ...lines, ...nodes);
}

function starsTab(stars, ctl) {
  const sel = stars.find((s) => s.id === ctl.ui.sel) ?? stars.find((s) => s.here);
  const names = Object.fromEntries(stars.map((s) => [s.id, s.name]));
  return h('div', { class: 'l-grid l-grid--wide' },
    card({ title: 'Sternkarte', subtitle: 'Grün sicher, gelb Grenzland, rot Piratengebiet. Systeme sind durch Sternentore verbunden.', children: starMap(stars, ctl) }),
    card({ title: sel?.name ?? 'System', subtitle: sel ? `Sicherheit ${fmt(sel.security, 1)}${sel.here ? ' · hier' : ''}` : '', children: sel ? h('div', { class: 'l-stack' },
      h('p', null, `Tore nach: ${sel.neighbors.map((n) => names[n] ?? n).join(', ') || '–'}`),
      h('p', { class: 'u-mute' }, sel.here ? 'Hier befindest du dich. Warpe zum Tor und springe.' : 'Reise über die Tore: Systemkarte → Tor wählen → Springen.')) : null }));
}

export const view = liveView({
  id: 'system', title: 'Sonnensystem', group: 'system', order: 10,
  subs: [{ id: 'overview', labelKey: 'shell.nav.system.overview' }, { id: 'map', labelKey: 'shell.nav.system.map' }, { id: 'stars', labelKey: 'shell.nav.system.stars' }],
  model(game, route, ui) {
    const sub = route.sub ?? 'overview';
    return { sub, ov: game.select('travel/overview'), stars: sub === 'stars' ? game.select('travel/stars') : null, warp: game.state.pilot.warp, sel: ui.sel, msg: ui.msg };
  },
  draw(m, game, route, ctl) {
    const parts = [statusCard(m.ov, ctl), warpMeter(game)];
    if (m.sub === 'map') parts.push(h('div', { class: 'l-grid l-grid--wide' }, card({ title: 'Systemkarte', subtitle: 'Klicke einen Himmelskörper an.', children: orbitMap(m.ov, game, ctl) }), selectionCard(m.ov, ctl)));
    else if (m.sub === 'stars') parts.push(starsTab(m.stars, ctl));
    else parts.push(overviewTab(m.ov, ctl));
    return h('div', { class: 'l-stack' }, ...parts);
  }
});
