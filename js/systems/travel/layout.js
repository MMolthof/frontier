// Sternkarten-Layout: Systeme werden per Breitensuche ab dem Startsystem entlang der Tor-Richtung (angleDeg) platziert.
// Rein und deterministisch; nur für die Darstellung.

const STEP = 90;

/** @returns {{ [systemId: string]: {x: number, y: number} }} */
export function layoutSystems(data) {
  const start = data.balance?.startSystem ?? Object.keys(data.systems)[0];
  const pos = {};
  if (!start || !data.systems[start]) return pos;
  pos[start] = { x: 0, y: 0 };
  const queue = [start];
  while (queue.length) {
    const id = queue.shift();
    for (const cel of data.systems[id].celestials ?? []) {
      if (cel.type !== 'gate' || !data.systems[cel.to] || pos[cel.to]) continue;
      const a = ((cel.angleDeg ?? 0) * Math.PI) / 180;
      let x = pos[id].x + Math.cos(a) * STEP;
      let y = pos[id].y + Math.sin(a) * STEP;
      // Überlappungen leicht auflösen
      for (let k = 0; k < 6 && Object.values(pos).some((p) => Math.hypot(p.x - x, p.y - y) < 40); k++) { x += 28; y += 20; }
      pos[cel.to] = { x: Math.round(x), y: Math.round(y) };
      queue.push(cel.to);
    }
  }
  return pos;
}
