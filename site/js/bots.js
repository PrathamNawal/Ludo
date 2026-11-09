// Bot personalities: utility scoring (game-ai skill). Each candidate move is scored on
// weighted features; personalities differ only by weights. Pure; takes an rng for noise.
import { absCell, SAFE, HOME, LAST_TRACK, current } from './rules.js';

export const PERSONAS = {
  dadi:      { emoji: '👵', w: { capture: 2.0, danger: 3.4, safeLand: 1.6, leave: 2.0, home: 5, progress: 0.05, escape: 2.6, chase: 0.0, noise: 0.25 } },
  bunty:     { emoji: '😎', w: { capture: 6.0, danger: 0.5, safeLand: 0.3, leave: 2.6, home: 3, progress: 0.10, escape: 0.4, chase: 0.8, noise: 0.50 } },
  professor: { emoji: '🧐', w: { capture: 4.5, danger: 2.6, safeLand: 1.1, leave: 2.2, home: 4.5, progress: 0.10, escape: 2.0, chase: 0.4, noise: 0.05 } },
  chhotu:    { emoji: '🧒', mistake: 0.45, w: { capture: 3.0, danger: 0.4, safeLand: 0.5, leave: 2.0, home: 3, progress: 0.10, escape: 0.3, chase: 0.2, noise: 1.5 } },
};
export const PERSONA_KEYS = Object.keys(PERSONAS);

// How many opponent tokens could hit `cell` with a single roll of 1..6.
function threats(s, color, cell) {
  let n = 0;
  for (const o of s.colors) {
    if (o === color) continue;
    for (const q of s.toks[o]) {
      if (q < 0 || q > LAST_TRACK) continue;
      const d = (cell - absCell(o, q) + 52) % 52;
      if (d >= 1 && d <= 6 && q + d <= LAST_TRACK) n++;
    }
  }
  return n;
}

function chaseValue(s, color, cell) {
  let n = 0;
  for (const o of s.colors) {
    if (o === color) continue;
    for (const q of s.toks[o]) {
      if (q < 0 || q > LAST_TRACK) continue;
      const a = absCell(o, q);
      const d = (a - cell + 52) % 52;
      if (d >= 1 && d <= 6 && !SAFE.has(a)) n++;
    }
  }
  return n;
}

export function scoreMove(s, roll, idx, w, rnd = Math.random) {
  const c = current(s);
  const p = s.toks[c][idx];
  const to = p === -1 ? 0 : p + roll;
  let score = 0;
  if (to <= LAST_TRACK) {
    const ac = absCell(c, to);
    if (!SAFE.has(ac)) {
      for (const o of s.colors) {
        if (o === c) continue;
        for (const q of s.toks[o]) {
          if (q >= 0 && q <= LAST_TRACK && absCell(o, q) === ac) score += w.capture * (1 + q / 50);
        }
      }
    }
  }
  if (to === HOME) score += w.home;
  if (p === -1) score += w.leave;
  score += w.progress * roll;
  const before = p >= 0 && p <= LAST_TRACK && !SAFE.has(absCell(c, p)) ? threats(s, c, absCell(c, p)) : 0;
  let after = 0;
  if (to <= LAST_TRACK) {
    const ac = absCell(c, to);
    if (SAFE.has(ac)) score += w.safeLand;
    else { after = threats(s, c, ac); score += w.chase * chaseValue(s, c, ac); }
  } else score += w.safeLand;
  if (before > 0 && after === 0) score += w.escape;
  score -= w.danger * after;
  return score + w.noise * rnd();
}

export function chooseMove(s, roll, legal, persona = 'professor', rnd = Math.random) {
  if (legal.length === 1) return legal[0];
  const P = PERSONAS[persona] || PERSONAS.professor;
  if (P.mistake && rnd() < P.mistake) return legal[Math.floor(rnd() * legal.length)];
  let best = legal[0], bestScore = -Infinity;
  for (const idx of legal) {
    const sc = scoreMove(s, roll, idx, P.w, rnd);
    if (sc > bestScore) { bestScore = sc; best = idx; }
  }
  return best;
}
