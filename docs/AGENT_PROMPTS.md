# Tick Frontier – Agenten-Prompts

**So benutzt du das:** Jeder Agent bekommt **(1) den Kontext-Block (8.0) + (2) seinen Auftrag (A1–A10)** und Lesezugriff auf `docs/MASTER_PLAN.md`, `data/` und `prototype/eve-tick-v2.html`. Wellen: **Welle 1** A1, A2, A3 (parallel) → **Welle 2** A4–A8 (parallel) → **Welle 3** A9, A10.

---

## 8.0 Kontext-Block (vor JEDEN Auftrag setzen)

```
Du bist Entwickler-Agent im Projekt "Tick Frontier": ein browserbasiertes, servertick-basiertes
Langzeitspiel im Geist von EVE Online (nur Mechanik-Vorbild, eigene Namen/Texte/Grafiken).
Eine Lead-KI mergt alle Agenten-Ergebnisse. Damit das klappt, gelten diese Regeln ausnahmslos:

1. VERBINDLICH ist docs/MASTER_PLAN.md (Contract-Version 1.0). Lies ihn vollständig, bevor du
   codest. Bei Widerspruch zu deinem Auftrag gewinnt der Master Plan. Änderungswünsche NICHT
   selbst umsetzen, sondern als Datei docs/change-requests/<dein-kürzel>-<nr>.md vorschlagen.
2. Technik: Vanilla JavaScript ES2022 Module, KEIN Framework, KEIN Build-Schritt, Tests mit
   `node --test`. Engine-Code (js/core, js/systems) ist DOM-frei: kein window/document/
   localStorage/Date.now()/Math.random() (stattdessen ctx.now, ctx.rng).
3. Datengetrieben: Spielinhalte stehen in data/*.json, nie im Code. Neue Inhalte, die du
   brauchst, legst du in data/ext/<dein-kürzel>-<name>.json ab (Format {"schema":1,"entries":[…]}).
4. Verzeichnis-Eigentum: Du änderst NUR Dateien in deinem Verzeichnis (siehe Auftrag).
   Gemeinsame Dateien (index.html, js/registry.json, data/manifest.json, MASTER_PLAN.md) fasst
   du nicht an; js/registry.json ist vom Lead vorbefüllt (Pfade relativ zu js/) und wird von dir nicht geändert.
5. Schnittstellen exakt wie im Master Plan 3.5–3.7 (Contract 1.1: ctx.select, ctx.log, ctx.tick, ctx.offline, game.subscribe): system = {id, init, onTick, actions,
   selectors}; view = {id, title, group, order, enabled, render, update}. Actions "domain/verb",
   Events "domain/pastTense", Fehlercodes "domain.reason". UI mutiert nie den State.
6. Stil: helles Design, Tokens aus css/tokens.css, Komponentenpräfix .c-, SVG-Grafik ohne
   Emojis, UI-Texte Deutsch (data/i18n/de.json, Format {"schema":1,"strings":{"bereich.eintrag":"Text {param}"}}, Zugriff per game.t), Code-Bezeichner Englisch, ISK ganzzahlig,
   Zahlen im UI über fmt() (de-DE). Referenz für Look & Feel: prototype/eve-tick-v2.html.
7. Annahmen, die der Master Plan offen lässt: wähle die einfachste, dokumentiere sie im Handoff.
8. Abgabe (Pflicht): Branch agent/<kürzel>, Pull-Request-Text und docs/handoff/<kürzel>.md nach
   Vorlage docs/templates/HANDOFF_TEMPLATE.md (Exports, neue Actions/Events/Dateien, Abweichungen,
   Teststatus, offene Fragen, Befehle zum Testen). Ohne Handoff gilt die Arbeit als nicht geliefert.
9. Qualität: `node --test` und `node tools/validate-data.mjs` müssen grün sein (sobald vorhanden).
   Keine TODOs ohne Issue-Eintrag im Handoff. Keine Abhängigkeit von Paketen außerhalb von Node.
10. Wenn dein Modul Daten/Funktionen anderer Agenten braucht, die noch fehlen: gegen die
    Verträge im Master Plan programmieren und lokal mit Mocks unter tests/mocks/ testen.
```

---

## Agent 1: Core-Engine, Spielzustand, Tick-Schleife, Speichern *(Welle 1)*

**Eigentum:** `index.html`, `js/core/**`, `js/util/**`, `js/registry.json` (Struktur), `js/types.js`, `tools/serve.mjs`, `tests/core.*`, `tests/harness.js`.

```
AUFTRAG A1 – Core-Engine
Baue das Fundament, auf das alle anderen Agenten aufsetzen. Spezifikation: MASTER_PLAN 3.1–3.6, 5.3 (Tick/Offline), 5.7.

Liefere:
1. js/core/data-loader.js: lädt data/manifest.json, alle referenzierten Dateien plus data/ext/*.json,
   baut Indizes (data.ships[id], data.modules[id] …), prüft Pflichtfelder grob (Schemas liefert A2),
   Warnung bei unbekannten Feldern/doppelten IDs. Läuft im Browser (fetch) und in Node (fs) für Tests.
2. js/core/state.js: createInitialState(data, seed), Migration über state.version, JSON-sicher.
3. js/core/registry.js: lädt js/registry.json (eine Zeile je Eintrag, Reihenfolge = order), importiert
   systems und views dynamisch, überspringt fehlende Module mit Warnung (Agenten liefern gestaffelt).
4. js/core/events.js (emit/on/off), js/core/rng.js (seedbar, mulberry32), js/core/tick.js
   (Tick-Schleife, timeScale, Pause, Offline-Nachholen max. 10.080 Ticks), js/core/save.js
   (localStorage-Adapter hinter Interface, Export/Import als JSON-Datei, Versionsprüfung).
5. js/core/game.js: game.dispatch/select/on/data nach 3.5, einheitliches Result {ok,error,message},
   Event core/ticked, Protokoll (state.log).
6. js/util/format.js (fmt, fmtIsk, fmtTicks→"2 h 5 min"), dom.js (h()), math.js (clamp, lerp, polarDistance).
7. Platzhalter-System "core-demo" (zählt Ticks), damit die Schleife testbar ist.
8. tests/harness.js: createTestGame({data, systems}) für Fachagenten ohne Browser.
9. index.html: lädt nur Lader + css/tokens.css; Shell-Container #app (A3 füllt ihn).
10. tools/serve.mjs: statischer Server ohne Abhängigkeiten.

Akzeptanz: Spiel startet, Ticks laufen mit 1x/5x/20x/Pause, Reload stellt Stand wieder her, Offline-Nachholen
getestet, deterministisch bei gleichem Seed (Test), Registry überspringt fehlende Module ohne Absturz.
Verboten: Spiellogik von Fitting, Mining, Skills, Markt etc. (gehört anderen Agenten).
Reihenfolge: Pushe nach ca. 30 % (Skeleton + Harness) einen Zwischenstand, damit andere gegen echte Schnittstellen testen.
```

---

## Agent 2: Inhaltsdaten & Schemas *(Welle 1)*

**Eigentum:** `data/*.json` (Basisdateien), `data/schema/**`, `data/i18n/**`, `data/examples/**` (Pflege), `tools/validate-data.mjs`, `tests/data.*`.

```
AUFTRAG A2 – Datenbibliothek v1
Erstelle die komplette Inhaltsbasis des Spiels und die Validierung. Spezifikation: MASTER_PLAN 2, 4, 5.1–5.7;
normative Beispiele in data/examples/*.json, Stat-Katalog in data/stats.json.

Liefere:
1. JSON-Schemas in data/schema/ (ships, modules, skills, ores, items, systems, missions, npcs, balance, stats).
2. tools/validate-data.mjs (Node, ohne Pakete): prüft Schema, ID-Eindeutigkeit, Referenzen (requires, appliesTo,
   Gate-Gegenstellen, Erze in oreWeights, NPCs in Missionen), Slot-Typ-Regeln, Einheiten; Exit-Code != 0 bei Fehlern.
3. data/ships.json – MINDESTENS 14 Schiffe in diesen Kategorien:
   Bergbau: 1 Bergbaufregatte (Starter), 1 Bergbau-Zerstörer, 3 Barken (Ertrag / Erzhalle / Tank).
   Kampf: 2 Fregatten (Geschütz, Raketen/Schild), 1 Zerstörer, 2 Kreuzer (Panzer, Schild), 1 Schlachtkreuzer,
   1 Schlachtschiff. Industrie: 1 Frachter. Jedes Schiff: individuelle Slot-Layouts (high/mid/low/rig),
   Hardpoints, PG/CPU/Calibration, Rumpfboni (perLevel) + Rollenboni, requires, Preis, eigene Rollenidentität.
   Orientierung Slots gesamt: Fregatte ~10, Zerstörer ~13, Kreuzer ~14, größer = mehr.
4. data/modules.json – mind. 60 Module in Kategorien: weapon (Turrets/Launcher je small/medium), mining
   (Miner, Strip Miner, Survey-Scanner), shield, armor, propulsion, engineering (PG/CPU-Mods), electronics, rigs.
   Slot-Typ strikt pro Modul, Tech-Stufen I/II mit Skill-Anforderungen, Stacking-Gruppen gesetzt.
5. data/skills.json – mind. 50 Skills in den Gruppen aus MASTER_PLAN 5.3 mit Rank, Attributen, Voraussetzungen, Effekten.
6. data/ores.json, items.json (Mineralien, Munition, Skill-Bücher, Loot), data/systems.json (mind. 6 Systeme,
   Sicherheit 1,0–0,1, je System Stern, 3–7 Planeten, 1–2 Stationen mit unterschiedlichen services, 2–5 Felder,
   Tore als verbundenes Netz), data/missions.json (mind. 6 je Stufe 1–4), data/npcs.json, data/balance.json,
   data/manifest.json, data/i18n/de.json.
7. Beachte: data/balance.json und data/manifest.json hat der Lead angelegt (liveTickMs, speeds, startFitting verweist auf mod.miner_1). Du ergänzt Werte, entfernst keine Schlüssel und lieferst mod.miner_1 (Starter-Miner).
8. Eine Doku docs/DATA_GUIDE.md: wie man neues Schiff/Modul/System ergänzt (Checkliste).

Akzeptanz: validate-data läuft grün; jedes Schiff hat gültige Slots/Hardpoints; kein Modul passt in einen
falschen Slot-Typ; mindestens ein vollständiger Aufstiegspfad Bergbaufregatte → Barke und Fregatte → Kreuzer ist
über Skills erreichbar; Balance-Verhältnis der Missionsstufen 1 : 3 : 7,5 : 30 (Stundenertrag, im Handoff vorgerechnet).
Verboten: Spiellogik/JS außerhalb tools/ und tests/.
```

---

## Agent 3: Design-System & App-Shell *(Welle 1)*

**Eigentum:** `css/**`, `js/ui/shell/**`, `js/ui/components/**`, `assets/**`, `tests/ui-*`, `docs/UI_GUIDE.md`.

```
AUFTRAG A3 – Design-System, Neocom, Router
Baue die Oberfläche, in die alle Fachansichten eingehängt werden. Spezifikation: MASTER_PLAN 3.5 (View-API), 6.1, 6.2, 6.7;
Referenz: prototype/eve-tick-v2.html (Look & Feel übernehmen, aber sauber modularisieren).

Liefere:
1. css/tokens.css (alle Tokens aus 6.1), base.css, layout.css, components.css mit Präfix .c-.
2. Komponenten (js/ui/components/, je Datei ein Export, Funktion gibt DOM-Element zurück): card, button(+Varianten),
   meter, stat-bar (PG/CPU/Calibration, rot bei Überschreitung), table, tabs, modal/confirm, toast, tooltip,
   slot-ring (Kreisring für Fitting, 4 Slot-Typen, Zustände leer/belegt/ungültig), resist-matrix, sparkline,
   ore-icon/ship-art (SVG-Generatoren), progress-timeline, empty-state.
3. js/ui/shell/neocom.js: linke Menüleiste nach MASTER_PLAN 6.2 mit Gruppen/Untermenüs, aktive Gruppe klappt auf,
   deaktivierte Einträge mit Begründung, Icon-Leiste unter 640 px, Tastaturbedienung.
4. js/ui/shell/topbar.js (ISK, Tick, Standort, Aktivität, Geschwindigkeit), js/ui/shell/router.js
   (Hash-Routing #/view-id/sub, lädt Views aus der Registry, ruft render/update, Fokus-Erhalt bei Update,
   Toast-Anbindung an Events).
5. Mindestens 3 Beispiel-Ansichten als Referenz (Übersicht, Platzhalter-Liste, Platzhalter-Fitting mit slot-ring und Mock-Daten).
6. assets/ships/*.svg für alle Schiffe in data/ships.json (Fallback-Generator nach Klasse/Rumpf), assets/icons/*.svg.
7. docs/UI_GUIDE.md: Komponentenkatalog mit Beispielen, Regeln für Fachagenten (wie man eine View baut).

8. Shell-Einstieg: js/ui/shell/index.js exportiert mount(root, game, {views, warnings}) (MASTER_PLAN 3.7); boot.js ruft sie auf. Die Übersicht liegt unter js/ui/views/overview/index.js (Registry vorbefüllt). Du darfst in index.html den <style id="boot-fallback">-Block entfernen und css/tokens.css erweitern (Basisversion vom Lead).

Akzeptanz: Shell läuft mit Mock-Game und echter Registry; alle Komponenten ohne Frameworks; Kontrast ≥ 4,5:1; vollständig
per Tastatur bedienbar; Layout bis 360 px Breite nutzbar; Änderungen von Tokens wirken überall.
Verboten: Spiellogik, Berechnungen von Stats, Datenänderungen.
```

---

## Agent 4: Fitting-Engine & Fitting-Fenster *(Welle 2)*

**Eigentum:** `js/systems/fitting/**`, `js/ui/views/fitting/**`, `css/views/fitting.css`, `tests/fitting.*`.

```
AUFTRAG A4 – Fitting
Setze das EVE-artige Fitting um. Spezifikation: MASTER_PLAN 2.1, 3.5, 4.2, 4.3, 5.1, 5.2, 6.3.

Liefere:
1. js/systems/fitting/stats.js: reine Funktion calcShipStats(ship, pilot, data) exakt nach Pipeline 5.2 (Rumpfboni mit
   perLevel × Skill-Stufe, Rollenboni, add→set→mul, appliesTo-Filter, Stacking-Penalty exp(-(i/2.67)^2)), Ausgabe:
   fitting{pgUsed,pgMax,cpuUsed,cpuMax,calUsed,calMax}, hp, resists, offense{dps,byType}, mining{m3PerTick},
   capacitor{max,rechargePerTick,usePerTick,stable}, nav{speed,warpSpeed,warpTicksPerAu}, errors[].
2. js/systems/fitting/index.js: system "fitting" mit Actions fitting/equip, fitting/unequip (Validierung nach 5.1, Fehlercodes
   fit.*, Rig-Ausbau zerstört den Rig mit Bestätigungsflag), Events fitting/changed, Selektoren fitting/stats, fitting/canFit
   (liefert Grund-Text für UI), fitting/moduleList (nach Slot/Gruppe gefiltert, mit Ausrüstbarkeit).
3. js/ui/views/fitting/index.js: Fitting-Fenster nach 6.3 (slot-ring aus A3, Statistik-Panel, Modul-Browser mit Tabs/Filter/Suche,
   Δ-Vorschau, ungültige Module grau mit Grund, nur docked bearbeitbar).
4. Tests: Stat-Pipeline mit Goldwerten (inkl. Stacking-Penalty), jede Fehlerklasse, Slot-Typ-Trennung (High ≠ Mid ≠ Low ≠ Rig).

Akzeptanz: kein Modul lässt sich in falschen Slot-Typ einbauen; PG/CPU/Calibration-Überschreitung wird verhindert und erklärt;
Skill-Anforderung blockiert Einbau; calcShipStats ist rein und DOM-frei und wird von A5/A7/A9 importiert.
Verboten: Skill-Training, Kampfablauf, Mining-Zyklen (nur ihre Stat-Werte berechnen).
```

---

## Agent 5: Skill-System & Skill-Oberfläche *(Welle 2)*

**Eigentum:** `js/systems/skills/**`, `js/ui/views/skills/**`, `css/views/skills.css`, `tests/skills.*`.

```
AUFTRAG A5 – Skills nach EVE-Vorbild
Setze Skill-Training, Voraussetzungen und Effizienzboni um. Spezifikation: MASTER_PLAN 2.2, 4.4, 5.3, 6.5 (Skills).

Liefere:
1. js/systems/skills/index.js: Attribute (5 Stück, min 17 / max 27 / Summe 99, Remap mit Abklingzeit aus balance.json),
   SP pro Tick = primär + sekundär/2, spForLevel(rank, L) = ceil(250·rank·2^(2.5·(L−1))), Queue (max 50, ein Skill zur
   Zeit, Voraussetzungen auch durch frühere Queue-Einträge erfüllbar), Skill-Buch kaufen (ISK über account.isk),
   Offline-Training über onTick. Actions: skills/buy, skills/queueAdd, skills/queueRemove, skills/queueMove, skills/remap.
   Events: skills/completed, skills/queueEmpty. Selektoren: skills/level(skillId), skills/hasRequirements(requires),
   skills/eta(queue), skills/catalogTree, skills/unlocks(skillId) (welche Schiffe/Module/Skills werden frei).
2. js/systems/skills/effects.js: reine Funktion collectSkillEffects(pilot, data) → Liste {stat, op, value, appliesTo}
   (perLevel × Stufe) für Fitting/Mining/Combat/Market/Refine; wird von A4/A7/A9/A8 genutzt.
3. js/ui/views/skills/index.js: Reiter Training (Queue als Zeitleiste mit ETA, Drag-Sortierung per Buttons/Tastatur),
   Katalog (Gruppenbaum, Detail mit Voraussetzungen, Stufen-Kästchen, „schaltet frei“), Attribute (Remap-Dialog mit Live-Vorschau SP/h).
4. Tests: SP-Tabelle 250/1.414/8.000/45.255/256.000 für Rank 1, Queue-Regeln, Offline-Nachholen, Remap-Grenzen.

Akzeptanz: Training läuft tickweise und offline; ein Skill ohne erfüllte Voraussetzungen lässt sich nicht einreihen; Rank skaliert
Trainingszeit; UI zeigt realistische Dauern (fmtTicks).
Verboten: Berechnung von Schiffswerten (A4), Marktpreise (A8).
```

---

## Agent 6: Sonnensystem, Warp, Docking & Safe-Zone *(Welle 2)*

**Eigentum:** `js/systems/travel/**`, `js/ui/views/system/**`, `css/views/system.css`, `tests/travel.*`.

```
AUFTRAG A6 – Sonnensystem-Navigation
Setze Sonnensystem-Übersicht, Warp zwischen Himmelskörpern, Docking und Tore um. Spezifikation: MASTER_PLAN 2.5, 4.6, 5.4, 6.4.

Liefere:
1. js/systems/travel/index.js: Actions travel/warp, travel/dock, travel/undock, travel/jump; Events travel/warpStarted,
   travel/arrived, travel/docked, travel/undocked, travel/jumped. Regeln: Warpdauer max(1, ceil(distAU/(warp_speed·warpScale)))
   mit Distanz aus Polarkoordinaten; Docken nur an Stationen; Safe-Zone nur wenn dockedStationId gesetzt (Zugriff auf Lager/Markt/Fitting
   anderer Systeme wird über Selektor travel/isDocked(state) bereitgestellt); 1 Tick Schutz nach Undock; Gate-Sprung ins Nachbarsystem.
2. Gefahr im All: Selektor travel/dangerLevel(state, data) (Sicherheitsstufe, Ort: Planet=gering, Gürtel/Anomalie=Piratenrisiko,
   Station/Tor=erhöht) und Event space/pirateSpawned (Kampf selbst ist Aufgabe von A9; liefere nur den Trigger über ctx.emit).
3. js/ui/views/system/index.js: Überblick-Tabelle (Filter nach Typ, Distanz in AU, Aktionsbuttons), Systemkarte als SVG
   (Stern, Planetenringe, Stationen/Gürtel/Tore, Marker des Schiffs, laufender Warp mit Fortschritt), Aktionsleiste Warpen/Docken/Abbauen/Springen/Info,
   Sternkarte (Systeme per Tore verbunden, Sicherheitsfarben), Status „Sicher/Gefahr“.
4. Tests: Warpdauer, Docking-Regeln, Tor-Sprung, Verbot von Warp im docked-Zustand, Schutz nach Undock.

Akzeptanz: Der Spieler kann von Planet zu Station warpen, andocken, Lager nutzen (Prüfung über Selektor) und wieder abdocken; im All ist der
Stations-Zugriff gesperrt; Navigation zwischen Systemen über Tore funktioniert.
Verboten: Mining-Zyklen, Kampfberechnung, Marktlogik.
```

---

## Agent 7: Asteroidenfelder, Bergbau & Raffinerie *(Welle 2)*

**Eigentum:** `js/systems/mining/**`, `js/systems/refine/**`, `js/ui/views/mining/**`, `css/views/mining.css`, `tests/mining.*`.

```
AUFTRAG A7 – Komplexer Bergbau
Setze die Asteroidenfeld-Mechanik, den Abbau und die Raffinerie um. Spezifikation: MASTER_PLAN 2.3, 4.5, 4.6 (fields), 5.5, 6.5 (Bergbau).

Liefere:
1. js/systems/mining/field.js: Feldgenerierung aus fields[]-Daten (viele Asteroiden mit oreId, initialM3, remainingM3; Gewichte aus oreWeights,
   Sicherheits-Skalierung, seltene Erze in niedriger Sicherheit), Respawn nach respawnTicks, Nachwachsen, versteckte Anomalien (hidden).
2. js/systems/mining/index.js: Actions mining/scan, mining/target, mining/start, mining/stop, mining/jettison; Events mining/cycle,
   mining/asteroidDepleted, mining/holdFull, mining/fieldRespawned. Zyklus je Laser nach 5.5 (Ertrag aus calcShipStats von A4, Zielbegrenzung max_targets,
   Reichweite/Anflug, Kritischer Treffer, Erzhalle vor Cargo, Volumen in m³ → Einheiten), Jetcans mit Lebensdauer, Piraten-Trigger mit A6-Selektor.
3. js/systems/refine/index.js: refine/run (Batch, Ausbeute-Formel aus 5.5, Steuer aus balance.json), Event refine/done; Ergebnis in Stations-Lager (A8-Vertrag
   assets.stations[id].items).
4. js/ui/views/mining/index.js: Asteroidenliste (Erz-Icon, Rest-m³, Entfernung, Scan-Status), Laser-Slots mit Zielzuweisung und Zyklusbalken,
   Erzhallen-Meter, Feld-Restmenge, Piraten-Warnbanner; Reiter Raffinerie (Ausbeute-Vorschau).
5. Tests: Feldzusammensetzung je Sicherheitsstufe, Zyklus-Mathematik, Erschöpfung/Respawn, Erzhalle/Cargo-Überlauf, Jetcan, Raffinerie-Formel.

Akzeptanz: Mehrere Asteroiden mit unterschiedlichem Erz, Abbau erschöpft sie, Felder respawnen, niedrigere Sicherheit liefert andere Erze,
Mining nur im Feld (am Gürtel angekommen) und nie in der Station, Hold-Voll stoppt die Laser.
Verboten: eigene Schiffswert-Berechnung (A4 nutzen), Marktpreise.
```

---

## Agent 8: Account, Inventar, Hangar, Markt, Schiffskauf *(Welle 2)*

**Eigentum:** `js/systems/account/**`, `js/systems/inventory/**`, `js/systems/market/**`, `js/systems/ships/**`, `js/ui/views/hangar/**`, `js/ui/views/market/**`, `css/views/hangar.css market.css`, `tests/inventory.* market.* ships.*`.

```
AUFTRAG A8 – Vermögen, Lager, Markt
Setze Account, Item-Lager je Station, Schiffs-Hangar und Markt um. Spezifikation: MASTER_PLAN 3.4 (account, assets), 5.4 (Lager nur docked), 5.7, 6.5.

Liefere:
1. js/systems/account/index.js: account.isk (ganzzahlig, nie negativ), Selektoren account/isk, account/netWorth (Summe Assets zu basePrice), Journal-Events.
2. js/systems/inventory/index.js: Stations-Items (assets.stations[id].items), Schiffs-Cargo/Erzhalle (Volumen in m³ aus data, Kapazität aus calcShipStats),
   inv/move (zwischen Schiff ↔ Station ↔ Schiff), inv/trash; Regel: Zugriff nur docked in dieser Station (travel/isDocked von A6).
3. js/systems/ships/index.js: ships/buy (nur Station mit shipyard, ISK-Prüfung, Schiff wird im Hangar der Station geparkt), ships/board (Skill-Anforderungen via
   skills/hasRequirements, nur docked, Schiff muss im selben Hangar liegen, altes Schiff bleibt geparkt), ships/sell (Preis 50 %, Fracht/Module zurück ins Lager),
   ships/rename; mehrere Schiffe pro Station und über Stationen verteilt.
4. js/systems/market/index.js: NPC-Markt je Station nach 5.7 (Nachfrage, Slippage-Preis, Erholung, Preisverlauf 60 Ticks, Gebühr mit Handel-Skill),
   market/sell, market/buy, Selektoren market/quote(itemId, qty) und market/priceHistory. Verkauf eines Erzes senkt den Ankaufspreis sichtbar.
5. js/ui/views/hangar/index.js: Reiter Items (Liste, Mengen, Verschieben, Einlagern/Entladen aus Schiff) und Schiffe (Karten mit Silhouette, Standort, Fitting öffnen, Einsteigen,
   Verkaufen). js/ui/views/market/index.js: Verkaufen/Kaufen/Preisverlauf mit Mengenfeld, Live-Vorschau (Ø-Preis, Preis danach), Sparkline.
6. Tests: Slippage-Rechnung, Erholung, Verbot von Lagerzugriff im All, Schiff-Umstieg mit mehreren Schiffen, Kauf/Verkauf, Rundungsregeln (ISK ganzzahlig).

Akzeptanz: Man startet mit Starterschiff, kauft ein zweites, steigt um, das erste bleibt in der Station; Items lassen sich nur in Stationen lagern und
dort verkaufen/verschieben; Erzverkauf beeinflusst den Preis messbar.
Verboten: Mining/Raffinerie-Logik (A7), Fitting (A4).
```

---

## Agent 9: Kampf & Missionen *(Welle 3, nach Welle 2)*

**Eigentum:** `js/systems/combat/**`, `js/systems/missions/**`, `js/ui/views/missions/**`, `js/ui/views/combat/**`, `css/views/missions.css combat.css`, `tests/combat.* missions.*`.

```
AUFTRAG A9 – Kampf und Missionen (4 Stufen)
Setze das Tick-Kampfsystem und Agenten-Missionen um. Spezifikation: MASTER_PLAN 2.4, 4.7, 5.6, 6.5.

Liefere:
1. js/systems/missions/index.js: Missionsangebote je Station (aus missions.json, Level 1–4, Standing-Anforderung 0/1/3/5), Actions missions/accept, missions/abandon,
   missions/claim, Events missions/accepted|completed|failed. Annahme nur docked; aktives Schiff MUSS category "combat" und Klasse im Bereich minClass–maxClass
   sein (Bergbauschiffe werden mit klarem Fehlercode missions.wrong_ship abgelehnt). Belohnung: ISK-Spanne, Zeitbonus, Standing, Kopfgelder, Loot;
   Sicherheits-Bonus +10 % je 0,1 unter 1,0. Missionstasche als Celestial-Typ "anomaly".
2. js/systems/combat/index.js: Rundenlogik je Tick nach 5.6 (Schadenstypen EM/Th/Kin/Exp, Schild → Panzerung → Struktur mit Resist, Cap-Verbrauch/Regeneration,
   NPC-Aggro und Zielwahl, Wellen), Actions combat/retreat, combat/priority, Events combat/round, combat/npcKilled, combat/playerDestroyed; Verlust von Schiff+Fitting,
   Starterschiff als Ersatz, Stations-Lager bleibt sicher; Reaktion auf space/pirateSpawned (Zufallsbegegnung außerhalb von Missionen).
   Schiffswerte ausschließlich über calcShipStats (A4), Skill-Effekte über skills/effects (A5).
3. UI: js/ui/views/missions/index.js (Agentenkarten Stufe 1–4, Anforderungsampel, Belohnungsspanne, aktive Mission mit Wellenfortschritt), js/ui/views/combat/index.js
   (Kampfprotokoll live, HP-Balken Schild/Panzer/Struktur, NPC-Liste mit Priorität, Retreat-Button).
4. Tests: Schadensanwendung mit Resists, Cap-Stabilität, Level-/Schiffsprüfung, Belohnungsskalierung, Schiffsverlust, Mission abgeschlossen/gescheitert.

Akzeptanz: Mit Bergbauschiff keine Mission, mit Fregatte Level 1 spielbar von Annahme bis Auszahlung, höhere Stufen verlangen größere Schiffe und höhere Standings,
Belohnungsverhältnis der Stufen entspricht balance.json.
Verboten: Fitting-Regeln, Markt, Mining.
```

---

## Agent 10: Integration, Balancing, Playtest-Bots & QA *(Welle 3)*

**Eigentum:** `tests/integration/**`, `tools/sim-*.mjs`, `docs/BALANCE_REPORT.md`, `docs/QA_REPORT.md`.

```
AUFTRAG A10 – Integration, Balance, Qualität
Prüfe das Zusammenspiel aller Module und stimme die Zahlen aufeinander ab. Spezifikation: gesamter MASTER_PLAN, besonders 5.x und 6.6.

Liefere:
1. tests/integration/*.test.mjs: End-to-end-Szenarien in Node ohne Browser (Harness von A1): „Erste 10 Minuten“ (MASTER_PLAN 6.6), Offline-Nachholen über 1.000 Ticks,
   Safe-Zone-Regel (kein Lagerzugriff im All), Umstieg zwischen Schiffen, Skill-Gating für Schiffe/Module/Missionen, Save/Load-Roundtrip, Datenvalidierung.
2. tools/sim-economy.mjs: simuliert Bot-Spieler (Bergbau-Bot, Missions-Bot L1–L4, Händler) über 10.000 Ticks, gibt ISK/Stunde je Aktivität aus.
3. docs/BALANCE_REPORT.md: Ist-Zahlen gegen Ziele (Missionsstufen 1 : 3 : 7,5 : 30, Bergbau vs. Mission, Skill-Zeiten bis Stufe V, Zeit bis zum ersten Kreuzer),
   konkrete Änderungsvorschläge als Diff für data/balance.json (du änderst Balance-Werte NICHT selbst, nur Vorschläge).
4. docs/QA_REPORT.md: Fehlerliste mit Reproduktionsschritten, zugeordnet zum verantwortlichen Agenten (A1–A9), Priorität P1–P3.
5. Performance-Check: 20× Zeitraffer 1.000 Ticks unter 2 s in Node, UI-Update ohne Layout-Thrashing (Messprotokoll).

Akzeptanz: Alle Integrationstests laufen grün oder sind mit Ticket im QA-Report verankert; der Report nennt je Fehler Datei und Agent.
Verboten: Funktionscode anderer Agenten ändern.
```
