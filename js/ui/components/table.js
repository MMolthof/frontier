// Tabelle mit sortierbaren Spalten, Zeilenklick, horizontalem Scrollen (Region mit Fokus) und In-place-Update.

import { h, setText } from '../../util/dom.js';
import { icon } from './icon.js';
import { uiText } from './ui-strings.js';

const parts = new WeakMap();
const sortValue = (col, row) => (col.sortValue ? col.sortValue(row) : row[col.key]);

function compare(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), 'de');
}

function sortedRows(rows, columns, sort) {
  if (!sort) return rows;
  const col = columns.find((c) => c.key === sort.key);
  if (!col) return rows;
  const dir = sort.dir === 'desc' ? -1 : 1;
  return rows.map((row, i) => ({ row, i }))
    .sort((a, b) => dir * compare(sortValue(col, a.row), sortValue(col, b.row)) || a.i - b.i).map((x) => x.row);
}

function setCell(td, value) {
  if (value !== null && typeof value === 'object' && 'nodeType' in value) {
    if (td.firstChild !== value || td.children.length !== 1) { td.replaceChildren(value); }
  } else setText(td, value ?? '');
}

/**
 * @param {{columns: {key: string, label: string, align?: 'left'|'right', sortable?: boolean, render?: (row: any) => any, sortValue?: (row: any) => any}[],
 *   rows: any[], caption: string, rowKey?: (row: any) => string, onRowClick?: (row: any) => void,
 *   sort?: {key: string, dir: 'asc'|'desc'}, onSort?: (sort: object) => void, emptyText?: string, t?: Function}} o
 */
export function table(o) {
  const t = uiText(o.t);
  const state = { o, t, sort: o.sort ?? null, rowEls: new Map(), headers: new Map() };
  const headRow = h('tr', null, o.columns.map((col) => {
    const th = h('th', { scope: 'col', class: col.align === 'right' ? 'c-table__r' : null });
    if (col.sortable) {
      const btn = h('button', { type: 'button', class: 'c-table__sort', 'aria-label': t('ui.table.sort', { name: col.label }) }, col.label, icon('chevron', { size: 12 }));
      btn.addEventListener('click', () => {
        const dir = state.sort?.key === col.key && state.sort.dir === 'asc' ? 'desc' : 'asc';
        state.sort = { key: col.key, dir };
        o.onSort?.(state.sort);
        update(el, {});
      });
      th.appendChild(btn);
    } else th.appendChild(h('span', null, col.label));
    state.headers.set(col.key, th);
    return th;
  }));
  const body = h('tbody');
  const empty = h('p', { class: 'c-table__empty u-mute' });
  const el = h('div', { class: 'c-table-wrap', role: 'region', tabindex: '0', 'aria-label': o.caption },
    h('table', { class: 'c-table' }, h('caption', { class: 'u-sr' }, o.caption), h('thead', null, headRow), body), empty);
  state.body = body; state.empty = empty;
  parts.set(el, state);
  return update(el, o);
}

function update(el, patch) {
  const state = parts.get(el);
  Object.assign(state.o, patch);
  if (patch.sort) state.sort = patch.sort;
  const { columns, rows, onRowClick } = state.o;
  const keyOf = state.o.rowKey ?? ((row) => String(row.id ?? rows.indexOf(row)));
  for (const col of columns) {
    state.headers.get(col.key).setAttribute('aria-sort', state.sort?.key === col.key ? (state.sort.dir === 'desc' ? 'descending' : 'ascending') : 'none');
  }
  const ordered = sortedRows(rows, columns, state.sort);
  const seen = new Set();
  ordered.forEach((row, index) => {
    const key = keyOf(row);
    seen.add(key);
    let entry = state.rowEls.get(key);
    if (!entry) {
      const cells = columns.map((col) => h('td', { class: col.align === 'right' ? 'c-table__r u-num' : null }));
      const tr = h('tr', { class: onRowClick ? 'c-table__row--click' : null, tabindex: onRowClick ? '0' : null });
      cells.forEach((td) => tr.appendChild(td));
      entry = { tr, cells, row };
      if (onRowClick) {
        tr.addEventListener('click', () => state.o.onRowClick?.(entry.row));
        tr.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); state.o.onRowClick?.(entry.row); } });
      }
      state.rowEls.set(key, entry);
    }
    entry.row = row;
    columns.forEach((col, i) => setCell(entry.cells[i], col.render ? col.render(row) : row[col.key]));
    if (state.body.children[index] !== entry.tr) state.body.insertBefore(entry.tr, state.body.children[index] ?? null);
  });
  for (const [key, entry] of state.rowEls) if (!seen.has(key)) { entry.tr.remove(); state.rowEls.delete(key); }
  setText(state.empty, ordered.length ? '' : state.o.emptyText ?? uiText(state.o.t)('ui.empty.default'));
  return el;
}

/** Ersetzt Zeilen und/oder Sortierung; vorhandene Zeilen-Elemente werden wiederverwendet. */
export const updateTable = (el, patch) => update(el, patch);
