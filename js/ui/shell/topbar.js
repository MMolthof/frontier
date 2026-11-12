// Statusleiste: ISK, Tick, Standort mit Sicherheitsfarbe + Zahl, Aktivität, Geschwindigkeit, Nachhol-Hinweis, Warnungen.

import { h, setText } from '../../util/dom.js';
import { fmt, fmtIsk, fmtTicks } from '../../util/format.js';
import { button, updateButton } from '../components/button.js';
import { deriveActivity, describeLocation, securityBand } from './status.js';

/** @param {{game: object, t: Function, getWarnings: () => string[], onWarnings: () => void}} o */
export function createTopbar({ game, t, getWarnings, onWarnings }) {
  const isk = h('span', { class: 'u-isk' });
  const tick = h('span', { class: 'u-num' });
  const sec = h('span', { class: 's-sec', 'aria-hidden': 'true' });
  const secText = h('span', { class: 'u-num' });
  const place = h('span');
  const activity = h('span');
  const catching = h('span', { class: 's-catching', role: 'status' });
  const speedBox = h('span', { class: 's-speed', role: 'group', 'aria-label': t('shell.status.speed') });
  const speedButtons = new Map();
  const warnBtn = button({ icon: 'warning', variant: 'ghost', ariaLabel: t('shell.warnings'), onClick: onWarnings });
  const warnCount = h('span', { class: 'u-num' });
  warnBtn.appendChild(warnCount);
  const item = (labelKey, ...children) => h('span', { class: 's-top__item' }, h('span', { class: 's-top__label' }, t(labelKey)), ...children);

  const el = h('div', { class: 's-top' },
    h('strong', null, t('shell.title')),
    item('shell.status.isk', isk), item('shell.status.tick', tick),
    h('span', { class: 's-top__item', 'aria-label': t('shell.status.location') }, sec, place, secText),
    item('shell.status.activity', activity), catching,
    h('span', { class: 's-top__spacer' }), speedBox, warnBtn);

  function updateSpeeds() {
    const speeds = game.select('core/speeds') ?? [1];
    const current = game.select('core/speed');
    for (const scale of speeds) {
      let btn = speedButtons.get(scale);
      if (!btn) {
        btn = button({ label: t('shell.status.speed.value', { n: scale }), variant: 'alt', ariaLabel: t('shell.status.speed.set', { n: scale }), onClick: () => game.dispatch('game/setSpeed', { scale }) });
        speedButtons.set(scale, btn);
        speedBox.appendChild(btn);
      }
      updateButton(btn, { pressed: scale === current, disabled: !(game.hasAction?.('game/setSpeed') ?? true), reason: t('shell.reason.unavailable') });
    }
  }

  function update() {
    const state = game.state;
    setText(isk, fmtIsk(state.account.isk));
    setText(tick, fmt(state.tick));
    const loc = describeLocation(state, game.data);
    setText(place, loc.place ? `${loc.system} · ${loc.place}` : loc.system);
    if (loc.security === null) { setText(secText, ''); sec.setAttribute('class', 's-sec'); sec.setAttribute('hidden', ''); }
    else {
      sec.removeAttribute('hidden');
      sec.setAttribute('class', `s-sec s-sec--${securityBand(loc.security)}`);
      setText(secText, t('shell.status.sec', { value: fmt(loc.security, 1) }));
    }
    const act = deriveActivity(state, game.data);
    const text = act.kind === 'warp'
      ? t('shell.status.activity.warp', { target: act.target, time: fmtTicks(act.ticksLeft, game.data.balance?.tickSeconds) })
      : act.kind === 'mining' ? t('shell.status.activity.mining', { n: act.count }) : t(`shell.status.activity.${act.kind}`);
    setText(activity, text);
    setText(catching, game.select('core/isCatchingUp') ? t('shell.status.catching') : '');
    updateSpeeds();
    const warnings = getWarnings().length;
    setText(warnCount, warnings ? String(warnings) : '');
    updateButton(warnBtn, { disabled: false });
  }

  return { el, update };
}
