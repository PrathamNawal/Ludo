# Ludo Adda 🎲

**Family Ludo you can trust.** Free forever, no ads, no sign-in, works offline, installs from the browser.

> Play: **https://prathamnawal.github.io/Ludo/** (GitHub Pages). On a phone, open it and use *Add to Home screen* for a full-screen app.

The product thinking is in [`GAME_CONCEPT.md`](GAME_CONCEPT.md). This repo is the playable v0.1 of that concept.

## What is in v0.1

| Pillar (from the concept) | Status | How it works |
|---|---|---|
| **Play in 10 seconds, no friction** | ✅ | One tap on *Abhi khelo* starts a match vs 3 bots as a guest. No login, no permission prompts, no tutorial. 233 KB total. |
| **Sachcha Dice** (provably fair) | ✅ | Before the first roll the device creates a 256-bit seed and shows its SHA-256 *lock code*. Roll *i* = `HMAC-SHA256(seed, "ludo-adda:v1:i")` with bias-free rejection sampling. After the match, **Verify my dice** recomputes every roll against the lock code. Per-player dice-stats charts show the distribution against fair dice. |
| **Roz ki Chaal** (daily puzzle) | ✅ | A deterministic daily puzzle, #1 = 1 Jan 2026. Every puzzle is solver-verified to have 1 to 3 solutions. The whole back-catalogue is generated on the fly, so it needs no storage and works offline. 3 free hints a day, streaks, emoji-grid sharing. |
| **Parivaar Board** (async family play) | ✅ (link-based) | The whole match is a replayable move log inside the URL. Play your move, tap *Send on WhatsApp*, the next person opens the link. No server. Each seat's dice come from a seed that only lives on that person's device; its lock code travels in the link and the seed can be revealed at the end for verification. |
| **Bot personalities** | ✅ | Dadi (careful), Bunty (aggressive), Professor (smart), Chhotu (makes kid mistakes). Utility-scoring AI, one weight set per personality. |
| **Apni Bhasha** | 🟡 3 languages | Hinglish, English, हिन्दी, with cricket-style commentary. More Indian languages are next (the string tables are ready for them). |
| **Bharat-grade performance** | ✅ | Pure SVG + vanilla JS, no framework, no build step, no fonts or images to download. Service worker precaches everything: the app reloads and plays with the network off. |
| **Desi game feel** | ✅ | Tiered feedback: tumbling dice, dhol on a six, decaying screen shake + hit-stop on a capture, rangoli bloom and shehnai when a token reaches home. All sounds are synthesised (nothing to download). Honours *reduce motion*. |

### Not built yet (honest list)

- **Live online matches** (real-time, random opponents) need a server, which GitHub Pages cannot host. Planned next: Nakama or a small WebSocket service.
- **Voice-note moves**, **creator rooms**, **Chaupar heritage mode**, **iOS store app**, **10+ languages**.
- **Family-mode fairness is tamper-evident, not trustless.** Without a server, a device could grind seeds before publishing its lock code. A server-side phase closes this. Single-device and vs-bot matches are fully verifiable.
- Android back button, install prompt and offline are tested in headless Chromium; test on real low-end phones before a wide launch.

## Rules implemented

Classic Ludo, 2 to 4 players, 4 or 2 tokens each (*Quick Ludo*): a six brings a token out; a six, a capture or reaching home gives another roll; three sixes in a row forfeits the turn; star squares and start squares are safe; you need an exact roll to finish; first player to bring every token home wins.

## Develop

```bash
npm install            # only needed for the browser tests (playwright)
npm test               # 16 unit tests: rules, 1,500 random bot games, dice, 600 puzzles, family codec, i18n
npm run serve          # http://localhost:8080
npm run e2e            # 25 end-to-end checks in headless Chromium (SHOTS=dir saves screenshots)
npm run icons          # re-render PNG icons from the SVGs
```

Layout: `site/` is the deployable app. `site/js/rules.js` (pure rules engine), `dice.js`, `bots.js`, `puzzle.js`, `family.js` are DOM-free and unit-tested in Node; `board.js`, `view.js`, `app.js` are the UI.

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

Pushing to `main` runs `.github/workflows/pages.yml` (tests, then deploy `site/` to GitHub Pages). One-time setup: repo *Settings, Pages, Source: GitHub Actions*.

## Legal

Free, social play only: no stakes, no prizes, no purchasable or cash-out currency, which keeps it outside the Promotion and Regulation of Online Gaming Act, 2025 definition of an online money game. This is a design intent, not legal advice.
