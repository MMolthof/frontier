// System "skills": Skillbücher, Trainings-Queue, Skillpunkte (MASTER_PLAN 5.3). Eigene Teilbäume: pilot.skills, pilot.queue.
// SP je Stufe: ceil(250 · Rank · 2^(2,5·(Stufe−1))), Training je Tick: primäres Attribut + sekundäres / 2.

const fail = (error, message) => ({ ok: false, error, message });
const dockedId = (state) => state.pilot.location.dockedStationId;

export const spForLevel = (rank, level, base = 250, exp = 2.5) => (level <= 0 ? 0 : Math.ceil(base * rank * 2 ** (exp * (level - 1))));
const levelOf = (state, id) => state.pilot.skills?.[id]?.level ?? 0;
const owned = (state, id) => Boolean(state.pilot.skills?.[id]);

export function spPerTick(state, skill) {
  const a = state.pilot.attributes ?? {};
  return (a[skill.primary] ?? 20) + (a[skill.secondary] ?? 20) / 2;
}

/** Höchste bereits eingereihte Stufe eines Skills. */
const queuedTo = (state, id) => state.pilot.queue.filter((q) => q.skillId === id).reduce((m, q) => Math.max(m, q.toLevel), 0);

function requirements(state, data, skill, upToIndex = Infinity) {
  return Object.entries(skill.requires ?? {}).map(([id, level]) => {
    const have = Math.max(levelOf(state, id), state.pilot.queue.slice(0, upToIndex).filter((q) => q.skillId === id).reduce((m, q) => Math.max(m, q.toLevel), 0));
    return { id, name: data.skills[id]?.name ?? id, level, have, ok: have >= level };
  });
}

function canQueue(state, data, skillId, toLevel) {
  const skill = data.skills[skillId];
  if (!skill) return { ok: false, reason: 'Unbekannter Skill.' };
  if (!owned(state, skillId)) return { ok: false, reason: 'Skillbuch fehlt.' };
  const base = Math.max(levelOf(state, skillId), queuedTo(state, skillId));
  if (toLevel !== base + 1) return { ok: false, reason: 'Stufen nur nacheinander.' };
  if (toLevel > (skill.maxLevel ?? 5)) return { ok: false, reason: 'Maximalstufe erreicht.' };
  if (state.pilot.queue.length >= (data.balance.skills?.queueMax ?? 50)) return { ok: false, reason: 'Queue voll.' };
  const missing = requirements(state, data, skill).filter((r) => !r.ok);
  if (missing.length) return { ok: false, reason: `Voraussetzung: ${missing.map((m) => `${m.name} ${m.level}`).join(', ')}` };
  return { ok: true };
}

function ticksFor(state, data, entry, startSp) {
  const skill = data.skills[entry.skillId];
  const target = spForLevel(skill.rank, entry.toLevel, data.balance.skills?.baseSp, data.balance.skills?.levelExponent);
  return { target, ticks: Math.max(0, Math.ceil((target - startSp) / spPerTick(state, skill))) };
}

export const system = {
  id: 'skills',
  actions: {
    'skills/buy': (ctx, p) => {
      const { state, data } = ctx;
      const skill = data.skills[p?.skillId];
      if (!skill) return fail('skills.unknown', 'Unbekannter Skill.');
      if (owned(state, skill.id)) return fail('skills.owned', 'Dieses Skillbuch besitzt du bereits.');
      if (!dockedId(state)) return fail('skills.not_docked', 'Skillbücher gibt es nur in Stationen.');
      if (state.account.isk < skill.price) return fail('skills.no_isk', `Zu wenig ISK (${skill.price.toLocaleString('de-DE')} nötig).`);
      state.account.isk -= skill.price;
      state.pilot.skills[skill.id] = { sp: 0, level: 0 };
      ctx.log(`Skillbuch gekauft: ${skill.name}.`);
      ctx.emit('skills/bought', { skillId: skill.id, name: skill.name });
      return { ok: true };
    },
    'skills/queueAdd': (ctx, p) => {
      const { state, data } = ctx;
      const base = Math.max(levelOf(state, p?.skillId), queuedTo(state, p?.skillId));
      const toLevel = p?.toLevel ?? base + 1;
      const check = canQueue(state, data, p?.skillId, toLevel);
      if (!check.ok) return fail('skills.cannot_queue', check.reason);
      state.pilot.queue.push({ skillId: p.skillId, toLevel });
      ctx.log(`Training eingereiht: ${data.skills[p.skillId].name} ${toLevel}.`);
      return { ok: true };
    },
    'skills/queueRemove': (ctx, p) => {
      const { state } = ctx;
      const i = Math.floor(p?.index);
      if (!(i >= 0 && i < state.pilot.queue.length)) return fail('skills.bad_index', 'Eintrag nicht gefunden.');
      // Spätere Stufen desselben Skills hängen davon ab: ab hier alle gleichen Skills entfernen
      const id = state.pilot.queue[i].skillId;
      state.pilot.queue = state.pilot.queue.filter((q, k) => k < i || q.skillId !== id);
      return { ok: true };
    }
  },
  onTick(ctx) {
    const { state, data } = ctx;
    const q = state.pilot.queue[0];
    if (!q) return;
    const skill = data.skills[q.skillId];
    const entry = (state.pilot.skills[q.skillId] ??= { sp: 0, level: 0 });
    entry.sp += spPerTick(state, skill);
    const target = spForLevel(skill.rank, q.toLevel, data.balance.skills?.baseSp, data.balance.skills?.levelExponent);
    if (entry.sp >= target) {
      entry.sp = target;
      entry.level = q.toLevel;
      state.pilot.queue.shift();
      ctx.log(`Training abgeschlossen: ${skill.name} ${q.toLevel}.`, 'good');
      ctx.emit('skills/completed', { skillId: skill.id, name: skill.name, level: q.toLevel });
      if (!state.pilot.queue.length) ctx.emit('skills/queueEmpty', {});
    }
  },
  selectors: {
    'skills/level': (state, data, args) => levelOf(state, args?.skillId),
    'skills/spPerTick': (state, data) => {
      const q = state.pilot.queue[0];
      return q ? spPerTick(state, data.skills[q.skillId]) : spPerTick(state, { primary: 'memory', secondary: 'intelligence' });
    },
    /** Queue mit Fortschritt und geschätzter Restdauer in Ticks. */
    'skills/queue': (state, data) => {
      let acc = 0;
      let carrySp = {};
      return state.pilot.queue.map((q, index) => {
        const skill = data.skills[q.skillId];
        const have = carrySp[q.skillId] ?? state.pilot.skills[q.skillId]?.sp ?? 0;
        const { target, ticks } = ticksFor(state, data, q, have);
        carrySp[q.skillId] = target;
        acc += ticks;
        const from = spForLevel(skill.rank, q.toLevel - 1, data.balance.skills?.baseSp, data.balance.skills?.levelExponent);
        return { index, skillId: q.skillId, name: skill.name, toLevel: q.toLevel, active: index === 0, spNow: Math.round(have), spTarget: target,
          pct: target > from ? Math.min(1, Math.max(0, (have - from) / (target - from))) : 1, ticksLeft: ticks, etaTicks: acc };
      });
    },
    /** Katalog gruppiert: [{ group, skills: [...] }] */
    'skills/catalog': (state, data) => {
      const groups = {};
      for (const skill of data.lists.skills) {
        const level = levelOf(state, skill.id);
        const next = Math.max(level, queuedTo(state, skill.id)) + 1;
        const check = next <= (skill.maxLevel ?? 5) ? canQueue(state, data, skill.id, next) : { ok: false, reason: 'Maximalstufe erreicht.' };
        const have = state.pilot.skills[skill.id]?.sp ?? 0;
        (groups[skill.group] ??= []).push({
          id: skill.id, name: skill.name, rank: skill.rank, level, owned: owned(state, skill.id), price: skill.price, maxLevel: skill.maxLevel ?? 5,
          queuedTo: queuedTo(state, skill.id), nextLevel: next, canQueue: check, description: skill.description ?? '',
          requires: requirements(state, data, skill), nextTicks: next <= (skill.maxLevel ?? 5) ? ticksFor(state, data, { skillId: skill.id, toLevel: next }, have).ticks : 0
        });
      }
      return Object.entries(groups).map(([group, skills]) => ({ group, skills: skills.sort((a, b) => a.name.localeCompare(b.name)) }));
    },
    'skills/attributes': (state) => ({ ...state.pilot.attributes })
  }
};
