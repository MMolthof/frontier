// Übersetzer mit Rückfall auf die Standardtexte: erst game.t (data/i18n/de.json), dann DEFAULT_STRINGS.

import { createTranslator } from '../../util/format.js';
import { DEFAULT_STRINGS } from './default-strings.js';

const fallback = createTranslator(DEFAULT_STRINGS);

export function createT(game) {
  return (key, params = {}) => {
    const out = typeof game?.t === 'function' ? game.t(key, params) : key;
    return out !== key ? out : fallback(key, params);
  };
}

/** Alter Name, bleibt als Alias erhalten. */
export const createTranslatorFor = createT;
