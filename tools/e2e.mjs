// End-to-end checks in real (headless) Chromium. Run: node tools/e2e.mjs   (SHOTS=dir to save screenshots)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { serve } from './serve.mjs';
import { generatePuzzle, solve, dayNumber } from '../js/puzzle.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const srv = await serve(0);
const base = `http://localhost:${srv.address().port}/`;
// software GL so WebGL works in headless CI
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const failures = [];
const errors = [];
let passed = 0;
const check = (name, ok, extra = '') => { if (ok) { passed++; console.log('  ok   ', name); } else { failures.push(name); console.log('  FAIL ', name, extra); } };

async function newPage(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return page;
}
const mobile = { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const shot = (page, name) => SHOTS ? page.screenshot({ path: `${SHOTS}/${name}.png` }) : null;
// Long flows run in Lite 2D (software-rendered WebGL is slow on shared CI runners); 3D flows below are short.
const fastSettings = `if(!localStorage.getItem('ludoadda.v1'))localStorage.setItem('ludoadda.v1', JSON.stringify({version:1,settings:{lang:'hg',sound:false,haptics:false,reduceMotion:true,gfx:'lite'}}))`;
const fast3d = `if(!localStorage.getItem('ludoadda.v1'))localStorage.setItem('ludoadda.v1', JSON.stringify({version:1,settings:{lang:'hg',sound:false,haptics:false,reduceMotion:true,gfx:'3d'}}))`;

// Drive a human through whatever the UI is asking until `done()` is true.
async function drive(page, done, { maxMs = 240000, pick = 'first' } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (await done()) return true;
    const can = await page.$$('.tk.can');
    if (can.length) { await (pick === 'last' ? can[can.length - 1] : can[0]).dispatchEvent('pointerdown'); }
    else { const r = await page.$('.dice.ready'); if (r) await r.click({ force: true }); }
    await page.waitForTimeout(40);
  }
  return false;
}

// ---------------------------------------------------------------- 1a. 3D: hero, canvas board, tapping pawns
console.log('1a. 3D home hero and board input');
{
  const ctx = await browser.newContext(mobile);
  await ctx.addInitScript(fast3d);
  const page = await newPage(ctx);
  await page.goto(base);
  await page.waitForSelector('#play-now');
  await page.waitForSelector('.hero3d.live canvas', { timeout: 20000 });
  check('3D hero renders on the home screen', true);
  check('3D graphics are selected', (await page.evaluate(() => window.__ludo.gfxMode())) === '3d');
  await page.waitForTimeout(400); await shot(page, '01-home');
  await page.evaluate(() => window.__ludo.startLocal({ kinds: ['human', 'off', 'professor', 'off'], tokens: 2 }));
  await page.waitForSelector('.dice.ready', { timeout: 30000 });
  check('game board is a WebGL canvas', !!(await page.$('.board-wrap canvas.gl')));
  check('dice commitment shown before first roll', /🔒 [0-9a-f]{6}/.test(await page.textContent('.chip-lock')));
  await shot(page, '02-game-start');
  const reached = await drive(page, async () => (await page.evaluate(() => (JSON.parse(localStorage.getItem('ludoadda.v1')).match || { log: [] }).log.length)) >= 6, { maxMs: 120000 });
  check('tapping the 3D dice and pawns plays moves (6 rolls recorded)', reached);
  await ctx.close();
}

// ---------------------------------------------------------------- 1. vs-bots match + dice verification (Lite, fast)
console.log('1. Full match vs bot, dice verification');
{
  const ctx = await browser.newContext(mobile);
  await ctx.addInitScript(fastSettings);
  const page = await newPage(ctx);
  const external = [];
  page.on('request', r => { if (!r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
  await page.goto(base);
  await page.waitForSelector('#play-now');
  check('home renders with Play now', true);
  check('page title', (await page.title()) === 'Ludo Adda');
  check('no sign-in wall: Play now is one tap from first open', !!(await page.$('#play-now')) && !(await page.$('input[type=password], input[type=tel]')));
  await page.evaluate(() => window.__ludo.startLocal({ kinds: ['human', 'off', 'professor', 'off'], tokens: 2 }));
  await page.waitForSelector('.dice.ready');
  const lock = await page.textContent('.chip-lock');
  check('dice commitment shown before first roll', /🔒 [0-9a-f]{6}/.test(lock), lock);
  await shot(page, '02-game-start');
  const finished = await drive(page, async () => !!(await page.$('.result')));
  check('a full match completes with a winner', finished);
  await page.waitForTimeout(300); await shot(page, '03-result');
  check('result shows winner heading', !!(await page.$('.win-h')));
  check('dice stats rendered for each player', (await page.$$('.stat')).length === 2);
  await page.click('#verify-btn');
  await page.waitForSelector('.verify-out .ok', { timeout: 15000 });
  check('"Verify my dice" confirms every roll', /✅/.test(await page.textContent('.verify-out .ok')));
  await shot(page, '04-verified');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ludoadda.v1')));
  check('finished match is cleared from resume slot and counted in stats', saved.match === null && saved.stats.games === 1);
  check('zero third-party network requests (no ads, no trackers, no CDNs)', external.length === 0, external.join(','));
  await ctx.close();
}

// ---------------------------------------------------------------- 2. resume
console.log('2. Autosave and resume');
{
  const ctx = await browser.newContext(mobile);
  await ctx.addInitScript(fastSettings);
  const page = await newPage(ctx);
  await page.goto(base);
  await page.waitForSelector('#play-now');
  await page.evaluate(() => window.__ludo.startLocal({ kinds: ['human', 'off', 'professor', 'off'], tokens: 4 }));
  let moves = 0;
  await drive(page, async () => { const n = await page.evaluate(() => (JSON.parse(localStorage.getItem('ludoadda.v1')).match || { log: [] }).log.length); moves = n; return n >= 8; }, { maxMs: 60000 });
  const before = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('ludoadda.v1')).match.log));
  await page.reload();
  await page.waitForSelector('.resume-btn');
  check('resume button appears after reload', true);
  await page.click('.resume-btn');
  await page.waitForSelector('.game');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('ludoadda.v1')).match.log));
  check('resumed match keeps its exact move log', after.startsWith(before.slice(0, -1)) , `${before.length} vs ${after.length}`);
  await ctx.close();
}

// ---------------------------------------------------------------- 3. daily puzzle
console.log('3. Roz ki Chaal');
{
  const ctx = await browser.newContext(mobile);
  await ctx.addInitScript(fast3d);
  const page = await newPage(ctx);
  await page.goto(base);
  await page.click('.c-daily');
  await page.waitForSelector('.roll-chip');
  const n = dayNumber();
  const puz = generatePuzzle(n);
  check('puzzle number matches today', (await page.textContent('.puz-head b')).includes(String(n)));
  await shot(page, '05-daily');
  const { first } = solve(puz);
  for (let i = 0; i < first.length; i++) {
    if (first[i] < 0) { await page.waitForTimeout(900); continue; }
    await page.waitForSelector(`.tk.can[data-c="0"][data-i="${first[i]}"]`, { timeout: 8000 });
    await page.dispatchEvent(`.tk.can[data-c="0"][data-i="${first[i]}"]`, 'pointerdown');
    await page.waitForTimeout(250);
  }
  await page.waitForSelector('.result .share-grid', { timeout: 8000 });
  check('solver solution solves the puzzle in the UI', true);
  await shot(page, '06-daily-solved');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('ludoadda.v1')).puzzle);
  check('solve recorded with streak 1', st.solved[n] && st.streak === 1);
  await ctx.close();
}

// ---------------------------------------------------------------- 4. family board, two devices
console.log('4. Parivaar Board across two devices');
{
  const A = await browser.newContext(mobile), B = await browser.newContext(mobile);
  for (const c of [A, B]) await c.addInitScript(fastSettings);
  const pa = await newPage(A), pb = await newPage(B);
  await pa.goto(base);
  await pa.click('.c-family');
  await pa.waitForSelector('.name-row');
  await shot(pa, '07-family-new');
  await pa.click('.btn.primary.big');
  await pa.waitForSelector('.dice.ready');
  check('family room created; creator can roll', true);
  const roomUrl = async p => p.evaluate(() => location.href);
  let url = await roomUrl(pa);
  check('room lives in the URL hash', /#p=/.test(url));
  let turns = 0, lastLen = 0;
  const lenOf = p => p.evaluate(() => { const m = location.hash.match(/#p=(.+)/); if (!m) return 0; const o = JSON.parse(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))); return o.l.length / 2; });
  const players = [pa, pb];
  for (let step = 0; step < 8; step++) {
    const p = players[step % 2];
    if (step === 1) { await p.goto(url); await p.waitForSelector('.setup-row'); await shot(p, '08-family-who'); await p.click('.setup-row:nth-child(2)'); }
    else if (step > 1) { await p.goto(url); await p.waitForTimeout(150); }
    // play until the turn is handed over (share buttons appear)
    const ok = await drive(p, async () => !!(await p.$('.btn.wa')), { maxMs: 40000 });
    if (!ok) { check(`family turn ${step} completed`, false); break; }
    url = await roomUrl(p);
    const len = await lenOf(p);
    if (len > lastLen) turns++;
    lastLen = len;
    if (step === 2) await shot(p, '09-family-turn');
  }
  check('8 hand-offs between two devices advanced the shared log', turns === 8 && lastLen >= 8, `turns=${turns} len=${lastLen}`);
  const bad = await pb.evaluate(() => 1);
  // a wrong person must not be able to move: open the link fresh in a third context and verify it asks who you are
  const C = await browser.newContext(mobile); await C.addInitScript(fastSettings);
  const pc = await newPage(C); await pc.goto(url);
  await pc.waitForSelector('.setup-row');
  check('a brand-new device is asked which family member it is', (await pc.$$('.setup-row')).length === 2);
  await pc.goto(base + '#p=garbage');
  await pc.waitForSelector('#toast.show', { timeout: 4000 });
  check('a broken link shows a friendly error and lands on home', !!(await pc.$('#play-now')));
  await A.close(); await B.close(); await C.close();
}

// ---------------------------------------------------------------- 5. languages + settings
console.log('5. Settings and languages');
{
  const ctx = await browser.newContext(mobile);
  const page = await newPage(ctx);
  await page.goto(base);
  await page.click('.home-top .icon-btn');
  await page.waitForSelector('.settings');
  await page.click('.seg button:has-text("हिन्दी")');
  await page.waitForSelector('.play-t');
  check('Hindi UI applies', /अभी खेलें/.test(await page.textContent('.play-t')));
  await page.waitForTimeout(300); await shot(page, '10-home-hindi');
  await page.reload();
  await page.waitForSelector('.play-t');
  check('language choice persists', /अभी खेलें/.test(await page.textContent('.play-t')));
  await ctx.close();
}

// ---------------------------------------------------------------- 6. offline
console.log('6. Offline');
{
  const ctx = await browser.newContext(mobile);
  const page = await newPage(ctx);
  await page.goto(base);
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller || false, null, { timeout: 15000 }).catch(async () => { await page.reload(); await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }); });
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('#play-now', { timeout: 8000 });
  check('app reloads with network fully off', true);
  await page.evaluate(() => window.__ludo.startLocal({ kinds: ['human', 'dadi', 'off', 'off'], tokens: 4 }));
  await page.waitForSelector('.dice.ready', { timeout: 8000 });
  check('can start and play a match offline', true);
  await ctx.setOffline(false);
  await ctx.close();
}

// ---------------------------------------------------------------- 7. normal-motion visuals (captures a six and a capture if they happen)
console.log('7. Visual pass with full animation');
{
  const ctx = await browser.newContext(mobile);
  await ctx.addInitScript(`if(!localStorage.getItem('ludoadda.v1'))localStorage.setItem('ludoadda.v1', JSON.stringify({version:1,settings:{lang:'en',sound:false,haptics:false,reduceMotion:false}}))`);
  const page = await newPage(ctx);
  await page.goto(base);
  await page.waitForSelector('#play-now');
  await page.evaluate(() => window.__ludo.startLocal({ kinds: ['human', 'bunty', 'off', 'professor'], tokens: 4 }));
  let n = 0;
  await drive(page, async () => { n++; if (n === 60) await shot(page, '11-mid-game'); return n > 400; }, { maxMs: 25000 });
  check('animated match ran without errors', true);
  await ctx.close();
}

// ---------------------------------------------------------------- 8. 3D dice shows the rolled number
console.log('8. 3D dice lands on the rolled face');
{
  const ctx = await browser.newContext(mobile);
  await ctx.addInitScript(fast3d);
  const page = await newPage(ctx);
  await page.goto(base);
  await page.waitForSelector('#play-now');
  await page.evaluate(() => window.__ludo.startLocal({ kinds: ['human', 'off', 'professor', 'off'], tokens: 2 }));
  await page.waitForSelector('.dice.ready');
  const res = await page.evaluate(async () => {
    const b = window.__ludo.board();
    const normals = { 3: [1, 0, 0], 4: [-1, 0, 0], 1: [0, 1, 0], 6: [0, -1, 0], 2: [0, 0, 1], 5: [0, 0, -1] };
    const rot = (q, v) => { // rotate vector v by quaternion q
      const [x, y, z] = v, { x: qx, y: qy, z: qz, w: qw } = q;
      const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
      return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx];
    };
    const out = [];
    for (let v = 1; v <= 6; v++) for (let rep = 0; rep < 3; rep++) {
      await b.rollDice(v);
      let best = 0, bestDot = -2;
      for (const [val, n] of Object.entries(normals)) { const r = rot(b.die.quaternion, n); if (r[1] > bestDot) { bestDot = r[1]; best = +val; } }
      out.push([v, best, +bestDot.toFixed(3)]);
    }
    return out;
  });
  const wrong = res.filter(([want, got, dot]) => want !== got || dot < 0.999);
  check('3D dice shows the rolled number face-up (18 rolls, all values)', wrong.length === 0, JSON.stringify(wrong));
  await ctx.close();
}

// ---------------------------------------------------------------- 9. Lite (2D) mode still fully works
console.log('9. Lite 2D mode');
{
  const ctx = await browser.newContext(mobile);
  await ctx.addInitScript(`if(!localStorage.getItem('ludoadda.v1'))localStorage.setItem('ludoadda.v1', JSON.stringify({version:1,settings:{lang:'en',sound:false,haptics:false,reduceMotion:true,gfx:'lite'}}))`);
  const page = await newPage(ctx);
  const requests3d = [];
  page.on('request', r => { if (/three|board3d/.test(r.url())) requests3d.push(r.url()); });
  await page.goto(base);
  await page.waitForSelector('#play-now');
  check('Lite mode never downloads the 3D engine', requests3d.length === 0, requests3d.join(','));
  await page.evaluate(() => window.__ludo.startLocal({ kinds: ['human', 'off', 'professor', 'off'], tokens: 2 }));
  await page.waitForSelector('.dice.ready');
  check('Lite mode uses the SVG board', !!(await page.$('svg.board')) && !(await page.$('canvas.gl')));
  const done = await drive(page, async () => !!(await page.$('.result')), { maxMs: 200000 });
  check('a full Lite match completes', done);
  await ctx.close();
}

// ---------------------------------------------------------------- 10. a phone on the OLD cache-first worker receives a new deploy
console.log('10. Updates reach phones that cached an older build');
{
  // The exact service worker that shipped in v0.1 (cache-first). Real phones are stuck on this one.
  const OLD_SW = `const VERSION='ludo-adda-v1';const ASSETS=['./','index.html','css/style.css','js/app.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==VERSION).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;e.respondWith((async()=>{const cache=await caches.open(VERSION);const hit=await cache.match(req,{ignoreSearch:true});const net=fetch(req).then(res=>{if(res.ok)cache.put(req,res.clone());return res}).catch(()=>null);if(hit){net.catch(()=>{});return hit}return(await net)||Response.error()})())});`;
  let phase = 'old', build = 'A-old';
  const srv2 = await serve(0, p => {
    if (p === '/sw.js' && phase === 'old') return OLD_SW;
    if (p === '/js/version.js') return `self.LUDO_BUILD='${build}';`;
    return null;
  });
  const base2 = `http://localhost:${srv2.address().port}/`;
  const ctx = await browser.newContext(mobile);
  await ctx.addInitScript(fastSettings);
  const page = await newPage(ctx);
  await page.goto(base2);
  await page.waitForSelector('#play-now');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  check('phone is running the old build under the old cache-first worker', (await page.evaluate(() => self.LUDO_BUILD)) === 'A-old');
  // "deploy": new worker (the real one in the repo root) and a new build id
  phase = 'new'; build = 'B-new';
  await page.reload().catch(() => {}); // the app may also reload itself when the new worker takes over
  // the old worker may serve one stale load; the new worker installs, takes over, and the app reloads itself or the next load is fresh
  let got = null;
  for (let i = 0; i < 4 && got !== 'B-new'; i++) {
    await page.waitForTimeout(1500);
    got = await page.evaluate(() => self.LUDO_BUILD).catch(() => null);
    if (got !== 'B-new') await page.reload().catch(() => {});
  }
  check('after a deploy the phone ends up on the new build within two reloads', got === 'B-new', String(got));
  check('settings shows the running version', await (async () => { await page.waitForSelector('#play-now'); await page.click('.home-top .icon-btn'); await page.waitForSelector('.settings'); return /Ludo Adda vB-new/.test(await page.textContent('.settings')); })());
  // and from now on a further deploy shows up on the very next load (network-first)
  build = 'C-newer';
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.reload().catch(() => {});
  let nextOk = true;
  await page.waitForFunction(() => self.LUDO_BUILD === 'C-newer', null, { timeout: 10000 }).catch(() => { nextOk = false; });
  check('next deploy arrives on the very next load', nextOk);
  await page.waitForSelector('#play-now');
  check('the page is marked translate=no (no browser auto-translate of Hinglish)', (await page.getAttribute('html', 'translate')) === 'no');
  await ctx.close(); srv2.close();
}

// ---------------------------------------------------------------- 11. what Pages publishes is the game, whichever deploy mode is on
console.log('11. Repository is publishable as-is');
{
  const { existsSync, readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  check('repo root has index.html that is the game (so a branch-based Pages build serves it, not the README)', /<title>Ludo Adda<\/title>/.test(html) && /js\/app\.js/.test(html));
  check('.nojekyll present (no Jekyll processing of the game files)', existsSync(new URL('../.nojekyll', import.meta.url)));
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const listed = [...sw.matchAll(/'([^']+\.(?:js|css|html|png|svg|webmanifest))'/g)].map(m => m[1]);
  const missing = listed.filter(f => !existsSync(new URL('../' + f, import.meta.url)));
  check('every file the service worker precaches exists (a missing one would break install)', missing.length === 0, missing.join(','));
  // and the reverse: every shipped file is precached, otherwise the app breaks offline when a new module is added
  const { readdirSync } = await import('node:fs');
  const shipped = ['index.html', 'sw.js', 'manifest.webmanifest', ...['css', 'js', 'vendor', 'icons'].flatMap(d => readdirSync(new URL('../' + d + '/', import.meta.url)).filter(f => !/^LICENSE/.test(f) && !/maskable\.svg$/.test(f)).map(f => d + '/' + f))];
  const unlisted = shipped.filter(f => f !== 'sw.js' && !listed.includes(f));
  check('every shipped file is in the offline precache list (no module forgotten)', unlisted.length === 0, unlisted.join(','));
}

// ---------------------------------------------------------------- 12. spoken commentary reaches the device's speech engine
console.log('12. Spoken commentary');
{
  // Headless Chromium has no real voices, so stub the engine and verify WHAT is said, in which language and with which voice.
  const VOICES = `[{name:'Hindi Local',lang:'hi-IN',localService:true,voiceURI:'hi-local'},{name:'Hindi Network',lang:'hi-IN',localService:false,voiceURI:'hi-in-x-hia-network'},{name:'Indian English Local',lang:'en-IN',localService:true,voiceURI:'en-local'},{name:'Indian English Network',lang:'en-IN',localService:false,voiceURI:'en-in-x-ena-network'}]`;
  const stub = `window.__spoken=[];const V=${VOICES};const fake={speak(u){window.__spoken.push({text:u.text,lang:u.lang,voice:u.voice&&u.voice.name,rate:u.rate,pitch:u.pitch})},cancel(){},getVoices(){return V},addEventListener(){}};Object.defineProperty(window,'speechSynthesis',{value:fake,configurable:true});window.SpeechSynthesisUtterance=class{constructor(t){this.text=t}};`;
  const mk = async settings => {
    const ctx = await browser.newContext(mobile);
    await ctx.addInitScript(stub);
    await ctx.addInitScript(`if(!localStorage.getItem('ludoadda.v1'))localStorage.setItem('ludoadda.v1', JSON.stringify({version:1,settings:${JSON.stringify({ sound: true, voice: true, haptics: false, reduceMotion: true, gfx: 'lite', ...settings })}}))`);
    const page = await newPage(ctx);
    await page.goto(base); await page.waitForSelector('#play-now');
    return { ctx, page };
  };
  const run = async (settings, ms, until) => {
    const { ctx, page } = await mk(settings);
    await page.evaluate(() => window.__ludo.startLocal({ kinds: ['human', 'off', 'professor', 'off'], tokens: 4 }));
    await page.waitForSelector('.dice.ready');
    await drive(page, async () => until ? (await page.evaluate(() => window.__spoken.length)) >= until : false, { maxMs: ms });
    const spoken = await page.evaluate(() => window.__spoken);
    await ctx.close();
    return spoken;
  };
  const dev = /[ऀ-ॿ]/;
  const hg = await run({ lang: 'hg' }, 60000, 3);
  check('commentary is spoken during play', hg.length >= 3 && hg.every(x => x.text && x.text.length > 3), JSON.stringify(hg.slice(0, 3)));
  check('Hinglish is spoken as Hindi (Devanagari line, hi-IN voice), not Romanised text through an English voice', hg.every(x => x.lang === 'hi-IN' && dev.test(x.text)), JSON.stringify(hg.slice(0, 3)));
  check('the best voice is chosen automatically (network Hindi voice, not the first one listed)', hg.every(x => x.voice === 'Hindi Network'), JSON.stringify([...new Set(hg.map(x => x.voice))]));
  check('delivery is set per moment (rate and pitch present)', hg.every(x => typeof x.rate === 'number' && typeof x.pitch === 'number'));
  const en = await run({ lang: 'en' }, 60000, 3);
  check('English is spoken in English by an Indian-English voice', en.length >= 3 && en.every(x => x.lang === 'en-IN' && !dev.test(x.text) && x.voice === 'Indian English Network'), JSON.stringify(en.slice(0, 3)));
  const hi = await run({ lang: 'hi' }, 60000, 2);
  check('Hindi script is read by a Hindi voice', hi.length >= 2 && hi.every(x => x.lang === 'hi-IN' && dev.test(x.text)));
  const off = await run({ lang: 'hg', voice: false }, 8000, 0);
  check('voice commentary can be switched off', off.length === 0, String(off.length));
  const muted = await run({ lang: 'hg', sound: false }, 8000, 0);
  check('turning sound off also silences the voice', muted.length === 0, String(muted.length));

  // family members with custom (Latin) names: Hindi voice cannot say them properly, so fall back to the shown line + English voice
  {
    const { ctx, page } = await mk({ lang: 'hg' });
    await page.click('.c-family'); await page.waitForSelector('.name-row'); await page.click('.btn.primary.big');
    await page.waitForSelector('.dice.ready');
    await drive(page, async () => (await page.evaluate(() => window.__spoken.length)) >= 1, { maxMs: 60000 });
    const sp = await page.evaluate(() => window.__spoken);
    check('family board with custom names falls back to the English voice reading the shown line', sp.length >= 1 && sp.every(x => x.lang === 'en-IN' && !dev.test(x.text)), JSON.stringify(sp.slice(0, 2)));
    await ctx.close();
  }

  // Settings: the player can pick a voice; it is used, remembered, and previewed
  {
    const { ctx, page } = await mk({ lang: 'hg' });
    await page.click('.home-top .icon-btn'); await page.waitForSelector('.settings');
    await page.waitForSelector('.voice-pickers select');
    const opts = await page.$$eval('.voice-pickers label:first-child select option', os => os.map(o => o.textContent));
    check('Settings lists this phone\'s Hindi voices with an Auto option', opts.length === 3 && /Auto/.test(opts[0]) && opts.some(o => /Network/.test(o)), JSON.stringify(opts));
    await page.selectOption('.voice-pickers label:first-child select', 'Hindi Local');
    await page.waitForTimeout(200);
    const last = await page.evaluate(() => window.__spoken.at(-1));
    check('choosing a voice previews it immediately in that voice', last && last.voice === 'Hindi Local' && dev.test(last.text), JSON.stringify(last));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ludoadda.v1')).settings.voiceHi);
    check('the chosen voice is remembered', saved === 'Hindi Local', saved);
    await ctx.close();
  }
}

await browser.close(); srv.close();
console.log(`\n${passed} checks passed, ${failures.length} failed`);
if (errors.length) console.log('Browser errors:\n  ' + errors.join('\n  '));
if (failures.length || errors.length) { console.log('FAILED:', failures); process.exit(1); }
