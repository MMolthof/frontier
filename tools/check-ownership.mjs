// Prüft, dass ein Branch "agent/aN-…" nur Dateien im eigenen Eigentum ändert (MERGE_PROTOCOL 4).
import { execSync } from 'node:child_process';
const OWN = {
  a1: ['index.html','js/core/**','js/util/**','js/types.js','tools/serve.mjs','tests/core.*','tests/harness.js'],
  a2: ['data/*.json','data/schema/**','data/i18n/**','data/examples/**','tools/validate-data.mjs','tests/data.*','docs/DATA_GUIDE.md'],
  a3: ['index.html','css/*.css','js/ui/shell/**','js/ui/components/**','js/ui/views/overview/**','assets/**','tests/ui-*','docs/UI_GUIDE.md'],
  a4: ['js/systems/fitting/**','js/ui/views/fitting/**','css/views/fitting.css','tests/fitting.*'],
  a5: ['js/systems/skills/**','js/ui/views/skills/**','css/views/skills.css','tests/skills.*'],
  a6: ['js/systems/travel/**','js/ui/views/system/**','css/views/system.css','tests/travel.*'],
  a7: ['js/systems/mining/**','js/systems/refine/**','js/ui/views/mining/**','css/views/mining.css','tests/mining.*','tests/refine.*'],
  a8: ['js/systems/account/**','js/systems/inventory/**','js/systems/market/**','js/systems/ships/**','js/ui/views/hangar/**','js/ui/views/market/**','css/views/hangar.css','css/views/market.css','tests/inventory.*','tests/market.*','tests/ships.*'],
  a9: ['js/systems/combat/**','js/systems/missions/**','js/ui/views/combat/**','js/ui/views/missions/**','css/views/combat.css','css/views/missions.css','tests/combat.*','tests/missions.*'],
  a10: ['tests/integration/**','tools/sim-*.mjs','docs/BALANCE_REPORT.md','docs/QA_REPORT.md'],
};
const re = g => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*\*/g,'\u0000').replace(/\*/g,'[^/]*').replace(/\u0000/g,'.*') + '$');
const branch = process.env.BRANCH || execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
const m = /^agent\/(a\d+)(?:-|$)/.exec(branch);
if (!m) { console.log(`Branch "${branch}" ist kein Agenten-Branch, Check übersprungen.`); process.exit(0); }
const id = m[1];
if (!OWN[id]) { console.error(`Unbekannter Agent ${id}`); process.exit(1); }
const base = process.env.BASE || 'origin/main';
const files = execSync(`git diff --name-only ${base}...HEAD`).toString().split('\n').filter(Boolean);
const allowed = [...OWN[id], `docs/handoff/${id}.md`, `docs/change-requests/${id}-*`, `data/ext/${id}-*.json`, 'tests/mocks/**'].map(re);
const bad = files.filter(f => !allowed.some(r => r.test(f)));
if (bad.length) { console.error(`Verstoß gegen Eigentum von ${id}:\n` + bad.map(f => ' - ' + f).join('\n')); process.exit(1); }
console.log(`OK: ${files.length} Dateien im Eigentum von ${id}.`);
