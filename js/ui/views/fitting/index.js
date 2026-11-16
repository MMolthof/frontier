// Fitting-Fenster (EVE-Stil): Slot-Ring mit Modulsymbolen, Statistik rechts, Modul-Browser unten. Logik und Zahlen liefert die Fitting-Engine.
import { h } from '../../../util/dom.js';
import { fmt } from '../../../util/format.js';
import { card } from '../../components/card.js';
import { button } from '../../components/button.js';
import { confirm } from '../../components/modal.js';
import { emptyState } from '../../components/empty-state.js';
import { meter } from '../../components/meter.js';
import { moduleIcon } from '../../components/module-icon.js';
import { resistMatrix } from '../../components/resist-matrix.js';
import { slotRing } from '../../components/slot-ring.js';
import { statBar } from '../../components/stat-bar.js';
import { liveView, msgLine } from '../live.js';
import { CLASS_LABEL, MODCAT_LABEL, SIZE_LABEL, SLOT_LABEL } from '../labels.js';

const ORDER = ['high', 'mid', 'low', 'rig'];
const DELTAS = [['mining.m3PerTick', 'Abbau', ' m³/Tick', 2], ['offense.dps.total', 'DPS', '', 1], ['defense.ehp', 'EHP', '', 0], ['capacitor.usePerTick', 'Cap-Last', '', 1], ['nav.speed', 'Tempo', ' m/s', 0], ['fitting.pg.used', 'PG', '', 1], ['fitting.cpu.used', 'CPU', '', 0]];

function deltaText(delta) {
  const parts = [];
  for (const [key, label, unit, digits] of DELTAS) {
    const v = delta?.[key];
    if (typeof v === 'number' && Math.abs(v) > 1e-6) parts.push(`${label} ${v > 0 ? '+' : ''}${fmt(v, digits)}${unit}`);
  }
  return parts.join(' · ');
}

function decorate(ring, counts, ship, data, sel) {
  const buttons = [...ring.querySelectorAll('.c-slot')];
  let i = 0;
  for (const type of ORDER) {
    for (let k = 0; k < counts[type]; k++) {
      const b = buttons[i++];
      if (!b) continue;
      const id = ship.fitting[type][k];
      if (id && data.modules[id]) b.appendChild(moduleIcon(data.modules[id].category, { size: 20 }));
      if (sel.type === type && sel.index === k) b.classList.add('c-slot--sel');
    }
  }
}

function statsPanel(stats, data) {
  const f = stats.fitting;
  const d = stats.defense;
  const res = {};
  for (const layer of ['shield', 'armor', 'structure']) for (const t of ['em', 'th', 'kin', 'exp']) res[`${layer}_res_${t}`] = d[layer].res[t];
  return h('div', { class: 'l-stack' },
    h('div', null, statBar({ label: 'Powergrid', value: f.pg.used, max: f.pg.max, unit: 'MW' }), statBar({ label: 'CPU', value: f.cpu.used, max: f.cpu.max, unit: 'tf' }),
      statBar({ label: 'Calibration', value: f.calibration.used, max: f.calibration.max })),
    h('div', { class: 'v-hp' }, ...['shield', 'armor', 'structure'].map((k) => h('div', null, h('span', { class: 'u-mute' }, { shield: 'Schild', armor: 'Panzerung', structure: 'Struktur' }[k]), h('strong', { class: 'u-num' }, ` ${fmt(d[k].hp)} HP`)))),
    h('p', { class: 'u-mute' }, `Gesamt-EHP ${fmt(d.ehp)}`),
    resistMatrix({ stats: res }),
    h('ul', { class: 'v-list v-statlist' },
      h('li', null, `Waffen: ${fmt(stats.offense.dps.total, 1)} DPS`),
      h('li', null, `Bergbau: ${fmt(stats.mining.lasers)} Laser · ${fmt(stats.mining.m3PerTick, 2)} m³/Tick · Erzhalle ${fmt(stats.mining.oreHold)} m³`),
      h('li', null, `Capacitor: ${fmt(stats.capacitor.max)} GJ ${stats.capacitor.stable ? '(stabil)' : '(reicht nicht dauerhaft)'}`),
      h('li', null, `Tempo ${fmt(stats.nav.speed)} m/s · Warp ${fmt(stats.nav.warpSpeed, 1)} AU/Tick · Ziele ${fmt(stats.nav.maxTargets)}`)));
}

export const view = liveView({
  id: 'fitting', title: 'Fitting', group: 'fitting', order: 30,
  model(game, route, ui) {
    const st = game.state;
    const here = st.pilot.location.dockedStationId;
    const docked = Boolean(here);
    const ships = st.assets.ships.filter((s) => s.uid === st.pilot.activeShipUid || (docked && s.stationId === here)).map((s) => ({ uid: s.uid, name: s.name, active: s.uid === st.pilot.activeShipUid }));
    const uid = ships.some((s) => s.uid === ui.uid) ? ui.uid : st.pilot.activeShipUid;
    const ship = st.assets.ships.find((s) => s.uid === uid);
    const type = game.data.ships[ship.typeId];
    const sel = ui.slot && (ship.fitting[ui.slot.type]?.length ?? 0) > ui.slot.index ? ui.slot : { type: 'high', index: Math.max(0, ship.fitting.high.findIndex((x) => !x)) };
    const stats = game.select('fitting/stats', { uid });
    const list = game.select('fitting/moduleList', { uid, slot: sel.type, includeUnowned: Boolean(ui.all), search: ui.search || undefined });
    const selId = ship.fitting[sel.type][sel.index];
    // Die Engine prüft moduleList gegen den ersten freien Slot. Bei belegtem Slot (Austausch) werten wir die hypothetische Bilanz aus fitting/preview aus.
    const rows = list.slice(0, 40).map((r) => {
      if (!selId && !r.check.ok) return { ...r, delta: null };
      const pv = game.select('fitting/preview', { uid, slot: sel.type, index: sel.index, moduleId: r.moduleId });
      let check = r.check;
      if (selId) {
        if (!pv.stats.valid) check = { ok: false, message: pv.stats.errors[0]?.message ?? 'Passt nicht.' };
        else check = r.qtyInStation > 0 ? { ok: true } : { ok: false, message: 'Nicht im Stationslager.' };
      }
      return { ...r, check, delta: check.ok ? pv.delta : null };
    });
    return { docked, ships, uid, shipName: ship.name, typeId: ship.typeId, fitting: ship.fitting, sel, stats, rows, all: Boolean(ui.all), search: ui.search ?? '', msg: ui.msg,
      cls: CLASS_LABEL[type.class] ?? type.class, hardpoints: type.hardpoints };
  },
  draw(m, game, route, ctl) {
    const type = game.data.ships[m.typeId];
    const counts = Object.fromEntries(ORDER.map((k) => [k, m.fitting[k].length]));
    const slots = Object.fromEntries(ORDER.map((k) => [k, m.fitting[k].map((id, i) => (id ? { id, label: game.data.modules[id]?.name ?? id, invalid: m.stats.errors.some((e) => e.slot === k && e.index === i) } : null))]));
    const ring = slotRing({ slots, ship: { ...type, name: m.shipName }, hardpoints: m.hardpoints, onSelect: (t, i) => { ctl.ui.slot = { type: t, index: i }; ctl.repaint(); } });
    decorate(ring, counts, { fitting: m.fitting }, game.data, m.sel);

    const selId = m.fitting[m.sel.type][m.sel.index];
    const selMod = selId ? game.data.modules[selId] : null;
    const unequip = async () => {
      if (m.sel.type === 'rig') {
        const yes = await confirm({ title: 'Rig ausbauen?', message: `${selMod.name} wird beim Ausbau zerstört.`, confirmLabel: 'Ausbauen', danger: true });
        if (!yes) return;
      }
      ctl.run('fitting/unequip', { uid: m.uid, slot: m.sel.type, index: m.sel.index, confirm: m.sel.type === 'rig' });
    };
    const slotCard = card({ title: `${SLOT_LABEL[m.sel.type]}-Slot ${m.sel.index + 1}`, children: selMod
      ? h('div', { class: 'l-stack' }, h('span', { class: 'l-row' }, moduleIcon(selMod.category, { size: 22 }), h('strong', null, selMod.name)), h('span', { class: 'u-mute' }, selMod.description ?? ''),
        button({ label: 'Ausbauen', variant: 'alt', disabled: !m.docked, reason: 'Nur in Stationen', onClick: unequip }))
      : h('p', { class: 'u-mute' }, 'Leer. Wähle unten ein Modul zum Einbauen.') });

    const ships = m.ships.length > 1 ? h('div', { class: 'l-row' }, ...m.ships.map((s) => button({ label: `${s.name}${s.active ? ' (aktiv)' : ''}`, variant: 'alt', pressed: s.uid === m.uid, onClick: () => { ctl.ui.uid = s.uid; ctl.repaint(); } }))) : null;
    const left = card({ title: m.shipName, subtitle: `${m.cls} · Slot anklicken, dann unten ein Modul wählen`, children: h('div', { class: 'l-stack' }, ships,
      m.docked ? null : h('p', { class: 'v-msg' }, 'Im All kannst du dein Schiff nur ansehen. Zum Umbauen docke an einer Station an.'), msgLine(ctl.ui.msg), h('div', { class: 'v-ringwrap' }, ring)) });
    const right = card({ title: 'Schiffswerte', children: statsPanel(m.stats, game.data) });

    const chips = ORDER.map((k) => button({ label: `${SLOT_LABEL[k]} (${counts[k]})`, variant: 'alt', pressed: m.sel.type === k, onClick: () => { ctl.ui.slot = { type: k, index: Math.max(0, m.fitting[k].findIndex((x) => !x)) }; ctl.repaint(); } }));
    const search = h('input', { type: 'search', class: 'v-qty v-search', placeholder: 'Modul suchen …', value: m.search, 'aria-label': 'Modul suchen' });
    search.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ctl.ui.search = search.value; ctl.repaint(); } });
    search.addEventListener('change', () => { ctl.ui.search = search.value; ctl.repaint(); });
    const showAll = h('label', { class: 'v-check' }, h('input', { type: 'checkbox', checked: m.all ? '' : null }), ' auch Module, die nicht im Lager liegen');
    showAll.firstChild.addEventListener('change', (ev) => { ctl.ui.all = ev.target.checked; ctl.repaint(); });
    const items = m.rows.map((r) => {
      const fit = r.check.ok;
      const equip = () => {
        if (selId) { const r1 = ctl.run('fitting/unequip', { uid: m.uid, slot: m.sel.type, index: m.sel.index, confirm: true }); if (!r1.ok) return; }
        ctl.run('fitting/equip', { uid: m.uid, slot: m.sel.type, index: m.sel.index, moduleId: r.moduleId });
      };
      return h('li', { class: 'v-mod' },
        h('span', { class: 'v-mod__icon' }, moduleIcon(r.category, { size: 22 })),
        h('div', { class: 'v-mod__main' }, h('strong', null, r.name), h('span', { class: 'u-mute' }, ` ${MODCAT_LABEL[r.category] ?? r.category} · ${SIZE_LABEL[r.size] ?? r.size} · PG ${fmt(r.fitting.powergrid ?? 0)} · CPU ${fmt(r.fitting.cpu ?? 0)}${r.fitting.calibration ? ` · Cal ${fmt(r.fitting.calibration)}` : ''}`),
          r.delta && deltaText(r.delta) ? h('span', { class: 'v-mod__delta' }, deltaText(r.delta)) : null, !fit ? h('span', { class: 'v-mod__why' }, r.check.message ?? '') : null),
        h('span', { class: 'u-mute u-num v-mod__qty' }, r.qtyInStation ? `Lager: ${fmt(r.qtyInStation)}` : 'nicht im Lager'),
        button({ label: selId ? 'Ersetzen' : 'Einbauen', variant: 'primary', disabled: !fit || !m.docked, reason: !m.docked ? 'Nur in Stationen' : r.check.message, onClick: equip }));
    });
    const browser = card({ title: `Module für ${SLOT_LABEL[m.sel.type]}-Slots`, subtitle: 'Neue Module kaufst du im Markt unter „Kaufen“.', children: h('div', { class: 'l-stack' },
      h('div', { class: 'l-row' }, ...chips), h('div', { class: 'l-row' }, search, showAll),
      items.length ? h('ul', { class: 'v-mods' }, ...items) : emptyState({ icon: 'fitting', title: 'Keine Module', text: 'Im Stationslager liegt nichts für diesen Slot-Typ. Kaufe Module im Markt.' })) });
    return h('div', { class: 'l-stack' }, h('div', { class: 'l-grid l-grid--wide' }, h('div', { class: 'l-stack' }, left, slotCard), right), browser);
  }
});
