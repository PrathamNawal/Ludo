import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACK, HOME_COL, SAFE, START_IDX, createState, step, legalMoves, current, replay, absCell, HOME, cellXY } from '../js/rules.js';
import { chooseMove, PERSONA_KEYS } from '../js/bots.js';
import { mulberry32 } from '../js/puzzle.js';

test('track is a closed loop of 52 unique cells with exactly 4 diagonal corner steps', () => {
  assert.equal(TRACK.length, 52);
  assert.equal(new Set(TRACK.map(c => c.join(','))).size, 52);
  let diagonals = 0;
  for (let i = 0; i < 52; i++) {
    const [a, b] = [TRACK[i], TRACK[(i + 1) % 52]];
    const dx = Math.abs(a[0] - b[0]), dy = Math.abs(a[1] - b[1]);
    assert.ok(Math.max(dx, dy) === 1, `gap at ${i}`);
    if (dx + dy === 2) diagonals++;
  }
  assert.equal(diagonals, 4);
});

test('home columns and safe cells are consistent', () => {
  HOME_COL.forEach(col => assert.equal(col.length, 5));
  for (const s of START_IDX) assert.ok(SAFE.has(s));
  assert.equal(SAFE.size, 8);
  // each colour's entry to its home column is adjacent to the end of its track run
  START_IDX.forEach((s, c) => {
    const last = TRACK[(s + 50) % 52];
    const first = HOME_COL[c][0];
    assert.equal(Math.abs(last[0] - first[0]) + Math.abs(last[1] - first[1]), 1, `colour ${c}`);
  });
});

test('needs a six to leave base; exact roll to finish', () => {
  const s = createState({ colors: [0, 2], tokens: 4 });
  assert.deepEqual(legalMoves(s, 3), []);
  assert.deepEqual(legalMoves(s, 6), [0, 1, 2, 3]);
  s.toks[0][0] = 54;
  assert.deepEqual(legalMoves(s, 3), []);
  assert.deepEqual(legalMoves(s, 2), [0]);
});

test('capture sends opponent home, safe cells protect, extra turn granted', () => {
  const s = createState({ colors: [0, 2], tokens: 4 });
  s.toks[0][0] = 3;               // red abs 3
  s.toks[2][0] = 51 - 26 + 3 + 26 - 26; // placeholder replaced below
  // yellow token whose abs cell is 5 => pos = (5 - 26 + 52) % 52 = 31
  s.toks[2][0] = 31;
  const ev = step(s, 2, 0);
  assert.equal(ev.captured.length, 1);
  assert.equal(s.toks[2][0], -1);
  assert.ok(ev.extra);
  assert.equal(current(s), 0);
  // safe cell: abs 8
  s.toks[0][0] = 6; s.toks[2][0] = (8 - 26 + 52) % 52;
  const ev2 = step(s, 2, 0);
  assert.equal(ev2.captured.length, 0);
  assert.equal(current(s), 2);
});

test('third consecutive six forfeits the turn', () => {
  const s = createState({ colors: [0, 2], tokens: 4 });
  step(s, 6, 0); step(s, 6, 1);
  const ev = step(s, 6, null);
  assert.ok(ev.forfeit);
  assert.equal(current(s), 2);
});

test('replay reproduces state exactly', () => {
  const rnd = mulberry32(7);
  const s = createState({ colors: [0, 1, 2, 3], tokens: 4 });
  for (let i = 0; i < 300 && s.winner === null; i++) {
    const roll = 1 + Math.floor(rnd() * 6);
    const legal = legalMoves(s, roll);
    step(s, roll, legal.length ? legal[Math.floor(rnd() * legal.length)] : null);
  }
  const r = replay({ colors: [0, 1, 2, 3], tokens: 4 }, s.log);
  assert.deepEqual(r.toks, s.toks);
  assert.equal(r.turn, s.turn);
});

test('1500 random bot games terminate with sane invariants', () => {
  let finished = 0;
  for (let g = 0; g < 1500; g++) {
    const rnd = mulberry32(1000 + g);
    const colors = g % 3 === 0 ? [0, 2] : [0, 1, 2, 3];
    const tokens = g % 2 ? 2 : 4;
    const s = createState({ colors, tokens });
    const personas = Object.fromEntries(colors.map((c, i) => [c, PERSONA_KEYS[(i + g) % 4]]));
    let n = 0;
    while (s.winner === null && n++ < 20000) {
      const roll = 1 + Math.floor(rnd() * 6);
      const legal = legalMoves(s, roll);
      const tok = legal.length ? chooseMove(s, roll, legal, personas[current(s)], rnd) : null;
      step(s, roll, tok);
      for (const c of colors) for (const p of s.toks[c]) assert.ok(p >= -1 && p <= HOME);
      // no two different colours may share a non-safe track cell
      const seen = new Map();
      for (const c of colors) for (const p of s.toks[c]) {
        const a = absCell(c, p);
        if (a < 0 || SAFE.has(a)) continue;
        assert.ok(!seen.has(a) || seen.get(a) === c, `colour clash at ${a}`);
        seen.set(a, c);
      }
    }
    if (s.winner !== null) finished++;
  }
  assert.equal(finished, 1500);
});

test('every position has board coordinates inside the 15x15 grid', () => {
  for (let c = 0; c < 4; c++) for (let p = -1; p <= HOME; p++) for (let i = 0; i < 4; i++) {
    const [x, y] = cellXY(c, p, i);
    assert.ok(x >= 0 && x <= 15 && y >= 0 && y <= 15);
  }
});
