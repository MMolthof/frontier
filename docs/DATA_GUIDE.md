# Daten-Leitfaden (A2)

Alle Spielinhalte stehen in `data/*.json`, nie im Code. Jede Datei hat das Format `{"schema":1,"entries":[…]}` (Ausnahmen: `balance.json`, `i18n/de.json`).
Nach **jeder** Änderung:

```
node tools/validate-data.mjs            # Schema, Querverweise, Regeln – Exit-Code 1 bei Fehlern
node tools/validate-data.mjs --report   # zusätzlich Balance-Rechnung (Ertrag, Missionen, Skillpunkte, Aufstiegspfade)
node --test                             # inkl. tests/data.*
```

Eigene Erweiterungen ohne Eingriff in die Basisdateien: `data/ext/<kürzel>-<name>.json` (gleiches Format, ID-Präfix bestimmt die Sammlung). Bei doppelter ID gewinnt die Basis.

## Namenskonventionen
| Was | Muster | Beispiel |
|---|---|---|
| Schiff | `ship.<name>` | `ship.warden` |
| Modul | `mod.<familie>_<größe>[_t2]` (s/m/l), Sonderfälle `mod.miner_1`, `mod.mining_upgrade_1` | `mod.shield_extender_m_t2` |
| Skill | `skill.<name>`, Skillbuch-Item `item.skillbook_<name>` | `skill.cruiser_command` |
| Erz / Item / NPC | `ore.<name>`, `item.<name>`, `npc.rat_<name>` | `ore.dravite` |
| System | `sys.<name>`; Himmelskörper `cel.<sys>.<p1\|belt1\|anom1\|gate.<ziel>>`; Station `cel.<sys>.p<n>.station` (Mond: `….p<n>.m<k>.station`); Feld `field.<sys>.<belt\|anom><n>` | `cel.vael.gate.drosk` |
| Mission | `msn.l<stufe>.<slug>` | `msn.l2.raider_camp` |
| Konzern (owner / agentCorp) | `corp.<name>`, Anzeigename in i18n unter demselben Schlüssel | `corp.vanguard` |
| Stat-Gruppe in Effekten | `stackingGroup` = Name des Stats oder der Funktion | `mining_yield` |

Texte (name, description, title, summary) sind Deutsch, Bezeichner Englisch, ISK ganzzahlig. Werte „je Tick“: 1 Tick = 1 Spielminute (`tickSeconds` 60).

## Checkliste: neues Schiff (`data/ships.json`)
1. ID und Namen vergeben, `art` = ID (SVG `assets/ships/<id>.svg` liefert A3).
2. `category` (mining | combat | industrial), `class` und passende `hull`: Fregatte/Zerstörer small, Kreuzer/Barke/Frachter medium, Schlachtkreuzer/Schlachtschiff large.
3. `slots` (high/mid/low/rig), Summe im Rahmen der Klasse (Fregatte 7–13, Zerstörer 10–16, Kreuzer 11–18, Barke 9–15, Frachter 8–14, Schlachtkreuzer 14–21, Schlachtschiff 16–24).
4. `hardpoints`: `turret` und `launcher` je ≤ High-Slots. Bergbauschiffe: `launcher: 0`, `turret` = Anzahl Laser. Kampfschiffe: mindestens ein Hardpoint.
5. `fitting` (powergrid, cpu, calibration 400) **so wählen, dass ein sinnvolles Voll-Fitting passt**. Dafür einen Eintrag in `REFERENCE_FITS` (tools/validate-data.mjs) ergänzen; der Validator rechnet ihn nach.
6. `attributes`: alle 24 Werte (HP, Cap, Speed, Warp, Signatur, Ziele, Lock, cargo, ore_hold, 12 Resistenzen). Kampf-/Industrieschiffe `ore_hold: 0`, Bergbauschiffe `ore_hold > 0`, Frachter `cargo ≥ 10000`.
7. `bonuses` (Skill, Stat, op, `perLevel`) und `roleBonuses` (fester `value`). Keine Mining-Boni auf Kampfschiffen, keine Waffenboni auf Bergbauschiffen.
8. `requires`: Raumschiffkommando + Klassen-Skill (+ Hüllen-Skill ab Zerstörer). Ggf. neue Skills in `skills.json` anlegen.
9. `price`, danach Validator laufen lassen; neues Layout darf keinem anderen Rumpf gleichen.

## Checkliste: neues Modul (`data/modules.json`)
1. `slot` genau einer von high/mid/low/rig; `group` gehört zu genau einem Slot-Typ. **Neue Gruppe**: in `GROUP_SLOT` (tools/validate-data.mjs) und `modgroup.<gruppe>` in `i18n/de.json` ergänzen.
2. `size` = Rumpfgröße der Zielschiffe (small/medium/large); gibt es keine Rumpf-Größe dazu, ist das Modul unbenutzbar (Test schlägt an).
3. `hardpoint` (`turret`/`launcher`) nur im High-Slot und nur bei Modulen mit `activation`. Mining-Laser sind Turret-Hardpoints.
4. `fitting`: Powergrid und CPU (beide angeben, auch 0). Rigs: nur `calibration` 50–200, `permanent: true`, `category: "rig"`.
5. `activation` je `kind`: `attack` (damage je em/th/kin/exp, rangeKm, capUse), `mine` (cycleTicks, yieldM3, rangeKm), `repair` (repairs shield|armor, amount), `scan` (rangeKm), `boost` (capUse).
6. `effects`: nur Stat-IDs aus `data/stats.json`. **Jeder `mul`-Effekt braucht eine `stackingGroup`** (gleiche Gruppe = Stacking-Malus). Widerstände nutzen `op: "add"` (Prozentpunkte).
7. `requires` Skills; Tech II verlangt Spezialisierungs-Skill. `price` ganzzahlig.

## Checkliste: neuer Skill (`data/skills.json`)
`rank` 1–8, `primary` ≠ `secondary` (intelligence/memory/perception/willpower/charisma), `maxLevel` 5, `requires` ohne Zyklen (Stufen 1–5), `price` (Skillbuch), `effects` mit `perLevel`. Gruppe: eine der elf Pflichtgruppen. Skillbuch-Item `item.skillbook_<name>` nur bei Rang ≤ 2 nötig (`basePrice` = Skillpreis). Skill-Punkte: `ceil(250 · rank · 2^(2,5·(Stufe−1)))` kumulativ (Rang 1, Stufe V = 256.000 SP).

## Checkliste: neues System (`data/systems.json`)
1. `security` mit einer Dezimalstelle, `region` (i18n `region.<name>` anlegen).
2. Genau ein Stern, 3–7 Planeten, 1–2 Stationen (verschiedene `services`, `owner` = `corp.*` mit i18n-Eintrag), Stationen hängen an `parent` (Planet oder Mond).
3. 2–5 Felder: jedes Feld hat genau einen Gürtel (`belt`) oder eine Anomalie (`anomaly`, bei `hidden: true` Pflicht) über `fieldId`. `oreWeights` nur mit Erzen, deren `securityBand` die Systemsicherheit enthält.
4. Tore: `cel.<von>.gate.<nach>` mit `to` und `toGate`. **Das Gegentor im Zielsystem muss existieren und zurückzeigen.** Das Netz muss vom Startsystem aus vollständig erreichbar sein.
5. Konzern mit `missions`-Station, wenn Missionen von ihm kommen sollen.

## Checkliste: neue Mission (`data/missions.json`, NPCs in `npcs.json`)
1. ID `msn.l<stufe>.<slug>`, Stufe 1–4. `requires`: `shipCategory: "combat"`, Klassen und Standing **exakt wie die Stufe**: L1 frigate–destroyer / 0, L2 destroyer–cruiser / 1,0, L3 cruiser–battlecruiser / 3,0, L4 battlecruiser–battleship / 5,0.
2. `agentCorp` muss eine Station mit Service `missions` besitzen. NPC-Klassen dürfen die Stufe nicht überschreiten.
3. **Belohnung** nicht schätzen: ISK = Stundenertrag(Stufe) · Dauer / 60 − Kopfgelder − Beute. Stundenerträge und Referenzmodell stehen in `balance.economy`; `node tools/validate-data.mjs --report` zeigt die Verhältnisse (Ziel 1 : 3 : 7,5 : 30), `tests/data.balance.test.mjs` prüft ±3 %.
4. Referenzschiffe müssen überleben: Test „überlebbar“ (Schadensanteil ≤ 90 %).

## Häufige Fehler
- Stat-ID nicht im Katalog (`unbekannte Stat-ID`): erst in `data/stats.json` anlegen (nur anhängen, nie umbenennen) und `stat.<id>` in i18n ergänzen.
- `mul`-Effekt ohne `stackingGroup`.
- Modul-Größe passt nicht zum Rumpf (Fitting-Fehler „hat Größe medium, Rumpf ist small“).
- Rig mit Powergrid/CPU statt Calibration oder ohne `permanent`.
- Tor ohne Gegentor, Feld ohne Gürtel, Erz außerhalb seines Sicherheitsbands.
- Skill-Zyklus (z. B. A verlangt B, B verlangt A).
- Mission mit Klassen/Standing, die nicht zur Stufe passen; Agent-Konzern ohne Missionsstation.
- Feste IDs umbenennen (siehe Auftrag A2): `ship.pebble`, `mod.miner_1`, `skill.spaceship_command`, `skill.mining`, `skill.mining_frigate`, `sys.aldara`, `cel.aldara.p1.station`, `item.tritanium|pyerite|mexallon|scrap_metal`, `ore.veldspar|scordite|pyroxeres` und alle Beispiel-IDs aus `data/examples`.
- Dateien mit Byte-Order-Mark, CRLF oder Tabs: UTF-8, LF.

## Schemas
`data/schema/<sammlung>.schema.json` (JSON-Schema draft-07-Teilmenge: type, required, properties, patternProperties, additionalProperties, items, enum, const, min/max, pattern, minItems/maxItems, uniqueItems, minProperties, propertyNames). Der Validator liest sie zur Laufzeit; Schemaänderungen wirken sofort.
