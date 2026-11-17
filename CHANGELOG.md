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

## 15.11.2026 – Iteration 2 (Lead)
- Starterschiff: Zivilier-Bergbaulaser und Zivilier-Geschütz (Preis 0, nicht käuflich, kein Handelswert); Testwerte der Fitting-Tests vom Live-Start entkoppelt
- UI: Schiffs-HUD (Ringe, Modulreihe, Hauptaktion), Stations-Hub, Overview mit Auswahl, Zielleiste, Modul-Symbole, dunkles Design (optional), Navigation beim Andocken/Abdocken
- Neue Systeme: `skills`, `ships`, `shop`; neue Ansichten: Stationshub, Werft, Skills, Fitting, Schiffe im Hangar, Modul-Shop im Markt
- `tools/smoke-ui.mjs` (jsdom-Smoke-Test), `tests/iteration2.test.mjs`; 266 Tests grün

## 16.11.2026 – Korrekturen I2 (Lead)
- System `starter`: einmalige Nachrüstung leerer Starterschiffe alter Spielstände, kostenlose Notfall-Ausrüstung (`starter/rearm`)
- Markt: Module/Items verkaufen (`market/fixedRows`), Rohstoffe und Munition kaufen (`shop/buyItem`)
- System `industry`: Module herstellen (Rezepte aus Modulpreis, Skill Industrie), Produktions-Ansicht
- Tests: 270 grün; `tools/smoke-ui.mjs` deckt Verkauf, Kauf und Produktion ab

## 17.11.2026 – Zivilier-Module im Markt (Lead)
- Zivilier-Module (`mod.civilian_miner` 250 ISK, `mod.civilian_gun` 150 ISK) sind im Markt (Kaufen › Module) käuflich; neue Modulfelder `buyPrice` und `civilian` (Schema + Loader).
- Kein Verkaufswert (`price` bleibt 0) und keine Aufbereitung: neue Aktion `inv/scrap` (Hangar › Verschrotten), kein Erlös, keine Rohstoffe.
- Balancing: Zivilier-Bergbaulaser 1,6 → 1,2 m³ je Zyklus, Zivilier-Geschütz kin 2 → 1.
- Test `Zivilier-Module: im Markt kaufbar …`; 271 Tests grün.

## 17.11.2026 – Fitting: Waffenplätze verständlicher (Lead)
- Fitting-Fenster: Bei vollen Turret-/Werfer-Plätzen steht jetzt „Alle Turret-Plätze sind belegt … wähle einen belegten Slot und klicke Ersetzen“; leere High-Slots zeigen den Stand „Waffenplätze: Turret 2/2“.

## 17.11.2026 – Feedback und Skill-Infos (Lead)
- Skills (Katalog): jede Zeile zeigt Beschreibung und Effekt je Stufe samt aktuellem Wert und Maximum (z. B. „Abbauertrag: +5 % je Stufe · jetzt +20 %, Maximum +25 %“). Effekte kommen aus `skills.json` (`effects`), Anzeigenamen aus dem Skill-System.
- Gesperrte Buttons: Klick blendet den Grund sichtbar neben dem Button ein (vorher nur Tooltip).
- Tests: Skill-Katalog-Effekte, Sperrgrund im Smoke-Test; 272 Tests grün.

## 17.11.2026 – Starterschiff „Wayfarer“ (Lead)
- `ship.pebble` heißt jetzt **Wayfarer**, Untertitel „Starterschiff“ (neues Schiffsfeld `subtitle`), drei Turret-Plätze statt zwei. Alte Spielstände übernehmen den neuen Namen einmalig.
- Untertitel in Übersicht, Hangar und Fitting-Fenster; Tests angepasst (272 grün).
- `docs/ITERATIONS.md`: Cap-, Expeditions- und Blaupausen-Entscheidungen festgehalten.

## 17.11.2026 – Iteration 3a: Energiespeicher (Lead)
- Neues System `cap`: Cap gehört zum Piloten (Prozent), Schiffsgröße bestimmt nur die Kosten je Aktion; Schiffswechsel füllt nicht auf. Aufladen über Ticks, angedockt doppelt so schnell.
- Bergbaulaser (nicht-zivil) verbrauchen Cap (`capUse`). Bei 0 % **Civilian Mode**: nur Zivilier-Module arbeiten, bis 25 % erreicht sind (Fitting-Selector `fitting/stats` mit `civilianOnly`).
- Warp und Tor-Sprung kosten Cap; im Civilian Mode nur Notflug zu Stationen, kein Tor-Sprung (gegen Hauler-Missbrauch).
- HUD: gelbe Cap-Leiste, bei leerem Cap grau mit roter Schrift „Civilian Mode“, nicht-zivile Module ausgegraut; Übersicht zeigt Energie-Zeile.
- `balance.cap`, Schema, 6 neue Tests (278 grün), Smoke-Test für die Civilian-Anzeige.

## 17.11.2026 – Hotfix: Slots alter Spielstände (Lead)
- Ursache für „Dieses Modul passt nicht in diesen Slot“ beim Starterschiff: Im Spielstand fehlten die Slot-Listen des Schiffs (`fitting.high/mid/low/rig` leer oder fehlend), daher scheiterte jeder Einbau. `starter` ergänzt sie beim Laden und schreibt ins Protokoll „Schiffs-Slots repariert“.
- Test mit beschädigtem Spielstand; 279 Tests grün.
