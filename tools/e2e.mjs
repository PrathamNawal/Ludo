// End-to-end checks in real (headless) Chromium. Run: node tools/e2e.mjs   (SHOTS=dir to save screenshots)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { serve } from './serve.mjs';
import { generatePuzzle, solve, dayNumber } from '../site/js/puzzle.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const srv = await serve(0);
const base = `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch();
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
const fastSettings = `if(!localStorage.getItem('ludoadda.v1'))localStorage.setItem('ludoadda.v1', JSON.stringify({version:1,settings:{lang:'hg',sound:false,haptics:false,reduceMotion:true}}))`;

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

// ---------------------------------------------------------------- 1. home + vs-bots match + dice verification
console.log('1. Home, full match vs bot, dice verification');
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
  await page.waitForTimeout(400); await shot(page, '01-home');
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
  await ctx.addInitScript(fastSettings);
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
  await page.evaluate(() => window.__ludo.startLocal({ kinds: ['human', 'bunty', 'off', 'professor'], tokens: 4 }));
  let n = 0;
  await drive(page, async () => { n++; if (n === 60) await shot(page, '11-mid-game'); return n > 400; }, { maxMs: 60000 });
  check('animated match ran without errors', true);
  await ctx.close();
}

await browser.close(); srv.close();
console.log(`\n${passed} checks passed, ${failures.length} failed`);
if (errors.length) console.log('Browser errors:\n  ' + errors.join('\n  '));
if (failures.length || errors.length) { console.log('FAILED:', failures); process.exit(1); }
