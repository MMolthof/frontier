// Hash-Routen: "#/hangar/items" <-> { viewId: 'hangar', sub: 'items' }. Leer = Übersicht.

export const DEFAULT_VIEW = 'overview';

export function parseHash(hash) {
  const clean = String(hash ?? '').replace(/^#\/?/, '').replace(/\/+$/, '');
  if (!clean) return { viewId: DEFAULT_VIEW, sub: null };
  const [viewId, sub] = clean.split('/').map((part) => { try { return decodeURIComponent(part); } catch { return part; } });
  return { viewId: viewId || DEFAULT_VIEW, sub: sub || null };
}

export function buildHash({ viewId, sub }) {
  return `#/${encodeURIComponent(viewId)}${sub ? `/${encodeURIComponent(sub)}` : ''}`;
}
