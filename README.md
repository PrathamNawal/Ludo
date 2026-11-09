# Ludo Adda 🎲

**Family Ludo you can trust.** Free forever, no ads, no sign-in, works offline, installs from the browser.

> Play: **https://prathamnawal.github.io/Ludo/** (GitHub Pages). On a phone, open it and use *Add to Home screen* for a full-screen app.

The product thinking is in [`GAME_CONCEPT.md`](GAME_CONCEPT.md). This repo is the playable v0.1 of that concept.

## What is in v0.1

| Pillar (from the concept) | Status | How it works |
|---|---|---|
| **Real 3D board** | ✅ | three.js scene: lit and shadowed rosewood table, inlaid board with raised tiles, turned pawns that hop tile to tile, a rounded physical dice that tumbles and lands on the true rolled face, saturated colours, reflections. Drag to orbit; the camera rotates so *your* colour is bottom-left, punches in on a six and shakes on a capture. A 3D hero board floats on the home screen. |
| **Lite mode** | ✅ | The original flat SVG board stays as *Settings, Graphics, Lite*. It is chosen automatically on very weak devices or when WebGL is missing, and never downloads the 3D engine. |
| **Play in 10 seconds, no friction** | ✅ | One tap on *Abhi khelo* starts a match vs 3 bots as a guest. No login, no permission prompts, no tutorial. About 0.8 MB total with the 3D engine (about 0.25 MB in Lite mode). |
| **Sachcha Dice** (provably fair) | ✅ | Before the first roll the device creates a 256-bit seed and shows its SHA-256 *lock code*. Roll *i* = `HMAC-SHA256(seed, "ludo-adda:v1:i")` with bias-free rejection sampling. After the match, **Verify my dice** recomputes every roll against the lock code. Per-player dice-stats charts show the distribution against fair dice. |
| **Roz ki Chaal** (daily puzzle) | ✅ | A deterministic daily puzzle, #1 = 1 Jan 2026. Every puzzle is solver-verified to have 1 to 3 solutions. The whole back-catalogue is generated on the fly, so it needs no storage and works offline. 3 free hints a day, streaks, emoji-grid sharing. |
| **Parivaar Board** (async family play) | ✅ (link-based) | The whole match is a replayable move log inside the URL. Play your move, tap *Send on WhatsApp*, the next person opens the link. No server. Each seat's dice come from a seed that only lives on that person's device; its lock code travels in the link and the seed can be revealed at the end for verification. |
| **Bot personalities** | ✅ | Dadi (careful), Bunty (aggressive), Professor (smart), Chhotu (makes kid mistakes). Utility-scoring AI, one weight set per personality. |
| **Apni Bhasha** | 🟡 3 languages | Hinglish, English, हिन्दी, with cricket-style commentary. More Indian languages are next (the string tables are ready for them). |
| **Bharat-grade performance** | ✅ | Vanilla JS, no framework, no build step for the app, no fonts or images to download (textures and sounds are generated). 3D adapts: smaller shadow maps, capped pixel ratio and no anti-aliasing on weak devices; renders only while something is moving. Service worker precaches everything: the app reloads and plays with the network off. |
| **Desi game feel** | ✅ | Tiered feedback: tumbling dice, dhol on a six, decaying screen shake + hit-stop on a capture, rangoli bloom and shehnai when a token reaches home. All sounds are synthesised (nothing to download). Honours *reduce motion*. |

### Not built yet (honest list)

- **Live online matches** (real-time, random opponents) need a server, which GitHub Pages cannot host. Planned next: Nakama or a small WebSocket service.
- **Voice-note moves**, **creator rooms**, **Chaupar heritage mode**, **iOS store app**, **10+ languages**.
- **Family-mode fairness is tamper-evident, not trustless.** Without a server, a device could grind seeds before publishing its lock code. A server-side phase closes this. Single-device and vs-bot matches are fully verifiable.
- Everything is tested in headless Chromium with *software* WebGL. Frame rate on real phones, especially 2 GB Android devices, is **unmeasured**: try it, and use Lite if it stutters.

## Rules implemented

Classic Ludo, 2 to 4 players, 4 or 2 tokens each (*Quick Ludo*): a six brings a token out; a six, a capture or reaching home gives another roll; three sixes in a row forfeits the turn; star squares and start squares are safe; you need an exact roll to finish; first player to bring every token home wins.

## Develop

```bash
npm install            # only needed for the browser tests (playwright)
npm test               # 16 unit tests: rules, 1,500 random bot games, dice, 600 puzzles, family codec, i18n
npm run serve          # http://localhost:8080
npm run e2e            # 32 end-to-end checks in headless Chromium with software WebGL (SHOTS=dir saves screenshots)
npm run vendor         # rebuild vendor/three.min.js (tree-shaken three.js) from tools/three-entry.js
npm run icons          # re-render PNG icons from the SVGs
```

Layout: the repo root *is* the deployable app (`index.html`, `sw.js`, `css/`, `js/`, `vendor/`, `icons/`). `js/rules.js` (pure rules engine), `dice.js`, `bots.js`, `puzzle.js`, `family.js` are DOM-free and unit-tested in Node; `board3d.js` (3D) / `board.js` (Lite 2D), `view.js` and `app.js` are the UI. `vendor/three.min.js` is a tree-shaken three.js r187 build (MIT) committed so the site needs no build step and makes no third-party requests.

### How the code maps to the [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) it was built with

| Skill | Applied as |
|---|---|
| `puzzle` | Board model is the single source of truth; deterministic seeded RNG; generate-and-verify puzzles; input locked while a move resolves |
| `game-ai` | Utility-scoring bots with per-personality weights |
| `game-feel` | Four feedback tiers; decaying shake; real-time hit-stop; eased squash and stretch |
| `game-ui-ux` | Safe-area insets, one-thumb layout, event-driven HUD, screen stack with back-button support |
| `save-systems` | Versioned save with defensive migration, backup slot, autosave after every move, resume by replaying the log |
| `audio-design` | Synthesised sounds with small random pitch offsets |
| `prototype-fast` | Each pillar shipped as a thin playable slice with an end-to-end check as its keep/kill test |

## Deploy

Pushing to `main` publishes the game at the Pages URL. It works with either Pages source: the repo root is the site (with `.nojekyll`), so GitHub's branch build serves the game, and `.github/workflows/pages.yml` (tests, then deploy) publishes the identical file set. Prefer *Settings, Pages, Source: GitHub Actions* so only one deploy runs.

## Legal

Free, social play only: no stakes, no prizes, no purchasable or cash-out currency, which keeps it outside the Promotion and Regulation of Online Gaming Act, 2025 definition of an online money game. This is a design intent, not legal advice.
