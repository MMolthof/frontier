// Einstellungen (#/account/settings): Speichern, Export/Import über game.saves, Neustart mit Bestätigung.
// Actions nur über dispatch und nur, wenn game.hasAction(type); sonst deaktiviert mit Grund.

import { h } from '../../../util/dom.js';
import { downloadText, pickTextFile } from '../../../util/browser.js';
import { button } from '../../components/button.js';
import { card } from '../../components/card.js';
import { confirm } from '../../components/modal.js';

/** ctx: { notify(kind, text), reload(), modalRoot } */
export function renderSettingsPage(root, game, t, ctx) {
  const saves = game.saves ?? null;
  const noAction = t('shell.reason.unavailable');
  const canSave = game.hasAction?.('game/save') ?? false;
  const canReset = game.hasAction?.('game/reset') ?? false;

  const save = button({ icon: 'save', label: t('settings.save'), disabled: !canSave, reason: noAction, onClick: () => {
    const res = game.dispatch('game/save');
    if (res.ok) ctx.notify('ok', t('toast.saved')); else ctx.notify('error', t('toast.save.failed', { message: res.message }));
  } });
  const exportBtn = button({ icon: 'export', label: t('settings.export'), variant: 'alt', disabled: !saves, reason: t('settings.nosaves'), onClick: () => {
    try { downloadText('tick-frontier-save.json', saves.exportJson(game.state)); } catch (err) { ctx.notify('error', t('toast.error', { message: err.message })); }
  } });
  const importBtn = button({ icon: 'import', label: t('settings.import'), variant: 'alt', disabled: !saves, reason: t('settings.nosaves'), onClick: async () => {
    const text = await pickTextFile();
    if (text === null) return;
    try { saves.importJson(text); ctx.notify('ok', t('toast.imported')); ctx.reload(); } catch (err) { ctx.notify('error', t('toast.import.failed', { message: err.message })); }
  } });
  const resetBtn = button({ label: t('settings.reset'), variant: 'danger', disabled: !canReset, reason: noAction, onClick: async () => {
    const yes = await confirm({ title: t('settings.reset.title'), message: t('settings.reset.text'), confirmLabel: t('settings.reset.confirm'), danger: true, root: ctx.modalRoot, t });
    if (yes) game.dispatch('game/reset');
  } });
  root.appendChild(card({ title: t('settings.title'), children: h('div', { class: 'l-row' }, save, exportBtn, importBtn, resetBtn) }));
}
