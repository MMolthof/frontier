# Changelog

## contract-1.0-w0 – Kit
- Master Plan, Merge-Protokoll, Agenten-Prompts, Vorlagen, Beispieldaten, Prototyp.

## 10.11.2026 – Contract 1.1 (Lead)
- A1 abgenommen mit Hotfixes: `.nojekyll`, `css/tokens.css`, sichtbare Startfehler in `index.html`, `append(null)`-Fix in `boot.js`, `data/ext/.gitkeep`
- `balance.json`: `liveTickMs`, `speeds`, `startFitting`; Registry vorbefüllt; Change Request A1-1 angenommen
- CI, Eigentums-Check, PR-Vorlage, Einzelprompts `docs/prompts/`

## 12.11.2026 – Contract 1.2 (Lead)
- A2 abgenommen; Change Request a2-1 angenommen (MASTER_PLAN 3.8); Fitting-Schnittstelle A4↔A5 festgelegt (3.9)
- Roster: A4 Fitting-Engine, A5 Fitting-GUI, Skills jetzt A11; Eigentumsmatrix und CI angepasst
- `core.serve`-Test robust (legt data/ext selbst an); Manifest 1.2

## 13.11.2026 – Iteration 1 (Lead): spielbare Bergbau-Schleife
- Fehlende Stylesheets ergänzt (`base/layout/components/shell/overview.css`, `views.css`) im Look des Prototyps; Ursache der unformatierten Seite war, dass Agent 3s CSS-Dateien nicht im Repo lagen
- Neue Systeme: `travel`, `mining` (Felder), `inventory`, `market`, `refine`; neue Ansichten: Sonnensystem, Bergbau, Hangar, Markt, Industrie
- Registry enthält nur vorhandene Module (kein Warnungs-Lärm); `core-demo` entfernt; Tests angepasst (261 grün)
- Neu: `docs/ITERATIONS.md` (Iterationsprinzip, Roadmap, Spielanleitung), `tests/iteration1.test.mjs`
- Zusammengeführt: Agent 3 (Shell), Agent 4 (Fitting-Engine), Lead-Patch 2 (Contract 1.2)
