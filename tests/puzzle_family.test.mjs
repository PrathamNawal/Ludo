import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePuzzle, solve, dayNumber } from '../site/js/puzzle.js';
import { encodeRoom, decodeRoom, roomState, nextRoll, verifyRoom } from '../site/js/family.js';
import { newSeed, commitOf, rollAt } from '../site/js/dice.js';
import { step, legalMoves, current } from '../site/js/rules.js';

test('puzzles 1..600 are generated, solvable, and have 1-3 solutions', () => {
  const t0 = Date.now();
  for (let n = 1; n <= 600; n++) {
    const p = generatePuzzle(n);
    const { count, first } = solve(p);
    assert.ok(count >= 1 && count <= 3, `#${n} has ${count} solutions`);
    assert.equal(first.length, p.rolls.length);
    assert.deepEqual(generatePuzzle(n).rolls, p.rolls, 'deterministic');
  }
  console.log(`  generated 600 puzzles in ${Date.now() - t0} ms`);
});

test('day numbering starts at 1 on 2026-01-01', () => {
  assert.equal(dayNumber(new Date(2026, 0, 1)), 1);
  assert.equal(dayNumber(new Date(2026, 10, 9)), 313);
});

test('family room round-trips through the URL encoding, replays and verifies', async () => {
  const seeds = [newSeed(), newSeed()];
  const room = { id: 'abc123', tokens: 4, seats: [], log: [], reveals: {} };
  for (let i = 0; i < 2; i++) room.seats.push({ c: i * 2, name: ['Papa', 'दादी'][i], commit: await commitOf(seeds[i]) });
  for (let t = 0; t < 120; t++) {
    const { state } = roomState(room);
    if (state.winner !== null) break;
    const roll = await nextRoll(room, seeds[state.turn]);
    const legal = legalMoves(state, roll);
    room.log.push([roll, legal.length ? legal[legal.length - 1] : -1]);
  }
  room.reveals = { 0: seeds[0], 1: seeds[1] };
  const back = decodeRoom(encodeRoom(room));
  assert.deepEqual(back.log, room.log);
  assert.equal(back.seats[1].name, 'दादी');
  assert.deepEqual(roomState(back).state.toks, roomState(room).state.toks);
  const v = await verifyRoom(back);
  assert.ok(v.every(x => x.revealed && x.ok), JSON.stringify(v));
  // tamper: change one logged roll
  back.log[0][0] = (back.log[0][0] % 6) + 1;
  const bad = await verifyRoom(back);
  assert.ok(bad.some(x => !x.ok));
});

test('decodeRoom rejects garbage', () => {
  assert.throws(() => decodeRoom('not-base64!!'));
  assert.throws(() => decodeRoom('e30'));
});

test('i18n: every key has all three languages and commentary is complete', async () => {
  const { _tables } = await import('../site/js/i18n.js');
  for (const [k, v] of Object.entries(_tables.S)) for (const l of ['en', 'hi', 'hg']) assert.ok(v[l] && v[l].length, `${k}.${l}`);
  for (const [k, v] of Object.entries(_tables.C)) for (const l of ['en', 'hi', 'hg']) assert.ok(Array.isArray(v[l]) && v[l].length >= 2, `${k}.${l}`);
  // placeholders must match across languages so no translation drops a variable
  const ph = s => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const [k, v] of Object.entries(_tables.S)) assert.equal(ph(v.hi), ph(v.en), k), assert.equal(ph(v.hg), ph(v.en), k);
});
