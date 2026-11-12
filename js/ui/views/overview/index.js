// Übersicht (Startansicht): aktives Schiff, ISK, Standort, Aktivität, Skill-Queue, letzte Ereignisse, erste Schritte.
// Nur lesend über game.state/select; Updates ändern vorhandene Knoten, bauen nichts neu (außer der Ereignisliste bei Änderung).

import { h, setText } from '../../../util/dom.js';
import { fmt, fmtIsk, fmtTicks } from '../../../util/format.js';
import { card } from '../../components/card.js';
import { emptyState } from '../../components/empty-state.js';
import { meter, updateMeter } from '../../components/meter.js';
import { shipArt } from '../../components/ship-art.js';
import { icon } from '../../components/icon.js';
import { createTranslatorFor } from '../../shell/translate.js';
import { activeShip, deriveActivity, describeLocation } from '../../shell/status.js';

const LOG_LINES = 5;

function build(root, game) {
  const t = createTranslatorFor(game);
  const refs = { t, logSig: '' };
  refs.shipName = h('p', { class: 'v-ov__big' });
  refs.shipType = h('p', { class: 'u-mute' });
  refs.shipHolder = h('div');
  refs.shipCard = card({ title: t('overview.ship'), children: h('div', { class: 'v-ov__ship' }, refs.shipHolder, h('div', { class: 'v-ov__facts' }, refs.shipName, refs.shipType)) });

  refs.isk = h('p', { class: 'v-ov__big u-isk' });
  refs.iskCard = card({ title: t('overview.isk'), children: refs.isk });

  refs.place = h('p', { class: 'v-ov__big' });
  refs.sec = h('p', { class: 'u-mute u-num' });
  refs.locCard = card({ title: t('overview.location'), children: h('div', { class: 'v-ov__facts' }, refs.place, refs.sec) });

  refs.actText = h('p');
  refs.warpMeter = meter({ label: t('overview.warp.progress'), value: 0, max: 1 });
  refs.warpMeter.setAttribute('hidden', '');
  refs.actCard = card({ title: t('overview.activity'), children: h('div', { class: 'v-ov__activity' }, refs.actText, refs.warpMeter) });

  refs.skillBody = h('div');
  refs.skillCard = card({ title: t('overview.skills'), children: refs.skillBody });

  refs.logBody = h('div');
  refs.logCard = card({ title: t('overview.log'), children: refs.logBody });

  const steps = h('ol', { class: 'v-ov__steps' }, [1, 2, 3].map((n) => h('li', null, t(`overview.steps.${n}`))));
  refs.stepsCard = card({ title: t('overview.steps'), children: steps });

  root.appendChild(h('div', { class: 'l-stack' },
    h('div', { class: 'l-grid' }, refs.shipCard, refs.iskCard, refs.locCard, refs.actCard),
    h('div', { class: 'l-grid' }, refs.skillCard, refs.logCard),
    refs.stepsCard));
  root.__ov = refs;
  return refs;
}

function update(root, game) {
  const refs = root.__ov ?? build(root, game);
  const { t } = refs;
  const state = game.state;
  const data = game.data;

  const ship = activeShip(state);
  const type = data.ships?.[ship?.typeId];
  if (ship) {
    setText(refs.shipName, ship.name ?? type?.name ?? ship.typeId);
    setText(refs.shipType, type ? `${type.name} · ${type.class}` : String(ship.typeId));
    if (refs.shipArtId !== ship.typeId) {
      refs.shipArtId = ship.typeId;
      refs.shipHolder.replaceChildren(shipArt({ ship: type ?? { id: ship.typeId, name: ship.name }, size: 140, t }));
    }
  } else {
    setText(refs.shipName, t('overview.ship.none'));
    setText(refs.shipType, '');
  }

  setText(refs.isk, fmtIsk(state.account.isk));

  const loc = describeLocation(state, data);
  setText(refs.place, loc.place ? `${loc.system} · ${loc.place}` : loc.system);
  setText(refs.sec, loc.security === null ? '' : t('shell.status.sec', { value: fmt(loc.security, 1) }));

  const act = deriveActivity(state, data);
  if (act.kind === 'warp') {
    setText(refs.actText, t('shell.status.activity.warp', { target: act.target, time: fmtTicks(act.ticksLeft, data.balance?.tickSeconds) }));
    refs.warpMeter.removeAttribute('hidden');
    updateMeter(refs.warpMeter, { label: t('overview.warp.progress'), value: act.ticksTotal - act.ticksLeft, max: act.ticksTotal });
  } else {
    setText(refs.actText, act.kind === 'mining' ? t('shell.status.activity.mining', { n: act.count }) : t(`shell.status.activity.${act.kind}`));
    refs.warpMeter.setAttribute('hidden', '');
  }

  const first = state.pilot.queue?.[0];
  const skillSig = first ? `${first.skillId ?? first.id}:${first.level}` : '';
  if (refs.skillSig !== skillSig) {
    refs.skillSig = skillSig;
    const id = first?.skillId ?? first?.id;
    refs.skillBody.replaceChildren(first
      ? h('div', { class: 'v-ov__facts' }, h('p', { class: 'v-ov__big' }, data.skills?.[id]?.name ?? id), h('p', { class: 'u-mute' }, t('overview.skills.level', { level: first.level ?? first.toLevel ?? '?' })))
      : emptyState({ icon: 'skills', title: t('overview.skills.none'), text: t('overview.skills.none.hint') }));
  }

  const rows = game.select('core/log', { limit: LOG_LINES }) ?? [];
  const sig = rows.map((r) => `${r.tick}|${r.text}`).join('\n');
  if (sig !== refs.logSig) {
    refs.logSig = sig;
    refs.logBody.replaceChildren(rows.length
      ? h('ul', { class: 'v-ov__log' }, rows.map((r) => h('li', { class: 'l-row' }, icon('log', { size: 14 }), h('span', { class: 'u-mute u-num' }, fmt(r.tick)), h('span', null, r.text))))
      : emptyState({ icon: 'log', title: t('overview.log.none') }));
  }
}

/** @type {import('../../../types.js').View} */
export const view = {
  id: 'overview',
  title: 'Übersicht',
  group: 'main',
  order: 0,
  css: false, // overview.css wird in index.html verlinkt
  render(root, game) { build(root, game); update(root, game); },
  update
};
