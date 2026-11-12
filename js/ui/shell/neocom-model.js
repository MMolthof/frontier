// Neocom-Modell (Master Plan 3.2 / Vertrag 5.1). Neue Einträge nur hier ergänzen.
// Eintrag: { id, labelKey, icon, viewId?, sub?, requires?: 'docked', unavailable?: true, subs?: [{id, labelKey}], children?: [...] }
// Ohne viewId ist der Eintrag eine Gruppe (klappt auf). requires 'docked' gilt für alle Kinder.

export const NEOCOM_MODEL = [
  { id: 'overview', labelKey: 'shell.nav.overview', icon: 'overview', viewId: 'overview' },
  {
    id: 'system', labelKey: 'shell.nav.system', icon: 'system', children: [
      { id: 'system.overview', labelKey: 'shell.nav.system.overview', icon: 'system', viewId: 'system', sub: 'overview' },
      { id: 'system.map', labelKey: 'shell.nav.system.map', icon: 'planet', viewId: 'system', sub: 'map' },
      { id: 'system.stars', labelKey: 'shell.nav.system.stars', icon: 'star', viewId: 'system', sub: 'stars' }
    ]
  },
  {
    id: 'station', labelKey: 'shell.nav.station', icon: 'station', requires: 'docked', children: [
      { id: 'hangar', labelKey: 'shell.nav.hangar', icon: 'hangar', viewId: 'hangar', subs: [{ id: 'items', labelKey: 'shell.nav.hangar.items' }, { id: 'ships', labelKey: 'shell.nav.hangar.ships' }] },
      { id: 'market', labelKey: 'shell.nav.market', icon: 'market', viewId: 'market', subs: [{ id: 'sell', labelKey: 'shell.nav.market.sell' }, { id: 'buy', labelKey: 'shell.nav.market.buy' }, { id: 'history', labelKey: 'shell.nav.market.history' }] },
      { id: 'missions', labelKey: 'shell.nav.missions', icon: 'missions', viewId: 'missions', subs: [{ id: 'available', labelKey: 'shell.nav.missions.available' }, { id: 'active', labelKey: 'shell.nav.missions.active' }] },
      { id: 'industry', labelKey: 'shell.nav.industry', icon: 'industry', viewId: 'industry', subs: [{ id: 'refinery', labelKey: 'shell.nav.industry.refinery' }, { id: 'production', labelKey: 'shell.nav.industry.production' }] },
      { id: 'shipyard', labelKey: 'shell.nav.shipyard', icon: 'shipyard', viewId: 'shipyard' }
    ]
  },
  { id: 'fitting', labelKey: 'shell.nav.fitting', icon: 'fitting', viewId: 'fitting' },
  {
    id: 'mining', labelKey: 'shell.nav.mining', icon: 'mining', children: [
      { id: 'mining.field', labelKey: 'shell.nav.mining.field', icon: 'belt', viewId: 'mining', sub: 'field' },
      { id: 'mining.hall', labelKey: 'shell.nav.mining.hall', icon: 'ore', viewId: 'mining', sub: 'hall' }
    ]
  },
  {
    id: 'skills', labelKey: 'shell.nav.skills', icon: 'skills', children: [
      { id: 'skills.training', labelKey: 'shell.nav.skills.training', icon: 'skills', viewId: 'skills', sub: 'training' },
      { id: 'skills.catalog', labelKey: 'shell.nav.skills.catalog', icon: 'search', viewId: 'skills', sub: 'catalog' },
      { id: 'skills.attributes', labelKey: 'shell.nav.skills.attributes', icon: 'cap', viewId: 'skills', sub: 'attributes' }
    ]
  },
  {
    id: 'account', labelKey: 'shell.nav.account', icon: 'account', children: [
      { id: 'account.wealth', labelKey: 'shell.nav.account.wealth', icon: 'cargo', viewId: 'account', sub: 'wealth', unavailable: true },
      { id: 'account.log', labelKey: 'shell.nav.account.log', icon: 'log', viewId: 'account', sub: 'log' },
      { id: 'account.settings', labelKey: 'shell.nav.account.settings', icon: 'settings', viewId: 'account', sub: 'settings' }
    ]
  }
];

import { buildMenu } from './menu.js';
import { createT } from './translate.js';

/** Reine Funktion (ohne DOM): Menümodell + Ansichten + Spiel -> Einträge mit Zustand. Vertrag 4.3. */
export function buildNeocom(model, views, game, options = {}) {
  return buildMenu(model, views, game, { t: createT(game), ...options });
}
