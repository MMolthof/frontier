// Fitting-Fenster (A5, MASTER_PLAN 6.3). Nur DOM: Logik steckt in controller.js/model.js.
// Jede Änderung läuft über game.dispatch (im Controller), Werte kommen nur aus Selektoren.
// Update-Strategie: Skeleton einmal bauen; Teilbereiche nur neu zeichnen, wenn sich ihre Signatur
// ändert; Eingabefelder werden nie neu erzeugt (Fokus bleibt); Fokus der Buttons wird per
// data-fit-focus wiederhergestellt; update() läuft höchstens einmal pro Sekunde, sofern keine eigene Aktion lief.

import { h, clear } from '../../../util/dom.js';
import { createFittingController, fittingAvailability } from './controller.js';
import { nextInRing } from './model.js';
import { glyph, shipArt, statBar, resistMatrix, statList, tabs, showToast, confirmDialog } from './components.js';

const CSS_HREF = new URL('../../../../css/views/fitting.css', import.meta.url).href;
const REFRESH_MIN_MS = 1000;
const SLOT_ORDER = ['high', 'mid', 'low', 'rig'];
const instances = new WeakMap();

const nowMs = () => globalThis.performance?.now?.() ?? Date.now();
const sig = (v) => (typeof v === 'string' ? v : JSON.stringify(v));

function ensureCss() {
  const doc = globalThis.document;
  if (!doc?.head || doc.getElementById?.('c-fit-css')) return;
  doc.head.append(h('link', { id: 'c-fit-css', rel: 'stylesheet', href: CSS_HREF }));
}

function card(title, ...children) {
  return h('section', { class: 'c-fit-card' }, h('h3', { class: 'c-fit-card__title' }, title), ...children);
}

function createInstance(root, game) {
  const ctrl = createFittingController(game);
  const t = (key, params) => game.t(key, params);
  const local = { sigs: {}, last: -Infinity, ringFocus: null, drag: null, pendingFocus: null, vm: null };

  // ---- Skeleton (wird einmal gebaut) ------------------------------------------------------------
  const toastHost = h('div', { class: 'c-fit-toasts' });
  const unavailableEl = h('div', { class: 'c-fit-empty' });
  const noticeEl = h('div', { class: 'c-fit-notice', role: 'status' });
  const statsMissingEl = h('div', { class: 'c-fit-notice c-fit-notice--warn', role: 'status' }, t('ui.fitting.statsMissing'));

  const shipSelect = h('select', {
    class: 'c-fit-select', id: 'c-fit-ship',
    onChange: (e) => { ctrl.selectShip(e.target.value); refresh(true); }
  });
  const shipBar = h('div', { class: 'c-fit-shipbar' }, h('label', { class: 'c-fit-label', for: 'c-fit-ship' }, t('ui.fitting.ship')), shipSelect);

  const ringBox = h('div', { class: 'c-fit-ring', role: 'group' });
  const hardpointsEl = h('div', { class: 'c-fit-hardpoints' });
  const selectedBar = h('div', { class: 'c-fit-selected' });
  const slotList = h('div', { class: 'c-fit-slots' });
  const openBrowserBtn = h('button', {
    type: 'button', class: 'c-fit-btn c-fit-open', 'data-fit-focus': 'open-browser',
    onClick: () => { ctrl.setBrowserOpen(true); browser.setAttribute('data-open', 'true'); searchInput.focus(); }
  }, t('ui.fitting.openBrowser'));
  const stage = h('section', { class: 'c-fit-stage', 'aria-label': t('ui.fitting.section.slots') },
    ringBox, hardpointsEl, openBrowserBtn, selectedBar, slotList);

  const panelBody = h('div', { class: 'c-fit-panel__body' });
  const panel = h('section', { class: 'c-fit-panel', 'aria-label': t('ui.fitting.section.stats') }, panelBody);

  const tabsEl = h('div', { class: 'c-fit-browser__tabs' });
  const searchInput = h('input', {
    type: 'search', class: 'c-fit-input', id: 'c-fit-search', autocomplete: 'off',
    'aria-label': t('ui.fitting.search'), placeholder: t('ui.fitting.search'),
    onInput: (e) => { ctrl.setFilter({ search: e.target.value }); refresh(true); }
  });
  const groupSelect = h('select', {
    class: 'c-fit-select', 'aria-label': t('ui.fitting.group'),
    onChange: (e) => { ctrl.setFilter({ group: e.target.value }); refresh(true); }
  });
  const usableBox = h('input', {
    type: 'checkbox', id: 'c-fit-usable', onChange: (e) => { ctrl.setFilter({ onlyUsable: e.target.checked }); refresh(true); }
  });
  const stockBox = h('input', {
    type: 'checkbox', id: 'c-fit-stock', onChange: (e) => { ctrl.setFilter({ inStockOnly: e.target.checked }); refresh(true); }
  });
  const targetEl = h('p', { class: 'c-fit-browser__target' });
  const countEl = h('p', { class: 'c-fit-browser__count' });
  const moduleList = h('ul', { class: 'c-fit-modules', 'aria-label': t('ui.fitting.moduleList') });
  const previewEl = h('div', { class: 'c-fit-preview', 'aria-live': 'polite' });
  const closeBtn = h('button', {
    type: 'button', class: 'c-fit-btn c-fit-btn--alt c-fit-close', 'data-fit-focus': 'close-browser',
    onClick: () => { ctrl.setBrowserOpen(false); browser.setAttribute('data-open', 'false'); openBrowserBtn.focus(); }
  }, t('ui.fitting.close'));
  const browser = h('aside', {
    class: 'c-fit-browser', 'aria-label': t('ui.fitting.browser'), 'data-open': 'false',
    onKeydown: (e) => { if (e.key === 'Escape' && browser.getAttribute('data-open') === 'true') closeBtn.click(); }
  },
  h('div', { class: 'c-fit-browser__head' }, h('h3', { class: 'c-fit-card__title' }, t('ui.fitting.browser')), closeBtn),
  tabsEl,
  h('div', { class: 'c-fit-filters' }, searchInput, groupSelect,
    h('label', { class: 'c-fit-check', for: 'c-fit-usable' }, usableBox, t('ui.fitting.onlyUsable')),
    h('label', { class: 'c-fit-check', for: 'c-fit-stock' }, stockBox, t('ui.fitting.inStockOnly'))),
  targetEl, countEl, moduleList, previewEl);

  const grid = h('div', { class: 'c-fit__grid' }, stage, panel, browser);
  const section = h('section', { class: 'c-fit', 'data-view': 'fitting' },
    h('h2', { class: 'c-fit__title' }, t('ui.fitting.title')),
    unavailableEl, noticeEl, statsMissingEl, shipBar, grid, toastHost);
  clear(root).append(section);

  // ---- Hilfen -----------------------------------------------------------------------------------
  const focusKey = () => {
    const el = root.ownerDocument?.activeElement;
    return el && root.contains(el) ? el.dataset?.fitFocus ?? null : null;
  };
  const restoreFocus = (keep) => {
    const want = local.pendingFocus ?? keep;
    local.pendingFocus = null;
    if (!want) return;
    const el = root.querySelector(`[data-fit-focus="${want}"]`);
    if (el && root.ownerDocument?.activeElement !== el) el.focus();
  };
  function patch(name, value, build) {
    const s = sig(value);
    if (local.sigs[name] === s) return;
    local.sigs[name] = s;
    build();
  }

  function handleResult(res) {
    showToast(toastHost, res.message, res.ok ? 'success' : 'error');
    refresh(true);
  }

  async function doUnequip(slot, index) {
    const res = ctrl.unequip(slot, index);
    if (res.needsConfirm) {
      const yes = await confirmDialog(section, res.confirm);
      local.pendingFocus = `slot:${slot}:${index}`;
      if (!yes) { refresh(true); return; }
      const done = ctrl.unequip(slot, index, { confirm: true });
      handleResult(done);
      return;
    }
    if (res.ok) local.pendingFocus = `slot:${slot}:${index}`;
    handleResult(res);
  }

  function doEquip(moduleId, at) {
    handleResult(ctrl.equip(moduleId, at));
  }

  function showPreview() {
    const pv = ctrl.preview();
    patch('preview', pv ?? 'none', () => {
      clear(previewEl);
      if (!pv) {
        previewEl.append(h('p', { class: 'c-fit-preview__hint' }, t('ui.fitting.preview.hint')));
        return;
      }
      previewEl.append(
        h('h4', { class: 'c-fit-preview__title' }, pv.title),
        pv.message ? h('p', { class: 'c-fit-preview__msg' }, pv.message) : null,
        pv.rows.length
          ? h('ul', { class: 'c-fit-delta' }, pv.rows.map((r) => h('li', { class: ['c-fit-delta__row', `is-${r.tone}`] },
            h('span', null, r.label), h('span', { class: 'c-fit-delta__val' }, r.text))))
          : pv.message ? null : h('p', { class: 'c-fit-preview__hint' }, t('ui.fitting.preview.none')));
    });
  }
  const hover = (spec) => { ctrl.setHover(spec); showPreview(); };

  function syncRoving() {
    const f = local.ringFocus;
    for (const btn of ringBox.querySelectorAll('.c-fit-slot')) {
      const on = f && btn.dataset.slot === f.slot && Number(btn.dataset.index) === f.index;
      btn.setAttribute('tabindex', on ? '0' : '-1');
    }
  }
  function focusSlot(target) {
    local.ringFocus = target;
    syncRoving();
    ringBox.querySelector(`[data-fit-focus="slot:${target.slot}:${target.index}"]`)?.focus();
  }

  // ---- Zeichnen ---------------------------------------------------------------------------------
  function slotButton(vm, pos) {
    const cell = vm.cells[pos.slot][pos.index];
    const selected = vm.selected?.slot === pos.slot && vm.selected?.index === pos.index;
    const slotName = `${t(`slot.${pos.slot}`)} ${pos.index + 1}`;
    const rf = local.ringFocus;
    const roving = rf ? rf.slot === pos.slot && rf.index === pos.index : pos.slot === vm.order[0]?.slot && pos.index === vm.order[0]?.index;
    const aria = cell.moduleId
      ? t('ui.fitting.slotAria.filled', { slot: slotName, module: cell.name })
      : t('ui.fitting.slotAria.empty', { slot: slotName });
    const btn = h('button', {
      type: 'button',
      class: ['c-fit-slot', `c-fit-slot--${pos.slot}`, cell.moduleId ? 'is-filled' : 'is-empty', selected ? 'is-selected' : '', cell.invalid ? 'is-invalid' : ''],
      'data-slot': pos.slot, 'data-index': pos.index, 'data-fit-focus': `slot:${pos.slot}:${pos.index}`,
      'aria-label': cell.invalid && cell.issue ? `${aria}. ${cell.issue}` : aria,
      'aria-pressed': String(selected), tabindex: roving ? '0' : '-1', title: cell.name ?? slotName,
      onClick: () => { local.ringFocus = { slot: pos.slot, index: pos.index }; ctrl.selectSlot(pos.slot, pos.index); refresh(true); },
      onFocus: () => { local.ringFocus = { slot: pos.slot, index: pos.index }; syncRoving(); },
      onKeydown: (e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && cell.moduleId) { e.preventDefault(); doUnequip(pos.slot, pos.index); return; }
        const next = nextInRing(local.vm.order, { slot: pos.slot, index: pos.index }, e.key);
        if (next) { e.preventDefault(); focusSlot(next); }
      },
      onDragover: (e) => { if (local.drag) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; } },
      onDrop: (e) => dropOn(e, pos.slot, pos.index)
    }, cell.moduleId ? glyph(cell.category) : h('span', { class: 'c-fit-slot__n', 'aria-hidden': 'true' }, String(pos.index + 1)));
    btn.style.setProperty('--fit-x', `${pos.xPct}%`);
    btn.style.setProperty('--fit-y', `${pos.yPct}%`);
    btn.style.setProperty('--fit-size', `${pos.sizePct}%`);
    return btn;
  }

  function dropOn(e, slot, index) {
    if (!local.drag) return;
    e.preventDefault();
    const { moduleId } = local.drag;
    local.drag = null;
    section.removeAttribute('data-drag');
    doEquip(moduleId, { slot, index });
  }

  function paintRing(vm) {
    clear(ringBox);
    ringBox.style.maxWidth = `${vm.ring.size}px`; // dynamische Breite
    ringBox.setAttribute('aria-label', t('ui.fitting.ringLabel', { ship: vm.ship.name }));
    ringBox.append(
      h('div', { class: 'c-fit-ring__core' },
        shipArt({ typeId: vm.ship.typeId, shipClass: vm.ship.classId }),
        h('div', { class: 'c-fit-ring__name' }, vm.ship.name),
        h('div', { class: 'c-fit-ring__type' }, `${vm.ship.typeName} · ${vm.ship.className}`)),
      SLOT_ORDER.filter((s) => vm.counts[s] > 0).map((s) => h('span', { class: `c-fit-ring__label c-fit-ring__label--${s}`, 'aria-hidden': 'true' }, t(`slot.${s}`))),
      vm.ring.slots.map((pos) => slotButton(vm, pos)));
  }

  function paintHardpoints(vm) {
    clear(hardpointsEl);
    if (!vm.hardpoints.length) return;
    hardpointsEl.append(
      h('span', { class: 'c-fit-hardpoints__title' }, t('ui.fitting.hardpoints')),
      vm.hardpoints.map((hp) => h('span', { class: ['c-fit-chip', `is-${hp.state}`] }, `${hp.label} ${hp.used}/${hp.max}`)));
  }

  function paintSelected(vm) {
    clear(selectedBar);
    const s = vm.selected;
    if (!s) {
      selectedBar.append(h('p', { class: 'c-fit-selected__hint' }, t('ui.fitting.selectHint')));
      return;
    }
    selectedBar.append(
      h('p', { class: 'c-fit-selected__text' },
        h('strong', null, s.label), ' – ', s.cell.moduleId ? s.cell.name : t('ui.fitting.empty')),
      s.cell.moduleId
        ? h('button', {
          type: 'button', class: 'c-fit-btn c-fit-btn--danger', 'data-fit-focus': 'selected-remove',
          onClick: () => doUnequip(s.slot, s.index),
          onMouseenter: () => hover({ unequip: { slot: s.slot, index: s.index } }), onMouseleave: () => hover(null),
          onFocus: () => hover({ unequip: { slot: s.slot, index: s.index } }), onBlur: () => hover(null)
        }, s.slot === 'rig' ? t('ui.fitting.removeRig') : t('ui.fitting.remove'))
        : null,
      h('button', { type: 'button', class: 'c-fit-btn c-fit-btn--alt', onClick: () => { ctrl.clearSlot(); refresh(true); } }, t('ui.fitting.clearSelection')));
  }

  function paintSlotList(vm) {
    clear(slotList);
    for (const slot of SLOT_ORDER) {
      if (!vm.counts[slot]) continue;
      slotList.append(
        h('h3', { class: ['c-fit-slots__title', `c-fit-slots__title--${slot}`] }, t(`slot.${slot}`)),
        h('ul', { class: 'c-fit-slots__list', 'aria-label': t(`slot.${slot}`) }, vm.cells[slot].map((cell) => {
          const selected = vm.selected?.slot === slot && vm.selected?.index === cell.index;
          return h('li', {
            class: ['c-fit-row', `c-fit-row--${slot}`, cell.moduleId ? 'is-filled' : 'is-empty', selected ? 'is-selected' : '', cell.invalid ? 'is-invalid' : ''],
            'data-slot': slot, 'data-index': cell.index,
            onDragover: (e) => { if (local.drag) e.preventDefault(); },
            onDrop: (e) => dropOn(e, slot, cell.index)
          },
          h('button', {
            type: 'button', class: 'c-fit-row__main', 'data-fit-focus': `row:${slot}:${cell.index}`, 'aria-pressed': String(selected),
            onClick: () => { local.ringFocus = { slot, index: cell.index }; ctrl.selectSlot(slot, cell.index); refresh(true); }
          },
          h('span', { class: 'c-fit-row__icon' }, cell.moduleId ? glyph(cell.category) : null),
          h('span', { class: 'c-fit-row__label' }, `${cell.index + 1}`),
          h('span', { class: 'c-fit-row__name' }, cell.moduleId ? cell.name : t('ui.fitting.empty')),
          cell.invalid ? h('span', { class: 'c-fit-row__issue' }, cell.issue || t('ui.fitting.invalid')) : null),
          cell.moduleId
            ? h('button', {
              type: 'button', class: 'c-fit-btn c-fit-btn--alt c-fit-row__remove', 'data-fit-focus': `remove:${slot}:${cell.index}`,
              'aria-label': t('ui.fitting.removeAria', { module: cell.name }),
              onClick: () => doUnequip(slot, cell.index),
              onMouseenter: () => hover({ unequip: { slot, index: cell.index } }), onMouseleave: () => hover(null),
              onFocus: () => hover({ unequip: { slot, index: cell.index } }), onBlur: () => hover(null)
            }, t('ui.fitting.remove'))
            : null);
        })));
    }
  }

  function paintPanel(vm) {
    const p = vm.panel;
    clear(panelBody);
    if (p.errors.length || !p.valid) {
      panelBody.append(card(t('ui.fitting.section.problems'),
        h('ul', { class: 'c-fit-problems' }, p.errors.map((e) => h('li', null, e.text)))));
    }
    panelBody.append(
      card(t('ui.fitting.section.budget'), p.budget.map((row) => statBar(row))),
      card(t('ui.fitting.section.defense'),
        h('div', { class: 'c-fit-hp' }, p.layers.map((l) => h('div', { class: ['c-fit-hp__cell', `c-fit-hp__cell--${l.id}`] },
          h('span', { class: 'c-fit-hp__label' }, l.label), h('span', { class: 'c-fit-hp__value' }, l.hpText)))),
        h('p', { class: 'c-fit-ehp' }, h('span', null, t('ui.fitting.ehp')), h('strong', null, p.ehpText)),
        resistMatrix(p.resist, t('ui.fitting.resistCaption'))),
      p.sections.map((s) => card(s.title, statList(s.rows))));
  }

  function paintBrowser(vm) {
    const b = vm.browser;
    browser.setAttribute('data-open', String(vm.ui.browserOpen));
    patch('tabs', [b.tabs, b.slot], () => {
      clear(tabsEl).append(tabs({
        tabs: b.tabs.map((x) => ({ id: x.id, label: x.label, badge: `${x.free}/${x.total}` })),
        activeId: b.slot, label: t('ui.fitting.tabsLabel'),
        onSelect: (id) => { ctrl.selectTab(id); local.pendingFocus = `tab:${id}`; refresh(true); }
      }));
    });
    patch('groups', [b.groups, vm.ui.group], () => {
      clear(groupSelect).append(
        h('option', { value: '' }, t('ui.fitting.allGroups', { count: b.total })),
        b.groups.map((g) => h('option', { value: g.id }, `${g.label} (${g.count})`)));
      groupSelect.value = vm.ui.group;
    });
    targetEl.textContent = b.targetIndex >= 0
      ? t('ui.fitting.target', { slot: b.targetLabel })
      : t('ui.fitting.noFreeSlot', { slot: b.slotLabel });
    countEl.textContent = t('ui.fitting.count', { shown: b.items.length, total: b.total });
    patch('modules', [b.items, b.targetIndex], () => {
      clear(moduleList);
      if (!b.items.length) {
        moduleList.append(h('li', { class: 'c-fit-modules__empty' }, t('ui.fitting.noModules')));
        return;
      }
      moduleList.append(b.items.map((m) => moduleRow(vm, m)));
    });
  }

  function moduleRow(vm, m) {
    const whyId = `c-fit-why-${m.moduleId}`;
    return h('li', {
      class: ['c-fit-mod', m.usable ? '' : 'is-blocked'], draggable: 'true', 'data-module-id': m.moduleId,
      onDblclick: () => { if (m.canEquip) doEquip(m.moduleId); },
      onMouseenter: () => hover({ moduleId: m.moduleId }), onMouseleave: () => hover(null),
      onFocusin: () => hover({ moduleId: m.moduleId }), onFocusout: () => hover(null),
      onDragstart: (e) => {
        local.drag = { moduleId: m.moduleId, slot: vm.browser.slot };
        section.setAttribute('data-drag', vm.browser.slot);
        if (e.dataTransfer) { e.dataTransfer.setData('text/plain', m.moduleId); e.dataTransfer.effectAllowed = 'copy'; }
      },
      onDragend: () => { local.drag = null; section.removeAttribute('data-drag'); }
    },
    h('span', { class: 'c-fit-mod__icon' }, glyph(m.category)),
    h('div', { class: 'c-fit-mod__body' },
      h('strong', { class: 'c-fit-mod__name' }, m.name),
      h('span', { class: 'c-fit-mod__meta' }, [m.groupLabel, m.sizeLabel, m.cost].filter(Boolean).join(' · ')),
      h('span', { class: ['c-fit-mod__stock', m.qtyInStation > 0 ? '' : 'is-zero'] }, t('ui.fitting.stock', { qty: m.qtyInStation })),
      m.reason ? h('span', { class: 'c-fit-mod__why', id: whyId }, m.reason) : null),
    h('button', {
      type: 'button', class: ['c-fit-btn', 'c-fit-mod__equip', m.canEquip ? '' : 'is-disabled'],
      'aria-disabled': String(!m.canEquip), 'aria-describedby': m.reason ? whyId : null, 'data-fit-focus': `mod:${m.moduleId}`,
      onClick: () => { if (m.canEquip) doEquip(m.moduleId); }
    }, t('ui.fitting.equip')));
  }

  function paint(vm) {
    const keep = focusKey();
    unavailableEl.hidden = vm.available;
    if (!vm.available) {
      unavailableEl.textContent = vm.reason;
      noticeEl.hidden = true; statsMissingEl.hidden = true; shipBar.hidden = true; grid.hidden = true;
      return;
    }
    noticeEl.hidden = vm.docked;
    if (!vm.docked) {
      noticeEl.textContent = `${vm.notice} ${t('ui.fitting.notice.hint')}`;
      statsMissingEl.hidden = true; shipBar.hidden = true; grid.hidden = true;
      return;
    }
    shipBar.hidden = false; grid.hidden = false; statsMissingEl.hidden = !vm.statsMissing;

    patch('ships', [vm.ships.map((s) => [s.uid, s.label]), vm.ship.uid], () => {
      clear(shipSelect).append(vm.ships.map((s) => h('option', { value: s.uid }, s.label)));
      shipSelect.value = vm.ship.uid;
    });
    patch('ring', [vm.ring.size, vm.ship.typeId, vm.cells, vm.selected && [vm.selected.slot, vm.selected.index]], () => paintRing(vm));
    patch('hardpoints', vm.hardpoints, () => paintHardpoints(vm));
    patch('selected', [vm.selected && [vm.selected.slot, vm.selected.index, vm.selected.cell.moduleId]], () => paintSelected(vm));
    patch('slotlist', [vm.cells, vm.selected && [vm.selected.slot, vm.selected.index]], () => paintSlotList(vm));
    patch('panel', vm.panel, () => paintPanel(vm));
    paintBrowser(vm);
    showPreview();
    restoreFocus(keep);
  }

  function refresh(force = false) {
    const t0 = nowMs();
    if (!force && t0 - local.last < REFRESH_MIN_MS) return;
    local.last = t0;
    local.vm = ctrl.viewModel();
    paint(local.vm);
  }

  return { game, ctrl, refresh, root: section, local };
}

export const view = {
  id: 'fitting',
  title: 'Fitting', // = data/i18n/de.json „nav.fitting“; Shells, die übersetzen, nutzen titleKey
  titleKey: 'nav.fitting',
  group: 'fitting',
  order: 30,
  enabled(game) {
    const { available } = fittingAvailability(game);
    return available ? true : { enabled: false, reason: game.t('ui.fitting.unavailable') };
  },
  render(root, game) {
    ensureCss();
    const inst = createInstance(root, game);
    instances.set(root, inst);
    inst.refresh(true);
  },
  update(root, game) {
    const inst = instances.get(root);
    if (!inst || inst.game !== game) { view.render(root, game); return; }
    inst.refresh(false);
  }
};
