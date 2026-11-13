// PLATZHALTER-Komponenten der Fitting-Ansicht (A5).
// Agent 3 liefert die echten Komponenten (js/ui/components/**: stat-bar, resist-matrix, tabs, modal/confirm,
// toast, tooltip, slot-ring …). Zum Zeitpunkt dieser Lieferung waren sie noch nicht im Repo. Damit der Lead sie
// später mit einer Ein-Datei-Änderung ersetzen kann, liegt ALLES, was A3 ersetzt, hier – index.js importiert
// nur aus dieser Datei. Klassen: .c-fit-… (css/views/fitting.css), nur Tokens aus css/tokens.css.

import { h, clear } from '../../../util/dom.js';

const ASSET_ROOT = new URL('../../../../', import.meta.url);

// -- Icons (18 px, Strichstärke 1,5, currentColor, ohne Emojis) --------------------------------

const GLYPHS = {
  weapon: ['circle:12,12,6', 'path:M12 2v5M12 17v5M2 12h5M17 12h5'],
  mining: ['polygon:12,3 20,12 12,21 4,12', 'path:M12 8v8M8 12h8'],
  shield: ['path:M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z'],
  armor: ['rect:5,5,14,14', 'path:M5 12h14'],
  propulsion: ['path:M6 7l6 5-6 5M12 7l6 5-6 5'],
  engineering: ['path:M13 3L5 13h6l-1 8 8-10h-6z'],
  electronics: ['path:M2 12h4l2-6 4 12 2-6h8'],
  scanner: ['circle:12,12,8', 'path:M12 12l6-4'],
  rig: ['path:M12 3l8 4.5v9L12 21l-8-4.5v-9z']
};

/** Kleines Kategorie-Icon. */
export function glyph(category, size = 18) {
  const parts = GLYPHS[category] ?? ['circle:12,12,4'];
  const nodes = parts.map((p) => {
    const [kind, raw] = [p.slice(0, p.indexOf(':')), p.slice(p.indexOf(':') + 1)];
    const v = raw.split(',');
    if (kind === 'circle') return h('circle', { cx: v[0], cy: v[1], r: v[2] });
    if (kind === 'rect') return h('rect', { x: v[0], y: v[1], width: v[2], height: v[3], rx: 2 });
    if (kind === 'polygon') return h('polygon', { points: raw });
    return h('path', { d: raw });
  });
  return h('svg', {
    viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
    'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false'
  }, nodes);
}

// -- Schiffsbild --------------------------------------------------------------------------------

const SILHOUETTE = {
  frigate: '50,6 62,30 90,44 62,48 50,54 38,48 10,44 38,30',
  destroyer: '50,4 60,22 92,40 60,46 50,56 40,46 8,40 40,22',
  cruiser: '50,4 64,20 94,38 66,48 50,56 34,48 6,38 36,20',
  battlecruiser: '50,3 66,18 96,36 68,50 50,57 32,50 4,36 34,18',
  battleship: '50,2 68,16 98,34 70,52 50,58 30,52 2,34 32,16',
  barge: '30,10 70,10 88,30 70,52 30,52 12,30',
  hauler: '20,12 80,12 92,30 80,50 20,50 8,30'
};

/** Schiffssilhouette: assets/ships/<typeId>.svg (A3), sonst eigener flacher Rückfall nach Klasse. */
export function shipArt({ typeId, shipClass }) {
  const fallback = () => h('svg', { viewBox: '0 0 100 60', class: 'c-fit-ship__svg', 'aria-hidden': 'true', focusable: 'false' },
    h('polygon', { points: SILHOUETTE[shipClass] ?? SILHOUETTE.frigate }),
    h('circle', { cx: 50, cy: 52, r: 2.5, class: 'c-fit-ship__engine' }));
  const wrap = h('div', { class: 'c-fit-ship', 'aria-hidden': 'true' });
  const img = h('img', {
    class: 'c-fit-ship__img', alt: '', width: 100, height: 60, decoding: 'async',
    src: new URL(`assets/ships/${typeId}.svg`, ASSET_ROOT).href,
    onError: () => { clear(wrap); wrap.append(fallback()); }
  });
  wrap.append(img);
  return wrap;
}

// -- Balken, Resist-Matrix, Listen --------------------------------------------------------------

/** Fitting-Balken (PG/CPU/Calibration); rot bei Überschreitung. `row` stammt aus buildPanel().budget. */
export function statBar(row) {
  const fill = h('span', { class: 'c-fit-bar__fill' });
  fill.style.width = `${Math.round(row.ratio * 100)}%`; // dynamische Breite
  return h('div', { class: ['c-fit-bar', `c-fit-bar--${row.state}`] },
    h('div', { class: 'c-fit-bar__head' },
      h('span', { class: 'c-fit-bar__label' }, row.label),
      h('span', { class: 'c-fit-bar__text' }, row.text)),
    h('div', {
      class: 'c-fit-bar__track', role: 'meter', 'aria-label': row.label,
      'aria-valuemin': 0, 'aria-valuemax': Math.max(row.max, row.used), 'aria-valuenow': row.used,
      'aria-valuetext': row.overText ? `${row.text} ${row.overText}` : row.text
    }, fill),
    row.overText ? h('div', { class: 'c-fit-bar__over' }, row.overText) : null);
}

/** Resist-Matrix 4 × 3 (Schadenstypen × Schichten). */
export function resistMatrix(resist, caption) {
  const head = h('tr', null, h('td', null), resist.layers.map((l) => h('th', { scope: 'col' }, l.label)));
  const body = resist.rows.map((r) => h('tr', null,
    h('th', { scope: 'row' }, r.label),
    r.cells.map((c) => {
      const td = h('td', { class: 'c-fit-res__cell' }, c.text);
      td.style.setProperty('--fit-level', String(Math.round(c.level * 100) / 100)); // dynamischer Wert
      return td;
    })));
  return h('table', { class: 'c-fit-res' }, h('caption', { class: 'c-fit-sr' }, caption), h('thead', null, head), h('tbody', null, body));
}

/** Beschriftete Wertezeilen. */
export function statList(rows) {
  return h('dl', { class: 'c-fit-list' }, rows.map((r) => [
    h('dt', null, r.label),
    h('dd', { class: [r.strong ? 'is-strong' : '', r.tone ? `is-${r.tone}` : ''] }, r.text)
  ]));
}

// -- Tabs ---------------------------------------------------------------------------------------

/** Tab-Leiste mit Pfeiltasten (roving tabindex). tabs: [{id,label,badge?}] */
export function tabs({ tabs: items, activeId, label, onSelect }) {
  // Fokus setzt der Aufrufer (onSelect zeichnet die Leiste neu; ein Fokus auf den alten Button ginge verloren).
  const move = (from, step) => onSelect(items[(from + step + items.length) % items.length].id);
  const list = h('div', { class: 'c-fit-tabs', role: 'tablist', 'aria-label': label });
  items.forEach((tab, i) => {
    const active = tab.id === activeId;
    const btn = h('button', {
      type: 'button', role: 'tab', class: ['c-fit-tab', `c-fit-tab--${tab.id}`, active ? 'is-active' : ''],
      'aria-selected': String(active), tabindex: active ? '0' : '-1', 'data-fit-focus': `tab:${tab.id}`,
      onClick: () => onSelect(tab.id),
      onKeydown: (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); move(i, 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); move(i, -1); }
        else if (e.key === 'Home') { e.preventDefault(); move(i, -i); }
        else if (e.key === 'End') { e.preventDefault(); move(i, items.length - 1 - i); }
      }
    }, tab.label, tab.badge ? h('span', { class: 'c-fit-tab__badge' }, tab.badge) : null);
    list.append(btn);
  });
  return list;
}

// -- Toast und Bestätigungsdialog ----------------------------------------------------------------

/** Meldung (role=status), verschwindet von selbst. kind: 'success' | 'error' */
export function showToast(host, text, kind = 'success', ttlMs = kind === 'error' ? 6000 : 3500) {
  const toast = h('div', { class: ['c-fit-toast', `c-fit-toast--${kind}`], role: kind === 'error' ? 'alert' : 'status' }, text);
  host.append(toast);
  const timer = globalThis.setTimeout?.(() => toast.remove(), ttlMs);
  timer?.unref?.(); // Node: hält den Prozess nicht offen
  toast.addEventListener('click', () => { globalThis.clearTimeout?.(timer); toast.remove(); });
  return toast;
}

let dialogSeq = 0;

/** Bestätigungsdialog (<dialog>, Fokusfalle und Esc durch den Browser). Löst mit true/false auf. */
export function confirmDialog(host, { title, message, confirmLabel, cancelLabel }) {
  return new Promise((resolve) => {
    const id = `c-fit-dlg-${++dialogSeq}`;
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      if (dlg.close) dlg.close();
      dlg.remove();
      resolve(value);
    };
    const cancel = h('button', { type: 'button', class: 'c-fit-btn', autofocus: true, onClick: () => finish(false) }, cancelLabel);
    const confirm = h('button', { type: 'button', class: 'c-fit-btn c-fit-btn--danger', onClick: () => finish(true) }, confirmLabel);
    const dlg = h('dialog', { class: 'c-fit-dialog', 'aria-labelledby': `${id}-t`, 'aria-describedby': `${id}-m` },
      h('h3', { id: `${id}-t`, class: 'c-fit-dialog__title' }, title),
      h('p', { id: `${id}-m`, class: 'c-fit-dialog__text' }, message),
      h('div', { class: 'c-fit-dialog__actions' }, cancel, confirm));
    dlg.addEventListener('cancel', () => finish(false));
    dlg.addEventListener('close', () => finish(false));
    host.append(dlg);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    cancel.focus();
  });
}
