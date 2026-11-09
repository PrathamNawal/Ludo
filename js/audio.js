// Synthesised audio: no files to download, so the app stays tiny and works offline.
// Small random pitch offsets keep repeated sounds from feeling robotic (audio-design skill).
import { settings } from './store.js';
import { getLang } from './i18n.js';

let ctx = null, master = null;
function ensure() {
  if (!settings().sound) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export function unlock() { ensure(); }

const jitter = (v, amt = 0.04) => v * (1 + (Math.random() * 2 - 1) * amt);

function tone({ f, f2, type = 'sine', dur = 0.15, vol = 0.3, at = 0, attack = 0.005 }) {
  const c = ensure(); if (!c) return;
  const t0 = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(jitter(f), t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.1, vol = 0.2, at = 0, freq = 1200, q = 1 }) {
  const c = ensure(); if (!c) return;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource(); src.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(c.currentTime + at);
}

export const sfx = {
  click() { tone({ f: 660, f2: 520, dur: 0.06, vol: 0.12, type: 'triangle' }); },
  roll() { for (let i = 0; i < 6; i++) noise({ dur: 0.04, vol: 0.12, at: i * 0.08, freq: jitter(2400, 0.2), q: 4 }); },
  land() { tone({ f: 220, f2: 140, dur: 0.12, vol: 0.25, type: 'triangle' }); },
  step() { tone({ f: 480, f2: 420, dur: 0.05, vol: 0.1, type: 'triangle' }); },
  // Dhol: a low thump plus a bright slap.
  dhol() {
    tone({ f: 130, f2: 55, dur: 0.28, vol: 0.5 });
    noise({ dur: 0.07, vol: 0.28, freq: 1800, q: 0.8 });
    tone({ f: 130, f2: 55, dur: 0.28, vol: 0.45, at: 0.16 });
  },
  six() { this.dhol(); },
  leave() { tone({ f: 520, f2: 780, dur: 0.14, vol: 0.2, type: 'triangle' }); },
  capture() {
    tone({ f: 300, f2: 90, dur: 0.3, vol: 0.4, type: 'sawtooth' });
    noise({ dur: 0.12, vol: 0.3, freq: 600 });
  },
  home() { [523, 659, 784].forEach((f, i) => tone({ f, dur: 0.18, vol: 0.2, type: 'triangle', at: i * 0.09 })); },
  // Shehnai-ish flourish over a Bhairav scale.
  win() {
    const sa = 392, scale = [1, 16 / 15, 5 / 4, 4 / 3, 3 / 2, 8 / 5, 15 / 8, 2];
    scale.forEach((r, i) => tone({ f: sa * r, dur: 0.28, vol: 0.14, type: 'sawtooth', at: i * 0.11 }));
    this.dhol();
  },
  good() { tone({ f: 660, dur: 0.1, vol: 0.18, type: 'triangle' }); tone({ f: 880, dur: 0.16, vol: 0.18, type: 'triangle', at: 0.09 }); },
  bad() { tone({ f: 200, f2: 150, dur: 0.2, vol: 0.2, type: 'square' }); },
};

export function buzz(pattern) {
  try { if (settings().haptics && navigator.vibrate) navigator.vibrate(pattern); } catch { /* ignore */ }
}

// ---------- spoken commentary (the phone's own text-to-speech: free, nothing to download) ----------
// Hindi script is read by a Hindi voice; Hinglish and English (Latin script) by an Indian-English voice,
// which reads Romanised Hindi far better than a Hindi voice does.
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voices = [];
const loadVoices = () => { try { voices = synth ? synth.getVoices() : []; } catch { voices = []; } };
if (synth) { loadVoices(); try { synth.addEventListener('voiceschanged', loadVoices); } catch { /* old browsers */ } }
const VOICE_LANG = { hi: 'hi-IN', hg: 'en-IN', en: 'en-IN' };
const norm = l => String(l || '').replace('_', '-');
function pickVoice(want) {
  const base = want.split('-')[0];
  return voices.find(v => norm(v.lang) === want) || voices.find(v => norm(v.lang).startsWith(base + '-')) || voices.find(v => norm(v.lang).startsWith(base)) || null;
}
export const voiceSupported = () => !!synth && typeof SpeechSynthesisUtterance !== 'undefined';
/** Speak one commentary line. Latest line wins (cancels the previous) so speech never lags the game. */
export function speak(text) {
  const st = settings();
  if (!voiceSupported() || !st.sound || st.voice === false || !text) return false;
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const want = VOICE_LANG[getLang()] || 'en-IN';
    u.lang = want;
    const v = pickVoice(want);
    if (v) u.voice = v;
    u.rate = 1.03; u.pitch = 1; u.volume = 1;
    synth.speak(u);
    return true;
  } catch { return false; }
}
export function stopSpeaking() { try { if (synth) synth.cancel(); } catch { /* ignore */ } }
