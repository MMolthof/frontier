// Formatierung für das UI (de-DE). Zahlen im UI immer über fmt().

const formatters = new Map();

function numberFormat(digits) {
  let nf = formatters.get(digits);
  if (!nf) {
    nf = new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    formatters.set(digits, nf);
  }
  return nf;
}

/** Zahl nach de-DE, z. B. fmt(1234.5, 1) → "1.234,5". Nicht endliche Werte → "–". */
export function fmt(value, digits = 0) {
  return Number.isFinite(value) ? numberFormat(digits).format(value) : '–';
}

/** ISK ist ganzzahlig. */
export function fmtIsk(value) {
  return `${fmt(Math.round(value))} ISK`;
}

/** Ticks (Standard: 1 Tick = 60 s) als "1 d 2 h 5 min". */
export function fmtTicks(ticks, tickSeconds = 60) {
  const totalMin = Math.max(0, Math.round((ticks * tickSeconds) / 60));
  const d = Math.floor(totalMin / 1440);
  const hh = Math.floor((totalMin % 1440) / 60);
  const mm = totalMin % 60;
  const parts = [];
  if (d) parts.push(`${fmt(d)} d`);
  if (hh) parts.push(`${hh} h`);
  if (mm || parts.length === 0) parts.push(`${mm} min`);
  return parts.join(' ');
}

/**
 * Übersetzer über data.i18n.<lang>. Akzeptiert flache Tabellen oder { strings: {...} }.
 * Fehlende Schlüssel liefern den Schlüssel selbst. Platzhalter: "{name}".
 */
export function createTranslator(table) {
  const strings = table && typeof table.strings === 'object' ? table.strings : table ?? {};
  return (key, params = {}) => {
    const raw = typeof strings[key] === 'string' ? strings[key] : key;
    return raw.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
  };
}
