// Farbschema: hell (Standard) oder dunkel (EVE-nah). Die Wahl wird im Browser gespeichert.
const KEY = 'tf_theme';

export function readTheme(win = globalThis.window) {
  try { return win?.localStorage?.getItem(KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}
export function applyTheme(doc, theme) { doc?.documentElement?.setAttribute('data-theme', theme); }
export function saveTheme(theme, win = globalThis.window) {
  try { win?.localStorage?.setItem(KEY, theme); } catch { /* Speicher nicht verfügbar */ }
}
