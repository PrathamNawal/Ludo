// Roz ki Chaal: daily solo puzzle. Fully deterministic from the puzzle number, so the whole
// back-catalogue needs no storage and works offline. Every puzzle is generate-and-verify:
// a solver counts the winning move sequences and only accepts puzzles with 1-3 solutions.
import { absCell, SAFE, HOME, START_IDX, LAST_TRACK, legalFor, moveToken } from './rules.js';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TIERS = ['easy', 'medium', 'hard'];
const ROLL_COUNT = [2, 3, 4];

export const EPOCH = Date.UTC(2026, 0, 1);
export function dayNumber(date = new Date()) {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((local - EPOCH) / 86400000) + 1;
}

const cloneToks = t => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, [...v]]));

/** Count all winning choice sequences. Returns {count, first} where first = a winning token list. */
export function solve(puz, limit = 50, from = null) {
  let count = 0, first = null;
  const walk = (toks, i, picks, caps) => {
    if (count >= limit) return;
    if (i === puz.rolls.length) {
      if (isGoalMet(puz, toks, caps)) { count++; if (!first) first = [...picks]; }
      return;
    }
    const roll = puz.rolls[i];
    const legal = legalFor(toks, 0, roll);
    if (!legal.length) { walk(toks, i + 1, [...picks, -1], caps); return; }
    for (const idx of legal) {
      const t = cloneToks(toks);
      const m = moveToken(t, 0, idx, roll);
      walk(t, i + 1, [...picks, idx], caps + m.captured.length);
    }
  };
  if (from) walk(cloneToks(from.toks), from.rollNo, [], from.caps);
  else walk(cloneToks(puz.toks), 0, [], 0);
  return { count, first };
}

export function isGoalMet(puz, toks, captures) {
  if (puz.goal === 'capture') return captures >= 1;
  if (puz.goal === 'capture2') return captures >= 2;
  if (puz.goal === 'home') return toks[0].some(p => p === HOME);
  return false;
}

/** Shared by the UI: play a roll on the puzzle board. Returns the move result or null (skipped). */
export function playRoll(puz, toks, rollNo, tokenIdx) {
  const roll = puz.rolls[rollNo];
  if (tokenIdx < 0) return null;
  return moveToken(toks, 0, tokenIdx, roll);
}

function candidate(rng, tier) {
  const k = ROLL_COUNT[tier];
  const rolls = Array.from({ length: k }, () => 1 + Math.floor(rng() * 6));
  const goals = tier === 0 ? ['capture', 'capture', 'home'] : tier === 1 ? ['capture', 'capture', 'capture2', 'home'] : ['capture', 'capture2', 'capture2', 'home'];
  const goal = goals[Math.floor(rng() * goals.length)];
  const used = new Set();
  const reds = [];
  const placeRed = pos => { if (!used.has(pos) && pos >= 0 && pos < HOME) { used.add(pos); reds.push(pos); return true; } return false; };
  const sums = [];
  for (let m = 1; m < 1 << k; m++) {
    let s = 0; for (let j = 0; j < k; j++) if (m & (1 << j)) s += rolls[j];
    sums.push(s);
  }
  if (goal === 'home') {
    const s = sums[Math.floor(rng() * sums.length)];
    if (s > 30) return null;
    placeRed(HOME - s);
  }
  while (reds.length < 4) placeRed(1 + Math.floor(rng() * 48));
  for (let i = reds.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [reds[i], reds[j]] = [reds[j], reds[i]]; }

  const toks = { 0: reds, 1: [], 2: [], 3: [] };
  const foeCount = goal === 'capture2' ? 2 + Math.floor(rng() * 2) : 1 + Math.floor(rng() * 3);
  const foeCells = new Set();
  for (let f = 0; f < foeCount; f++) {
    const target = reds.filter(p => p <= LAST_TRACK)[Math.floor(rng() * reds.filter(p => p <= LAST_TRACK).length)];
    if (target === undefined) return null;
    const d = sums[Math.floor(rng() * sums.length)];
    const cell = absCell(0, target + d);
    if (target + d > LAST_TRACK || cell < 0 || SAFE.has(cell) || foeCells.has(cell)) continue;
    const color = 1 + Math.floor(rng() * 3);
    const q = (cell - START_IDX[color] + 52) % 52;
    if (q > LAST_TRACK) continue;
    foeCells.add(cell);
    toks[color].push(q);
  }
  const total = toks[1].length + toks[2].length + toks[3].length;
  if (!total || (goal === 'capture2' && total < 2)) return null;
  return { goal, rolls, toks };
}

export function generatePuzzle(n) {
  const tier = (n - 1) % 3;
  const maxSol = tier === 0 ? 3 : tier === 1 ? 2 : 2;
  for (let attempt = 0; attempt < 20000; attempt++) {
    const rng = mulberry32((n * 2654435761 + attempt * 40503) >>> 0);
    const c = candidate(rng, tier);
    if (!c) continue;
    const puz = { n, tier, goal: c.goal, rolls: c.rolls, toks: c.toks };
    const { count, first } = solve(puz);
    if (count >= 1 && count <= maxSol) return { ...puz, solutions: count, hint: first };
  }
  throw new Error('puzzle generation failed for ' + n);
}

export const GOAL_KEY = { capture: 'goal.capture', capture2: 'goal.capture2', home: 'goal.home' };
