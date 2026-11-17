# Iterationen – jeder Stand ist spielbar

**Prinzip (ab 13.11.2026):** Der Prototyp `prototype/eve-tick-v2.html` ist der Maßstab für Spielgefühl und Look. Wir bauen in **Iterationen als vertikale Schnitte**: Jede Iteration liefert etwas, das du auf GitHub Pages sofort spielen kannst, mit grünen Tests und einem automatisierten Spielablauf-Test (`tests/iterationN.test.mjs`). Der Lead baut die Schnitte direkt im Repo; Agenten bekommen nur klar abgegrenzte Aufgaben (Daten, Grafik, Balancing, QA), die in eine Iteration einfließen.

**Design:** helle blaugraue Flächen, Teal-Akzent, Bernstein für ISK, Neocom-Menü links mit Untermenüs, Karten mit Rand und 8 px Radius, flache SVG-Schiffe. Alle Farben nur über `css/tokens.css`.

## Roadmap
| Iteration | Spielbar danach | Inhalt |
|---|---|---|
| **I1 (fertig)** | Bergbau-Schleife | Start in der Station, abdocken, im Sonnensystem warpen (Überblick, Orbitkarte, Sternkarte), Tor-Sprung, Asteroidenfeld mit mehreren Erzen und Laser-Zielen, Erzhalle, andocken, Lager, Markt mit Preisdruck und Verlauf, Raffinerie |
| **I2 (fertig)** | EVE-näheres Spielgefühl und Fortschritt | Starterschiff mit Zivilier-Modulen, Schiffs-HUD, Stations-Hub, Overview mit „Selected Item“, Zielleiste, optional dunkles Design, Fitting-Fenster, Modul-Shop, Werft, Schiffswechsel, Skills |
| **I3** | Kampf und Missionen | Agenten, Missionen Stufe 1, Kampfschiffe, NPC-Piraten (Gefahr in Low-Sec-Gürteln), Belohnung, Schiffsverlust |
| **I4** | Tiefe im Bergbau und Industrie | Scannen und versteckte Anomalien, Jetcans, Drohnen, Produktion mit Blaupausen, Handel zwischen Stationen |
| **I5** | Feinschliff | Missionsstufen 2–4, Balancing, Tutorial-Führung, Speicher-Export/Import, Barrierefreiheit-Check |

## Abnahme je Iteration (Definition of Done)
1. `node --test` grün, `node tools/validate-data.mjs` grün.
2. Ein Spielablauf-Test deckt die neue Schleife ab (z. B. `tests/iteration1.test.mjs`).
3. Alle Ansichten rendern ohne Fehler (Smoke-Test mit simuliertem Browser).
4. Auf GitHub Pages spielbar; Anleitung „So spielst du“ in diesem Dokument.
5. Bekannte Lücken ehrlich im Changelog.

## So spielst du Iteration 1
1. Seite öffnen: **Übersicht** zeigt Schiff, Standort und Anleitung. Oben rechts Geschwindigkeit **20x** oder **60x** wählen (1x ist sehr gemütlich).
2. **Sonnensystem → Überblick**: **Abdocken**.
3. In der Tabelle bei „Aldara – Gürtel 1“ **Warpen** klicken, kurz warten, bis du angekommen bist.
4. **Bergbau → Asteroidenfeld**: **Abbau starten** (oder gezielt „Alle Laser“ / L1, L2 pro Asteroid).
5. Zurück: **Sonnensystem**, bei der Station **Warpen**, dann **Andocken**.
6. **Hangar → Items**: **Alles entladen**. **Markt → Verkaufen**: Menge eintragen oder leer lassen (alles) und verkaufen; beobachte, wie der Preis fällt und sich erholt (**Preisverlauf**).
7. **Industrie → Raffinerie**: Erz zu Mineralien machen.
8. Weitere Systeme: im Überblick zum **Sternentor** warpen und **Springen**. Niedrigere Sicherheit bringt andere Erze.

## Bekannte Lücken in I1
Piraten, Scannen, Skills, Schiffskauf und Fitting-Fenster fehlen noch (siehe Roadmap). Die Menüeinträge dafür sind sichtbar, aber deaktiviert („Ansicht noch nicht verfügbar“).

## So spielst du Iteration 2
1. **Start:** Du bist in Aldara angedockt. Das **Stations-Hub** zeigt die Dienste. Oben unter der Statusleiste erscheint die **Zielleiste** mit dem nächsten Schritt und einem Knopf.
2. **Abdocken:** Danach landest du in der Systemübersicht. Links die **Overview** (Klick wählt, Doppelklick warpt), rechts „Ausgewähltes Objekt“ und die Orbitkarte.
3. **Schiffs-HUD** (unten, nur im All): Ringe für Schild, Panzerung und Struktur, darunter deine Module. Im Gürtel startest du den Bergbau, indem du den **Laser im HUD anklickst**. Der Zivilier-Laser ist langsam, aber er genügt für den Anfang.
4. **Verkaufen:** Zur Station warpen, andocken, Hangar → Alles entladen, Markt → Verkaufen.
5. **Besser werden:** Markt → **Kaufen** (Module), Fitting → Slot wählen → **Ersetzen**. Werft: größere Schiffe kaufen (Skills nötig). Hangar → Schiffe: umsteigen.
6. **Skills:** Skills → Training. Das Training läuft auch im All weiter.
7. **Design:** Oben „Dunkles Design“ schaltet auf die dunkle, EVE-nahe Optik um. Hell bleibt der Standard.

## Bekannte Lücken in I2
Kampf, Missionen und Piraten fehlen (I3). Das Geschütz am Starterschiff hat noch keine Wirkung. Attribute lassen sich noch nicht neu verteilen. Produktion und Scannen folgen in I4.

## Nachtrag zu I2 (Korrekturen vom 16.11.2026)
- **Starterschiff leer:** Alte Spielstände im Browser wurden nie neu ausgerüstet. Beim Laden bekommt ein komplett leeres Starterschiff jetzt einmalig die Zivilier-Module. Fehlen dir Bergbaulaser oder Waffe ganz, gibt dir die Station kostenlosen Ersatz (Zielleiste: „Ausrüstung holen“). Wer es selbst neu starten will: Konto → Protokoll → „Neu starten“.
- **Handel:** Module und Items aus dem Stationslager lassen sich am Markt verkaufen (fester Rückkaufpreis 50 % bei Modulen, 70 % bei Beute und Munition). Zivilier-Module und Skillbücher haben keinen Handelswert. Unter „Kaufen“ gibt es jetzt auch Mineralien und Munition.
- **Industrie:** Neue Produktion: Module aus Mineralien herstellen (Skill Industrie Stufe 1, ein Fabrik-Platz, mehr mit höherem Skill). Das Ergebnis liegt im Stationslager, kann eingebaut oder verkauft werden. Kreislauf: abbauen, raffinieren oder Mineralien kaufen, herstellen, verkaufen.

## Designentscheidungen vom 17.11.2026 (Cap, Expeditionen, Starterschiff)

**Cap (Energiespeicher), geplant für I3**
- Der Cap gehört zum Piloten und wird in Prozent gespeichert; Schiffswechsel füllt ihn nicht auf. Die Schiffsgröße bestimmt nur, wie viel Prozent eine Aktion kostet (große Schiffe: mehr Aktionen je volle Leiste).
- Aufladen über feste Echtzeit (auch offline), nicht kaufbar.
- Leerer Cap = Notbetrieb („Civilian Mode“): nur Zivilier-Module laufen. Markt, Produktion, Skills und Expeditionen brauchen keinen Cap.
- Anzeige: Cap gelb; bei leerem Cap ausgegraut mit roter Schrift „Civilian Mode“. Der Unterschied zwischen Notbetrieb und vollem Cap mit richtigen Modulen muss deutlich spürbar sein.
- Offen: Warp-/Sprungkosten bei leerem Cap (Hauler-Missbrauch), Dummy-Accounts erst bei Mehrspieler relevant.

**Expeditionen (I4):** fiktiv, vom Spieler beauftragt, Rückkehr zur Station nach Wartezeit, nie für andere sichtbar, kein Zweitschiff.

**Blaupausen / Forschung (Platzhalter, I4):** lange Echtzeit-Aufträge ohne Cap.

**Starterschiff:** heißt jetzt „Wayfarer“ (Untertitel „Starterschiff“), drei Turret-Plätze.

## So spielst du Iteration 3a (Cap / Civilian Mode)
1. Neues Spiel (oder altes Spiel laden): in der Übersicht steht unter dem Schiff „Energie 100 %“.
2. Kaufe im Markt einen **Bergbaulaser I** (braucht Skill Bergbau 1) und baue ihn im Fitting in den dritten High-Slot ein. Der Zivilier-Laser bleibt drin.
3. Abdocken, zum Gürtel warpen (kostet ca. 2,5 % Energie), „Abbau starten“. Der Energie-Balken im HUD (gelb) sinkt.
4. Bei 0 % erscheint rot **„Civilian Mode“**: der Balken wird grau, der Laser I ist ausgegraut, nur der Zivilier-Laser arbeitet. Warp geht nur noch zu Stationen (Notflug), Tor-Sprünge sind gesperrt.
5. Zurück zur Station: angedockt lädt der Speicher doppelt so schnell auf. Ab 25 % gilt wieder volle Leistung.
Werte (`data/balance.json › cap`): Aufladen 0,02 %/Tick (voll nach ca. 5.000 Ticks), Warp 8 Einheiten, Sprung 12 Einheiten, Bergbaulaser I 1 Einheit je Zyklus.
