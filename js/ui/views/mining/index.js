// Bergbau: Asteroidenfeld mit Laser-Zielen und die Erzhalle des Schiffs.
import { h } from '../../../util/dom.js';
import { fmt } from '../../../util/format.js';
import { card } from '../../components/card.js';
import { meter } from '../../components/meter.js';
import { table } from '../../components/table.js';
import { emptyState } from '../../components/empty-state.js';
import { oreIcon } from '../../components/ore-icon.js';
import { actionButton, liveView, msgLine } from '../live.js';

function notAtBelt(m, ctl) {
  const f = m.field;
  const blocked = m.docked ? 'Erst abdocken.' : m.warping ? 'Du bist im Warp.' : null;
  return card({ title: 'Kein Asteroidengürtel in Reichweite', subtitle: 'Bergbau ist nur im Gürtel möglich, nie in der Station.', children: h('div', { class: 'l-stack' },
    msgLine(ctl.ui.msg),
    m.docked ? h('div', { class: 'l-row' }, actionButton({ label: 'Abdocken', icon: 'undock', variant: 'primary', run: ctl.run, type: 'travel/undock' })) : null,
    ...f.belts.map((b) => h('div', { class: 'l-row' }, h('strong', null, b.name),
      actionButton({ label: 'Hinwarpen', icon: 'warp', run: ctl.run, type: 'travel/warp', payload: { celestialId: b.id }, disabled: Boolean(blocked), reason: blocked }))),
    f.belts.length ? null : h('p', { class: 'u-mute' }, 'In diesem System gibt es keinen Gürtel. Reise über ein Sternentor weiter.')) });
}

function fieldTab(m, ctl) {
  const f = m.field;
  if (!f.atBelt) return notAtBelt(m, ctl);
  const hold = m.hold;
  const pct = hold.maxM3 ? hold.usedM3 / hold.maxM3 : 0;
  const lasers = Array.from({ length: f.lasers }, (_, i) => i);
  const head = card({ title: f.name, subtitle: `${f.lasers} Bergbaulaser · ${fmt(f.perLaserPerTick * f.cycleTicks, 1)} m³ je Laser und Zyklus (${f.cycleTicks} Ticks)`, children: h('div', { class: 'l-stack' },
    msgLine(ctl.ui.msg),
    meter({ label: 'Erzhalle', value: hold.usedM3, max: hold.maxM3 || 1, text: `${fmt(hold.usedM3, 1)} / ${fmt(hold.maxM3)} m³`, tone: pct > 0.9 ? 'warn' : 'default' }),
    h('div', { class: 'l-row' },
      f.mining ? actionButton({ label: 'Abbau stoppen', icon: 'close', run: ctl.run, type: 'mining/stop' })
        : actionButton({ label: 'Abbau starten', icon: 'mining', variant: 'primary', run: ctl.run, type: 'mining/start', disabled: !f.asteroids.length || !f.lasers, reason: f.lasers ? 'Feld leer' : 'Kein Laser eingebaut' }),
      h('span', { class: 'u-mute' }, f.mining ? 'Laser arbeiten …' : 'Beginnt mit dem wertvollsten Erz.'))) });
  if (!f.asteroids.length) {
    return h('div', { class: 'l-stack' }, head, emptyState({ title: 'Feld leer', text: f.respawnIn !== null ? `Neue Asteroiden in ${fmt(f.respawnIn)} Ticks.` : 'Das Feld wird neu gefüllt.' }));
  }
  const tbl = table({
    caption: 'Asteroiden', rows: f.asteroids, rowKey: (r) => r.id,
    columns: [
      { key: 'name', label: 'Erz', render: (r) => h('span', { class: 'l-row' }, oreIcon({ id: r.oreId, name: r.name }), r.name) },
      { key: 'rest', label: 'Rest', render: (r) => meter({ label: `${r.name} Restmenge`, value: r.remainingM3, max: r.initialM3, text: `${fmt(r.remainingM3)} m³` }) },
      { key: 'lasers', label: 'Laser', render: (r) => (r.lasers.length ? h('span', { class: 'v-badge' }, r.lasers.map((l) => `L${l + 1}`).join(' ')) : h('span', { class: 'u-mute' }, '–')) },
      { key: 'act', label: 'Ziel', render: (r) => h('span', { class: 'l-row' },
        actionButton({ label: 'Alle Laser', variant: 'alt', run: ctl.run, type: 'mining/start', payload: { asteroidId: r.id }, disabled: !f.lasers, reason: 'Kein Laser' }),
        ...(lasers.length > 1 ? lasers.map((l) => actionButton({ label: `L${l + 1}`, variant: 'ghost', run: ctl.run, type: 'mining/target', payload: { laser: l, asteroidId: r.id } })) : [])) }
    ] });
  return h('div', { class: 'l-stack' }, head, card({ title: 'Asteroiden', subtitle: 'Wähle, welche Laser welchen Asteroiden bearbeiten.', children: tbl }));
}

function hallTab(m, ctl) {
  const hold = m.hold;
  const rows = hold.rows;
  return h('div', { class: 'l-stack' },
    card({ title: 'Erzhalle', subtitle: 'Erz lagert im Schiff, bis du es in einer Station entlädst.', children: h('div', { class: 'l-stack' },
      msgLine(ctl.ui.msg),
      meter({ label: 'Erzhalle', value: hold.usedM3, max: hold.maxM3 || 1, text: `${fmt(hold.usedM3, 1)} / ${fmt(hold.maxM3)} m³` }),
      rows.length ? table({ caption: 'Erzhalle', rows, rowKey: (r) => r.oreId, columns: [
        { key: 'name', label: 'Erz', render: (r) => h('span', { class: 'l-row' }, oreIcon({ id: r.oreId, name: r.name }), r.name) },
        { key: 'units', label: 'Einheiten', align: 'right', render: (r) => fmt(r.units) },
        { key: 'm3', label: 'Volumen', align: 'right', render: (r) => `${fmt(r.m3, 1)} m³` }] })
        : emptyState({ icon: 'ore', title: 'Erzhalle leer' }),
      h('div', { class: 'l-row' }, actionButton({ label: 'Alles ins Stationslager', icon: 'hangar', variant: 'primary', run: ctl.run, type: 'inv/unloadAll', disabled: !m.docked || !rows.length, reason: m.docked ? 'Nichts zu entladen' : 'Nur in Stationen' }))) }));
}

export const view = liveView({
  id: 'mining', title: 'Bergbau', group: 'mining', order: 40,
  subs: [{ id: 'field', labelKey: 'shell.nav.mining.field' }, { id: 'hall', labelKey: 'shell.nav.mining.hall' }],
  model: (game, route, ui) => ({ sub: route.sub ?? 'field', field: game.select('mining/field'), hold: game.select('mining/hold'), docked: Boolean(game.state.pilot.location.dockedStationId), warping: Boolean(game.state.pilot.warp), msg: ui.msg }),
  draw: (m, game, route, ctl) => (m.sub === 'hall' ? hallTab(m, ctl) : fieldTab(m, ctl))
});
