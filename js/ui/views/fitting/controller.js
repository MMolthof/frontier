// Fitting-Ansicht (A5): DOM-freie Steuerung. Hält den reinen UI-Zustand (gewähltes Schiff, Tab,
// Filter …), liest ausschließlich über game.select und ändert ausschließlich über game.dispatch.
// Liefert ein View-Model für die DOM-Schicht (index.js) und Ergebnisse mit fertigem Meldungstext.

import {
  SLOT_TYPES, ringLayout, ringOrder, buildPanel, normalizeFitting, buildCells, chooseTargetIndex,
  filterModules, listGroups, describeCheck, errorText, formatDeltaRows, costText, barState
} from './model.js';
import { readFitting } from './access.js';

const REQUIRED_SELECTORS = ['fitting/ships', 'fitting/stats', 'fitting/moduleList', 'fitting/preview'];
const REQUIRED_ACTIONS = ['fitting/equip', 'fitting/unequip'];

/** Verfügbarkeit des Fitting-Systems (für view.enabled). */
export function fittingAvailability(game) {
  const missing = [
    ...REQUIRED_SELECTORS.filter((s) => !game.hasSelector(s)),
    ...REQUIRED_ACTIONS.filter((a) => !game.hasAction(a))
  ];
  return { available: missing.length === 0, missing };
}

export function createFittingController(game) {
  const t = (key, params) => game.t(key, params);
  const ui = {
    uid: null, slot: 'high', index: null,
    group: '', search: '', onlyUsable: false, inStockOnly: false,
    browserOpen: false, hover: null
  };

  const safe = (type, args) => {
    try { return game.select(type, args); } catch { return undefined; }
  };

  const slotLabel = (slot, index) => `${t(`slot.${slot}`)} ${index + 1}`;

  function resolveUid(ships) {
    if (ships.some((s) => s.uid === ui.uid)) return ui.uid;
    return (ships.find((s) => s.active) ?? ships[0])?.uid ?? null;
  }

  function resetSelection() {
    ui.slot = 'high'; ui.index = null; ui.group = ''; ui.hover = null;
  }

  /** Slot-Anzahlen: bevorzugt aus stats, sonst aus den Schiffsdaten. */
  function slotCounts(stats, typeDef) {
    const out = {};
    for (const slot of SLOT_TYPES) out[slot] = stats?.slots?.[slot]?.total ?? typeDef?.slots?.[slot] ?? 0;
    return out;
  }

  function readCells(uid) {
    const ships = safe('fitting/ships', {}) ?? [];
    if (uid === undefined) { ui.uid = resolveUid(ships); uid = ui.uid; } // auch ohne vorheriges viewModel()
    const ship = ships.find((s) => s.uid === uid);
    const stats = uid ? safe('fitting/stats', { uid }) : undefined;
    const counts = slotCounts(stats, game.data.ships?.[ship?.typeId]);
    const panel = buildPanel(stats, t, game.data);
    const fitting = normalizeFitting(readFitting(game, uid), counts);
    return { ship, stats, counts, panel, cells: buildCells(fitting, game.data, panel.errors) };
  }

  function previewFor(hover, cells) {
    if (!hover) return null;
    if (hover.unequip) {
      const { slot, index } = hover.unequip;
      const cell = cells[slot]?.[index];
      if (!cell?.moduleId) return null;
      const res = safe('fitting/preview', { uid: ui.uid, slot, index, moduleId: null });
      return {
        kind: 'unequip', title: t('ui.fitting.preview.unequip', { module: cell.name }),
        rows: formatDeltaRows(res?.delta, t), message: ''
      };
    }
    const def = game.data.modules?.[hover.moduleId];
    const name = def?.name ?? hover.moduleId;
    const index = chooseTargetIndex(cells[ui.slot] ?? [], ui.index);
    if (index < 0) {
      return { kind: 'equip', title: t('ui.fitting.preview.equip', { module: name }), rows: [], message: t('ui.fitting.noFreeSlot', { slot: t(`slot.${ui.slot}`) }) };
    }
    const res = safe('fitting/preview', { uid: ui.uid, slot: ui.slot, index, moduleId: hover.moduleId });
    const blocked = res?.check && !res.check.ok ? describeCheck(res.check, t, game.data) : '';
    return {
      kind: 'equip', title: t('ui.fitting.preview.equip', { module: name }),
      rows: formatDeltaRows(res?.delta, t), message: blocked
    };
  }

  /** Alles, was die DOM-Schicht zum Zeichnen braucht. */
  function viewModel() {
    const { available, missing } = fittingAvailability(game);
    if (!available) return { available: false, missing, reason: t('ui.fitting.unavailable') };

    const rawShips = safe('fitting/ships', {}) ?? [];
    ui.uid = resolveUid(rawShips);
    const ships = rawShips.map((s) => ({
      ...s,
      typeName: game.data.ships?.[s.typeId]?.name ?? s.typeId,
      label: t('ui.fitting.shipOption', { name: s.name, type: game.data.ships?.[s.typeId]?.name ?? s.typeId })
        + (s.active ? ` ${t('ui.fitting.activeSuffix')}` : '')
        + (s.valid === false ? ` ${t('ui.fitting.invalidSuffix')}` : '')
    }));

    if (!ships.length) {
      return { available: true, docked: false, ships, notice: t('error.fit.not_docked'), ui: { ...ui } };
    }

    const { ship, stats, counts, panel, cells } = readCells(ui.uid);
    const typeDef = game.data.ships?.[ship.typeId];
    if (!Number.isInteger(ui.index) || ui.index >= (counts[ui.slot] ?? 0)) ui.index = null;
    if (!SLOT_TYPES.includes(ui.slot)) ui.slot = 'high';

    const items = safe('fitting/moduleList', { uid: ui.uid, slot: ui.slot }) ?? [];
    const target = chooseTargetIndex(cells[ui.slot] ?? [], ui.index);
    const groups = listGroups(items, t);
    if (ui.group && !groups.some((g) => g.id === ui.group)) ui.group = ''; // Gruppe existiert nicht mehr
    const shown = filterModules(items, ui, t).map((m) => {
      const usable = Boolean(m.check?.ok);
      const reason = usable
        ? (target < 0 ? t('ui.fitting.noFreeSlot', { slot: t(`slot.${ui.slot}`) }) : '')
        : describeCheck(m.check, t, game.data);
      return {
        ...m,
        usable,
        canEquip: usable && target >= 0,
        reason,
        groupLabel: t(`modgroup.${m.group}`),
        sizeLabel: t(`size.${m.size}`),
        cost: costText(m.fitting, t)
      };
    });

    const high = stats?.slots?.high?.hardpoints ?? {};
    const hardpoints = ['turret', 'launcher']
      .filter((id) => (high[id]?.max ?? 0) > 0 || (high[id]?.used ?? 0) > 0)
      .map((id) => ({
        id, label: t(`hardpoint.${id}`), used: high[id].used ?? 0, max: high[id].max ?? 0,
        state: barState(high[id].used ?? 0, high[id].max ?? 0).state
      }));

    const selectedCell = ui.index === null ? null : cells[ui.slot]?.[ui.index] ?? null;

    return {
      available: true,
      docked: true,
      notice: '',
      ui: { ...ui },
      ships,
      ship: {
        uid: ship.uid, typeId: ship.typeId, name: ship.name, typeName: typeDef?.name ?? ship.typeId,
        classId: typeDef?.class ?? '', className: typeDef?.class ? t(`class.${typeDef.class}`) : '', hull: typeDef?.hull ?? 'small'
      },
      statsMissing: stats === undefined,
      panel,
      counts,
      cells,
      ring: ringLayout(counts),
      order: ringOrder(counts),
      hardpoints,
      selected: selectedCell ? { slot: ui.slot, index: ui.index, cell: selectedCell, label: slotLabel(ui.slot, ui.index) } : null,
      browser: {
        slot: ui.slot, slotLabel: t(`slot.${ui.slot}`), total: items.length, items: shown,
        groups, targetIndex: target,
        targetLabel: target >= 0 ? slotLabel(ui.slot, target) : '',
        tabs: SLOT_TYPES.map((slot) => ({
          id: slot, label: t(`slot.${slot}`), free: (cells[slot] ?? []).filter((c) => !c.moduleId).length, total: counts[slot] ?? 0
        }))
      },
      preview: previewFor(ui.hover, cells)
    };
  }

  /** Nur die Δ-Vorschau (für Hover/Fokus, ohne alle Selektoren neu zu lesen). */
  function preview() {
    return ui.uid ? previewFor(ui.hover, readCells().cells) : null;
  }

  // -- Aktionen -------------------------------------------------------------------------------

  const ok = (message, extra = {}) => ({ ok: true, kind: 'success', message, ...extra });
  const fail = (message, extra = {}) => ({ ok: false, kind: 'error', message, ...extra });

  /** Baut ein Modul ein. `at` = Ziel (Drag & Drop); sonst gewählter freier bzw. erster freier Slot. */
  function equip(moduleId, at = {}) {
    const slot = at.slot ?? ui.slot;
    const { cells } = readCells();
    const index = Number.isInteger(at.index) ? at.index : chooseTargetIndex(cells[slot] ?? [], slot === ui.slot ? ui.index : null);
    if (index < 0 || index === undefined) return fail(t('ui.fitting.noFreeSlot', { slot: t(`slot.${slot}`) }));
    const res = game.dispatch('fitting/equip', { uid: ui.uid, slot, index, moduleId });
    if (!res.ok) return fail(errorText(t, res), { error: res.error });
    ui.slot = slot; ui.index = index; ui.hover = null;
    const name = game.data.modules?.[moduleId]?.name ?? moduleId;
    return ok(t('ui.fitting.toast.equipped', { module: name, slot: slotLabel(slot, index) }), { slot, index });
  }

  /** Baut aus. Rigs verlangen vorher eine Bestätigung (needsConfirm), dann erneut mit {confirm:true}. */
  function unequip(slot, index, { confirm = false } = {}) {
    const cell = readCells().cells[slot]?.[index];
    if (!cell?.moduleId) return fail(t('ui.fitting.err.empty_slot'));
    const askConfirm = () => ({
      ok: false, needsConfirm: true, kind: 'confirm',
      confirm: {
        title: t('ui.fitting.confirm.rigTitle'),
        message: t('ui.fitting.confirm.rigText', { module: cell.name }),
        confirmLabel: t('ui.fitting.confirm.rigYes'), cancelLabel: t('ui.fitting.confirm.cancel'), slot, index
      }
    });
    if (slot === 'rig' && !confirm) return askConfirm();
    const res = game.dispatch('fitting/unequip', { uid: ui.uid, slot, index, ...(confirm ? { confirm: true } : {}) });
    if (!res.ok && res.needsConfirm && !confirm) return askConfirm();
    if (!res.ok) return fail(errorText(t, res), { error: res.error });
    ui.hover = null;
    return ok(t(slot === 'rig' ? 'ui.fitting.toast.rigDestroyed' : 'ui.fitting.toast.unequipped', { module: cell.name }), { slot, index });
  }

  return {
    viewModel,
    preview,
    /** Reiner UI-Zustand (Kopie), z. B. für Tests. */
    get ui() { return { ...ui }; },
    selectShip(uid) { if (uid !== ui.uid) { ui.uid = uid; resetSelection(); } },
    selectTab(slot) {
      if (!SLOT_TYPES.includes(slot) || slot === ui.slot) return;
      ui.slot = slot; ui.index = null; ui.group = ''; ui.hover = null;
    },
    selectSlot(slot, index) {
      if (!SLOT_TYPES.includes(slot)) return;
      if (slot !== ui.slot) ui.group = '';
      ui.slot = slot; ui.index = index; ui.browserOpen = true; ui.hover = null;
    },
    clearSlot() { ui.index = null; },
    setFilter(partial) {
      for (const key of ['group', 'search', 'onlyUsable', 'inStockOnly']) if (key in partial) ui[key] = partial[key];
    },
    setHover(spec) { ui.hover = spec ?? null; },
    setBrowserOpen(open) { ui.browserOpen = Boolean(open); },
    equip,
    unequip
  };
}
