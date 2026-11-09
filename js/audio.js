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
// Quality comes from three things: (1) Hindi lines are spoken in Devanagari by a Hindi voice (see
// i18n.sayParts), never as Romanised text through an English voice; (2) the best installed voice is
// chosen by quality signals (network / natural / neural) instead of list order, or the player's own
// pick from Settings; (3) delivery changes with the moment (excited for a six, softer for bad luck).
import { chooseVoice, rankVoices, MOODS } from './voice-rank.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voices = [];
const listeners = new Set();
const loadVoices = () => { try { voices = synth ? synth.getVoices() : []; } catch { voices = []; } listeners.forEach(fn => fn()); };
if (synth) { loadVoices(); try { synth.addEventListener('voiceschanged', loadVoices); } catch { /* old browsers */ } }
export const onVoicesChanged = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const voiceSupported = () => !!synth && typeof SpeechSynthesisUtterance !== 'undefined';
const DEVANAGARI = /[\u0900-\u097F]/;
export const langOf = text => (DEVANAGARI.test(text) ? 'hi-IN' : 'en-IN');

/** Voices on this device for a language, best first: {hi: [...], en: [...]}. */
export function listVoices() {
  return { hi: rankVoices(voices, 'hi-IN'), en: rankVoices(voices, 'en-IN') };
}

function pickFor(want, allowNetwork) {
  const st = settings();
  const pref = want.startsWith('hi') ? st.voiceHi : st.voiceEn;
  return chooseVoice(voices, want, pref, { allowNetwork });
}

/** Speak one commentary line. Latest line wins (cancels the previous) so speech never lags the game. */
export function speak(text, mood = 'calm') {
  const st = settings();
  if (!voiceSupported() || !st.sound || st.voice === false || !text) return false;
  const want = langOf(text);
  const m = MOODS[mood] || MOODS.calm;
  const say = (allowNetwork, retried) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = want;
    const v = pickFor(want, allowNetwork);
    if (v) u.voice = v;
    u.rate = m.rate; u.pitch = m.pitch; u.volume = 1;
    // A network voice fails when offline: retry once with the best on-device voice.
    u.onerror = e => { if (!retried && allowNetwork && e && e.error && e.error !== 'interrupted' && e.error !== 'canceled') { try { synth.cancel(); say(false, true); } catch { /* ignore */ } } };
    synth.speak(u);
  };
  try { synth.cancel(); say(true, false); return true; } catch { return false; }
}
export function stopSpeaking() { try { if (synth) synth.cancel(); } catch { /* ignore */ } }
