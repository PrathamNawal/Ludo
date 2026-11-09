import test from 'node:test';
import assert from 'node:assert/strict';
import { bestVoice, rankVoices, chooseVoice, scoreVoice, langFit, MOODS } from '../js/voice-rank.js';
import { _tables, setLang, sayParts } from '../js/i18n.js';

const V = (name, lang, localService = true, voiceURI = name) => ({ name, lang, localService, voiceURI });

test('Android Chrome: prefers the network voice over the compact offline one, whatever the list order', () => {
  const list = [V('Hindi India', 'hi-IN', true, 'hi-in-x-hic-local'), V('Hindi India', 'hi-IN', false, 'hi-in-x-hia-network'), V('English India', 'en-IN', true, 'en-in-x-ene-local')];
  assert.equal(bestVoice(list, 'hi-IN').voiceURI, 'hi-in-x-hia-network');
  assert.equal(bestVoice([...list].reverse(), 'hi-IN').voiceURI, 'hi-in-x-hia-network');
});

test('Edge/Windows: natural online voices win', () => {
  const list = [V('Microsoft Heera - Hindi (India)', 'hi-IN'), V('Microsoft Swara Online (Natural) - Hindi (India)', 'hi-IN', false)];
  assert.match(bestVoice(list, 'hi-IN').name, /Swara/);
});

test('iOS / macOS: enhanced voices beat novelty and compact ones', () => {
  const list = [V('Lekha', 'hi-IN'), V('Lekha (Enhanced)', 'hi-IN'), V('Zarvox', 'en-US'), V('Rishi (Premium)', 'en-IN'), V('Rishi', 'en-IN')];
  assert.equal(bestVoice(list, 'hi-IN').name, 'Lekha (Enhanced)');
  assert.equal(bestVoice(list, 'en-IN').name, 'Rishi (Premium)');
  assert.ok(!rankVoices(list, 'en-IN').some(v => v.name === 'Zarvox') || rankVoices(list, 'en-IN').at(-1).name === 'Zarvox');
});

test('robotic engines are pushed to the bottom', () => {
  const list = [V('eSpeak Hindi', 'hi-IN'), V('Some Compact Voice', 'hi-IN'), V('Plain Hindi', 'hi-IN')];
  assert.equal(bestVoice(list, 'hi-IN').name, 'Plain Hindi');
});

test('offline fallback never picks a network voice', () => {
  const list = [V('Hindi Net', 'hi-IN', false, 'x-network'), V('Hindi Local', 'hi-IN', true)];
  assert.equal(bestVoice(list, 'hi-IN', { allowNetwork: false }).name, 'Hindi Local');
  assert.equal(bestVoice([V('Hindi Net', 'hi-IN', false)], 'hi-IN', { allowNetwork: false }), null);
});

test('exact language beats family match; other languages are excluded', () => {
  const list = [V('British', 'en-GB'), V('Indian', 'en-IN'), V('German', 'de-DE')];
  assert.equal(bestVoice(list, 'en-IN').name, 'Indian');
  assert.equal(langFit(V('x', 'de-DE'), 'en-IN'), 0);
  assert.equal(scoreVoice(V('x', 'de-DE'), 'en-IN'), -Infinity);
  assert.equal(rankVoices([V('Hi_IN', 'hi_IN')], 'hi-IN').length, 1); // Android uses underscores
});

test("the player's own pick is honoured while installed, otherwise falls back to the best", () => {
  const list = [V('A good one', 'hi-IN', false), V('My favourite', 'hi-IN')];
  assert.equal(chooseVoice(list, 'hi-IN', 'My favourite').name, 'My favourite');
  assert.equal(chooseVoice(list, 'hi-IN', 'Uninstalled').name, 'A good one');
  assert.equal(chooseVoice(list, 'en-IN', 'My favourite'), null, 'a Hindi pick must not be used for an English line');
});

test('moods: excitement is faster and higher, sympathy slower and lower', () => {
  assert.ok(MOODS.excited.rate > MOODS.calm.rate && MOODS.excited.pitch > MOODS.calm.pitch);
  assert.ok(MOODS.sympathy.rate < MOODS.calm.rate && MOODS.sympathy.pitch < MOODS.calm.pitch);
});

test('every commentary event has the same number of variants and placeholders in en/hi/hg (speech uses the Hindi variant at the same index)', () => {
  const ph = s => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const [event, set] of Object.entries(_tables.C)) {
    assert.equal(set.hi.length, set.en.length, event);
    assert.equal(set.hg.length, set.en.length, event);
    set.en.forEach((_, i) => { assert.equal(ph(set.hi[i]), ph(set.en[i]), `${event}[${i}] hi`); assert.equal(ph(set.hg[i]), ph(set.en[i]), `${event}[${i}] hg`); });
  }
});

test('sayParts: Hinglish is shown in Latin but spoken from the Devanagari line; unknown names fall back safely', () => {
  setLang('hg');
  const dev = /[ऀ-ॿ]/;
  for (let k = 0; k < 40; k++) {
    const known = sayParts('capture', { name: 'Bunty', victim: 'Dadi' }, { name: 'बंटी', victim: 'दादी' });
    assert.ok(!dev.test(known.text), 'shown text stays Hinglish');
    // some variants mention only one of the two names, so require at least one and no leftover placeholder
    assert.ok(dev.test(known.speech) && (known.speech.includes('बंटी') || known.speech.includes('दादी')) && !/[{}]/.test(known.speech), known.speech);
    const custom = sayParts('capture', { name: 'Papa', victim: 'Mummy' }, { name: undefined, victim: undefined });
    assert.equal(custom.speech, custom.text, 'custom (Latin) names: speak the shown line with an English voice');
  }
  const start = sayParts('start', {}, {});
  assert.ok(dev.test(start.speech), 'lines without names are always spoken in Hindi');
  setLang('en');
  const en = sayParts('six', { name: 'Papa' }, { name: 'पापा' });
  assert.equal(en.speech, en.text, 'English stays English');
  setLang('hg');
});
