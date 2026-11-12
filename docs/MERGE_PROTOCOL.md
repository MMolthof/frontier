# Merge-Protokoll (Lead-KI)

## 1. Wellen und Abhängigkeiten
| Welle | Agenten | Startbedingung | Warum diese Reihenfolge |
|---|---|---|---|
| 0 | Lead | – | Master Plan, Verträge, Beispieldaten (fertig) |
| 1 | A1 Core, A2 Daten, A3 Design/Shell | Kit liegt im Repo | Fundament: Schleife/State, Inhalte/Schemas, UI-Gerüst. Keine gegenseitige Blockade, nur gegen Verträge |
| 2 | A4 Fitting, A5 Skills, A6 Navigation, A7 Mining, A8 Account/Markt | A1-Zwischenstand (Skeleton + Harness) oder Mocks | Fachsysteme, parallel entwickelbar dank fester API |
| 3 | A9 Kampf/Missionen, A10 Integration/QA | A4, A5, A6, A8 gemerged | Kampf braucht Fitting-Stats, Skills, Docking, Lager; QA braucht alles |

## 2. Merge-Reihenfolge
A1 → A2 → A3 → A8 → A5 → A4 → A6 → A7 → A9 → A10.
Begründung: erst Fundament und Daten, dann Besitz/Lager/Skills (alle brauchen sie), dann Fitting, Navigation, Mining, zuletzt Kampf und QA.

## 3. Ablauf je Branch
1. Handoff lesen (`docs/handoff/<Axx>.md`), Diff nur im erlaubten Eigentum prüfen (Matrix unten).
2. `node tools/validate-data.mjs` und `node --test` auf dem Integrationsbranch `integration` ausführen.
3. Verträge prüfen: Actions/Events/Fehlercodes/State-Teilbäume exakt wie MASTER_PLAN 3.4–3.6; fehlende UI-Strings in `data/i18n/de.json`.
4. Registry-Zeilen (`js/registry.json`) und `data/ext/*` zusammenführen; `data/ext` in Basisdateien falten und Ext-Datei löschen.
5. Smoke-Test im Browser (Szenario MASTER_PLAN 6.6). Bei Fehler: Ticket an den Agenten mit Repro, **nicht** selbst umschreiben, außer Hotfix ≤ 10 Zeilen.
6. `CHANGELOG.md` ergänzen, Tag `contract-1.0-wN` setzen.

## 4. Eigentumsmatrix (ein Agent = ein Verzeichnis)
| Pfad | Eigentümer |
|---|---|
| `index.html`, `js/core/**`, `js/util/**`, `js/types.js`, `tools/serve.mjs` | A1 |
| `data/*.json` (Basis), `data/schema/**`, `data/i18n/**`, `tools/validate-data.mjs` | A2 |
| `css/**` (außer `css/views/**`), `js/ui/shell/**`, `js/ui/components/**`, `assets/**` | A3 |
| `js/systems/fitting/**`, `js/ui/views/fitting/**` | A4 |
| `js/systems/skills/**`, `js/ui/views/skills/**` | A5 |
| `js/systems/travel/**`, `js/ui/views/system/**` | A6 |
| `js/systems/mining/**`, `js/systems/refine/**`, `js/ui/views/mining/**` | A7 |
| `js/systems/{account,inventory,market,ships}/**`, `js/ui/views/{hangar,market}/**` | A8 |
| `js/systems/{combat,missions}/**`, `js/ui/views/{combat,missions}/**` | A9 |
| `tests/integration/**`, `tools/sim-*.mjs`, `docs/{BALANCE,QA}_REPORT.md` | A10 |
| `css/views/<name>.css` | Agent der jeweiligen View |
| `docs/MASTER_PLAN.md`, `docs/MERGE_PROTOCOL.md`, `js/registry.json` (Reihenfolge), `data/manifest.json` | Lead |
| `data/ext/<kürzel>-*.json`, `docs/handoff/<kürzel>.md`, `docs/change-requests/<kürzel>-*.md` | jeweiliger Agent |

## 5. Konfliktregeln
- **Gemeinsame Dateien** nur append-only, eine Zeile pro Eintrag (`js/registry.json`), damit Git sauber mergt.
- **Contract-Konflikt** (zwei Agenten brauchen widersprüchliche Felder): Lead entscheidet, ändert MASTER_PLAN, erhöht Contract-Version (1.1 …), informiert betroffene Agenten mit neuem Prompt-Zusatz.
- **Änderungswunsch** eines Agenten: `docs/change-requests/` → Lead bewertet binnen der nächsten Merge-Runde (Annahme / Ablehnung / Alternative).
- **Doppelte IDs** in Daten: der frühere Merge gewinnt, der spätere Agent bekommt ein Ticket zur Umbenennung.
- **Fehlende Abhängigkeit**: Mock im `tests/mocks/` ist erlaubt, muss aber im Handoff als „Mock ersetzen sobald Axx gemerged“ stehen.

## 6. Definition of Done (je Agent)
- Alle Akzeptanzkriterien des Auftrags erfüllt, Tests grün, `validate-data` grün.
- Keine Dateien außerhalb des Eigentums geändert.
- Handoff vollständig (Exports, Actions/Events, Daten, Abweichungen, Teststatus, offene Fragen).
- Keine direkten State-Mutationen aus der UI, keine DOM-Zugriffe in Engine-Code, keine Zahlen im Code, die nach `balance.json` gehören.

## 7. Server-Portierung (Ausblick)
Weil Systeme reine Funktionen auf JSON-State sind (`ctx.now`, `ctx.rng`), kann die Tick-Schleife später in einem ASP.NET-Core-Hintergrunddienst laufen. Der Browser ruft dann statt `game.dispatch` lokal eine API auf. Die Action-/Event-Namen und das State-Schema bleiben identisch; die JSON-Datenbasis wird serverseitig geladen.

## 8. Meilensteine
- **M1** nach Welle 1: Shell startet, Ticks laufen, Daten validieren.
- **M2** nach Welle 2: Spielbar bis Raffinerie/Verkauf/Schiffskauf/Fitting, Navigation im System, Skill-Training.
- **M3** nach Welle 3: Missionen L1–L4, Balance- und QA-Bericht, Release-Kandidat Phase 1.
