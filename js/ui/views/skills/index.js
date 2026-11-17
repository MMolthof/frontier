// Skills: Training (Queue), Katalog nach Gruppen, Attribute. Training läuft tickweise und auch ohne geöffnete Ansicht.
import { h } from '../../../util/dom.js';
import { fmt, fmtTicks } from '../../../util/format.js';
import { card } from '../../components/card.js';
import { button } from '../../components/button.js';
import { meter } from '../../components/meter.js';
import { emptyState } from '../../components/empty-state.js';
import { liveView, msgLine } from '../live.js';
import { groupLabel } from '../labels.js';

const pips = (level, queuedTo, max) => h('span', { class: 'v-pips', role: 'img', 'aria-label': `Stufe ${level} von ${max}` },
  ...Array.from({ length: max }, (_, i) => h('span', { class: `v-pip${i < level ? ' v-pip--on' : i < queuedTo ? ' v-pip--queued' : ''}` })));

function trainingTab(m, ctl) {
  const [active, ...rest] = m.queue;
  const head = card({ title: 'Aktives Training', subtitle: `Training: ${fmt(m.spt, 1)} Skillpunkte je Tick. Läuft auch weiter, wenn du fliegst.`, children: active
    ? h('div', { class: 'l-stack' }, h('strong', null, `${active.name} ${active.toLevel}`),
      meter({ label: `${active.name} ${active.toLevel}`, value: active.pct * 100, max: 100, text: `${fmt(active.spNow)} / ${fmt(active.spTarget)} SP · noch ${fmtTicks(active.ticksLeft)}` }))
    : emptyState({ icon: 'skills', title: 'Kein Training aktiv', text: 'Wähle unten einen Skill oder im Katalog. Ohne Training verfällt keine Zeit, aber du verlierst Fortschritt.' }) });
  const queue = card({ title: 'Warteschlange', children: m.queue.length ? h('ol', { class: 'v-queue' }, ...m.queue.map((q) => h('li', { class: 'v-queue__row' },
    h('span', null, h('strong', null, `${q.name} ${q.toLevel}`), h('span', { class: 'u-mute' }, ` · fertig in ${fmtTicks(q.etaTicks)}`)),
    button({ label: 'Entfernen', variant: 'ghost', onClick: () => ctl.run('skills/queueRemove', { index: q.index }) })))) : h('p', { class: 'u-mute' }, 'Die Warteschlange ist leer.') });
  const tips = card({ title: 'Schnell trainieren', subtitle: 'Kurze Trainings, die du jetzt einreihen kannst.', children: m.suggestions.length ? h('ul', { class: 'v-list' }, ...m.suggestions.map((s) => h('li', { class: 'l-row' },
    h('span', null, h('strong', null, `${s.name} ${s.nextLevel}`), h('span', { class: 'u-mute' }, ` · ${fmtTicks(s.nextTicks)}`)),
    button({ label: 'Trainieren', variant: 'alt', onClick: () => ctl.run('skills/queueAdd', { skillId: s.id }) })))) : h('p', { class: 'u-mute' }, 'Aktuell keine Vorschläge. Im Katalog findest du alle Skills.') });
  return h('div', { class: 'l-stack' }, msgLine(ctl.ui.msg), head, h('div', { class: 'l-grid l-grid--wide' }, queue, tips));
}


/** Skill-Effekt als Text: Brüche als Prozent (0,05 → 5 %), größere Zahlen absolut (Kalibrierung +10). */
const effVal = (v) => {
  const frac = Math.abs(v) < 1;
  const n = frac ? Math.round(v * 1000) / 10 : v;
  return `${n < 0 ? '−' : '+'}${fmt(Math.abs(n), frac ? 1 : 0)}${frac ? ' %' : ''}`;
};
const effLine = (e, s) => `${e.label}: ${effVal(e.perLevel)} je Stufe · jetzt ${effVal(e.perLevel * s.level)}, Maximum ${effVal(e.perLevel * s.maxLevel)}`;

function skillRow(s, ctl) {
  let action;
  if (!s.owned) action = button({ label: `Buch kaufen (${fmt(s.price)} ISK)`, variant: 'alt', onClick: () => ctl.run('skills/buy', { skillId: s.id }) });
  else if (s.canQueue.ok) action = button({ label: `Stufe ${s.nextLevel} trainieren (${fmtTicks(s.nextTicks)})`, variant: 'primary', onClick: () => ctl.run('skills/queueAdd', { skillId: s.id }) });
  else action = h('span', { class: 'u-mute' }, s.canQueue.reason);
  const reqs = s.requires.length ? h('span', { class: 'u-mute v-skill__req' }, `Benötigt: ${s.requires.map((r) => `${r.name} ${r.level}${r.ok ? '' : ' (fehlt)'}`).join(', ')}`) : null;
  return h('li', { class: 'v-skill' }, h('div', { class: 'v-skill__main' }, h('strong', null, s.name), h('span', { class: 'u-mute' }, ` Rang ${s.rank}`), pips(s.level, s.queuedTo, s.maxLevel),
    s.description ? h('span', { class: 'v-skill__desc' }, s.description) : null,
    ...s.effects.map((e) => h('span', { class: 'v-skill__eff' }, effLine(e, s))), reqs), h('div', { class: 'v-skill__act' }, action));
}

function catalogTab(m, ctl) {
  const q = (ctl.ui.search ?? '').toLowerCase();
  const input = h('input', { type: 'search', class: 'v-qty v-search', placeholder: 'Skill suchen …', value: ctl.ui.search ?? '', 'aria-label': 'Skill suchen' });
  input.addEventListener('input', () => { ctl.ui.search = input.value; });
  input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ctl.repaint(); });
  input.addEventListener('change', () => ctl.repaint());
  const open = ctl.ui.open ??= {};
  const groups = m.catalog.map((g) => ({ ...g, skills: g.skills.filter((s) => !q || s.name.toLowerCase().includes(q)) })).filter((g) => g.skills.length);
  return h('div', { class: 'l-stack' }, msgLine(ctl.ui.msg), h('div', { class: 'l-row' }, input, h('span', { class: 'u-mute' }, 'Enter oder Feld verlassen zum Filtern')),
    ...groups.map((g) => {
      const det = h('details', { class: 'v-group', open: open[g.group] || q ? '' : null }, h('summary', null, h('strong', null, groupLabel(g.group)), h('span', { class: 'u-mute' }, ` ${g.skills.filter((s) => s.owned).length}/${g.skills.length} Bücher`)),
        h('ul', { class: 'v-skills' }, ...g.skills.map((s) => skillRow(s, ctl))));
      det.addEventListener('toggle', () => { open[g.group] = det.open; });
      return card({ children: det });
    }));
}

function attributesTab(m) {
  const NAMES = { intelligence: 'Intelligenz', memory: 'Gedächtnis', perception: 'Wahrnehmung', willpower: 'Willenskraft', charisma: 'Charisma' };
  return card({ title: 'Attribute', subtitle: 'Skillpunkte je Tick = primäres Attribut + sekundäres Attribut / 2. Neuverteilen (Remap) folgt in einer späteren Iteration.', children: h('ul', { class: 'v-list' },
    ...Object.entries(m.attributes).map(([k, v]) => h('li', { class: 'l-row' }, h('strong', null, NAMES[k] ?? k), h('span', { class: 'u-num' }, fmt(v))))) });
}

export const view = liveView({
  id: 'skills', title: 'Skills', group: 'skills', order: 50,
  model(game, route, ui) {
    const sub = route.sub ?? 'training';
    const catalog = game.select('skills/catalog');
    const suggestions = catalog.flatMap((g) => g.skills).filter((s) => s.owned && s.canQueue.ok).sort((a, b) => a.nextTicks - b.nextTicks).slice(0, 5);
    return { sub, queue: game.select('skills/queue'), spt: game.select('skills/spPerTick'), catalog: sub === 'catalog' ? catalog : [], suggestions: sub === 'training' ? suggestions : [], attributes: game.select('skills/attributes'), msg: ui.msg, search: ui.search };
  },
  draw: (m, game, route, ctl) => (m.sub === 'catalog' ? catalogTab(m, ctl) : m.sub === 'attributes' ? attributesTab(m) : trainingTab(m, ctl))
});
