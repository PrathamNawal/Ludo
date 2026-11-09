import test from 'node:test';
import assert from 'node:assert/strict';
import { newSeed, rollAt, commitOf, verifyRolls, faceStats } from '../js/dice.js';

test('rolls are deterministic per (seed, index) and in 1..6', async () => {
  const seed = newSeed();
  const a = await rollAt(seed, 5), b = await rollAt(seed, 5);
  assert.equal(a, b);
  assert.ok(a >= 1 && a <= 6);
});

test('distribution is uniform (chi-square, 6000 rolls)', async () => {
  const seed = newSeed();
  const rolls = [];
  for (let i = 0; i < 6000; i++) rolls.push(await rollAt(seed, i));
  const { counts, expected } = faceStats(rolls);
  const chi = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
  assert.ok(chi < 20.5, `chi-square ${chi} (df=5, p=0.001 cutoff 20.5)`); // very loose, avoids flakiness
});

test('commit/reveal verification catches tampering', async () => {
  const seed = newSeed();
  const commit = await commitOf(seed);
  const rolls = [];
  for (let i = 0; i < 50; i++) rolls.push(await rollAt(seed, i));
  assert.equal((await verifyRolls(seed, commit, rolls)).ok, true);
  const bad = [...rolls]; bad[10] = (bad[10] % 6) + 1;
  const r = await verifyRolls(seed, commit, bad);
  assert.equal(r.ok, false); assert.deepEqual(r.bad, [10]);
  assert.equal((await verifyRolls(newSeed(), commit, rolls)).commitOk, false);
});
