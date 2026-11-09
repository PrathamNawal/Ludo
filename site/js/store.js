// Versioned, defensive local save (save-systems skill). Everything works with storage blocked.
const KEY = 'ludoadda.v1';
const VERSION = 1;
const defaults = () => ({
  version: VERSION,
  settings: { lang: 'hg', sound: true, haptics: true, reduceMotion: false },
  stats: { games: 0, wins: 0, sixes: 0 },
  puzzle: { solved: {}, streak: 0, lastSolvedDay: 0, hints: {} },
  match: null,
});
let mem = null;

function load() {
  if (mem) return mem;
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  let data = defaults();
  if (raw) {
    try {
      const o = JSON.parse(raw);
      if (o && typeof o === 'object') data = migrate(o);
    } catch {
      try { const bak = localStorage.getItem(KEY + '.bak'); if (bak) data = migrate(JSON.parse(bak)); } catch { /* ignore */ }
    }
  }
  mem = data;
  return mem;
}

function migrate(o) {
  const d = defaults();
  // v1 is the first schema; merge defensively so missing/new fields never crash.
  return {
    version: VERSION,
    settings: { ...d.settings, ...(o.settings || {}) },
    stats: { ...d.stats, ...(o.stats || {}) },
    puzzle: { ...d.puzzle, ...(o.puzzle || {}) },
    match: o.match && o.match.seed && o.match.cfg && Array.isArray(o.match.log) ? o.match : null,
  };
}

export function save() {
  if (!mem) return;
  try {
    const prev = localStorage.getItem(KEY);
    if (prev) localStorage.setItem(KEY + '.bak', prev);
    localStorage.setItem(KEY, JSON.stringify(mem));
  } catch { /* quota or blocked: keep playing from memory */ }
}

export const db = () => load();
export const settings = () => load().settings;
export function update(fn) { fn(load()); save(); }

export function familyKey(id) { return `ludoadda.family.${id}`; }
export function getSeat(id) {
  try { return JSON.parse(localStorage.getItem(familyKey(id)) || 'null'); } catch { return null; }
}
export function setSeat(id, v) {
  try { localStorage.setItem(familyKey(id), JSON.stringify(v)); } catch { /* ignore */ }
}
