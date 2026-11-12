# Tick Frontier – Agent Kit
1. Lege diese Struktur als Git-Repo an (Branch `main`, Integrationsbranch `integration`).
2. Welle 1 starten: A1, A2, A3 aus `docs/AGENT_PROMPTS.md` (Kontext-Block 8.0 + Auftrag), parallel in getrennten Sitzungen. Jeder Agent bekommt Zugriff auf `docs/`, `data/`, `prototype/`.
3. Handoffs sammeln, dem Lead (Claude) zum Mergen übergeben (`docs/MERGE_PROTOCOL.md`). Danach Welle 2, dann Welle 3.
Dateien: `docs/MASTER_PLAN.md` (verbindlich), `docs/AGENT_PROMPTS.md`, `docs/MERGE_PROTOCOL.md`, `data/examples/` (normative Beispiele), `data/stats.json`, `data/balance.json`, `prototype/` (Look & Feel).

## GitHub Pages
Pages mit Quelle `main` / Root. Die Datei `.nojekyll` verhindert, dass Jekyll die Seite verarbeitet (sonst können Build-Fehler die Auslieferung blockieren). Startfehler erscheinen als rote Box unter der Seite.
