// Picks the best text-to-speech voice a device offers. Pure (no DOM) so it is unit-tested.
// Why: the browser lists voices in arbitrary order and the first match is often the worst one
// (a small offline "compact" voice). Phones and browsers usually also ship network or "natural"
// neural voices that sound far less robotic, so rank on quality signals, not list order.

export const normLang = l => String(l || '').replace('_', '-').toLowerCase();

const GOOD_NAME = /(neural|natural|wavenet|studio|chirp|journey|premium|enhanced|\bhd\b|multilingual)/i;
const BAD_NAME = /(compact|eloquence|espeak|flite|festival|pico|robot|novelty|zarvox|trinoids|bubbles|bells|whisper|bad news|good news|cellos|boing|organ|albert|junior|kathy|fred|ralph)/i;
const NETWORK = /(network|online|cloud)/i;

/** 2 = exact language (hi-IN), 1 = same language family (en-GB for en-IN), 0 = not a match. */
export function langFit(voice, want) {
  const v = normLang(voice.lang), w = normLang(want);
  if (v === w) return 2;
  return v.split('-')[0] === w.split('-')[0] ? 1 : 0;
}

export const isNetworkVoice = v => v.localService === false || NETWORK.test(`${v.name} ${v.voiceURI || ''}`);

export function scoreVoice(v, want, { allowNetwork = true } = {}) {
  const fit = langFit(v, want);
  if (!fit) return -Infinity;
  const net = isNetworkVoice(v);
  if (net && !allowNetwork) return -Infinity;
  let s = fit === 2 ? 100 : 60;
  const label = `${v.name} ${v.voiceURI || ''}`;
  if (GOOD_NAME.test(label)) s += 40;
  if (net) s += 25;
  if (/google/i.test(label)) s += 10;
  if (BAD_NAME.test(label)) s -= 60;
  return s;
}

/** All voices for a language, best first (for the Settings picker). */
export function rankVoices(voices, want, opts) {
  return voices
    .map(v => ({ v, s: scoreVoice(v, want, opts) }))
    .filter(x => x.s > -Infinity)
    .sort((a, b) => b.s - a.s || String(a.v.name).localeCompare(String(b.v.name)))
    .map(x => x.v);
}

export const bestVoice = (voices, want, opts) => rankVoices(voices, want, opts)[0] || null;

/** Honour the user's own choice if it is still installed and fits the language, else the best one. */
export function chooseVoice(voices, want, preferredName, opts) {
  if (preferredName) {
    const p = voices.find(v => v.name === preferredName && langFit(v, want) > 0);
    if (p) return p;
  }
  return bestVoice(voices, want, opts);
}

/** Delivery per moment: excitement for big events, a softer tone for bad luck. */
export const MOODS = {
  calm: { rate: 1.0, pitch: 1.0 },
  excited: { rate: 1.08, pitch: 1.12 },
  sympathy: { rate: 0.94, pitch: 0.94 },
};
