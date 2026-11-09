// Ludo rules engine. Pure and deterministic: no DOM, no randomness.
// The board model is the single source of truth; the UI only renders it.
//
// Token position model (per colour, relative to that colour's start):
//   -1        in base
//   0..50     on the shared 52-cell track (0 = own start cell)
//   51..55    in own home column
//   56        finished (centre)

export const COLORS = ['red', 'green', 'yellow', 'blue'];
export const START_IDX = [0, 13, 26, 39];
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export const HOME = 56;
export const LAST_TRACK = 50;

// 52 track cells on a 15x15 grid as [col,row], clockwise from Red's start.
export const TRACK = (() => {
  const t = [];
  const p = (c, r) => t.push([c, r]);
  for (let c = 1; c <= 5; c++) p(c, 6);
  for (let r = 5; r >= 0; r--) p(6, r);
  p(7, 0); p(8, 0);
  for (let r = 1; r <= 5; r++) p(8, r);
  for (let c = 9; c <= 14; c++) p(c, 6);
  p(14, 7); p(14, 8);
  for (let c = 13; c >= 9; c--) p(c, 8);
  for (let r = 9; r <= 14; r++) p(8, r);
  p(7, 14); p(6, 14);
  for (let r = 13; r >= 9; r--) p(6, r);
  for (let c = 5; c >= 0; c--) p(c, 8);
  p(0, 7); p(0, 6);
  return t;
})();

export const HOME_COL = [
  [1, 2, 3, 4, 5].map(c => [c, 7]),
  [1, 2, 3, 4, 5].map(r => [7, r]),
  [13, 12, 11, 10, 9].map(c => [c, 7]),
  [13, 12, 11, 10, 9].map(r => [7, r]),
];

const BASE_OFF = [[0, 0], [9, 0], [9, 9], [0, 9]];
const SLOT = [[2, 2], [4, 2], [2, 4], [4, 4]];
const FIN = [[6.85, 7.5], [7.5, 6.85], [8.15, 7.5], [7.5, 8.15]];

/** Centre coordinates (in 15x15 board units) of a token. */
export function cellXY(color, pos, idx = 0) {
  if (pos === -1) {
    const [bx, by] = BASE_OFF[color];
    const [sx, sy] = SLOT[idx];
    return [bx + sx, by + sy];
  }
  if (pos === HOME) {
    const [x, y] = FIN[color];
    const spread = (idx - 1.5) * 0.14;
    return color % 2 === 0 ? [x, y + spread] : [x + spread, y];
  }
  if (pos <= LAST_TRACK) {
    const [c, r] = TRACK[(START_IDX[color] + pos) % 52];
    return [c + 0.5, r + 0.5];
  }
  const [c, r] = HOME_COL[color][pos - 51];
  return [c + 0.5, r + 0.5];
}

export function absCell(color, pos) {
  return pos >= 0 && pos <= LAST_TRACK ? (START_IDX[color] + pos) % 52 : -1;
}

export function createState({ colors, tokens = 4 }) {
  const toks = {};
  for (const c of colors) toks[c] = Array(tokens).fill(-1);
  return { colors: [...colors], n: tokens, toks, turn: 0, sixes: 0, winner: null, log: [] };
}

export const current = s => s.colors[s.turn];

export function legalFor(toks, color, roll) {
  const res = [];
  toks[color].forEach((p, i) => {
    if (p === -1) { if (roll === 6) res.push(i); }
    else if (p < HOME && p + roll <= HOME) res.push(i);
  });
  return res;
}
export const legalMoves = (s, roll) => legalFor(s.toks, current(s), roll);

/** Apply a legal move to a bare tokens object. Returns what happened. */
export function moveToken(toks, color, idx, roll) {
  const from = toks[color][idx];
  const to = from === -1 ? 0 : from + roll;
  toks[color][idx] = to;
  const captured = [];
  if (to <= LAST_TRACK) {
    const ac = absCell(color, to);
    if (!SAFE.has(ac)) {
      for (const k of Object.keys(toks)) {
        const o = +k;
        if (o === color) continue;
        toks[o].forEach((q, i) => {
          if (q >= 0 && q <= LAST_TRACK && absCell(o, q) === ac) {
            toks[o][i] = -1;
            captured.push({ color: o, idx: i });
          }
        });
      }
    }
  }
  const path = [];
  if (from === -1) path.push(0);
  else for (let p = from + 1; p <= to; p++) path.push(p);
  return { from, to, path, captured, home: to === HOME };
}

/**
 * Play one roll. tokenIdx = null when there is no legal move or the roll is forfeited.
 * Mutates state, appends [roll, tokenIdx|-1] to state.log, returns an event for the UI.
 */
export function step(s, roll, tokenIdx) {
  const color = current(s);
  const ev = { color, roll, token: null, from: null, to: null, path: [], captured: [],
    home: false, extra: false, forfeit: false, pass: false, win: false, next: color };
  if (s.winner !== null) throw new Error('game over');
  if (roll === 6 && s.sixes === 2) {
    ev.forfeit = true; s.sixes = 0; s.turn = (s.turn + 1) % s.colors.length;
    ev.next = current(s); s.log.push([roll, -1]); return ev;
  }
  const legal = legalMoves(s, roll);
  if (tokenIdx === null || tokenIdx === undefined || tokenIdx < 0) {
    if (legal.length) throw new Error('a legal move exists');
    ev.pass = true; s.sixes = 0; s.turn = (s.turn + 1) % s.colors.length;
    ev.next = current(s); s.log.push([roll, -1]); return ev;
  }
  if (!legal.includes(tokenIdx)) throw new Error('illegal move');
  const m = moveToken(s.toks, color, tokenIdx, roll);
  Object.assign(ev, { token: tokenIdx, from: m.from, to: m.to, path: m.path, captured: m.captured, home: m.home });
  s.log.push([roll, tokenIdx]);
  if (s.toks[color].every(p => p === HOME)) {
    s.winner = color; ev.win = true; ev.next = color; return ev;
  }
  ev.extra = roll === 6 || m.captured.length > 0 || m.home;
  s.sixes = roll === 6 ? s.sixes + 1 : 0;
  if (!ev.extra) { s.sixes = 0; s.turn = (s.turn + 1) % s.colors.length; }
  ev.next = current(s);
  return ev;
}

/** Rebuild a match from its config and log. Used for resume, family links and verification. */
export function replay(cfg, log) {
  const s = createState(cfg);
  for (const [roll, tok] of log) step(s, roll, tok < 0 ? null : tok);
  return s;
}

export const progress = (s, color) => s.toks[color].reduce((a, p) => a + p + 1, 0);
export const homeCount = (s, color) => s.toks[color].filter(p => p === HOME).length;
export const standings = s => [...s.colors].sort((a, b) => progress(s, b) - progress(s, a));
