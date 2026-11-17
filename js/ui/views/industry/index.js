// Industrie: Raffinerie (Erz → Mineralien). Produktion folgt in einer späteren Iteration.
import { h } from '../../../util/dom.js';
import { fmt } from '../../../util/format.js';
import { card } from '../../components/card.js';
import { emptyState } from '../../components/empty-state.js';
import { oreIcon } from '../../components/ore-icon.js';
import { button } from '../../components/button.js';
import { meter } from '../../components/meter.js';
import { moduleIcon } from '../../components/module-icon.js';
import { MODCAT_LABEL, SIZE_LABEL, SLOT_LABEL } from '../labels.js';
import { actionButton, dockedOnly, liveView, msgLine } from '../live.js';

function refineryTab(m, ctl) {
  const ores = m.ores.map((o) => h('li', { class: 'v-trade' },
    h('div', { class: 'v-trade__name' }, h('span', { class: 'l-row' }, oreIcon({ id: o.id, name: o.name }), h('strong', null, o.name)), h('span', { class: 'u-mute' }, `Ausbeute ${fmt(o.efficiency * 100)} %`)),
    h('div', { class: 'v-trade__stock u-num' }, `Lager: ${fmt(o.stock)}`),
    h('div', { class: 'u-mute' }, o.batches > 0 ? `${fmt(o.batches)} Durchläufe → ${Object.entries(o.outputs).map(([id, n]) => `${fmt(n)} ${m.names[id] ?? id}`).join(', ')}` : `Mindestens ${fmt(o.batchSize)} Einheiten nötig.`),
    actionButton({ label: 'Raffinieren', variant: 'primary', run: ctl.run, type: 'refine/run', payload: { oreId: o.id }, disabled: o.batches <= 0, reason: `Mindestens ${o.batchSize} Einheiten` })));
  return h('div', { class: 'l-stack' },
    card({ title: `Raffinerie ${m.stationName}`, subtitle: 'Verarbeitet Erz aus dem Stationslager zu Mineralien. Skills erhöhen die Ausbeute.', children: h('div', { class: 'l-stack' }, msgLine(ctl.ui.msg),
      ores.length ? h('ul', { class: 'v-trades' }, ores) : emptyState({ icon: 'ore', title: 'Kein Erz im Lager', text: 'Baue Erz ab und entlade es im Hangar.' })) }),
    card({ title: 'Mineralien im Lager', children: m.minerals.length ? h('ul', { class: 'v-list' }, m.minerals.map((x) => h('li', null, h('strong', null, x.name), h('span', { class: 'u-num' }, ` ${fmt(x.qty)}`)))) : h('p', { class: 'u-mute' }, 'Noch keine Mineralien.') }));
}


function productionTab(m, ctl) {
  const jobs = m.jobs.length ? h('ul', { class: 'v-queue' }, ...m.jobs.map((j) => h('li', { class: 'v-queue__row' },
    h('span', null, h('strong', null, j.name), h('span', { class: 'u-mute' }, ` · noch ${fmt(j.ticksLeft)} Ticks`), meter({ label: j.name, value: j.pct * 100, max: 100, text: `${fmt(j.pct * 100)} %` })),
    button({ label: 'Abbrechen', variant: 'ghost', onClick: () => ctl.run('industry/cancel', { id: j.id }) })))) : h('p', { class: 'u-mute' }, 'Keine laufenden Aufträge.');
  const chips = [['', 'Alle'], ['high', 'Hoch'], ['mid', 'Mittel'], ['low', 'Niedrig'], ['rig', 'Rigs']].map(([id, label]) => button({ label, variant: 'alt', pressed: (ctl.ui.slot ?? '') === id, onClick: () => { ctl.ui.slot = id; ctl.repaint(); } }));
  const search = h('input', { type: 'search', class: 'v-qty v-search', placeholder: 'Modul suchen …', value: ctl.ui.search ?? '', 'aria-label': 'Modul suchen' });
  search.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ctl.ui.search = search.value; ctl.repaint(); } });
  search.addEventListener('change', () => { ctl.ui.search = search.value; ctl.repaint(); });
  const rows = m.recipes.slice(0, 50).map((r) => h('li', { class: 'v-mod' }, h('span', { class: 'v-mod__icon' }, moduleIcon(r.category, { size: 22 })),
    h('div', { class: 'v-mod__main' }, h('strong', null, r.name), h('span', { class: 'u-mute' }, ` ${SLOT_LABEL[r.slot]} · ${SIZE_LABEL[r.size] ?? r.size} · ${MODCAT_LABEL[r.category] ?? r.category} · ${fmt(r.ticks)} Ticks · Marktwert ${fmt(r.price)} ISK`),
      h('span', { class: 'v-req' }, r.inputs.map((i) => `${fmt(i.need)} ${i.name} (${fmt(i.have)})`).join(' · '))),
    h('span', { class: r.canStart ? 'v-req v-req--ok v-mod__qty' : 'v-req v-req--no v-mod__qty' }, r.canStart ? 'Material da' : 'Material fehlt'),
    h('span', null),
    button({ label: 'Herstellen', variant: 'primary', disabled: !m.canBuild, reason: m.buildReason, onClick: () => ctl.run('industry/start', { moduleId: r.moduleId }) })));
  return h('div', { class: 'l-stack' }, msgLine(ctl.ui.msg),
    card({ title: 'Fabrik', subtitle: `Aufträge: ${m.slots.used}/${m.slots.max} · Industrie-Skill Stufe ${m.slots.skillLevel}. Das fertige Modul landet im Stationslager und lässt sich einbauen oder am Markt verkaufen.`, children: jobs }),
    card({ title: 'Module herstellen', subtitle: 'Mineralien bekommst du aus der Raffinerie oder im Markt unter „Kaufen → Rohstoffe“.', children: h('div', { class: 'l-stack' }, h('div', { class: 'l-row' }, ...chips, search),
      rows.length ? h('ul', { class: 'v-mods' }, ...rows) : emptyState({ icon: 'industry', title: 'Keine Treffer' })) }));
}

export const view = liveView({
  id: 'industry', title: 'Industrie', group: 'station', order: 23, enabled: dockedOnly,
  subs: [{ id: 'refinery', labelKey: 'shell.nav.industry.refinery' }, { id: 'production', labelKey: 'shell.nav.industry.production' }],
  model(game, route, ui) {
    const stock = game.select('inv/stock');
    const names = Object.fromEntries(Object.values(game.data.items).map((i) => [i.id, i.name]));
    const ores = stock.filter((r) => r.kind === 'ore').map((r) => {
      const p = game.select('refine/preview', { oreId: r.itemId });
      return { id: r.itemId, name: r.name, stock: r.qty, efficiency: p.efficiency, batches: p.batches, batchSize: p.batchSize, outputs: p.outputs };
    });
    const sub = route.sub ?? 'refinery';
    const station = game.data.celestials[game.state.pilot.location.dockedStationId];
    const slots = game.select('industry/slots');
    const hasSkill = !game.data.skills['skill.industry'] || slots.skillLevel >= 1;
    const canBuild = Boolean(station?.services?.includes('industry')) && hasSkill && slots.used < slots.max;
    const buildReason = !station?.services?.includes('industry') ? 'Diese Station hat keine Fabrik' : !hasSkill ? 'Skill Industrie (Stufe 1) fehlt' : 'Alle Plätze belegt';
    return { sub, jobs: game.select('industry/jobs'), slots, canBuild, buildReason, recipes: sub === 'production' ? game.select('industry/recipes', { slot: ui.slot || undefined, search: ui.search || undefined }) : [], ores, names, minerals: stock.filter((r) => r.kind === 'mineral'), stationName: game.data.celestials[game.state.pilot.location.dockedStationId]?.name ?? '–', msg: ui.msg };
  },
  draw: (m, game, route, ctl) => (m.sub === 'production' ? productionTab(m, ctl) : refineryTab(m, ctl))
});
