# Tick Frontier – Master Plan

**Contract-Version:** 1.1 · **Stand:** 10.11.2026 · **Lead-KI:** Claude (einzige Instanz, die diese Datei ändert und Branches merged)

Dieses Dokument ist die **verbindliche Spezifikation** für alle Agenten. Bei Widerspruch zwischen Prompt und Master Plan gilt der Master Plan. Änderungswünsche gehen nur über `docs/CHANGE_REQUESTS.md` (Vorlage: `docs/templates/CHANGE_REQUEST_TEMPLATE.md`).

---

## 1. Vision

Ein browserbasiertes, **servertick-basiertes Langzeitspiel** im Geist von EVE Online (Mechanik-Inspiration, keine Assets, keine Texte, eigene Namen). Spielprinzip wie bei alten Tick-Browserspielen (z. B. CIA / Civil Attack): Der Spieler gibt Aufträge, die Welt rechnet in Ticks weiter, auch offline.

Kernschleife: **Skills trainieren → Schiff ausrüsten (Fitting) → im Sonnensystem warpen → Erz abbauen oder Missionen fliegen → in der Station sicher lagern/verkaufen/raffinieren/herstellen → ISK in bessere Schiffe, Module und Skills investieren.**

Zielbild Phase 1 (dieses Paket): vollständig spielbarer Einzelspieler-Prototyp im Browser, **rein clientseitig**, aber so gebaut, dass die Spiellogik später 1:1 auf einen Server (ASP.NET Core) wandern kann.

---

## 2. Recherche: EVE-Mechaniken → Designentscheidungen

Quellen am Ende (Abschnitt 8). Zahlen sind Richtwerte aus EVE und dürfen balanciert werden; die **Struktur** ist verbindlich.

### 2.1 Schiffe
- Klassenleiter: Shuttle → Fregatte → Zerstörer → Kreuzer → Schlachtkreuzer → Schlachtschiff (Capitals bewusst ausgeklammert). Größer = langsamer, größere Signatur, mehr Slots, mehr Leben, größere Waffen.
- Orientierung Slots gesamt (Mittel je Klasse in EVE): Fregatte ≈ 10, Zerstörer ≈ 13, Kreuzer ≈ 14.
- **Slot-Typen sind fest je Rumpf und nicht austauschbar**: High, Mid, Low, Rig. Ein Modul passt nur in seinen Slot-Typ. High-Slots sind zusätzlich durch **Hardpoints** (Turret, Launcher) begrenzt; Mining-Laser belegen Turret-Hardpoints.
- Fitting-Budget: **Powergrid (PG)** und **CPU** begrenzen Module. **Rigs** brauchen **Calibration** (Standard 400, einzelne Rigs ca. 50–200), sind **permanent** (Ausbau zerstört den Rig).
- Typische Rollen: High = Waffen/Miner/Utility, Mid = Propulsion, Schildtank, Elektronik, Low = Panzerung, Schadens-/Ertrags-Mods, Fitting-Mods.
- **Rumpfboni** = pro Skill-Level (z. B. Bergbaufregatte +5 % Ertrag pro Stufe) plus **Rollenboni** (fest, z. B. +100 % Ertrag). Bergbau-Barken: Ertrags-/Haltekapazitäts-/Tank-Spezialisierung.
- Ein Schiff braucht Kommando-Skills (je Klasse/Rumpf), höhere Klassen bauen auf niedrigeren auf.

### 2.2 Skills
- Jeder Skill hat **Rank** (Trainingszeit-Multiplikator), **primäres und sekundäres Attribut**, Stufen 1–5 und Voraussetzungen.
- SP/Minute = **primär + sekundär/2**. Fünf Attribute (Intelligence, Memory, Perception, Willpower, Charisma), Minimum 17, Maximum 27, Summe 99; Start ca. 20 je Attribut. Remap mit langer Abklingzeit.
- Benötigte SP für Stufe L: `250 · Rank · 2^(2,5·(L−1))` → 250 / 1.414 / 8.000 / 45.255 / 256.000 (× Rank).
- Skills schalten Schiffe/Module frei **und** machen sie effizienter (z. B. Mining +5 % Ertrag/Stufe). Training läuft in einer **Queue** weiter, auch offline.

### 2.3 Bergbau & Asteroidenfelder
- Felder (Belts/Anomalien) enthalten **viele Asteroiden unterschiedlicher Erzsorten und Größen**, **endlich**; leere Felder respawnen nach Downtime. Niedrigere Sicherheitsstufe = seltenere, wertvollere Erze und größere Vorkommen.
- Laser-Zyklus (15–60 s), Ertrag je Zyklus in m³ direkt in Frachtraum/**Erzhalle (Ore Hold)**. Ertrag steigt durch Skills (Mining, Astrogeology), Mining-Upgrade-Module (kosten CPU), Schiffsboni, Fleet-Boosts.
- Weitere Mechaniken: Mining-Drohnen, Jetcans (abgeworfene Container), Scannen versteckter Vorkommen in Low/Null, Spezial-Erze mit Zusatz-Skill.

### 2.4 Missionen
- Agenten bieten Missionen in Stufen (EVE: 1–5, hier **1–4**). Empfohlene Schiffe: L1 Fregatte/Zerstörer, L2 Zerstörer/Kreuzer, L3 Kreuzer/Schlachtkreuzer, L4 Schlachtkreuzer/Schlachtschiff.
- Standing-Anforderung: L1 keine, L2 ≥ 1,0, L3 ≥ 3,0, L4 ≥ 5,0.
- Belohnung = ISK + Kopfgelder + Loot/Salvage + Zeitbonus; **je 0,1 niedrigere Sicherheitsstufe des Agenten ca. +10 %**.
- Einkommen/Stunde ungefähr im Verhältnis **1 : 3 : 7,5 : 30+** (L1 : L2 : L3 : L4).

### 2.5 Sonnensystem & Warp
- Man warpt zwischen **Himmelskörpern (Celestials)**: Planeten, Monde, Gürtel, Stationen, Sternentore. Warp-Ziel wird aus einer Liste gewählt. Docking ist nur an Stationen möglich; **in der Station ist man sicher**, Lager/Markt/Fitting/Hangar gibt es nur dort.
- Planeten gelten als relativ sicher, Stationen/Tore sind bei Gefahr oft Lauerorte.

### 2.6 Namensrecht
Alle Namen, Texte, Grafiken und Werte im Projekt sind **eigene Daten** mit EVE als Mechanik-Vorbild. Keine CCP-Assets. Wegen der Datenhaltung in JSON sind Namen jederzeit austauschbar.

---

## 3. Architektur (verbindlich)

### 3.1 Prinzipien
1. **Engine ist DOM-frei und rein datengetrieben.** Alle Spielinhalte (Schiffe, Module, Skills, Erze, Systeme, Missionen, NPCs, Balance) stehen in `data/*.json`. Ein neues Schiff = neuer JSON-Eintrag, kein Code-Edit.
2. **UI mutiert nie den Spielzustand.** UI ruft `game.dispatch(action, payload)` und liest per `game.select(...)`.
3. **Alles Zeitabhängige läuft in Ticks.** 1 Tick = 1 Spielminute (`balance.json → tickSeconds = 60`). Im Prototyp beschleunigbar (`timeScale`). Für Entwicklung/Phase 1 überschreibt das optionale `balance.json → liveTickMs` (derzeit 3000) die Echtzeitdauer eines Ticks bei 1x; die Spiellogik rechnet weiterhin nur in Ticks, `tickSeconds = 60` bleibt Server-Zielgröße.
4. **Server-Portierbarkeit:** Systeme sind reine Funktionen auf JSON-State. Kein `window`, `document`, `localStorage`, `Date.now()` in `js/systems/**` und `js/core/**` (Zeit kommt über `ctx.now`, Zufall über `ctx.rng`).
5. **Ein Agent = ein Verzeichnis.** Siehe Eigentumsmatrix (Abschnitt 4.3 in `docs/MERGE_PROTOCOL.md`).

### 3.2 Technik
- **Vanilla JavaScript (ES2022, ES-Module)**, kein Framework, **kein Build-Schritt**. Läuft über statischen Server (`node tools/serve.mjs`, GitHub Pages geeignet). `fetch` für JSON, daher kein `file://`-Betrieb.
- Typen per **JSDoc** (`js/types.js`), Tests mit **`node --test`** (nur für DOM-freie Module).
- Code-Bezeichner **Englisch**, UI-Texte **Deutsch** (zentral in `data/i18n/de.json`, Schlüssel `bereich.eintrag`, Format `{"schema":1,"strings":{…}}`, Platzhalter `{name}`, Zugriff per `game.t`).
- Stil: 2 Leerzeichen, Semikolons, `const`/`let`, `camelCase` Funktionen, `UPPER_SNAKE` Konstanten, Dateinamen `kebab-case`, keine Default-Exports, keine globalen Variablen.
- Zahlen im UI immer über `fmt()` (`de-DE`). ISK ist **ganzzahlig**.

### 3.3 Verzeichnisstruktur
```
index.html                    App-Shell, nur Lader (A1/A3)
css/tokens.css base.css layout.css components.css   (A3)
css/views/<view>.css          je View eine Datei (Fachagent)
js/core/                      state.js tick.js events.js save.js data-loader.js rng.js registry.js (A1)
js/systems/<name>/index.js    Spiellogik je Domäne, DOM-frei (Fachagent)
js/ui/shell/                  neocom.js topbar.js router.js (A3)
js/ui/components/             wiederverwendbare Widgets (A3)
js/ui/views/<name>/index.js   Ansichten je Domäne (Fachagent)
js/util/                      format.js dom.js math.js (A1)
js/registry.json              vom Lead vorbefüllt (Pfade relativ zu js/), Agenten ändern sie nicht
data/                         manifest.json stats.json balance.json ships.json modules.json
                              skills.json ores.json items.json systems.json missions.json npcs.json
data/ext/<agent>-*.json       Erweiterungen eines Agenten, bis der Lead in die Basisdateien merged
data/i18n/de.json
data/schema/*.schema.json     JSON-Schemas (A2)
assets/ships/*.svg  assets/icons/*.svg
tests/<name>.test.mjs
tools/validate-data.mjs  serve.mjs
docs/                         MASTER_PLAN.md MERGE_PROTOCOL.md handoff/Axx.md
```

### 3.4 Spielzustand (JSON, serialisierbar, `version` Pflicht)
```js
state = {
  version: 1, tick: 0, lastRealTime: 0, seed: 12345, rngState: 0 /* uint32, von ctx.rng genutzt */,
  account: { id, name, isk },                       // Account besitzt ISK und alle Assets
  pilot: {
    attributes: { intelligence, memory, perception, willpower, charisma },
    skills: { 'skill.mining': { sp: 1414, level: 2 } },
    queue: [{ skillId, toLevel }],                  // Training, ein Skill zur Zeit
    standings: { 'corp.xyz': 1.5 },
    location: { systemId, celestialId, dockedStationId },   // dockedStationId != null => sicher
    activeShipUid: 'u1',
    warp: null | { fromId, toId, ticksLeft, ticksTotal }
  },
  assets: {
    ships: [{ uid, typeId, name, stationId /*null = im All*/,
              fitting: { high: [modId|null], mid: [], low: [], rig: [] },
              cargo: { [itemId]: qty }, oreHold: { [oreId]: units },
              damage: { shield, armor, structure } }],
    stations: { [stationId]: { items: { [itemId]: qty } } }      // Item-Hangar je Station
  },
  world: {
    fields: { [fieldId]: { asteroids: [{ id, oreId, initialM3, remainingM3 }], respawnAt } },
    cans: [{ id, systemId, celestialId, items, expiresAt }],
    markets: { [stationId]: { [itemId]: { demand, history: [] } } }
  },
  mining: { sessions: [...] },
  missions: { offers: { [stationId]: [...] }, active: null | { missionId, wave, npcs: [...] } },
  log: [{ tick, text, kind }]
}
```
Jedes System besitzt in `state` **nur seine eigenen Teilbäume**; Lesen fremder Bäume über Selektoren.

### 3.5 System-API (Pflicht für jedes `js/systems/<name>/index.js`)
```js
export const system = {
  id: 'mining',
  init(ctx) {},                                   // nach Laden/Neustart
  onTick(ctx) {},                                 // pro Tick, Reihenfolge: registry.order
  actions: { 'mining/start': (ctx, payload) => ({ ok: true }) },       // Fehler: { ok:false, error:'mining.no_target', message:'…' }
  selectors: { 'mining/field': (state, data, args, select) => ({ … }) }        // nur lesen
};
// ctx = { state, data, rng, now, tick, offline, select(type,args), log(text,kind), emit(type,payload) }
```
Actions heißen `domain/verb`, Events `domain/pastTense`, Fehlercodes `domain.reason`.

UI-API: `game.dispatch(type, payload) → result`, `game.select(type, args)`, `game.on(event, fn) → off()`, `game.data` (read-only), `game.subscribe(fn) → off()` (nach jedem Tick-Block und jeder erfolgreichen Action), `game.hasAction(type)`, `game.hasSelector(type)`, `game.t(key, params)`. Views: `export const view = { id, title, group, order, enabled(game), render(root, game), update(root, game) }`; `update` wird bei jedem Tick und nach Actions aufgerufen. DOM-Aufbau über `h(tag, attrs, ...children)` aus `js/util/dom.js`; Eingabefelder dürfen beim Update **nicht** neu gerendert werden (Fokus bleibt).

### 3.6 Action- und Event-Register (Vertrag)
| Domäne | Actions | Events |
|---|---|---|
| core | `game/new`, `game/save`, `game/reset`, `game/setSpeed` | `core/ticked`, `core/loaded` |
| travel | `travel/warp {celestialId}`, `travel/dock {stationId}`, `travel/undock`, `travel/jump {gateId}` | `travel/warpStarted`, `travel/arrived`, `travel/docked`, `travel/undocked`, `travel/jumped` |
| ships | `ships/buy {typeId, stationId}`, `ships/board {uid}`, `ships/sell {uid}`, `ships/rename {uid,name}` | `ships/boarded`, `ships/destroyed` |
| fitting | `fitting/equip {uid, slot, index, moduleId}`, `fitting/unequip {uid, slot, index}` | `fitting/changed` |
| inventory | `inv/move {from, to, itemId, qty}`, `inv/trash {…}` | `inv/changed` |
| market | `market/sell {itemId, qty}`, `market/buy {itemId, qty}` | `market/sold`, `market/bought` |
| skills | `skills/buy {skillId}`, `skills/queueAdd {skillId, toLevel}`, `skills/queueRemove {index}`, `skills/queueMove {from,to}`, `skills/remap {attributes}` | `skills/completed`, `skills/queueEmpty` |
| mining | `mining/scan {fieldId}`, `mining/target {laser, asteroidId}`, `mining/start`, `mining/stop`, `mining/jettison {oreId, units}` | `mining/cycle`, `mining/asteroidDepleted`, `mining/holdFull`, `mining/fieldRespawned` |
| refine | `refine/run {oreId, units}` | `refine/done` |
| industry | `industry/start {blueprintId}` | `industry/done` |
| missions | `missions/accept {missionId}`, `missions/abandon`, `missions/claim` | `missions/accepted`, `missions/completed`, `missions/failed` |
| combat | `combat/retreat`, `combat/priority {npcId}` | `combat/round`, `combat/npcKilled`, `combat/playerDestroyed` |

Neue Actions/Events nur über Change Request.

### 3.7 Ergänzungen Contract 1.1 (Change Request A1-1, vom Lead angenommen)
1. **Kontext und Selektoren:** `ctx.select(type, args)` liest Selektoren fremder Systeme (statt Direktimporten), `ctx.tick` = `state.tick`, `ctx.offline` ist `true` beim Nachholen, `ctx.log(text, kind)` schreibt ins Protokoll. Selektoren erhalten `select` als 4. Parameter.
2. **Game-API:** `game.subscribe`, `game.hasAction`, `game.hasSelector`, `game.t` (siehe 3.5). Views aktualisieren sich über `game.subscribe`, nicht über `core/ticked`.
3. **Shell-Vertrag (A3):** `js/ui/shell/index.js` exportiert `mount(root: HTMLElement, game, { views, warnings })`. `boot.js` ruft es auf, sobald die Datei existiert, sonst erscheint das Notbehelf-Panel. A3 darf den `<style id="boot-fallback">`-Block in `index.html` entfernen.
4. **Registry:** `js/registry.json` ist vom Lead mit allen bekannten Systemen und Views vorbefüllt (`path` relativ zu `js/`, Reihenfolge = `order`); fehlende Module werden mit Warnung übersprungen. Neue Einträge nur per Change Request.
5. **data/ext:** Browser können Verzeichnisse nicht listen. `tools/serve.mjs` erzeugt `data/ext/index.json` dynamisch; auf GitHub Pages bleibt ext leer. Agenten testen lokal mit `node tools/serve.mjs`, der Lead faltet ext vor jedem Release in die Basisdateien.
6. **Zufall und Zeit:** `state.rngState` hält den Zufallsstrom über Save/Load deterministisch. `ctx.now` ist nur die Echtzeituhr (Infrastruktur); Systeme speichern Zeitpunkte als Ticks (`expiresAt`, `respawnAt`).

---

## 4. Datenverträge (JSON)

Normative Beispiele liegen in `data/examples/*.json`, die Feldkatalog-Liste in `data/stats.json`. A2 liefert daraus die JSON-Schemas.

### 4.1 Konventionen
- **IDs:** `kind.snake_case`: `ship.`, `mod.`, `skill.`, `ore.`, `item.`, `sys.`, `cel.`, `field.`, `msn.`, `npc.`, `corp.`. Einmal vergeben, nie ändern.
- **Einheiten:** Distanz AU, Volumen m³, Zeit Ticks, HP ganzzahlig, Resistenzen als Bruch 0–1, Multiplikatoren als Faktor (+5 % = `1.05`), Preise ISK ganzzahlig.
- Jede Datei: `{ "schema": 1, "entries": [ … ] }`. Unbekannte Felder werden vom Loader mit Warnung ignoriert.
- Texte nur als Schlüssel in `i18n` **oder** direkt in `name`/`description` (Deutsch).

### 4.2 Schiff (`ships.json`)
Pflichtfelder: `id, name, category (mining|combat|industrial), class (frigate|destroyer|cruiser|battlecruiser|battleship|barge|hauler), hull (small|medium|large), tier, slots{high,mid,low,rig}, hardpoints{turret,launcher}, fitting{powergrid,cpu,calibration}, attributes{…stat-ids…}, bonuses[], roleBonuses[], requires{skillId:level}, price, art`.
- `bonuses[]`: `{ skill, stat, op, perLevel, appliesTo? }` (skalieren mit Skill-Stufe)
- `roleBonuses[]`: `{ stat, op, value, appliesTo? }` (fest)
- Kategorien trennen strikt: **Mining-Schiffe** erfüllen keine Kampf-Missionen (`missions.requires.shipCategory`).

### 4.3 Modul (`modules.json`)
Pflichtfelder: `id, name, slot (high|mid|low|rig), group, category (weapon|mining|shield|armor|propulsion|engineering|electronics|scanner|rig), size (small|medium|large), fitting{powergrid,cpu,calibration?}, requires{}, price`.
- Optional `hardpoint` (`turret|launcher`), `activation { kind (mine|attack|repair|boost|scan), cycleTicks, capUse, … }`, `effects[] { stat, op (add|mul|set), value, stackingGroup?, appliesTo? }`, `permanent` (Rigs), `ammo`.

### 4.4 Skill (`skills.json`)
`id, name, group, rank, primary, secondary, maxLevel (5), requires{skillId:level}, price, effects[] { stat, op, perLevel, appliesTo? }, description`.

### 4.5 Erz (`ores.json`), Items (`items.json`)
Erz: `id, name, volumeM3, basePrice, securityBand [min,max], rarity (1–5), refine { batch, outputs{itemId:qty} }, requires{}`. Items: Mineralien, Munition, Skill-Bücher, Loot, Blueprints: `id, name, volumeM3, basePrice, kind`.

### 4.6 Sonnensystem (`systems.json`)
`id, name, security, region, celestials[], fields[]`.
- Celestial: `id, type (star|planet|moon|station|belt|gate|anomaly), name, au (Abstand zum Stern), angleDeg, parent?, subtype?`; Station: `services[] (market|hangar|missions|refinery|industry|shipyard), owner`; Belt/Anomalie: `fieldId`; Gate: `to (sys-id), toGate (cel-id)`.
- Field: `id, kind (belt|anomaly|phased), asteroidCount [min,max], oreWeights{oreId:gewicht}, sizeM3 [min,max], respawnTicks, hidden (bool), scanDifficulty?`.

### 4.7 Missionen & NPCs (`missions.json`, `npcs.json`)
Mission: `id, level (1–4), title, summary, agentCorp, requires { shipCategory:"combat", minClass, maxClass, standing }, waves[ { npcs:[{id,count}] } ], reward { isk [min,max], timeBonusTicks, timeBonusIsk, standing }, loot[]`.
NPC: `id, name, class, structure_hp, armor_hp, shield_hp, res{…}, dps{em,th,kin,exp}, rangeKm, bounty, loot[]`.

### 4.8 Balance (`balance.json`)
Alle Tuning-Zahlen (Tick-Länge, Markt-Gebühr, Respawn, Missions-Skalierung, Startskills, Startgeld). **Keine Zahlen in Code**, die hierhin gehören. Optionale Schlüssel: `liveTickMs`, `speeds` (erlaubte Zeitraffer, Standard `[0,1,5,20]`), `startFitting` (`{high:[…],mid:[…],low:[…],rig:[…]}` für das Starterschiff, `null` = leer).

---

## 5. Spielregeln (verbindliche Formeln)

### 5.1 Fitting-Validierung (Reihenfolge = Fehlercode-Priorität)
1. `fit.not_docked` – Fitting nur in Station, Schiff muss im selben Hangar liegen.
2. `fit.slot_type` – Modul-Slot muss Slot-Typ der Position entsprechen. **High ≠ Mid ≠ Low ≠ Rig, nie vertauschbar.**
3. `fit.slot_occupied`.
4. `fit.size` – Modulgröße = Rumpfgröße.
5. `fit.hardpoints` – Turret/Launcher-Module ≤ Hardpoints (Mining-Laser = Turret).
6. `fit.powergrid`, `fit.cpu` – Summe ≤ Ausgabe des Schiffs (nach Boni).
7. `fit.calibration` – Summe der Rigs ≤ Calibration.
8. `fit.skill` – alle `requires` des Moduls erfüllt.
Zusätzlich: Schiff **einsteigen** erfordert `requires` des Rumpfs (`ships.skill`). Rig-Ausbau **zerstört** den Rig.

### 5.2 Stat-Pipeline (`calcShipStats(ship, pilot, data)`, rein, in `js/systems/fitting`)
1. Basiswerte aus `ship.attributes` und `fitting`.
2. Rumpfboni: `bonuses[]` mit `perLevel × Skill-Stufe`; danach `roleBonuses[]`.
3. Modul-Effekte: erst `add`, dann `set`, dann `mul`.
4. Skill-Effekte mit `appliesTo` (z. B. `{moduleGroup:"mining_laser"}`).
5. **Stacking-Penalty:** `mul`-Effekte derselben `stackingGroup` absteigend nach Stärke sortieren; i-ter Effekt (i = 0…) wirkt mit Gewicht `exp(-(i/2.67)^2)` (≈ 1; 0,87; 0,57; 0,28; 0,11) auf `(m − 1)`. Rumpf- und Skill-Boni werden nie bestraft.
6. Abgeleitet: Gesamt-HP, Resist-Matrix, DPS, Mining-Ertrag/Tick, Kapazitäts-Stabilität, Warp-Dauer, Ausrüstbarkeit (Liste von Fehlercodes).

### 5.3 Skills
- `spForLevel(rank, L) = ceil(250 · rank · 2^(2.5·(L−1)))` (kumulativ).
- Training pro Tick: `spPerTick = primär + sekundär/2` (Pilot-Attribute).
- Queue: bis 50 Einträge, ein Skill gleichzeitig, läuft offline weiter (Nachholen über Tick-Schleife, max. 10.080 Ticks). Voraussetzungen müssen erfüllt **oder früher in der Queue** sein.
- Skill-Buch kaufen (`skill.price`) vor dem ersten Training. Startskills über `balance.json`.
- Skill-Gruppen (Mindestumfang): Raumschiffkommando (je Klasse), Geschütze, Raketen, Bergbau/Industrie, Engineering (PG/CPU), Elektronik, Schilde, Panzerung, Navigation, Handel/Soziales, Wissenschaft (Raffination).
- Skills wirken **doppelt**: Freischaltung (`requires`) und Effizienz (`effects.perLevel`).

### 5.4 Navigation, Docking, Safe-Zone
- Standort: `{ systemId, celestialId, dockedStationId }`. **`dockedStationId != null` ⇒ sicher**: kein Schaden, Zugriff auf Hangar, Markt, Fitting, Missionen, Werft. Im All gibt es **keinen Zugriff auf Stations-Lager**.
- `travel/warp` nur im selben System, nur wenn nicht docked. Dauer: `max(1, ceil(distAU / (warp_speed · warpScale)))` Ticks, Distanz aus Polarkoordinaten (`au`, `angleDeg`). Bei Ankunft ist man „am“ Himmelskörper.
- Station: nach Ankunft `travel/dock` (1 Tick). Danach `docked`. `travel/undock` setzt Position an die Station, **1 Tick Schutz**.
- Gate: Warp zum Tor, `travel/jump` (1 Tick) ins Nachbarsystem am Gegentor.
- Gefahr im All (Piraten): pro Tick `pirateChance(security)` nur an Gürteln/Anomalien/Missionstaschen; steigt mit sinkender Sicherheit. Warp-Ziele Planeten gelten als sicher.

### 5.5 Asteroidenfelder (Mindestumfang v1)
- Feldinstanz: viele Asteroiden `{id, oreId, initialM3, remainingM3}`, Zusammensetzung aus `oreWeights`, gefiltert/gewichtet nach `securityBand`; niedrige Sicherheit ⇒ seltenere Erze, größere Vorkommen (`sizeM3`).
- **Scan:** unbekannte Asteroiden zeigen nur Erzname; `mining/scan` (Survey-Scanner-Modul + Skill) deckt Menge und Reichweite auf. Versteckte Anomalien (`hidden`) erst nach erfolgreichem Scan sichtbar.
- **Ziele & Reichweite:** `max_targets` des Schiffs begrenzt gleichzeitige Ziele; jeder Laser braucht ein Ziel in Reichweite; Zielwechsel außer Reichweite kostet 1 Tick Anflug.
- **Zyklus:** je Laser pro `cycleTicks`: `yield = base · Mods` (Pipeline 5.2), `mined = min(yield, asteroid.remainingM3, holdFree)`, Einheiten `floor(mined / ore.volumeM3)`. Kritischer Treffer (`mining_crit_chance`) verdoppelt den Zyklus.
- **Lagerort:** Erz geht in `oreHold` (nur Erz, große Kapazität) und danach in `cargo`. Voll ⇒ `mining/holdFull`, Laser stoppen.
- **Jetcan:** `mining/jettison` wirft Erz in einen Container im All (Kapazität `balance.jetcan.m3`, Lebensdauer `expiresAt`). Einsammeln nur im selben Feld. Risiko: für Piraten sichtbar.
- **Erschöpfung/Respawn:** leere Asteroiden verschwinden; ist das Feld leer, respawnt es nach `respawnTicks`; ungestörte Felder wachsen über Zeit bis zum Maximum.
- **Raffinerie (Station):** `refine/run`: Batch `ore.refine.batch`, Ausbeute `stationBase · (1 + 0,03·Reprocessing) · (1 + 0,02·RefiningEfficiency) · (1 + 0,02·erzspezifischer Skill)`, Steuer `balance.refine.tax`.
- Stretch v1.1: Mining-Drohnen, Eis, Deep-Core-Erze mit Zusatz-Skill, Fleet-Boosts.

### 5.6 Kampf & Missionen
- Kategorien: `mining`, `combat`, `industrial`. **Missionen erfordern `combat`**; Mining-Schiffe können sie nicht annehmen.
- Level → Klassen: L1 Fregatte/Zerstörer, L2 Zerstörer/Kreuzer, L3 Kreuzer/Schlachtkreuzer, L4 Schlachtkreuzer/Schlachtschiff. Standing: 0 / 1,0 / 3,0 / 5,0.
- Ertragsverhältnis (pro Stunde) **1 : 3 : 7,5 : 30**; Sicherheits-Bonus +10 % je 0,1 unter 1,0 (Station des Agenten). Details in `balance.json`.
- Kampf je Tick: Schaden = `dps · Σ`, Schadenstypen EM/Thermal/Kinetic/Explosive, Anwendung auf Schild → Panzerung → Struktur jeweils mit Resist; Kapazität (Cap) wird von aktiven Modulen verbraucht und lädt nach; NPCs wählen Ziele nach Aggro. Spieler kann `combat/retreat` (Warp, 1 Tick) oder `combat/priority`.
- Mission: Annahme in der Station, Missionstasche als Celestial `anomaly`-Typ, Wellen, Abschluss ⇒ Belohnung (`missions/claim` an der Station). Verlust: Schiff + Ausrüstung zerstört, Pilot erhält Starterschiff, Stations-Lager bleibt sicher.

### 5.7 Markt & ISK
- Währung **ISK** (Ganzzahl). Der **Account** besitzt ISK und alle Assets (Schiffe, Module, Items), verteilt auf Stationen.
- NPC-Markt je Station: Preis = `basePrice · stationFaktor · demand`. Verkauf von `q` Einheiten setzt `demand ← max(0,4; demand · (1 − q/depth))`, Durchschnittspreis über die Preisspanne (Slippage). Erholung 3 %/Tick plus Rauschen. Gebühr `5 % − 1 % · Handel-Stufe`. Preisverlauf (60 Ticks) je Item.
- Schiffs-/Modulkauf bei NPC-Werft zum Festpreis (`price`), nur in Stationen mit `shipyard`.

---

## 6. UI/UX und Grafikstil (verbindlich)

### 6.1 Designsprache
- **Helles Design** (nicht verhandelbar), ruhige blaugraue Flächen, Teal als Akzent, Bernstein für ISK. Referenz: `prototype/eve-tick-v2.html`.
- Tokens (`css/tokens.css`): `--bg #eef2f5`, `--panel #ffffff`, `--ink #16222b`, `--mute #5d6d78`, `--line #d3dce2`, `--acc #1f6f8b`, `--acc2 #e3f0f5`, `--gold #a8700e` (ISK), `--red #b23a3a`, `--ok #2f7d4f`, Karten-Fläche `#f3f7fa`. Slot-Farben: `--slot-high #b23a3a`, `--slot-mid #1f6f8b`, `--slot-low #a8700e`, `--slot-rig #5d6d78`. Sicherheitsfarben: ≥0,8 grün, ≥0,5 bernstein, darunter rot.
- Schrift: System-Stack (`"Segoe UI", system-ui, …`), Größen 13/15/16/20. Radius Karten 8 px, Buttons 6 px. Abstände 6/8/12/14 px. Tabellenzahlen `tabular-nums`.
- Grafik: **flache SVG-Silhouetten**, eine Akzentfarbe, keine Emojis, keine Fremdassets. Jedes Schiff hat eine SVG (`assets/ships/<id>.svg`, viewBox `0 0 100 60`, Triebwerk-Punkt in `--gold`). Icons: 18-px-Inline-SVG, Strichstärke 1,5.
- Komponentenpräfix `.c-`, Modifier `.c-btn--alt`. Keine Inline-Styles außer dynamischen Breiten.

### 6.2 Shell und Navigation (EVE-Neocom, links)
Linke Menüleiste (190 px, auf schmal 52 px Icon-Leiste), Gruppen mit **Untermenüs**, aktive Gruppe klappt auf. Oben Statusleiste: ISK, Tick, Standort, Aktivität, Geschwindigkeit (Pause/1x/5x/20x).
```
Übersicht
Sonnensystem        › Überblick · Systemkarte · Sternkarte
Station (nur docked)› Hangar (Items, Schiffe) · Markt (Verkaufen, Kaufen, Preisverlauf)
                      · Missionen (Verfügbar, Aktiv) · Industrie (Raffinerie, Produktion) · Werft
Fitting
Bergbau             › Asteroidenfeld · Erzhalle
Skills              › Training · Katalog · Attribute
Account             › Vermögen · Protokoll · Einstellungen
```
Nicht verfügbare Einträge sind sichtbar, aber deaktiviert mit Begründung (Tooltip, z. B. „Nur in Stationen“).

### 6.3 Fitting-Fenster (Kernansicht)
- Mitte: Schiffssilhouette, Slots als **Kreisring**: High oben, Mid rechts, Low links, Rigs unten; Slot-Farben nach Typ, leere Slots gestrichelt. Hardpoint-Zähler an High-Slots.
- Rechts: Balken **PG / CPU / Calibration** (rot bei Überschreitung), Dreifach-HP (Schild/Panzerung/Struktur), Resist-Matrix 4×3, Offense (DPS, Mining m³/Tick), Cap, Speed/Warp, Skill-Hinweise.
- Links/unten: **Modul-Browser** mit Tabs je Slot-Typ, Gruppen-Filter, Suche; nicht ausrüstbare Module sichtbar, grau, mit Grund („Skill X Stufe n fehlt“, „PG +4 zu viel“).
- Interaktion: Klick auf Slot öffnet den Browser für diesen Typ; Doppelklick/Drag legt ein; ungültiger Drop zeigt den Fehlercode-Text. Änderungen wirken sofort, die Vorschau zeigt Δ zu vorher.
- Nur bearbeitbar, wenn docked und Schiff im selben Hangar.

### 6.4 Sonnensystem-Ansicht
- **Überblick-Tabelle** (wie EVE-Overview): Icon, Name, Typ, Distanz (AU), Aktion. Gefiltert nach Typ.
- **Systemkarte (SVG):** Stern in der Mitte, Planeten auf Ringen, Stationen (Quadrat), Gürtel (Punktwolke), Tore (Dreieck), Spielerschiff als Marker, laufender Warp als Linie mit Fortschritt.
- Auswahl ⇒ Aktionsleiste: **Warpen**, **Docken**, **Abbauen** (Gürtel), **Springen** (Tor), **Info**. Warp-Status gut sichtbar. „Sicher/Gefahr“-Anzeige nach Standort.

### 6.5 Weitere Ansichten
- **Bergbau:** Liste der Asteroiden (Erz-Icon, Rest-m³, Entfernung, Scan-Status), Laser-Slots mit Zielzuweisung und Zyklusbalken, Erzhallen-Meter, Feld-Restmenge, Warn-Banner bei Piraten.
- **Skills:** Katalog nach Gruppen (Baum), Queue als Zeitleiste mit Rest-ETA, Detail mit Voraussetzungen, Stufen-Kästchen (5), „schaltet frei“-Liste.
- **Hangar:** zwei Reiter Items/Schiffe, Verschieben, Einsteigen, Fitting öffnen, Verkaufen.
- **Missionen:** Agenten-Karten nach Stufe 1–4, Anforderungen (Schiffskategorie, Klasse, Standing) mit Ampel, Belohnung als ISK-Spanne.
- Rückmeldung: **Toasts** für Events (`mining/holdFull`, `skills/completed`, `missions/completed`, …), Bestätigungsdialog bei zerstörenden Aktionen (Rig ausbauen, Schiff verkaufen).

### 6.6 Erste-10-Minuten-Fluss (muss spielbar sein)
Start docked in Station Aldara mit Starter-Bergbaufregatte (Miner vorausgerüstet) → Fitting ansehen → undock → zum Gürtel warpen → scannen & abbauen → Erzhalle voll → zurück zur Station warpen, docken → Erz raffinieren/verkaufen → Skill trainieren → Kampfschiff kaufen/fitten → Mission L1 annehmen.

### 6.7 Barrierefreiheit und Responsive
Fokus sichtbar, Kontrast ≥ 4,5:1, Klickflächen ≥ 40 px, vollständig per Tastatur bedienbar, ab 640 px Breite Icon-Leiste links.

---

## 7. Reihenfolge der Arbeit
Siehe `docs/MERGE_PROTOCOL.md` (Wellen, Abhängigkeiten, Merge-Reihenfolge) und `docs/AGENT_PROMPTS.md` (Aufträge A1–A10).

## 8. Quellen (Recherche, nur zur Einordnung)
EVE University Wiki (Ships, Tech I Role Reference, Fitting Modules and Rigs Guide, Mining, Asteroids and Ore, Missions, Warp Mechanics, Safe Spots, Skills), CCP-Blog „Ship Balancing: Mining Barges“, EVE-Foren-Archiv (Skill-Training-Formel, Attribute), eveuniversity.org/everef.net/evetools (Schiffswerte und Boni der Mining-Schiffe).
