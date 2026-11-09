// Provably fair dice.
//   seed   = 256 random bits, generated on-device before the first roll
//   commit = SHA-256(seed), shown to everyone BEFORE rolling
//   roll i = HMAC-SHA256(seed, "ludo-adda:v1:" + i), mapped to 1..6 without modulo bias
// After the match the seed is revealed and anyone can recompute every roll.
const enc = new TextEncoder();
const subtle = () => (globalThis.crypto && globalThis.crypto.subtle);

export const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
export const fromHex = hex => new Uint8Array(hex.match(/../g).map(h => parseInt(h, 16)));

export function newSeed() {
  const b = new Uint8Array(32);
  globalThis.crypto.getRandomValues(b);
  return toHex(b);
}

export async function sha256Hex(text) {
  return toHex(await subtle().digest('SHA-256', enc.encode(text)));
}
export const commitOf = seed => sha256Hex(seed);

export async function rollAt(seedHex, i) {
  const key = await subtle().importKey('raw', fromHex(seedHex), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  for (let ctr = 0; ctr < 64; ctr++) {
    const mac = new Uint8Array(await subtle().sign('HMAC', key, enc.encode(`ludo-adda:v1:${i}:${ctr}`)));
    for (const b of mac) if (b < 252) return (b % 6) + 1; // 252 = 6*42, rejects the biased tail
  }
  throw new Error('unreachable');
}

/** Check a revealed seed against its commitment and the rolls that were played. */
export async function verifyRolls(seedHex, commit, rolls, offset = 0) {
  const commitOk = (await commitOf(seedHex)) === commit;
  const bad = [];
  for (let i = 0; i < rolls.length; i++) {
    if ((await rollAt(seedHex, offset + i)) !== rolls[i]) bad.push(i);
  }
  return { ok: commitOk && bad.length === 0, commitOk, checked: rolls.length, bad };
}

export function faceStats(rolls) {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const r of rolls) counts[r - 1]++;
  return { counts, total: rolls.length, expected: rolls.length / 6 };
}
