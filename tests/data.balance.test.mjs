// Balance-Ziele aus Auftrag A2, Abschnitt G (Rechnung siehe docs/handoff/a2.md, Details: node tools/validate-data.mjs --report)
import test from 'node:test';
import assert from 'node:assert/strict';
import { REPO_ROOT } from './harness.js';
import { readRepo, validateBundle, balanceReport, spForLevel, requirementClosure } from '../tools/validate-data.mjs';

const { data } = validateBundle(readRepo(REPO_ROOT).bundle);
const R = balanceReport(data);

test('Missionsstufen-Stundenertrag 1 : 3 : 7,5 : 30 (±3 %)', () => {
  [1, 3, 7.5, 30].forEach((ratio, i) => {
    const dev = Math.abs(R.missionRatio[i] / ratio - 1);
    assert.ok(dev < 0.03, `Stufe ${i + 1}: Verhältnis ${R.missionRatio[i].toFixed(3)} statt ${ratio}`);
  });
});

test('Starter-Bergbau ≈ 15.000 ISK je Stunde (60 Ticks), ±8 %', () => {
  assert.ok(Math.abs(R.starter.netPerHour / 15000 - 1) < 0.08, `netto ${R.starter.netPerHour.toFixed(0)} ISK/h`);
});

test('Erzhalle des Starters füllt sich in sinnvoller Zeit (1.000–5.000 Ticks)', () => {
  assert.ok(R.starter.holdFillTicks > 1000 && R.starter.holdFillTicks < 5000, String(R.starter.holdFillTicks));
});

test('Skill-Stufe V eines Rank-1-Skills = 256.000 SP', () => {
  assert.equal(spForLevel(1, 5, data.balance.skills.baseSp, data.balance.skills.levelExponent), 256000);
  assert.equal(R.spRank1[4], 256000);
});

test('Bergbauschiffe: höhere Tiers verdienen mehr (bei gleichen Skills)', () => {
  const m = Object.fromEntries(R.mining.map((x) => [x.id, x]));
  assert.ok(m['ship.digger'].iskHour1 > m['ship.pebble'].iskHour1);
  assert.ok(m['ship.delver'].iskHour1 > m['ship.digger'].iskHour1);
  assert.ok(m['ship.delver'].iskHour1 > m['ship.vault'].iskHour1, 'Delver = Ertragsbarke');
  assert.ok(m['ship.vault'].hold > m['ship.delver'].hold, 'Vault = Erzhalle');
});

test('erster Kreuzer: einige Stunden Spielzeit (Training 1–4 h bei 1x), Gesamtkosten unter 3 Mio. ISK', () => {
  const p = R.path('ship.warden');
  assert.ok(p.trainingRealHours1x > 1 && p.trainingRealHours1x < 4, `Training ${p.trainingRealHours1x.toFixed(2)} h`);
  assert.ok(p.totalIsk < 3_000_000, String(p.totalIsk));
  const q = R.path('ship.corvid');
  assert.ok(q.trainingRealHours1x < 4);
});

test('Schiffspreise steigen mit der Klasse', () => {
  const price = (id) => data.ships[id].price;
  assert.ok(price('ship.dart') < price('ship.lance') && price('ship.lance') < price('ship.warden') && price('ship.warden') < price('ship.bastion') && price('ship.bastion') < price('ship.sovereign'));
});

test('Missionen sind mit dem Referenzschiff überlebbar (Schaden ≤ 90 % des Tankpools)', () => {
  const ref = { dps: [58, 135, 330, 880], over: [8, 10, 12, 14], pool: [1136, 1740, 5050, 10000], rep: [18, 36, 100, 300] };
  const avg4 = (r) => (r.em + r.th + r.kin + r.exp) / 4;
  const ehp = (n) => n.shield_hp / (1 - avg4(n.res.shield)) + n.armor_hp / (1 - avg4(n.res.armor)) + n.structure_hp;
  for (const m of data.lists.missions) {
    const l = m.level - 1; let clock = 0, dmg = 0;
    for (const w of m.waves) for (const { id, count } of w.npcs) for (let i = 0; i < count; i++) {
      const n = data.npcs[id]; clock += ehp(n) / ref.dps[l];
      dmg += (n.dps.em + n.dps.th + n.dps.kin + n.dps.exp) * 0.7 * clock;
    }
    assert.ok(dmg / (ref.pool[l] + ref.rep[l] * clock) <= 0.9, `${m.id}: Schadensanteil ${(dmg / (ref.pool[l] + ref.rep[l] * clock)).toFixed(2)}`);
    assert.ok(m.reward.isk[0] > 0 && m.reward.isk[0] < m.reward.isk[1]);
  }
});

test('Raffination: Veldspar-Batch ist mit Basisausbeute profitabler als Direktverkauf', () => {
  const price = (id) => data.items[id].basePrice;
  const o = data.ores['ore.veldspar'];
  const refined = Object.entries(o.refine.outputs).reduce((s, [k, q]) => s + q * data.balance.refine.stationBase * price(k), 0);
  assert.ok(refined > o.refine.batch * o.basePrice);
});

test('Erze: seltenere Erze haben niedrigere Sicherheitsbänder und höheren Wert je m³', () => {
  const list = data.lists.ores.slice().sort((a, b) => a.rarity - b.rarity || a.basePrice / a.volumeM3 - b.basePrice / b.volumeM3);
  const perM3 = (o) => o.basePrice / o.volumeM3;
  assert.ok(perM3(data.ores['ore.noctite']) > perM3(data.ores['ore.veldspar']) * 3);
  assert.ok(data.ores['ore.noctite'].securityBand[1] < data.ores['ore.veldspar'].securityBand[0]);
  assert.ok(list.length >= 6);
});

test('Skill-Katalog deckt Voraussetzungen der Raumschiff-Linie ab (Rang- und Preisordnung)', () => {
  const cmd = (id) => data.skills[id];
  assert.ok(cmd('skill.cruiser_command').rank > cmd('skill.destroyer_command').rank);
  assert.ok(cmd('skill.battleship_command').rank > cmd('skill.battlecruiser_command').rank);
  const need = requirementClosure(data.skills, data.ships['ship.sovereign'].requires);
  assert.ok(Object.keys(need).length >= 7);
});
