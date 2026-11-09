// SVG board renderer. Reads token positions from the rules model; owns all animation.
import { TRACK, HOME_COL, START_IDX, SAFE, HOME, cellXY } from './rules.js';
import { s, sleep, reduceMotion } from './ui.js';

export const PALETTE = ['#e53935', '#2e9d4f', '#f4b400', '#1e6fd9'];
export const TINT = ['#fde0df', '#d9f0e0', '#fdf0c4', '#d8e7fb'];
export const DARK = ['#a3201d', '#1c6b34', '#b78600', '#144a96'];
const BASE_ORIGIN = [[0, 0], [9, 0], [9, 9], [0, 9]];

function star(cx, cy, r, fill) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.42 : r;
    pts.push((cx + Math.cos(a) * rad).toFixed(3) + ',' + (cy + Math.sin(a) * rad).toFixed(3));
  }
  return s('polygon', { points: pts.join(' '), fill, 'pointer-events': 'none' });
}

export class Board {
  constructor(container, { colors, tokens, counts }) {
    this.colors = colors; this.n = tokens; this.counts = counts || null;
    this.svg = s('svg', { viewBox: '0 0 15 15', class: 'board', role: 'img', 'aria-label': 'Ludo board' });
    this.layerFx = s('g', { class: 'fx-layer' });
    this.layerTok = s('g', { class: 'tok-layer' });
    this.tokens = new Map();
    this.draw();
    this.svg.append(this.layerTok, this.layerFx);
    container.replaceChildren(this.svg);
    for (const c of colors) for (let i = 0; i < (counts ? counts[c] : tokens); i++) this.makeToken(c, i);
  }

  draw() {
    const g = s('g');
    g.append(s('rect', { x: 0, y: 0, width: 15, height: 15, rx: 0.5, fill: '#fff8ea' }));
    const active = new Set(this.colors);
    for (let c = 0; c < 4; c++) {
      const [ox, oy] = BASE_ORIGIN[c];
      const on = active.has(c);
      g.append(s('rect', { x: ox, y: oy, width: 6, height: 6, fill: on ? PALETTE[c] : '#cfc8bb' }));
      g.append(s('rect', { x: ox + 0.9, y: oy + 0.9, width: 4.2, height: 4.2, rx: 0.7, fill: '#fffdf7' }));
      for (const [sx, sy] of [[2, 2], [4, 2], [2, 4], [4, 4]]) {
        g.append(s('circle', { cx: ox + sx, cy: oy + sy, r: 0.55, fill: on ? TINT[c] : '#ece7dd' }));
      }
    }
    // track cells
    TRACK.forEach(([c, r], i) => {
      const startOf = START_IDX.indexOf(i);
      const fill = startOf >= 0 && active.has(startOf) ? PALETTE[startOf] : '#ffffff';
      g.append(s('rect', { x: c, y: r, width: 1, height: 1, fill, stroke: '#d8cfbf', 'stroke-width': 0.04 }));
      if (SAFE.has(i)) g.append(star(c + 0.5, r + 0.5, 0.34, startOf >= 0 && active.has(startOf) ? '#ffffff' : '#c7a24a'));
    });
    HOME_COL.forEach((col, c) => col.forEach(([x, y]) => {
      g.append(s('rect', { x, y, width: 1, height: 1, fill: active.has(c) ? PALETTE[c] : '#cfc8bb', stroke: '#fff8ea', 'stroke-width': 0.04, opacity: 0.92 }));
    }));
    const tri = [
      ['6,6 6,9 7.5,7.5', 0], ['6,6 9,6 7.5,7.5', 1], ['9,6 9,9 7.5,7.5', 2], ['6,9 9,9 7.5,7.5', 3],
    ];
    for (const [pts, c] of tri) g.append(s('polygon', { points: pts, fill: active.has(c) ? PALETTE[c] : '#cfc8bb', stroke: '#fff8ea', 'stroke-width': 0.05 }));
    this.svg.append(g);
  }

  makeToken(c, i) {
    const inner = s('g', { class: 'tk-in' },
      s('circle', { class: 'tk-hit', r: 0.62, fill: 'transparent' }),
      s('circle', { class: 'tk-ring', r: 0.5, fill: 'none', stroke: '#fff', 'stroke-width': 0.1 }),
      s('ellipse', { cx: 0.03, cy: 0.12, rx: 0.34, ry: 0.3, fill: 'rgba(0,0,0,.28)' }),
      s('circle', { class: 'tk-body', r: 0.34, fill: PALETTE[c], stroke: DARK[c], 'stroke-width': 0.07 }),
      s('circle', { cx: -0.1, cy: -0.11, r: 0.1, fill: 'rgba(255,255,255,.55)' }),
    );
    const g = s('g', { class: 'tk', 'data-c': c, 'data-i': i, tabindex: '-1', role: 'button', 'aria-label': `${['red', 'green', 'yellow', 'blue'][c]} token ${i + 1}` }, inner);
    this.layerTok.append(g);
    this.tokens.set(`${c}-${i}`, { g, inner, pos: -1 });
    this.setXY(c, i, ...cellXY(c, -1, i), 1);
  }

  setXY(c, i, x, y, scale = 1, ms) {
    const t = this.tokens.get(`${c}-${i}`);
    t.g.style.transition = ms === undefined ? '' : `transform ${ms}ms cubic-bezier(.2,.8,.3,1)`;
    t.g.style.transform = `translate(${x}px, ${y}px)`;
    t.inner.style.transform = scale === 1 ? '' : `scale(${scale})`;
  }

  /** Lay out every token from the model, fanning out tokens that share a cell. */
  place(toks, animateMs = 0) {
    const groups = new Map();
    for (const c of this.colors) toks[c].forEach((p, i) => {
      const key = p === -1 ? `b${c}${i}` : p === HOME ? `f${c}` : p <= 50 ? `t${(START_IDX[c] + p) % 52}` : `h${c}-${p}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push([c, i, p]);
    });
    const off = [[0, 0], [-0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]];
    for (const list of groups.values()) {
      list.forEach(([c, i, p], k) => {
        const [x, y] = cellXY(c, p, i);
        const many = list.length > 1 && p !== HOME && p !== -1;
        const o = many ? (list.length === 2 ? [[-0.17, 0], [0.17, 0]][k] : off[k % 4]) : [0, 0];
        this.setXY(c, i, x + o[0], y + o[1], many ? 0.78 : 1, animateMs);
        this.tokens.get(`${c}-${i}`).pos = p;
      });
    }
  }

  front(c, i) { const t = this.tokens.get(`${c}-${i}`); this.layerTok.append(t.g); }

  async hopTo(c, i, p, ms) {
    const [x, y] = cellXY(c, p, i);
    this.setXY(c, i, x, y, 1, ms);
    const t = this.tokens.get(`${c}-${i}`);
    if (!reduceMotion() && t.inner.animate) {
      t.inner.animate([{ transform: 'translateY(0) scale(1,1)' }, { transform: 'translateY(-0.28px) scale(.94,1.1)', offset: 0.45 }, { transform: 'translateY(0) scale(1.1,.88)', offset: 0.85 }, { transform: 'translateY(0) scale(1,1)' }], { duration: ms });
    }
    await sleep(ms);
    t.pos = p;
  }

  async moveAlong(c, i, positions) {
    this.front(c, i);
    const ms = reduceMotion() ? 40 : Math.max(70, Math.min(135, 900 / positions.length));
    for (const p of positions) await this.hopTo(c, i, p, ms);
  }

  async slinkHome(c, i) {
    const [x, y] = cellXY(c, -1, i);
    this.setXY(c, i, x, y, 1, reduceMotion() ? 60 : 480);
    const t = this.tokens.get(`${c}-${i}`);
    if (!reduceMotion() && t.inner.animate) t.inner.animate([{ transform: 'scale(1)' }, { transform: 'scale(.6,1.25)', offset: 0.3 }, { transform: 'scale(1.15,.8)', offset: 0.9 }, { transform: 'scale(1)' }], { duration: 480 });
    t.pos = -1;
    await sleep(reduceMotion() ? 60 : 480);
  }

  setMovable(color, list, onPick) {
    this.clearMovable();
    this._handlers = [];
    for (const i of list) {
      const t = this.tokens.get(`${color}-${i}`);
      t.g.classList.add('can');
      t.g.setAttribute('tabindex', '0');
      const fn = e => { e.preventDefault(); e.stopPropagation(); onPick(i); };
      const key = e => { if (e.key === 'Enter' || e.key === ' ') fn(e); };
      t.g.addEventListener('pointerdown', fn);
      t.g.addEventListener('keydown', key);
      this._handlers.push([t.g, fn, key]);
    }
  }
  clearMovable() {
    for (const t of this.tokens.values()) { t.g.classList.remove('can', 'hint'); t.g.setAttribute('tabindex', '-1'); }
    for (const [g, fn, key] of this._handlers || []) { g.removeEventListener('pointerdown', fn); g.removeEventListener('keydown', key); }
    this._handlers = [];
  }
  hint(c, i) { this.tokens.get(`${c}-${i}`).g.classList.add('hint'); }

  /** Rangoli bloom: petals expand and fade (reward feedback for reaching home). */
  bloom(x, y, color, big = false) {
    if (reduceMotion()) return;
    const g = s('g', { transform: `translate(${x} ${y})`, 'pointer-events': 'none' });
    const petals = big ? 12 : 8;
    for (let k = 0; k < petals; k++) {
      const a = (k / petals) * Math.PI * 2;
      const p = s('circle', { r: 0.2, fill: k % 2 ? PALETTE[color] : '#ffd54f' });
      g.append(p);
      p.animate([{ transform: 'translate(0,0) scale(.3)', opacity: 1 }, { transform: `translate(${Math.cos(a) * (big ? 1.7 : 1.1)}px,${Math.sin(a) * (big ? 1.7 : 1.1)}px) scale(1.2)`, opacity: 0.9, offset: 0.55 }, { transform: `translate(${Math.cos(a) * (big ? 2.1 : 1.4)}px,${Math.sin(a) * (big ? 2.1 : 1.4)}px) scale(.2)`, opacity: 0 }], { duration: big ? 1100 : 800, easing: 'ease-out' });
    }
    this.layerFx.append(g);
    setTimeout(() => g.remove(), 1200);
  }

  flash(x, y, color) {
    if (reduceMotion()) return;
    const c = s('circle', { cx: x, cy: y, r: 0.4, fill: 'none', stroke: color, 'stroke-width': 0.12, 'pointer-events': 'none' });
    this.layerFx.append(c);
    c.animate([{ transform: 'scale(.3)', opacity: 1, transformOrigin: `${x}px ${y}px` }, { transform: 'scale(2.4)', opacity: 0, transformOrigin: `${x}px ${y}px` }], { duration: 520, easing: 'ease-out' });
    setTimeout(() => c.remove(), 600);
  }

  /** Decaying shake (game-feel "trauma"): small for a six, bigger for a capture. */
  shake(amount = 1) {
    if (reduceMotion() || !this.svg.animate) return;
    const frames = [];
    const n = 8;
    for (let k = 0; k <= n; k++) {
      const decay = (1 - k / n) ** 2 * amount;
      frames.push({ transform: `translate(${(k % 2 ? -1 : 1) * 5 * decay}px, ${(k % 3 ? 1 : -1) * 3 * decay}px) rotate(${(k % 2 ? -1 : 1) * 0.5 * decay}deg)` });
    }
    this.svg.animate(frames, { duration: 360 });
  }
}
