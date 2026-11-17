// Gemeinsame JSDoc-Typen (kein Laufzeitcode). Import in anderen Dateien:
//   /** @typedef {import('../types.js').Ctx} Ctx */

/**
 * @typedef {{ok: true, [key: string]: any} | {ok: false, error: string, message: string}} Result
 *   Fehlercodes: "domain.reason" (z. B. "fit.powergrid")
 */

/**
 * @typedef {object} Ctx
 * @property {object} state            Spielzustand (nur eigene Teilbäume ändern)
 * @property {object} data             Spieldaten, read-only (data.ships[id], data.lists.ships, data.balance …)
 * @property {{float: () => number, int: (min: number, max: number) => number, chance: (p: number) => boolean,
 *             pick: <T>(list: T[]) => T, weighted: (weights: Record<string, number>) => string|null,
 *             shuffle: <T>(list: T[]) => T[]}} rng
 * @property {number} now              Echtzeit-Uhr in ms (injiziert; für Spielzeit state.tick verwenden)
 * @property {number} tick             = state.tick
 * @property {boolean} offline         true beim Nachholen verpasster Ticks
 * @property {(type: string, payload?: object) => void} emit
 * @property {(type: string, args?: any) => any} select   Selektoren anderer Systeme lesen
 * @property {(text: string, kind?: string) => void} log  Eintrag in state.log
 */

/**
 * @typedef {object} System
 * @property {string} id
 * @property {(ctx: Ctx) => void} [init]
 * @property {(ctx: Ctx) => void} [onTick]
 * @property {Record<string, (ctx: Ctx, payload: any) => Result|void>} [actions]       "domain/verb"
 * @property {Record<string, (state: object, data: object, args: any, select: Function) => any>} [selectors]
 */

/**
 * @typedef {object} View
 * @property {string} id
 * @property {string} title
 * @property {string} group
 * @property {number} order
 * @property {(game: Game) => boolean|{enabled: boolean, reason?: string}} [enabled]
 * @property {(root: HTMLElement, game: Game) => void} render
 * @property {(root: HTMLElement, game: Game) => void} update
 */

/**
 * @typedef {object} Game
 * @property {object} state                                   read-only verwenden
 * @property {object} data
 * @property {(type: string, payload?: object) => Result} dispatch
 * @property {(type: string, args?: any) => any} select
 * @property {(event: string, fn: (payload: any) => void) => () => void} on
 * @property {(fn: () => void) => () => void} subscribe       nach Ticks und erfolgreichen Actions
 * @property {(key: string, params?: object) => string} t
 * @property {(type: string) => boolean} hasAction
 * @property {(type: string) => boolean} hasSelector
 */

export {};
