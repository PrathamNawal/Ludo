// Ludo Adda: app shell, screens and match controllers.
import { createState, step, legalMoves, current, replay, standings, homeCount, cellXY, HOME } from './rules.js';
import { newSeed, commitOf, rollAt, verifyRolls, faceStats } from './dice.js';
import { chooseMove, PERSONAS, PERSONA_KEYS } from './bots.js';
import { generatePuzzle, solve, dayNumber, playRoll, isGoalMet, GOAL_KEY, TIERS } from './puzzle.js';
import { encodeRoom, decodeRoom, roomState, nextRoll, verifyRoom, newRoomId } from './family.js';
import { t, say, setLang, getLang, LANGS } from './i18n.js';
import { db, settings, update, getSeat, setSeat } from './store.js';
import { sfx, unlock, buzz } from './audio.js';
import { $, h, sleep, toast } from './ui.js';
import { GameView, setBoard3D } from './view.js';
import { Board, PALETTE } from './board.js';

const app = $('#app');
let ctl = null;           // active controller, cancelled when leaving a screen
let view = null;
let screenName = 'home';
let installEvt = null;
let heroBoard = null;
let gl = null;           // the lazily loaded 3D module, or null when unavailable / Lite

// ---------- graphics: 3D by default where it will run well, Lite 2D otherwise ----------
function wants3d() {
  const g = settings().gfx || 'auto';
  if (g === 'lite') return false;
  if (g === '3d') return true;
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 1) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
  return !weak;
}
async function initGfx() {
  if (!wants3d()) return false;
  if (gl) return true;
  try {
    const m = await Promise.race([import('./board3d.js'), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))]);
    if (!m.webglSupported()) return false;
    gl = m; setBoard3D(m.Board3D);
    return true;
  } catch (e) { console.warn('3D disabled:', e.message); return false; }
}
const gfxMode = () => (gl && wants3d() ? '3d' : 'lite');

// ---------- navigation ----------
function stopActive() {
  if (heroBoard) { heroBoard.dispose(); heroBoard = null; }
  if (ctl) ctl.dead = true;
  if (view) view.destroy();
  ctl = null; view = null;
  closeModal();
}
function show(name, build, { push = true } = {}) {
  stopActive();
  screenName = name;
  const el = build();
  app.replaceChildren(el);
  el.classList.add('screen', 'enter');
  window.scrollTo(0, 0);
  if (push && name !== 'home') history.pushState({ s: name }, '', location.href);
}
function goHome({ fromPop = false } = {}) {
  if (!fromPop && screenName !== 'home' && history.state && history.state.s) { history.back(); return; }
  show('home', homeScreen, { push: false });
}
window.addEventListener('popstate', () => { show('home', homeScreen, { push: false }); });

function topbar(title, { onBack = goHome, right = null, lock = null } = {}) {
  return h('header', { class: 'topbar' },
    h('button', { class: 'icon-btn', 'aria-label': t('back'), onclick: () => { sfx.click(); onBack(); } }, '←'),
    h('div', { class: 'top-title', text: title }),
    lock, right);
}

// ---------- modal ----------
function openModal(content, { onClose } = {}) {
  const m = $('#modal');
  m.replaceChildren(h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, content));
  m.hidden = false;
  m._onClose = onClose;
  requestAnimationFrame(() => m.classList.add('open'));
  const first = m.querySelector('button, input');
  if (first) first.focus({ preventScroll: true });
}
function closeModal() {
  const m = $('#modal');
  if (m.hidden) return;
  m.classList.remove('open'); m.hidden = true; m.replaceChildren();
  const cb = m._onClose; m._onClose = null; if (cb) cb();
}
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ---------- home ----------
function homeScreen() {
  const d = db();
  const today = dayNumber();
  const solvedToday = !!d.puzzle.solved[today];
  const streak = d.puzzle.streak && (d.puzzle.lastSolvedDay >= today - 1) ? d.puzzle.streak : 0;
  const resume = d.match;
  const card = (cls, icon, title, sub, fn) => h('button', { class: `card ${cls}`, onclick: () => { unlock(); sfx.click(); fn(); } },
    h('span', { class: 'card-ic', 'aria-hidden': 'true', text: icon }), h('span', { class: 'card-t', text: title }), h('span', { class: 'card-s', text: sub }));
  const use3d = gfxMode() === '3d';
  const hero = use3d ? h('div', { class: 'hero3d', 'aria-hidden': 'true' }) : null;
  if (hero) setTimeout(() => {
    if (screenName !== 'home' || !hero.isConnected || heroBoard) return;
    try { heroBoard = new gl.Board3D(hero, { colors: [0, 1, 2, 3], tokens: 4, hero: true }); hero.classList.add('live'); } catch (e) { console.warn('hero off', e); }
  }, 30);
  return h('main', { class: `home ${use3d ? 'has-hero' : ''}` },
    h('div', { class: 'home-top' },
      h('button', { class: 'icon-btn ghost', 'aria-label': t('home.settings'), onclick: openSettings }, '⚙'),
    ),
    hero,
    h('div', { class: 'logo' },
      use3d ? null : h('div', { class: 'logo-dice', 'aria-hidden': 'true' }, ...[1, 3, 4, 6, 7, 9].map(p => h('i', { style: `grid-area:p${p}` }))),
      h('h1', { text: t('app.name') }),
      h('p', { class: 'tag', text: t('app.tag') })),
    h('button', { class: 'play-btn', id: 'play-now', onclick: () => { unlock(); sfx.click(); startLocal(presets.now()); } },
      h('span', { class: 'play-t', text: '🎲 ' + t('home.play') }), h('span', { class: 'play-s', text: t('home.play.sub') })),
    resume ? h('button', { class: 'resume-btn', onclick: () => { unlock(); resumeLocal(); } }, '▶ ' + t('home.resume')) : null,
    h('div', { class: 'grid' },
      card('c-daily', solvedToday ? '✅' : '🧩', t('home.daily'), streak ? t('home.streak', { n: streak }) : t('home.daily.sub'), () => openDaily(today)),
      card('c-family', '👨‍👩‍👧', t('home.family'), t('home.family.sub'), openFamilyNew),
      card('c-quick', '⚡', t('home.quick'), t('home.quick.sub'), () => startLocal(presets.quick())),
      card('c-friends', '🫂', t('home.friends'), t('home.friends.sub'), () => openSetup(presets.friends())),
    ),
    h('p', { class: 'foot', text: t('home.free') }),
    h('p', { class: 'foot small', text: '🔒 ' + t('home.fair') }));
}

// ---------- settings ----------
function openSettings() {
  sfx.click();
  const st = settings();
  const seg = (label, opts, cur, on) => h('div', { class: 'row' }, h('span', { text: label }),
    h('div', { class: 'seg' }, ...opts.map(([k, txt]) => h('button', { class: k === cur ? 'on' : '', onclick: e => { on(k); [...e.target.parentNode.children].forEach(b => b.classList.toggle('on', b === e.target)); } }, txt))));
  const onoff = (key, label, fn) => seg(label, [[true, t('settings.on')], [false, t('settings.off')]], !!st[key], v => { update(d => { d.settings[key] = v; }); if (fn) fn(v); });
  const body = h('div', { class: 'settings' },
    h('h2', { text: t('home.settings') }),
    seg(t('settings.lang'), Object.entries(LANGS), getLang(), l => { update(d => { d.settings.lang = l; }); setLang(l); closeModal(); if (screenName === 'home') show('home', homeScreen, { push: false }); }),
    seg(t('settings.gfx'), [['3d', t('gfx.3d')], ['lite', t('gfx.lite')]], gfxMode() === '3d' ? '3d' : 'lite', async g => {
      update(d => { d.settings.gfx = g; });
      if (g === '3d') await initGfx();
      closeModal(); if (screenName === 'home') show('home', homeScreen, { push: false });
    }),
    h('p', { class: 'foot small', text: t('settings.gfxTip') }),
    onoff('sound', t('settings.sound'), v => { if (v) { unlock(); sfx.good(); } }),
    onoff('haptics', t('settings.haptics'), v => { if (v) buzz(40); }),
    onoff('reduceMotion', t('settings.motion'), v => { document.documentElement.dataset.motion = v ? 'reduce' : ''; }),
    installEvt ? h('button', { class: 'btn', onclick: async () => { installEvt.prompt(); installEvt = null; closeModal(); } }, '📲 ' + t('settings.install')) : null,
    h('p', { class: 'foot small', text: t('settings.about') }),
    h('button', { class: 'btn primary', onclick: closeModal }, t('ok')));
  openModal(body);
}

// ---------- local match setup ----------
const KINDS = ['human', ...PERSONA_KEYS, 'off'];
const presets = {
  now: () => ({ kinds: ['human', 'bunty', 'professor', 'dadi'], tokens: 4 }),
  quick: () => ({ kinds: ['human', 'bunty', 'professor', 'dadi'], tokens: 2 }),
  friends: () => ({ kinds: ['human', 'human', 'off', 'off'], tokens: 4 }),
};

function openSetup(cfg) {
  show('setup', () => {
    const kinds = [...cfg.kinds]; let tokens = cfg.tokens;
    const rows = h('div', { class: 'rows' });
    const label = k => k === 'human' ? t('p.human') : k === 'off' ? t('p.off') : t('p.' + k);
    const draw = () => {
      rows.replaceChildren(...kinds.map((k, c) => h('button', { class: `setup-row ${k === 'off' ? 'off' : ''}`, style: `--c:${PALETTE[c]}`, onclick: () => { kinds[c] = KINDS[(KINDS.indexOf(k) + 1) % KINDS.length]; sfx.click(); draw(); } },
        h('span', { class: 'dot' }), h('span', { class: 'who', text: label(k) }), h('span', { class: 'emoji', text: k === 'human' ? '🙂' : k === 'off' ? '' : PERSONAS[k].emoji }))));
      startBtn.disabled = kinds.filter(k => k !== 'off').length < 2;
    };
    const startBtn = h('button', { class: 'btn primary big', onclick: () => { unlock(); startLocal({ kinds, tokens }); } }, t('setup.start'));
    const tokSeg = h('div', { class: 'seg' }, ...[4, 2].map(n => h('button', { class: n === tokens ? 'on' : '', onclick: e => { tokens = n; [...e.target.parentNode.children].forEach(b => b.classList.toggle('on', b === e.target)); } }, String(n))));
    draw();
    return h('main', { class: 'page' }, topbar(t('setup.title')), h('p', { class: 'muted', text: t('setup.tap') }), rows,
      h('div', { class: 'row' }, h('span', { text: t('setup.mode') }), tokSeg), startBtn);
  });
}

function namesFor(kinds) {
  const humans = kinds.filter(k => k === 'human').length;
  let hn = 0; const names = {}, avatars = {}, kindMap = {};
  kinds.forEach((k, c) => {
    if (k === 'off') return;
    kindMap[c] = k;
    if (k === 'human') { hn++; names[c] = humans === 1 ? t('p.you') : t('n.player', { n: hn }); }
    else { names[c] = t('n.' + k); avatars[c] = PERSONAS[k].emoji; }
  });
  return { names, avatars, kindMap };
}

async function startLocal(setup) {
  const colors = setup.kinds.map((k, c) => (k === 'off' ? -1 : c)).filter(c => c >= 0);
  const { names, avatars, kindMap } = namesFor(setup.kinds);
  const seed = newSeed();
  const match = { cfg: { colors, tokens: setup.tokens }, kinds: kindMap, seed, commit: await commitOf(seed), log: [], startedAt: Date.now() };
  runLocal(match);
}
function resumeLocal() {
  const m = db().match;
  if (!m) return;
  try { replay(m.cfg, m.log); } catch { update(d => { d.match = null; }); toast('⚠️'); return goHome(); }
  runLocal(m);
}

function runLocal(match) {
  show('game', () => {
    const { colors, tokens } = match.cfg;
    const state = replay(match.cfg, match.log);
    const kindsArr = [0, 1, 2, 3].map(c => match.kinds[c] || 'off');
    const { names, avatars } = namesFor(kindsArr);
    const lockBtn = h('button', { class: 'chip-lock', onclick: () => openModal(h('div', { class: 'settings' }, h('h2', { text: '🔒 ' + t('game.locked') }), h('p', { text: t('game.lockedTip') }), h('code', { class: 'mono', text: match.commit }), h('button', { class: 'btn primary', onclick: closeModal }, t('ok')))) }, '🔒 ' + match.commit.slice(0, 6));
    const soundBtn = h('button', { class: 'icon-btn ghost', 'aria-label': t('settings.sound'), onclick: openSettings }, '⚙');
    const v = view = new GameView({ colors, tokens, names, avatars, gfx: gfxMode() });
    if (v.is3d) { const firstHuman = colors.find(c => match.kinds[c] === 'human'); v.board.setViewColor(firstHuman === undefined ? colors[0] : firstHuman, true); v.board.setInsets(214, 118); }
    const my = ctl = { dead: false };
    v.place(state, 0);
    v.dockHint.textContent = '';
    (async () => {
      v.setBubble(match.log.length ? '' : say('start'));
      try {
        while (state.winner === null && !my.dead) {
          const color = current(state), kind = match.kinds[color];
          v.setTurn(color);
          if (kind === 'human') { if (!v.is3d) v.dockHint.textContent = t('game.tapRoll'); await v.waitRoll(); v.dockHint.textContent = ''; }
          else { v.dockHint.textContent = t('game.turn', { name: names[color] }); await sleep(settings().reduceMotion ? 150 : 600); }
          if (my.dead) return;
          const roll = await rollAt(match.seed, match.log.length);
          await v.animateRoll(roll, color);
          if (my.dead) return;
          const forfeit = roll === 6 && state.sixes === 2;
          const legal = forfeit ? [] : legalMoves(state, roll);
          let tok = null;
          if (legal.length) {
            const positions = new Set(legal.map(i => state.toks[color][i]));
            if (kind === 'human') {
              if (positions.size === 1) { v.board.hint(color, legal[0]); await sleep(260); tok = legal[0]; v.board.clearMovable(); }
              else { v.dockHint.textContent = t('game.pick'); tok = await v.pickToken(color, legal); v.dockHint.textContent = ''; }
            } else {
              tok = chooseMove(state, roll, legal, kind);
              v.board.hint(color, tok); await sleep(settings().reduceMotion ? 60 : 320); v.board.clearMovable();
            }
          }
          const ev = step(state, roll, tok);
          match.log = state.log;
          update(d => { d.match = match; });
          await v.playEvent(ev, state);
        }
        if (state.winner !== null && !my.dead) { await sleep(900); finishLocal(match, state, names, avatars); }
      } catch (e) { if (e.message !== 'cancel') console.error(e); }
    })();
    return h('main', { class: 'page game-page' }, topbar(t('app.name'), { lock: lockBtn, right: soundBtn }), v.root);
  });
}

function rollsByColor(cfg, log) {
  const s = createState(cfg);
  const per = {};
  for (const c of cfg.colors) per[c] = [];
  for (const [r, tok] of log) { per[current(s)].push(r); step(s, r, tok < 0 ? null : tok); }
  return per;
}

function statsPanel(cfg, log, names) {
  const per = rollsByColor(cfg, log);
  const wrap = h('div', { class: 'stats' });
  for (const c of cfg.colors) {
    const st = faceStats(per[c]);
    const max = Math.max(...st.counts, st.expected * 1.4, 1);
    const bars = h('div', { class: 'bars' }, h('i', { class: 'exp', style: `bottom:${(st.expected / max) * 100}%` }),
      ...st.counts.map((n, i) => h('div', { class: 'bar' }, h('b', { style: `height:${(n / max) * 100}%;background:${PALETTE[c]}` }), h('span', { text: String(i + 1) }))));
    wrap.append(h('div', { class: 'stat' }, h('div', { class: 'stat-h' }, h('b', { text: names[c] }), h('small', { text: `${st.total} ${t('res.rolls')} · ${st.counts[5]} ${t('res.sixes')}` })), bars));
  }
  return wrap;
}

function finishLocal(match, state, names, avatars) {
  const winner = state.winner;
  const humanWon = match.kinds[winner] === 'human' && Object.values(match.kinds).filter(k => k === 'human').length === 1;
  update(d => {
    d.stats.games++; if (match.kinds[winner] === 'human') d.stats.wins++;
    d.stats.sixes += match.log.filter(([r]) => r === 6).length;
    d.match = null;
  });
  const order = standings(state);
  const verifyOut = h('div', { class: 'verify-out' });
  const body = h('div', { class: 'result' },
    h('h2', { class: 'win-h', text: humanWon ? t('res.youwin') : t('res.win', { name: names[winner] }) }),
    h('ol', { class: 'standings' }, ...order.map((c, i) => h('li', { style: `--c:${PALETTE[c]}`, 'data-rank': ['🥇', '🥈', '🥉', '4'][i] || String(i + 1) }, h('span', { class: 'dot' }), h('b', { text: names[c] }), h('small', { text: t('res.homeTokens', { n: homeCount(state, c) }) })))),
    h('h3', { text: t('res.stats') }), h('p', { class: 'muted small', text: t('res.statsNote') }),
    statsPanel(match.cfg, match.log, names),
    h('button', { class: 'btn', id: 'verify-btn', onclick: async e => {
      e.target.disabled = true; verifyOut.textContent = t('res.verifying', { n: match.log.length });
      const rolls = match.log.map(([r]) => r);
      const r = await verifyRolls(match.seed, match.commit, rolls);
      verifyOut.replaceChildren(h('p', { class: r.ok ? 'ok' : 'bad', text: r.ok ? t('res.verified', { n: rolls.length }) : t('res.failed') }),
        h('div', { class: 'kv' }, h('small', { text: t('res.commit') }), h('code', { class: 'mono', text: match.commit }), h('small', { text: t('res.seed') }), h('code', { class: 'mono', text: match.seed })));
    } }, '🔍 ' + t('res.verify')),
    verifyOut,
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn primary', onclick: () => { closeModal(); const k = Object.keys(match.kinds).map(Number); const setup = { kinds: [0, 1, 2, 3].map(c => match.kinds[c] || 'off'), tokens: match.cfg.tokens }; startLocal(setup); } }, t('res.again')),
      h('button', { class: 'btn', onclick: () => { closeModal(); goHome(); } }, t('res.home'))));
  openModal(body);
}

// ---------- Roz ki Chaal (daily puzzle) ----------
function openDaily(n) {
  const today = dayNumber();
  n = Math.max(1, Math.min(n, today));
  show('daily', () => {
    const puz = generatePuzzle(n);
    const fresh = () => ({ toks: { 0: [...puz.toks[0]], 1: [...puz.toks[1]], 2: [...puz.toks[2]], 3: [...puz.toks[3]] }, rollNo: 0, caps: 0, picks: [], marks: [] });
    let g = fresh(); let tries = 1; let hist = [];
    const snap = skip => hist.push({ skip, s: JSON.stringify(g) });
    const counts = { 0: 4, 1: puz.toks[1].length, 2: puz.toks[2].length, 3: puz.toks[3].length };
    const names = { 0: t('p.you'), 1: '', 2: '', 3: '' };
    const gv = view = new GameView({ colors: [0, 1, 2, 3], tokens: 4, names: { 0: t('p.you'), 1: ' ', 2: ' ', 3: ' ' }, counts, gfx: gfxMode(), dice: false });
    if (gv.is3d) gv.board.setViewColor(0, true);
    gv.chips.remove(); gv.dock.remove();
    const rollsEl = h('div', { class: 'rolls', 'aria-label': t('daily.rolls') });
    const msg = h('div', { class: 'bubble' });
    const hintLeft = () => 3 - (db().puzzle.hints[today] || 0);
    const hintBtn = h('button', { class: 'btn', onclick: useHint });
    const undoBtn = h('button', { class: 'btn', onclick: undo }, '↶ ' + t('daily.undo'));
    const resetBtn = h('button', { class: 'btn', onclick: () => { tries++; g = fresh(); hist = []; renderAll(); } }, '⟲ ' + t('daily.reset'));
    const state = () => ({ toks: g.toks });
    const my = ctl = { dead: false };
    const tierName = t('daily.' + TIERS[puz.tier]);

    function renderRolls() {
      rollsEl.replaceChildren(...puz.rolls.map((r, i) => h('div', { class: `roll-chip ${i < g.rollNo ? 'done' : ''} ${i === g.rollNo ? 'now' : ''}` },
        h('span', { class: 'die-mini', 'data-f': r }, ...Array.from({ length: 9 }, (_, k) => h('i', { class: ({ 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] })[r].includes(k + 1) ? 'on' : '' })))
        , g.marks[i] ? h('small', { text: g.marks[i] }) : null)));
    }
    function renderAll() {
      gv.board.clearMovable();
      gv.board.place(g.toks, 120);
      renderRolls();
      hintBtn.textContent = hintLeft() > 0 ? '💡 ' + t('daily.hint', { n: hintLeft() }) : '💡 ' + t('daily.noHint');
      undoBtn.disabled = hist.length === 0;
      next();
    }
    function next() {
      if (my.dead) return;
      if (g.rollNo >= puz.rolls.length) return finish();
      const roll = puz.rolls[g.rollNo];
      const legal = (function () { const out = []; g.toks[0].forEach((p, i) => { if (p === -1) return; if (p < HOME && p + roll <= HOME) out.push(i); }); return out; })();
      if (!legal.length) {
        msg.textContent = t('daily.skip'); snap(true); g.marks[g.rollNo] = '⏭'; g.picks.push(-1); g.rollNo++;
        setTimeout(() => { if (!my.dead) { renderRolls(); next(); } }, 700); return;
      }
      msg.textContent = t('daily.pick', { n: g.rollNo + 1 });
      gv.board.setMovable(0, legal, async i => {
        gv.board.clearMovable();
        snap(false);
        const m = playRoll(puz, g.toks, g.rollNo, i);
        g.picks.push(i); g.caps += m.captured.length;
        g.marks[g.rollNo] = m.captured.length ? '💥' : m.home ? '🏠' : '🟥';
        sfx.step();
        await gv.board.moveAlong(0, i, m.path);
        if (m.captured.length) { sfx.capture(); buzz([40, 30, 90]); gv.board.flash(...cellOf(0, m.to, i), '#ff3d00'); gv.board.shake(1); await Promise.all(m.captured.map(c => gv.board.slinkHome(c.color, c.idx))); }
        if (m.home) { sfx.home(); gv.board.bloom(...cellOf(0, m.to, i), 0); }
        g.rollNo++;
        if (my.dead) return;
        gv.board.place(g.toks, 120); renderRolls(); undoBtn.disabled = false;
        next();
      });
    }
    const cellOf = (c, p, i) => cellXY(c, p, i);
    function undo() {
      if (!hist.length) return;
      // rewind through auto-skipped rolls back to the last real choice
      let e;
      do { e = hist.pop(); g = JSON.parse(e.s); } while (e.skip && hist.length);
      renderAll();
    }
    function useHint() {
      if (hintLeft() <= 0) return toast(t('daily.noHint'));
      const { first } = solve(puz, 5, { toks: g.toks, rollNo: g.rollNo, caps: g.caps });
      if (!first) { toast(t('daily.failed')); return; }
      update(d => { d.puzzle.hints[today] = (d.puzzle.hints[today] || 0) + 1; });
      const idx = first.find(x => x >= 0);
      if (idx !== undefined) gv.board.hint(0, idx);
      hintBtn.textContent = '💡 ' + t('daily.hint', { n: hintLeft() });
    }
    function finish() {
      const ok = isGoalMet(puz, g.toks, g.caps);
      if (!ok) { sfx.bad(); msg.textContent = t('daily.failed'); undoBtn.disabled = hist.length === 0; return; }
      sfx.win(); buzz([30, 40, 80]); gv.confetti(); gv.board.bloom(7.5, 7.5, 0, true);
      msg.textContent = t('daily.solved');
      update(d => {
        if (!d.puzzle.solved[n]) {
          d.puzzle.solved[n] = { tries };
          if (n === today) { d.puzzle.streak = d.puzzle.lastSolvedDay === today - 1 ? d.puzzle.streak + 1 : (d.puzzle.lastSolvedDay === today ? d.puzzle.streak : 1); d.puzzle.lastSolvedDay = today; }
        }
      });
      const grid = g.marks.join('');
      const text = `🎲 ${t('daily.title', { n })} · ${tierName}\n${grid} · ${t('daily.tries', { n: tries })}\n${location.origin}${location.pathname}`;
      setTimeout(() => openModal(h('div', { class: 'result' }, h('h2', { text: t('daily.solved') }), h('p', { class: 'share-grid', text: grid }), h('p', { class: 'muted', text: t('daily.tries', { n: tries }) }),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn primary', onclick: async () => { try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast(t('daily.copied')); } } catch { try { await navigator.clipboard.writeText(text); toast(t('daily.copied')); } catch { /* ignore */ } } } }, '📤 ' + t('daily.share')),
          n < today ? h('button', { class: 'btn', onclick: () => { closeModal(); openDaily(n + 1); } }, t('daily.next')) : h('button', { class: 'btn', onclick: () => { closeModal(); goHome(); } }, t('res.home'))))), 900);
    }
    const older = h('div', { class: 'older' }, h('small', { text: t('daily.older') }), h('div', { class: 'older-row' }, ...Array.from({ length: Math.min(8, today) }, (_, k) => today - k).map(m => h('button', { class: `pill ${m === n ? 'on' : ''}`, onclick: () => openDaily(m) }, `#${m}${db().puzzle.solved[m] ? ' ✓' : ''}`))));
    const head = h('div', { class: 'puz-head' }, h('b', { text: t('daily.title', { n }) }), h('span', { class: `tier t${puz.tier}`, text: tierName }), h('div', { class: 'goal', text: '🎯 ' + t(GOAL_KEY[puz.goal]) }));
    const el = h('main', { class: 'page daily-page' }, topbar(t('home.daily')), head, rollsEl, gv.boardWrap, msg, h('div', { class: 'btn-row wrap' }, undoBtn, resetBtn, hintBtn), older);
    gv.place({ toks: g.toks, colors: [0, 1, 2, 3] }, 0);
    setTimeout(renderAll, 0);
    return el;
  });
}

// ---------- Parivaar Board (async family play) ----------
function openFamilyNew() {
  show('fam-new', () => {
    const defaults = ['Papa', 'Mummy', 'Dadi', 'Bhai'];
    let count = 2, tokens = 4;
    const inputs = defaults.map((d, i) => h('input', { class: 'inp', maxlength: 14, value: d, 'aria-label': `${t('n.player', { n: i + 1 })}` }));
    const list = h('div', { class: 'rows' });
    const seatColors = () => (count === 2 ? [0, 2] : [0, 1, 2, 3]); // must match the colours assigned on create
    const draw = () => list.replaceChildren(...inputs.slice(0, count).map((inp, i) => h('label', { class: 'name-row', style: `--c:${PALETTE[seatColors()[i]]}` }, h('span', { class: 'dot' }), inp)));
    const cnt = h('div', { class: 'seg' }, ...[2, 3, 4].map(n => h('button', { class: n === count ? 'on' : '', onclick: e => { count = n; [...e.target.parentNode.children].forEach(b => b.classList.toggle('on', b === e.target)); draw(); } }, String(n))));
    const tok = h('div', { class: 'seg' }, ...[4, 2].map(n => h('button', { class: n === tokens ? 'on' : '', onclick: e => { tokens = n; [...e.target.parentNode.children].forEach(b => b.classList.toggle('on', b === e.target)); } }, String(n))));
    draw();
    return h('main', { class: 'page' }, topbar(t('fam.title')), h('p', { class: 'muted', text: t('fam.intro') }),
      h('h3', { text: t('fam.names') }), h('div', { class: 'row' }, h('span', { text: '👥' }), cnt), list,
      h('div', { class: 'row' }, h('span', { text: t('setup.mode') }), tok),
      h('button', { class: 'btn primary big', onclick: async () => {
        unlock();
        const colors = count === 2 ? [0, 2] : count === 3 ? [0, 1, 2] : [0, 1, 2, 3];
        const seats = colors.map((c, i) => ({ c, name: (inputs[i].value.trim() || defaults[i]).slice(0, 14), commit: '' }));
        const room = { id: newRoomId(), tokens, seats, log: [], reveals: {} };
        const seed = newSeed(); const commit = await commitOf(seed);
        seats[0].commit = commit;
        setSeat(room.id, { seat: 0, seed, commit });
        openFamily(room);
      } }, t('fam.create')),
      h('p', { class: 'muted small', text: t('fam.note') }));
  });
}

const roomUrl = room => `${location.origin}${location.pathname}#p=${encodeRoom(room)}`;
function syncHash(room) { try { history.replaceState(history.state, '', '#p=' + encodeRoom(room)); } catch { /* ignore */ } }

async function openFamily(room, { fromLink = false } = {}) {
  let me = getSeat(room.id);
  if (!me) {
    // choose who you are
    return show('fam-who', () => h('main', { class: 'page' }, topbar(t('fam.title')), h('h2', { text: t('fam.who') }),
      h('div', { class: 'rows' }, ...room.seats.map((s, i) => h('button', { class: 'setup-row', style: `--c:${PALETTE[s.c]}`, onclick: async () => {
        const seed = newSeed(); const commit = await commitOf(seed);
        setSeat(room.id, { seat: i, seed, commit }); openFamily(room);
      } }, h('span', { class: 'dot' }), h('span', { class: 'who', text: s.name }))))), { push: !fromLink });
  }
  renderFamily(room, me, { push: !fromLink });
}

function renderFamily(room, me, { push = true } = {}) {
  show('fam-game', () => {
    syncHash(room);
    const { state } = roomState(room);
    const colors = room.seats.map(s => s.c);
    const names = {}; room.seats.forEach(s => { names[s.c] = s.name; });
    const v = view = new GameView({ colors, tokens: room.tokens, names, gfx: gfxMode() });
    const my = ctl = { dead: false };
    v.place(state, 0);
    const mySeat = me.seat, myColor = room.seats[mySeat].c;
    if (v.is3d) { v.board.setViewColor(myColor, true); v.board.setInsets(214, 170); }
    const curSeat = state.turn, curName = room.seats[curSeat].name;
    const share = (seatIdx, forceCopy = false) => {
      const url = roomUrl(room);
      const text = `${t('fam.msg')} ${url}`;
      if (!forceCopy) {
        const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
        const w = window.open(wa, '_blank', 'noopener');
        if (!w) navigator.clipboard?.writeText(url).then(() => toast(t('fam.copied')));
      } else navigator.clipboard?.writeText(url).then(() => toast(t('fam.copied')), () => prompt('Link', url));
    };
    const shareRow = nextSeat => {
      v.extra.replaceChildren(h('button', { class: 'btn wa', onclick: () => share(nextSeat) }, '💬 ' + t('fam.send', { name: room.seats[nextSeat].name })), h('button', { class: 'btn', onclick: () => share(nextSeat, true) }, '🔗 ' + t('fam.copy')));
    };
    const switchSeat = h('button', { class: 'linkish', onclick: () => { try { localStorage.removeItem(`ludoadda.family.${room.id}`); } catch { /* ignore */ } openFamily(room); } }, `${names[myColor]} · ↺`);

    (async () => {
      try {
        if (state.winner !== null) { v.setTurn(state.winner); v.setBubble(say('win', { name: names[state.winner] })); return familyResult(room, me, state, names); }
        v.setTurn(state.colors[curSeat]);
        if (curSeat !== mySeat) {
          v.setBubble(t('fam.waiting', { name: curName })); v.dockHint.textContent = t('fam.waiting', { name: curName });
          shareRow(curSeat); return;
        }
        // my turn: keep going while I have extra turns
        let st = state;
        for (;;) {
          v.setTurn(myColor); v.setBubble(t('fam.yourTurn')); if (!v.is3d) v.dockHint.textContent = t('game.tapRoll'); v.extra.replaceChildren();
          await v.waitRoll(); v.dockHint.textContent = '';
          const { rollCounts } = roomState(room);
          const roll = await nextRoll(room, me.seed);
          if (!room.seats[mySeat].commit) room.seats[mySeat].commit = me.commit;
          await v.animateRoll(roll, myColor);
          const forfeit = roll === 6 && st.sixes === 2;
          const legal = forfeit ? [] : legalMoves(st, roll);
          let tok = null;
          if (legal.length) {
            const positions = new Set(legal.map(i => st.toks[myColor][i]));
            if (positions.size === 1) { v.board.hint(myColor, legal[0]); await sleep(260); tok = legal[0]; v.board.clearMovable(); }
            else { v.dockHint.textContent = t('game.pick'); tok = await v.pickToken(myColor, legal); v.dockHint.textContent = ''; }
          }
          const ev = step(st, roll, tok);
          room.log.push([roll, tok === null ? -1 : tok]);
          syncHash(room);
          await v.playEvent(ev, st);
          if (st.winner !== null) { familyResult(room, me, st, names); return; }
          if (!ev.extra) break;
        }
        const nextSeat = st.turn;
        v.setTurn(st.colors[nextSeat]);
        v.dockHint.textContent = t('fam.waiting', { name: room.seats[nextSeat].name });
        shareRow(nextSeat);
      } catch (e) { if (e.message !== 'cancel') console.error(e); }
    })();
    return h('main', { class: 'page game-page' }, topbar(t('fam.title'), { right: switchSeat }), v.root);
  }, { push });
}

async function familyResult(room, me, state, names) {
  const out = h('div', { class: 'verify-out' });
  const refresh = async () => {
    const res = await verifyRoom(room);
    out.replaceChildren(...res.map(r => h('p', { class: r.revealed ? (r.ok ? 'ok' : 'bad') : 'muted', text: !r.revealed ? t('fam.seatPending', { name: room.seats[r.seat].name }) : r.ok ? t('fam.seatOk', { name: room.seats[r.seat].name, n: r.rolls }) : t('fam.seatBad', { name: room.seats[r.seat].name }) })));
  };
  await refresh();
  const order = standings(state);
  const body = h('div', { class: 'result' },
    h('h2', { class: 'win-h', text: t('res.win', { name: names[state.winner] }) }),
    h('ol', { class: 'standings' }, ...order.map((c, i) => h('li', { style: `--c:${PALETTE[c]}`, 'data-rank': ['🥇', '🥈', '🥉', '4'][i] || String(i + 1) }, h('span', { class: 'dot' }), h('b', { text: names[c] }), h('small', { text: t('res.homeTokens', { n: homeCount(state, c) }) })))),
    h('p', { class: 'muted small', text: t('fam.verifyNote') }),
    statsPanel({ colors: room.seats.map(s => s.c), tokens: room.tokens }, room.log, names),
    h('button', { class: 'btn', onclick: async e => { room.reveals[me.seat] = me.seed; syncHash(room); await refresh(); navigator.clipboard?.writeText(roomUrl(room)).then(() => toast(t('fam.copied'))); e.target.disabled = true; } }, '🔓 ' + t('fam.reveal')), out,
    h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: () => { closeModal(); goHome(); } }, t('res.home'))));
  openModal(body);
}

// ---------- boot ----------
async function boot() {
  const st = settings();
  setLang(st.lang);
  const prefersReduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (st.reduceMotion || (prefersReduce && st.reduceMotion !== false)) document.documentElement.dataset.motion = 'reduce';
  await initGfx();
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
  document.addEventListener('pointerdown', unlock, { once: true });
  // A family link tapped while the app is already open only changes the hash (no reload).
  // syncHash() uses replaceState, which does not fire this, so only external links arrive here.
  window.addEventListener('hashchange', () => {
    const hm = location.hash.match(/^#p=(.+)$/);
    if (!hm) return;
    try { openFamily(decodeRoom(hm[1])); } catch { toast(t('fam.badLink')); }
  });
  const m = location.hash.match(/^#p=(.+)$/);
  if (m) {
    try {
      const room = decodeRoom(m[1]);
      history.replaceState({ s: 'home0' }, '', location.pathname + location.search);
      openFamily(room); return;
    }
    catch { toast(t('fam.badLink')); }
  }
  if (!app.firstChild) show('home', homeScreen, { push: false }); // never paint over a screen the user already opened
}
boot();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').then(() => {
    if (!navigator.serviceWorker.controller) setTimeout(() => toast(t('offline.ready')), 1200);
  }).catch(() => {}));
}
window.__ludo = { show, goHome, startLocal, openDaily, gfxMode, board: () => view && view.board };
