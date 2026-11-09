// GameView: board + player chips + dice + commentary. Applies layered feedback by event tier:
//   tier 1 roll  : tumble + tick       tier 2 six   : dhol + zoom pulse + buzz
//   tier 3 capture: hit-stop + shake + flash + slink home + "Arre!"
//   tier 4 home/win: rangoli bloom + shehnai + confetti
import { Board, PALETTE, DARK } from './board.js';
import { cellXY, SAFE, START_IDX, homeCount } from './rules.js';
import { h, sleep, reduceMotion } from './ui.js';
import { say, t } from './i18n.js';
import { sfx, buzz } from './audio.js';

// The 3D board is loaded lazily by app.js (so Lite mode / old phones never download it).
let Board3DClass = null;
export function setBoard3D(cls) { Board3DClass = cls; }

const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

export class GameView {
  constructor({ colors, tokens, names, avatars, counts, gfx = 'lite', dice = true }) {
    this.colors = colors; this.tokens = tokens; this.names = names; this.avatars = avatars || {};
    this.counts = counts || null;
    this.waiters = [];
    this.dead = false;
    this.root = h('div', { class: 'game' });
    this.chips = h('div', { class: 'players', role: 'list' });
    this.boardWrap = h('div', { class: 'board-wrap' });
    this.bubble = h('div', { class: 'bubble', 'aria-live': 'polite' });
    this.dice = h('button', { class: 'dice', 'aria-label': t('game.dice'), 'data-tip': t('game.tapRoll'), disabled: true },
      ...Array.from({ length: 9 }, (_, i) => h('span', { class: 'pip', 'data-p': i + 1 })));
    this.dockHint = h('div', { class: 'dock-hint' });
    this.extra = h('div', { class: 'dock-extra' });
    this.dock = h('div', { class: 'dock' }, this.dice, h('div', { class: 'dock-col' }, this.dockHint, this.extra));
    this.root.append(this.chips, this.boardWrap, this.bubble, this.dock);
    this.board = null;
    if (gfx === '3d' && Board3DClass) {
      try { this.board = new Board3DClass(this.boardWrap, { colors, tokens, counts, dice }); }
      catch (e) { console.warn('3D unavailable, using Lite board', e); this.boardWrap.replaceChildren(); this.board = null; }
    }
    if (!this.board) this.board = new Board(this.boardWrap, { colors, tokens, counts });
    this.is3d = !!this.board.is3d;
    if (this.is3d) {
      this.root.classList.add('m3d');
      if (this.board.useDice) this.board.bindDice(this.dice);
    }
    this.buildChips();
    this.setFace(1);
    this.dice.addEventListener('click', () => this.onDice && this.onDice());
  }

  buildChips() {
    this.chipEls = {};
    for (const c of this.colors) {
      const av = h('span', { class: 'avatar', style: `background:${PALETTE[c]};border-color:${DARK[c]}`, text: this.avatars[c] || this.names[c].slice(0, 1).toUpperCase() });
      const sc = h('span', { class: 'chip-score' });
      const el = h('div', { class: 'chip', role: 'listitem', style: `--c:${PALETTE[c]}` }, av, h('span', { class: 'chip-name', text: this.names[c] }), sc);
      this.chipEls[c] = { el, sc, av };
      this.chips.append(el);
    }
  }

  updateChips(state) {
    for (const c of this.colors) {
      const n = state.toks[c].length;
      this.chipEls[c].sc.textContent = `🏠 ${homeCount(state, c)}/${n}`;
    }
  }

  setTurn(color) {
    if (this.board.setTurn) this.board.setTurn(color);
    for (const c of this.colors) this.chipEls[c].el.classList.toggle('turn', c === color);
    this.dice.style.setProperty('--c', PALETTE[color]);
    this.dice.style.setProperty('--cd', DARK[color]);
  }

  setBubble(text) { this.bubble.textContent = text; }
  setFace(n) {
    this.dice.dataset.face = n;
    const on = new Set(PIPS[n]);
    this.dice.querySelectorAll('.pip').forEach(p => p.classList.toggle('on', on.has(+p.dataset.p)));
  }

  place(state, ms = 0) { this.board.place(state.toks, ms); this.updateChips(state); }

  destroy() {
    this.dead = true;
    if (this.board.dispose) this.board.dispose();
    this.waiters.forEach(w => w(new Error('cancel')));
    this.waiters = [];
    this.board.clearMovable();
  }

  /** Resolve when the player taps the dice. */
  waitRoll() {
    return new Promise((res, rej) => {
      const fail = e => rej(e);
      this.waiters.push(fail);
      this.dice.disabled = false;
      this.dice.classList.add('ready');
      if (this.board.setDiceWaiting) this.board.setDiceWaiting(true);
      this.onDice = () => {
        this.onDice = null;
        this.dice.disabled = true;
        this.dice.classList.remove('ready');
        if (this.board.setDiceWaiting) this.board.setDiceWaiting(false);
        this.waiters = this.waiters.filter(w => w !== fail);
        res();
      };
    });
  }

  pickToken(color, legal) {
    return new Promise((res, rej) => {
      const fail = e => rej(e);
      this.waiters.push(fail);
      this.board.setMovable(color, legal, i => {
        this.board.clearMovable();
        this.waiters = this.waiters.filter(w => w !== fail);
        res(i);
      });
    });
  }

  async animateRoll(value, color) {
    const d = this.dice;
    d.classList.remove('land', 'six');
    if (this.dead) return;
    sfx.roll(); buzz(12);
    if (this.is3d && this.board.rollDice) {
      await this.board.rollDice(value, { onBounce: () => sfx.step() });
      if (this.dead) return;
      sfx.land();
      this.setFace(value);
      if (value === 6) { sfx.six(); buzz([30, 30, 60]); this.board.shake(0.5); }
      return;
    }
    if (reduceMotion()) { this.setFace(value); await sleep(150); }
    else {
      d.classList.add('rolling');
      for (let k = 0; k < 7; k++) { this.setFace(1 + Math.floor(Math.random() * 6)); await sleep(70); if (this.dead) return; }
      this.setFace(value);
      d.classList.remove('rolling'); d.classList.add('land');
      await sleep(120);
    }
    sfx.land();
    if (value === 6) {
      d.classList.add('six');
      sfx.six(); buzz([30, 30, 60]);
      this.board.shake(0.5);
      this.boardWrap.classList.add('pulse');
      setTimeout(() => this.boardWrap.classList.remove('pulse'), 320);
    }
  }

  confetti() {
    if (reduceMotion()) return;
    const wrap = h('div', { class: 'confetti', 'aria-hidden': 'true' });
    const cols = ['#e53935', '#2e9d4f', '#f4b400', '#1e6fd9', '#ff7043', '#ab47bc'];
    for (let i = 0; i < 44; i++) {
      wrap.append(h('i', { style: `left:${Math.random() * 100}%;background:${cols[i % cols.length]};animation-delay:${Math.random() * 0.6}s;animation-duration:${1.6 + Math.random() * 1.4}s;transform:rotate(${Math.random() * 360}deg)` }));
    }
    this.boardWrap.append(wrap);
    setTimeout(() => wrap.remove(), 3400);
  }

  /** Animate one engine event. `state` is already post-move; `ev` describes it. */
  async playEvent(ev, state) {
    if (this.dead) return;
    const name = this.names[ev.color];
    if (ev.forfeit) {
      this.setBubble(say('forfeit', { name })); sfx.bad(); buzz([60, 40, 60]);
      await sleep(900); this.place(state, 0); return;
    }
    if (ev.pass) { this.setBubble(say('pass', { name })); await sleep(reduceMotion() ? 200 : 650); return; }

    const left = ev.from === -1;
    this.setBubble(ev.roll === 6 && !left ? say('six', { name }) : left ? say('leave', { name }) : say('roll', { name, n: ev.roll }));
    if (left) { sfx.leave(); }
    // the stepping hops
    this.board.front(ev.color, ev.token);
    const ms = reduceMotion() ? 40 : Math.max(70, Math.min(135, 900 / ev.path.length));
    for (const p of ev.path) {
      if (this.dead) return;
      sfx.step();
      await this.board.hopTo(ev.color, ev.token, p, ms);
    }
    const [x, y] = cellXY(ev.color, ev.to, ev.token);
    if (ev.captured.length) {
      // tier 3: hit-stop (real-time pause), then flash + shake + slink
      await sleep(reduceMotion() ? 0 : 90);
      sfx.capture(); buzz([40, 30, 90]);
      this.board.flash(x, y, '#ff3d00');
      this.board.shake(1.2);
      const victim = this.names[ev.captured[0].color];
      this.setBubble(say('capture', { name, victim }));
      for (const v of ev.captured) {
        const chip = this.chipEls[v.color].el;
        chip.classList.add('hit'); setTimeout(() => chip.classList.remove('hit'), 600);
      }
      await Promise.all(ev.captured.map(v => this.board.slinkHome(v.color, v.idx)));
    } else if (ev.to <= 50 && SAFE.has((START_IDX[ev.color] + ev.to) % 52) && !left && Math.random() < 0.35) {
      this.setBubble(say('safe', { name }));
    }
    if (ev.home) {
      sfx.home(); buzz([20, 40, 20, 40, 60]);
      this.board.bloom(x, y, ev.color, ev.win);
      this.setBubble(say(ev.win ? 'win' : 'home', { name }));
    }
    if (ev.win) { sfx.win(); this.confetti(); }
    this.place(state, 140);
    await sleep(reduceMotion() ? 30 : ev.home ? 450 : 160);
  }
}
