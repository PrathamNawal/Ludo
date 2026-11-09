// Parivaar Board: asynchronous family Ludo with no server. The whole match is a replayable
// move log carried in the URL hash; each family member adds their move and forwards the link
// (WhatsApp). Each seat's dice come from a seed that lives only on that member's device; its
// SHA-256 commitment travels in the link and the seed is revealed at the end for verification.
import { createState, step, replay, current } from './rules.js';
import { rollAt, commitOf, verifyRolls } from './dice.js';

const b64 = {
  enc(str) {
    const bin = String.fromCharCode(...new TextEncoder().encode(str));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(s) {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
  },
};

export const newRoomId = () => Math.random().toString(36).slice(2, 8);

/** room = {id, tokens, seats:[{c,name,commit}], log:[[roll,tok]], reveals:{seatIdx:seedHex}} */
export function encodeRoom(room) {
  const l = room.log.map(([r, t]) => `${r}${t < 0 ? '-' : t}`).join('');
  const o = { v: 1, i: room.id, t: room.tokens, s: room.seats.map(s => [s.c, s.name, s.commit || '']), l };
  if (room.reveals && Object.keys(room.reveals).length) o.r = room.reveals;
  return b64.enc(JSON.stringify(o));
}

export function decodeRoom(payload) {
  const o = JSON.parse(b64.dec(payload));
  if (!o || o.v !== 1 || !Array.isArray(o.s) || o.s.length < 2 || o.s.length > 4) throw new Error('bad room');
  const log = [];
  for (let i = 0; i < (o.l || '').length; i += 2) {
    const r = +o.l[i], t = o.l[i + 1] === '-' ? -1 : +o.l[i + 1];
    if (!(r >= 1 && r <= 6) || !(t >= -1 && t <= 3)) throw new Error('bad log');
    log.push([r, t]);
  }
  return { id: String(o.i), tokens: o.t === 2 ? 2 : 4, seats: o.s.map(([c, name, commit]) => ({ c, name: String(name).slice(0, 14), commit })), log, reveals: o.r || {} };
}

export const roomConfig = room => ({ colors: room.seats.map(s => s.c), tokens: room.tokens });

/** Replay a room; also count how many rolls each seat has made (their dice index). */
export function roomState(room) {
  const cfg = roomConfig(room);
  const s = createState(cfg);
  const counts = room.seats.map(() => 0);
  for (const [roll, tok] of room.log) {
    counts[s.turn]++;
    step(s, roll, tok < 0 ? null : tok);
  }
  return { state: s, rollCounts: counts };
}

export const seatTurn = room => roomState(room).state.turn;

/** Roll for the seat whose turn it is, using that seat's local seed. */
export async function nextRoll(room, seed) {
  const { state, rollCounts } = roomState(room);
  return rollAt(seed, rollCounts[state.turn]);
}

/** Verify every revealed seat: commitment matches and its recorded rolls match the seed. */
export async function verifyRoom(room) {
  const cfg = roomConfig(room);
  const s = createState(cfg);
  const per = room.seats.map(() => []);
  try {
    for (const [roll, tok] of room.log) { per[s.turn].push(roll); step(s, roll, tok < 0 ? null : tok); }
  } catch (e) {
    // A log that does not replay legally is itself proof of tampering.
    return room.seats.map((_, seat) => ({ seat, revealed: !!room.reveals[seat], rolls: per[seat].length, ok: false, commitOk: false, bad: [], error: 'illegal log' }));
  }
  const out = [];
  for (let i = 0; i < room.seats.length; i++) {
    const seed = room.reveals[i];
    if (!seed) { out.push({ seat: i, revealed: false, rolls: per[i].length }); continue; }
    const r = await verifyRolls(seed, room.seats[i].commit, per[i]);
    out.push({ seat: i, revealed: true, rolls: per[i].length, ...r });
  }
  return out;
}

export { replay, commitOf, current };
