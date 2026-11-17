// Platzhalter-System: zählt Ticks, damit die Schleife testbar ist. Der Lead entfernt es,
// sobald echte Systeme gemerged sind (Registry-Zeile löschen).

export const system = {
  id: 'core-demo',
  init(ctx) {
    ctx.state.demo ??= { ticks: 0 };
  },
  onTick(ctx) {
    ctx.state.demo.ticks += 1;
  },
  actions: {
    'demo/ping': () => ({ ok: true, pong: true }),
    'demo/fail': () => ({ ok: false, error: 'demo.always_fails', message: 'Absichtlicher Testfehler.' })
  },
  selectors: {
    'demo/ticks': (state) => state.demo?.ticks ?? 0
  }
};
