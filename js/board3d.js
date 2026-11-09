// 3D board renderer (three.js). Drop-in replacement for the 2D SVG Board: it reads token
// positions from the rules model and owns all animation. Coordinates passed in and out are the
// same 15x15 "board units" the SVG board uses, so the controllers do not care which one runs.
//
// Visual design: a rosewood table, a cream inlaid board with raised tiles, turned pawns, a
// rounded physical dice, PBR materials with a soft room reflection, and real shadows.
import * as THREE from '../vendor/three.min.js';
import { TRACK, HOME_COL, START_IDX, SAFE, HOME, cellXY } from './rules.js';

const PALETTE = [0xe53935, 0x2e9d4f, 0xf4b400, 0x1e6fd9];
const DARKER = [0xa3201d, 0x1c6b34, 0xb78600, 0x144a96];
const TINT = [0xfde0df, 0xd9f0e0, 0xfdf0c4, 0xd8e7fb];
const CSS = ['#e53935', '#2e9d4f', '#f4b400', '#1e6fd9'];
const OFF = 0xcfc8bb;
const TILE_TOP = 0.12, BASE_TOP = 0.22, TABLE_TOP = -0.5, PAWN = 1.14;
const BASE_ORIGIN = [[0, 0], [9, 0], [9, 9], [0, 9]];

const reduce = () => document.documentElement.dataset.motion === 'reduce';
const ease = { out: t => 1 - (1 - t) ** 3, inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2), lin: t => t };
const w = (x, y) => new THREE.Vector3(x - 7.5, 0, y - 7.5); // board units -> world (y is up)

export function webglSupported() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

function roundedRect(wd, ht, r) {
  const s = new THREE.Shape(), x = -wd / 2, y = -ht / 2;
  s.moveTo(x + r, y); s.lineTo(x + wd - r, y); s.quadraticCurveTo(x + wd, y, x + wd, y + r);
  s.lineTo(x + wd, y + ht - r); s.quadraticCurveTo(x + wd, y + ht, x + wd - r, y + ht);
  s.lineTo(x + r, y + ht); s.quadraticCurveTo(x, y + ht, x, y + ht - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// Extrude a 2D shape upward (+y). Bottom sits at y=0, top at y=depth.
function slab(shape, depth, bevel = 0.02) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
}
function starShape(r) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r * 0.42 : r;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i) s.lineTo(x, y); else s.moveTo(x, y);
  }
  s.closePath();
  return s;
}

function woodTexture(base, dark, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    const y = Math.random() * 512;
    g.strokeStyle = dark; g.globalAlpha = 0.05 + Math.random() * 0.12; g.lineWidth = 1 + Math.random() * 3;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 64) g.lineTo(x, y + Math.sin(x / 90 + i) * 5);
    g.stroke();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 4;
  return t;
}

function pipTexture(n) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S * 0.75);
  grad.addColorStop(0, '#fffaf0'); grad.addColorStop(1, '#f0e2c8');
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  const spots = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] }[n];
  for (const [cx, cy] of spots) {
    const x = S * (0.25 + cx * 0.25), y = S * (0.25 + cy * 0.25), r = n === 1 ? 40 : 27;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = n === 1 ? '#c62828' : '#16222b'; g.fill();
    g.beginPath(); g.arc(x - r * 0.25, y - r * 0.28, r * 0.28, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Rounded cube: subdivide a box and pull each vertex onto a rounded shape; set exact normals.
function roundedBoxGeometry(size = 1, radius = 0.14, seg = 8) {
  const g = new THREE.BoxGeometry(size, size, size, seg, seg, seg);
  const p = g.attributes.position, n = g.attributes.normal, half = size / 2 - radius;
  const v = new THREE.Vector3(), inner = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    inner.set(THREE.MathUtils.clamp(v.x, -half, half), THREE.MathUtils.clamp(v.y, -half, half), THREE.MathUtils.clamp(v.z, -half, half));
    d.subVectors(v, inner);
    if (d.lengthSq() > 1e-8) { d.normalize(); n.setXYZ(i, d.x, d.y, d.z); v.copy(inner).addScaledVector(d, radius); p.setXYZ(i, v.x, v.y, v.z); }
  }
  return g;
}
// BoxGeometry material order is +x,-x,+y,-y,+z,-z; opposite faces sum to 7.
const FACE_VALUE = [3, 4, 1, 6, 2, 5];
const FACE_NORMAL = { 3: [1, 0, 0], 4: [-1, 0, 0], 1: [0, 1, 0], 6: [0, -1, 0], 2: [0, 0, 1], 5: [0, 0, -1] };

function pawnGeometries() {
  const pts = [[0, 0], [0.37, 0], [0.38, 0.05], [0.34, 0.1], [0.21, 0.2], [0.14, 0.34], [0.125, 0.5], [0.19, 0.56], [0.2, 0.6], [0.11, 0.63], [0, 0.64]].map(([x, y]) => new THREE.Vector2(x, y));
  return { body: new THREE.LatheGeometry(pts, 28), head: new THREE.SphereGeometry(0.21, 24, 16) };
}

export class Board3D {
  constructor(container, { colors, tokens, counts, hero = false, dice = true }) {
    this.is3d = true;
    this.colors = colors; this.n = tokens; this.counts = counts || null; this.hero = hero; this.useDice = dice && !hero;
    this.container = container;
    this.tweens = []; this.tokens = new Map(); this.movable = new Set(); this.fx = []; this.trauma = 0;
    this.viewYaw = 0; this.viewTarget = 0; this.orbit = { yaw: 0, tilt: 0, lastTouch: 0 }; this.punch = 0;
    this.insets = { top: 0, bottom: 0 };
    this.dirty = true; this.dead = false; this.time = 0; this.ready = false;

    const lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
    this.renderer = new THREE.WebGLRenderer({ antialias: !lowEnd, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowEnd ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping; // keeps the saturated Ludo colours
    this.renderer.toneMappingExposure = 0.92;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'gl';
    this.canvas.setAttribute('aria-label', 'Ludo board in 3D'); this.canvas.setAttribute('role', 'img');
    this.overlay = document.createElement('div'); this.overlay.className = 'tk-layer';
    container.replaceChildren(this.canvas, this.overlay);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 120);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.buildLights(lowEnd);
    this.buildTable();
    this.buildBoard();
    this.buildTokens();
    if (this.useDice) this.buildDice();
    if (hero) this.buildHero();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.onVis = () => { this.dirty = true; };
    document.addEventListener('visibilitychange', this.onVis);
    this.bindOrbit();
    this.resize();
    this.ready = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(t => this.frame(t));
  }

  // ---------- scene ----------
  buildLights(lowEnd) {
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.42;
    pm.dispose();
    this.scene.add(new THREE.HemisphereLight(0xfff1dc, 0x2b1a10, 0.4));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.1);
    sun.position.set(-7, 15, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(lowEnd ? 1024 : 2048, lowEnd ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 2, far: 45 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
    this.scene.add(sun);
    const rim = new THREE.PointLight(0x6fb6ff, 25, 40, 2); rim.position.set(9, 6, -10); this.scene.add(rim);
  }

  buildTable() {
    if (this.hero) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.38 }));
      sh.rotation.x = -Math.PI / 2; sh.position.y = TABLE_TOP; sh.receiveShadow = true; this.scene.add(sh);
      return;
    }
    const tex = woodTexture('#5a3220', '#2a140a', 3);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 1, 72), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0.02 }));
    m.position.y = TABLE_TOP - 0.5; m.receiveShadow = true;
    this.scene.add(m);
  }

  buildBoard() {
    const active = new Set(this.colors);
    const wood = new THREE.MeshStandardMaterial({ map: woodTexture('#8a5230', '#3b1d0e', 1), roughness: 0.45 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xf1dfba, roughness: 0.55 });
    const frame = new THREE.Mesh(slab(roundedRect(16.2, 16.2, 0.7), 0.5, 0.08), [cream, wood]);
    frame.position.y = -0.5; frame.castShadow = true; frame.receiveShadow = true;
    this.root.add(frame);

    // bases
    for (let c = 0; c < 4; c++) {
      const [ox, oy] = BASE_ORIGIN[c], on = active.has(c);
      const centre = w(ox + 3, oy + 3);
      const body = new THREE.Mesh(slab(roundedRect(5.9, 5.9, 0.45), BASE_TOP, 0.04), new THREE.MeshStandardMaterial({ color: on ? PALETTE[c] : OFF, roughness: 0.42 }));
      body.position.copy(centre); body.receiveShadow = true; body.castShadow = true; this.root.add(body);
      const inlay = new THREE.Mesh(slab(roundedRect(4.2, 4.2, 0.6), 0.05, 0.01), new THREE.MeshStandardMaterial({ color: 0xf6ecd8, roughness: 0.6 }));
      inlay.position.set(centre.x, BASE_TOP - 0.01, centre.z); inlay.receiveShadow = true; this.root.add(inlay);
      this[`baseMat${c}`] = body.material;
      for (const [sx, sy] of [[2, 2], [4, 2], [2, 4], [4, 4]]) {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.06, 32), new THREE.MeshStandardMaterial({ color: on ? TINT[c] : 0xece7dd, roughness: 0.7 }));
        const p = w(ox + sx, oy + sy); s.position.set(p.x, BASE_TOP + 0.04, p.z); s.receiveShadow = true; this.root.add(s);
      }
    }

    // track + home-column tiles (instanced: one draw call)
    const tileGeo = slab(roundedRect(0.94, 0.94, 0.12), TILE_TOP, 0.02);
    const cells = [];
    TRACK.forEach(([c, r], i) => {
      const s = START_IDX.indexOf(i);
      cells.push({ c, r, color: s >= 0 && active.has(s) ? PALETTE[s] : 0xf6ecd8 });
    });
    HOME_COL.forEach((col, ci) => col.forEach(([c, r]) => cells.push({ c, r, color: active.has(ci) ? PALETTE[ci] : OFF })));
    const tiles = new THREE.InstancedMesh(tileGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), cells.length);
    const m4 = new THREE.Object3D(), col = new THREE.Color();
    cells.forEach((cl, i) => { const p = w(cl.c + 0.5, cl.r + 0.5); m4.position.set(p.x, 0, p.z); m4.updateMatrix(); tiles.setMatrixAt(i, m4.matrix); tiles.setColorAt(i, col.set(cl.color)); });
    tiles.receiveShadow = true; tiles.castShadow = true; this.root.add(tiles);

    // safe-square stars
    const starGeo = new THREE.ShapeGeometry(starShape(0.34)); starGeo.rotateX(-Math.PI / 2);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a13b, roughness: 0.35, metalness: 0.6 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    SAFE.forEach(i => {
      const s = START_IDX.indexOf(i);
      const mesh = new THREE.Mesh(starGeo, s >= 0 && active.has(s) ? whiteMat : goldMat);
      const p = w(TRACK[i][0] + 0.5, TRACK[i][1] + 0.5); mesh.position.set(p.x, TILE_TOP + 0.004, p.z); this.root.add(mesh);
    });

    // centre triangles
    const tri = [[[6, 6], [6, 9], [7.5, 7.5]], [[6, 6], [9, 6], [7.5, 7.5]], [[9, 6], [9, 9], [7.5, 7.5]], [[6, 9], [9, 9], [7.5, 7.5]]];
    tri.forEach((pts, c) => {
      const s = new THREE.Shape();
      pts.forEach(([x, y], k) => { const p = w(x, y); if (k) s.lineTo(p.x, -p.z); else s.moveTo(p.x, -p.z); });
      s.closePath();
      const m = new THREE.Mesh(slab(s, 0.14, 0.02), new THREE.MeshStandardMaterial({ color: active.has(c) ? PALETTE[c] : OFF, roughness: 0.35, metalness: 0.1 }));
      m.receiveShadow = true; m.castShadow = true; this.root.add(m);
    });
  }

  buildTokens() {
    const { body, head } = pawnGeometries();
    this.pawnGeo = { body, head };
    this.ringGeo = new THREE.TorusGeometry(0.52, 0.05, 8, 40); this.ringGeo.rotateX(Math.PI / 2);
    for (const c of this.colors) {
      const count = this.counts ? this.counts[c] : this.n;
      for (let i = 0; i < count; i++) this.makeToken(c, i);
    }
  }

  makeToken(c, i) {
    const mat = new THREE.MeshStandardMaterial({ color: PALETTE[c], roughness: 0.3, metalness: 0.05, emissive: PALETTE[c], emissiveIntensity: 0 });
    const g = new THREE.Group();
    const bodyM = new THREE.Mesh(this.pawnGeo.body, mat); bodyM.castShadow = true;
    const headM = new THREE.Mesh(this.pawnGeo.head, mat); headM.position.y = 0.76; headM.castShadow = true;
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.position.y = 0.04; ring.visible = false;
    const inner = new THREE.Group(); inner.add(bodyM, headM); g.add(inner, ring);
    g.scale.setScalar(PAWN);
    this.root.add(g);
    const proxy = document.createElement('button');
    proxy.className = 'tk'; proxy.type = 'button'; proxy.tabIndex = -1;
    proxy.dataset.c = c; proxy.dataset.i = i;
    proxy.setAttribute('aria-label', `${['red', 'green', 'yellow', 'blue'][c]} token ${i + 1}`);
    this.overlay.append(proxy);
    const t = { g, inner, ring, mat, proxy, pos: -1, base: 0, lift: 0 };
    this.tokens.set(`${c}-${i}`, t);
    const [x, y] = cellXY(c, -1, i);
    this.setWorld(t, w(x, y), BASE_TOP + 0.07);
  }

  buildDice() {
    const geo = roundedBoxGeometry(2.0, 0.27, 8);
    const mats = FACE_VALUE.map(v => new THREE.MeshStandardMaterial({ map: pipTexture(v), roughness: 0.32, metalness: 0.03 }));
    this.die = new THREE.Mesh(geo, mats); this.die.castShadow = true;
    this.dieHome = new THREE.Vector3(0, TABLE_TOP + 1.0, 11.4);
    this.die.position.copy(this.dieHome);
    this.dieQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, 0.7, 0.2));
    this.die.quaternion.copy(this.dieQuat);
    this.scene.add(this.die);
    // turn-coloured glow under the dice
    this.dieRing = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.85, 56), new THREE.MeshBasicMaterial({ color: 0xe53935, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.dieRing.rotation.x = -Math.PI / 2; this.dieRing.position.set(0, TABLE_TOP + 0.02, this.dieHome.z); this.scene.add(this.dieRing);
    this.dieWaiting = false;
  }

  buildHero() {
    this.heroDie = new THREE.Mesh(roundedBoxGeometry(2.2, 0.28, 8), FACE_VALUE.map(v => new THREE.MeshStandardMaterial({ map: pipTexture(v), roughness: 0.3 })));
    this.heroDie.castShadow = true; this.heroDie.position.set(0, 3.4, 0); this.scene.add(this.heroDie);
    const demo = { 0: [-1, 12, 30, 51], 1: [-1, -1, 22, 54], 2: [-1, 6, 40, 56], 3: [-1, 18, 33, 3] };
    for (const c of this.colors) demo[c].forEach((p, i) => { const t = this.tokens.get(`${c}-${i}`); const [x, y] = cellXY(c, p, i); this.setWorld(t, w(x, y), this.heightFor(p)); t.pos = p; });
    this.autoSpin = true;
  }

  // ---------- helpers ----------
  heightFor(p) { return p === -1 ? BASE_TOP + 0.07 : p === HOME ? 0.14 : TILE_TOP; }
  setWorld(t, v, y) { t.g.position.set(v.x, y, v.z); this.dirty = true; }
  tween(ms, fn, easing = ease.lin) {
    return new Promise(res => {
      if (this.dead) return res();
      if (reduce()) ms = Math.min(ms, 40);
      this.tweens.push({ t0: performance.now(), ms, fn, easing, res }); this.dirty = true;
    });
  }

  // ---------- view ----------
  setViewColor(c, instant = false) {
    this.viewTarget = (((c + 1) % 4) * Math.PI) / 2;
    if (instant || !this.ready) this.viewYaw = this.viewTarget;
    this.dirty = true;
  }
  setInsets(top, bottom) { this.insets = { top, bottom }; this.resize(); }
  setTurn(c) {
    if (this.dieRing) { this.dieRing.material.color.setHex(PALETTE[c]); this.dirty = true; }
    this.colors.forEach(k => { const m = this[`baseMat${k}`]; if (m) { m.emissive.setHex(PALETTE[k]); m.emissiveIntensity = k === c ? 0.35 : 0; } });
  }

  resize() {
    if (this.dead) return;
    const r = this.container.getBoundingClientRect();
    const wd = Math.max(1, Math.round(r.width)), ht = Math.max(1, Math.round(r.height));
    this.size = { w: wd, h: ht };
    this.renderer.setSize(wd, ht, false);
    this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    this.camera.aspect = wd / ht;
    this.frameCamera();
    this.dirty = true;
  }

  frameCamera() {
    const { w: wd, h: ht } = this.size, vf = (this.camera.fov * Math.PI) / 180;
    const aspect = wd / ht;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    const usableH = ht - this.insets.top - this.insets.bottom;
    // distance so the board (~17.5 wide) fits horizontally and the board plus dice fits vertically
    const dH = (this.hero ? 8.3 : 9.4) / Math.tan(hf / 2);
    const dV = (this.hero ? 9.5 : this.useDice ? 10.9 : 9.4) / Math.tan(vf / 2) * (ht / Math.max(usableH, ht * 0.5));
    this.dist = Math.max(dH, dV);
    this.shiftZ = this.hero || !this.useDice ? 0 : 2.4;
    const shift = (this.insets.top - this.insets.bottom) / 2;
    if (shift) this.camera.setViewOffset(wd, ht, 0, -shift, wd, ht); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  bindOrbit() {
    if (this.hero) return; // the home hero must not capture page scrolling
    let down = null;
    const c = this.canvas;
    const pd = e => { down = { x: e.clientX, y: e.clientY, yaw: this.orbit.yaw, tilt: this.orbit.tilt }; c.setPointerCapture?.(e.pointerId); };
    const pm = e => {
      if (!down) return;
      this.orbit.yaw = THREE.MathUtils.clamp(down.yaw - (e.clientX - down.x) * 0.006, -0.7, 0.7);
      this.orbit.tilt = THREE.MathUtils.clamp(down.tilt + (e.clientY - down.y) * 0.004, -0.35, 0.3);
      this.orbit.lastTouch = performance.now(); this.dirty = true;
    };
    const pu = () => { down = null; this.orbit.lastTouch = performance.now(); };
    c.addEventListener('pointerdown', pd); c.addEventListener('pointermove', pm); c.addEventListener('pointerup', pu); c.addEventListener('pointercancel', pu);
    c.style.touchAction = 'none';
  }

  // ---------- frame loop ----------
  frame(now) {
    if (this.dead) return;
    this.raf = requestAnimationFrame(t => this.frame(t));
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.time += dt;
    if (document.hidden) return;
    let active = this.dirty; this.dirty = false;

    if (this.tweens.length) {
      active = true;
      for (const tw of [...this.tweens]) {
        const p = Math.min(1, (now - tw.t0) / tw.ms);
        tw.fn(tw.easing(p), p);
        if (p >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.res(); }
      }
    }
    // smooth view rotation toward the focus colour
    let dy = this.viewTarget - this.viewYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    if (Math.abs(dy) > 0.002) { this.viewYaw += dy * Math.min(1, dt * 6); active = true; } else if (dy) { this.viewYaw = this.viewTarget; }
    if (this.hero) { this.viewYaw += dt * 0.25; this.viewTarget = this.viewYaw; active = true; this.heroDie.rotation.x += dt * 0.7; this.heroDie.rotation.y += dt * 0.9; this.heroDie.position.y = 3.3 + Math.sin(this.time * 1.4) * 0.25; }
    this.root.rotation.y = this.viewYaw;
    // orbit eases back after the player lets go
    if (!this.hero && performance.now() - this.orbit.lastTouch > 2500 && (Math.abs(this.orbit.yaw) > 0.003 || Math.abs(this.orbit.tilt) > 0.003)) {
      this.orbit.yaw *= 1 - Math.min(1, dt * 3); this.orbit.tilt *= 1 - Math.min(1, dt * 3); active = true;
    }
    // movable tokens bob and glow; the waiting dice hovers
    if (this.movable.size) {
      active = true;
      for (const k of this.movable) {
        const t = this.tokens.get(k), s = Math.sin(this.time * 6);
        t.inner.position.y = 0.1 + (s * 0.5 + 0.5) * 0.16;
        t.mat.emissiveIntensity = 0.35 + (s * 0.5 + 0.5) * 0.4;
        t.ring.scale.setScalar(1 + (s * 0.5 + 0.5) * 0.25);
      }
    }
    if (this.useDice && this.dieWaiting && !this.rolling) {
      active = true;
      this.die.position.y = this.dieHome.y + 0.18 + Math.sin(this.time * 3) * 0.14;
      this.die.rotation.y += dt * 0.8;
      this.dieRing.material.opacity = 0.55 + Math.sin(this.time * 4) * 0.35;
      this.dieRing.scale.setScalar(1 + Math.sin(this.time * 4) * 0.06);
    }
    if (this.fx.length) { active = true; for (const f of [...this.fx]) f.update(dt, f); }
    if (this.trauma > 0) { this.trauma = Math.max(0, this.trauma - dt * 1.6); active = true; }
    if (!active) return;

    // camera
    const phi = THREE.MathUtils.degToRad((this.hero ? 40 : 58) + this.orbit.tilt * 30);
    const yaw = this.orbit.yaw;
    const d = this.dist * (1 - this.punch * 0.06);
    const sh = this.trauma * this.trauma * 0.5;
    this.camera.position.set(
      Math.sin(yaw) * Math.cos(phi) * d + (sh ? (Math.random() - 0.5) * sh : 0),
      Math.sin(phi) * d + (sh ? (Math.random() - 0.5) * sh : 0),
      Math.cos(yaw) * Math.cos(phi) * d + this.shiftZ);
    this.camera.lookAt(0, 0, this.shiftZ);
    this.updateProxies();
    this.renderer.render(this.scene, this.camera);
  }

  // Invisible-but-accessible buttons follow each movable token (and the dice) on screen.
  updateProxies() {
    const { w: wd, h: ht } = this.size;
    const v = new THREE.Vector3();
    const place = (el, obj, dy, px) => {
      obj.getWorldPosition(v); v.y += dy; v.project(this.camera);
      const sx = (v.x * 0.5 + 0.5) * wd, sy = (-v.y * 0.5 + 0.5) * ht;
      el.style.transform = `translate(${sx - px / 2}px, ${sy - px / 2}px)`;
    };
    for (const k of this.movable) { const t = this.tokens.get(k); place(t.proxy, t.g, 0.5, 52); }
    if (this.diceEl && this.useDice) place(this.diceEl, this.die, 0, Math.min(120, wd * 0.3));
  }

  // ---------- public API (same surface as the SVG Board) ----------
  bindDice(el) {
    this.diceEl = el;
    const px = Math.min(120, Math.max(84, (this.size?.w || 360) * 0.3));
    el.style.width = el.style.height = px + 'px';
    this.overlay.append(el);
    this.dirty = true;
  }
  setDiceWaiting(on) { this.dieWaiting = on; if (!on && this.die) { this.die.position.copy(this.dieHome); } this.dirty = true; }

  async rollDice(value, { onBounce } = {}) {
    if (!this.die) return;
    this.rolling = true; this.dieWaiting = false;
    const up = new THREE.Vector3(0, 1, 0);
    const n = FACE_NORMAL[value];
    const qFinal = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...n), up);
    qFinal.premultiply(new THREE.Quaternion().setFromAxisAngle(up, Math.random() * Math.PI * 2));
    const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    const theta0 = (3 + Math.random() * 1.5) * Math.PI * 2;
    const q = new THREE.Quaternion(), spin = new THREE.Quaternion();
    const start = this.die.position.clone(), drift = (Math.random() - 0.5) * 1.4;
    let bounces = 0;
    const dur = reduce() ? 40 : 1150;
    await this.tween(dur, (e, p) => {
      const hop = Math.abs(Math.sin(p * Math.PI * 3)) * (1 - p) ** 1.4 * 3.2;
      this.die.position.set(this.dieHome.x + drift * Math.sin(p * Math.PI), this.dieHome.y + (p < 1 ? hop : 0), this.dieHome.z);
      spin.setFromAxisAngle(axis, theta0 * (1 - ease.out(p)));
      this.die.quaternion.copy(q.copy(qFinal).multiply(spin));
      const b = Math.floor(p * 3);
      if (b > bounces && p < 0.95) { bounces = b; onBounce && onBounce(b); }
      this.dieRing.scale.setScalar(1 + hop * 0.03);
    });
    this.die.position.copy(this.dieHome); this.die.quaternion.copy(qFinal);
    this.dieQuat.copy(qFinal);
    this.rolling = false; this.dirty = true;
    this.tween(260, e => { this.die.scale.set(1 + (1 - e) * 0.08, 1 - (1 - e) * 0.1, 1 + (1 - e) * 0.08); });
    if (value === 6) this.punchCamera();
  }

  punchCamera() { this.tween(420, (e, p) => { this.punch = Math.sin(p * Math.PI); }).then(() => { this.punch = 0; }); }

  place(toks, animateMs = 0) {
    const groups = new Map();
    for (const c of this.colors) toks[c].forEach((p, i) => {
      const key = p === -1 ? `b${c}${i}` : p === HOME ? `f${c}` : p <= 50 ? `t${(START_IDX[c] + p) % 52}` : `h${c}-${p}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push([c, i, p]);
    });
    const off = [[0, 0], [-0.22, -0.22], [0.22, 0.22], [-0.22, 0.22]];
    for (const list of groups.values()) list.forEach(([c, i, p], k) => {
      const t = this.tokens.get(`${c}-${i}`);
      const [x, y] = cellXY(c, p, i);
      const many = list.length > 1 && p !== HOME && p !== -1;
      const o = many ? (list.length === 2 ? [[-0.2, 0], [0.2, 0]][k] : off[k % 4]) : [0, 0];
      const target = w(x + o[0], y + o[1]);
      const sc = (many ? 0.8 : 1) * PAWN;
      t.pos = p;
      if (animateMs > 0 && t.g.position.distanceTo(new THREE.Vector3(target.x, 0, target.z)) > 0.01) {
        const from = t.g.position.clone(), y1 = this.heightFor(p);
        this.tween(animateMs, e => { t.g.position.set(from.x + (target.x - from.x) * e, from.y + (y1 - from.y) * e, from.z + (target.z - from.z) * e); t.g.scale.setScalar(t.g.scale.x + (sc - t.g.scale.x) * e); });
      } else { this.setWorld(t, target, this.heightFor(p)); t.g.scale.setScalar(sc); }
    });
    this.dirty = true;
  }

  front() {}

  async hopTo(c, i, p, ms) {
    const t = this.tokens.get(`${c}-${i}`), [x, y] = cellXY(c, p, i), to = w(x, y), y1 = this.heightFor(p);
    const from = t.g.position.clone();
    await this.tween(ms, (e, pr) => {
      t.g.position.set(from.x + (to.x - from.x) * e, from.y + (y1 - from.y) * e + Math.sin(pr * Math.PI) * 0.55, from.z + (to.z - from.z) * e);
      const sq = pr > 0.8 ? 1 - Math.sin((pr - 0.8) / 0.2 * Math.PI) * 0.12 : 1;
      t.inner.scale.set(1 + (1 - sq) * 0.6, sq, 1 + (1 - sq) * 0.6);
    });
    t.inner.scale.set(1, 1, 1); t.pos = p;
  }

  async moveAlong(c, i, positions) {
    const ms = reduce() ? 40 : Math.max(90, Math.min(160, 900 / positions.length));
    for (const p of positions) await this.hopTo(c, i, p, ms);
  }

  async slinkHome(c, i) {
    const t = this.tokens.get(`${c}-${i}`), [x, y] = cellXY(c, -1, i), to = w(x, y), y1 = BASE_TOP + 0.07;
    const from = t.g.position.clone();
    t.pos = -1;
    await this.tween(reduce() ? 60 : 760, (e, p) => {
      t.g.position.set(from.x + (to.x - from.x) * e, from.y + (y1 - from.y) * e + Math.sin(p * Math.PI) * 3.2, from.z + (to.z - from.z) * e);
      t.g.rotation.y = p * Math.PI * 4;
      t.inner.scale.set(1, 1 - Math.max(0, p - 0.9) * 1.2, 1);
    }, ease.inOut);
    t.g.rotation.y = 0; t.inner.scale.set(1, 1, 1);
  }

  setMovable(color, list, onPick) {
    this.clearMovable();
    this._h = [];
    for (const i of list) {
      const k = `${color}-${i}`, t = this.tokens.get(k);
      this.movable.add(k); t.ring.visible = true; t.ring.material.color.setHex(0xffd54f);
      t.proxy.classList.add('can'); t.proxy.tabIndex = 0;
      const fn = e => { e.preventDefault(); e.stopPropagation(); onPick(i); };
      const key = e => { if (e.key === 'Enter' || e.key === ' ') fn(e); };
      t.proxy.addEventListener('pointerdown', fn); t.proxy.addEventListener('keydown', key);
      this._h.push([t.proxy, fn, key]);
    }
    this.dirty = true;
  }
  clearMovable() {
    for (const k of this.movable) this.resetToken(this.tokens.get(k));
    this.movable.clear();
    for (const t of this.tokens.values()) { t.proxy.classList.remove('can', 'hint'); t.proxy.tabIndex = -1; if (t.ring.visible) this.resetToken(t); }
    for (const [el, fn, key] of this._h || []) { el.removeEventListener('pointerdown', fn); el.removeEventListener('keydown', key); }
    this._h = []; this.dirty = true;
  }
  resetToken(t) { t.inner.position.y = 0; t.mat.emissiveIntensity = 0; t.ring.visible = false; t.ring.scale.setScalar(1); }
  hint(c, i) {
    const k = `${c}-${i}`, t = this.tokens.get(k);
    this.movable.add(k); t.ring.visible = true; t.ring.material.color.setHex(0xffffff); t.proxy.classList.add('hint'); this.dirty = true;
  }

  bloom(x, y, color, big = false) {
    if (reduce()) return;
    const origin = w(x, y), n = big ? 34 : 18, parts = [];
    const geo = new THREE.SphereGeometry(0.09, 8, 6), mats = [new THREE.MeshBasicMaterial({ color: PALETTE[color] }), new THREE.MeshBasicMaterial({ color: 0xffd54f })];
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(geo, mats[k % 2]); m.position.copy(origin).setY(0.3);
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.4, sp = (big ? 3.4 : 2.4) * (0.6 + Math.random() * 0.6);
      m.userData = { vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: (big ? 6 : 4) * (0.6 + Math.random() * 0.7) };
      this.root.add(m); parts.push(m);
    }
    let age = 0;
    const f = { update: (dt) => {
      age += dt;
      for (const m of parts) { const u = m.userData; u.vy -= 14 * dt; m.position.x += u.vx * dt; m.position.z += u.vz * dt; m.position.y += u.vy * dt; m.scale.setScalar(Math.max(0.01, 1 - age / 1.1)); }
      if (age > 1.1) { parts.forEach(m => this.root.remove(m)); geo.dispose(); mats.forEach(m => m.dispose()); this.fx.splice(this.fx.indexOf(f), 1); }
    } };
    this.fx.push(f); this.dirty = true;
  }

  flash(x, y, color) {
    if (reduce()) return;
    const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.46, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; const p = w(x, y); m.position.set(p.x, 0.2, p.z); this.root.add(m);
    this.tween(560, e => { m.scale.setScalar(1 + e * 4.5); m.material.opacity = 1 - e; }).then(() => { this.root.remove(m); m.geometry.dispose(); m.material.dispose(); });
  }

  shake(amount = 1) { if (reduce()) return; this.trauma = Math.min(1, this.trauma + 0.45 * amount); this.dirty = true; }

  dispose() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.ro && this.ro.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
    this.tweens.forEach(t => t.res()); this.tweens = [];
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { m.map && m.map.dispose(); m.dispose(); }); });
    this.scene.environment && this.scene.environment.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss && this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
