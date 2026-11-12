// Reines Menümodell: Neocom-Modell + registrierte Ansichten + Spielzustand -> Einträge mit Zustand.
// Keine DOM-Zugriffe; testbar. Aktiv-Markierung kommt aus der Route.

import { buildHash } from './route.js';

export const isDocked = (game) => Boolean(game.state?.pilot?.location?.dockedStationId);

/** Wertet view.enabled aus. Wirft die Funktion, gilt die Ansicht als nicht verfügbar. */
export function evalEnabled(view, game, t) {
  if (!view) return { ok: false, reason: t('shell.reason.notyet'), missing: true };
  if (typeof view.enabled !== 'function') return { ok: true };
  try {
    const res = view.enabled(game);
    if (res && typeof res === 'object') return (res.ok ?? res.enabled) ? { ok: true } : { ok: false, reason: res.reason ?? t('shell.reason.unavailable') };
    return res ? { ok: true } : { ok: false, reason: t('shell.reason.unavailable') };
  } catch {
    return { ok: false, reason: t('shell.reason.unavailable') };
  }
}

function matchesRoute(entry, route, siblings) {
  if (!entry.viewId || entry.viewId !== route.viewId) return false;
  if (!entry.sub) return true;
  if (entry.sub === route.sub) return true;
  if (route.sub) return false;
  const firstSame = siblings.find((s) => s.viewId === entry.viewId);
  return firstSame === entry;
}

/**
 * @param {object[]} model NEOCOM_MODEL
 * @param {{id: string, title: string, enabled?: Function}[]} views registrierte Ansichten (inkl. Shell-Seiten)
 * @param {object} game
 * @param {{t: Function, route?: {viewId: string, sub: string|null}, expanded?: Set<string>}} o
 */
export function buildMenu(model, views, game, { t, route = { viewId: 'overview', sub: null }, expanded = new Set() }) {
  const viewMap = new Map(views.map((v) => [v.id, v]));
  const docked = isDocked(game);
  const used = new Set();

  const makeLeaf = (entry, parentBlock, siblings) => {
    if (entry.viewId) used.add(entry.viewId);
    const view = viewMap.get(entry.viewId);
    let state = evalEnabled(view, game, t);
    if (entry.unavailable) state = { ok: false, reason: t('shell.reason.notyet') };
    if (parentBlock) state = { ok: false, reason: parentBlock };
    const active = matchesRoute(entry, route, siblings);
    const subs = (entry.subs ?? view?.subs ?? []).map((s) => ({
      id: s.id, label: s.label ?? t(s.labelKey ?? s.titleKey), hash: buildHash({ viewId: entry.viewId, sub: s.id }),
      active: active && route.sub === s.id
    }));
    return {
      id: entry.id, label: t(entry.labelKey), icon: entry.icon, viewId: entry.viewId, sub: entry.sub ?? null,
      hash: buildHash({ viewId: entry.viewId, sub: entry.sub }), enabled: state.ok, reason: state.reason ?? null,
      active, subs: active ? subs : [], children: null
    };
  };

  const items = model.map((entry) => {
    const block = entry.requires === 'docked' && !docked ? t('shell.reason.docked') : null;
    if (!entry.children) return makeLeaf(entry, block, [entry]);
    const children = entry.children.map((child) => makeLeaf(child, block, entry.children));
    const anyEnabled = children.some((c) => c.enabled);
    const hasActive = children.some((c) => c.active);
    return {
      id: entry.id, label: t(entry.labelKey), icon: entry.icon, viewId: null, sub: null, hash: null,
      enabled: anyEnabled, reason: anyEnabled ? null : block ?? children.find((c) => c.reason)?.reason ?? t('shell.reason.unavailable'),
      active: false, subs: [], children, expanded: hasActive || expanded.has(entry.id)
    };
  });

  const extra = views.filter((v) => !used.has(v.id) && !model.some((m) => m.viewId === v.id) && v.id !== 'overview')
    .map((v) => ({ v, state: evalEnabled(v, game, t) })).filter(({ state }) => state.ok)
    .map(({ v }) => ({
      id: `more.${v.id}`, label: v.title, icon: 'overview', viewId: v.id, sub: null, hash: buildHash({ viewId: v.id }),
      enabled: true, reason: null, active: route.viewId === v.id, subs: [], children: null
    }));
  if (extra.length) {
    items.push({ id: 'more', label: t('shell.nav.more'), icon: 'overview', viewId: null, sub: null, hash: null, enabled: true, reason: null, active: false, subs: [], children: extra, expanded: extra.some((c) => c.active) || expanded.has('more') });
  }
  return items;
}

/** Tabs für die schmale Ansicht: Geschwister der aktiven Gruppe oder Subs des aktiven Eintrags. */
export function activeTabs(menu) {
  for (const item of menu) {
    if (item.children) {
      const active = item.children.find((c) => c.active);
      if (active) return item.children.map((c) => ({ id: c.id, label: c.label, hash: c.hash, disabled: !c.enabled, reason: c.reason, active: c.active }));
    } else if (item.active && item.subs.length) {
      return item.subs.map((s) => ({ id: s.id, label: s.label, hash: s.hash, disabled: false, reason: null, active: s.active }));
    }
  }
  return [];
}
