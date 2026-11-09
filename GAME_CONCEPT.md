# Ludo Adda — Game Concept (Nov 2026)

> **Ludo Adda** (*adda* = the hangout where people sit and talk): the Ludo you play with your family across cities, with dice you can verify, and a daily puzzle you can play alone.

**Pitch:** Ludo King made Ludo a phone game. Ludo Adda makes it a *family ritual* again. It works on a ₹8,000 phone, plays in your language, and you can check every dice roll.

---

## 1. The 2026 landscape (why now)

| Fact | What it means for us |
|---|---|
| Ludo King was still India's #1 downloaded game in Q1 and Q2 2026, with over 1.25B lifetime downloads, and earns mostly from ads | Demand is proven. We can't win by being "another Ludo". We win on the experience gaps: ads, trust, family, language. |
| The **Promotion and Regulation of Online Gaming Act, 2025** bans online money games. Its Rules came into force on **1 May 2026**. Zupee dropped paid games and kept its free formats. | Real-money Ludo is gone. Free **social** Ludo is legal and now has *less* competition for attention. We never use convertible currency. |
| India's mobile game downloads were about 2B in Q2 2026, but Free Fire and BGMI take about 50% of revenue | Ads plus micro-cosmetic IAP over UPI is the realistic model. Don't plan around whale spending. |
| The most common player complaints about existing Ludo apps are "dice is rigged", too many ads, and disconnects or bots that ruin games | Each complaint is a 10x opportunity (see pillars). |

---

## 2. The one mechanic

**"Roll and race."** We don't add mini-games or a mode buffet. Every feature below either makes rolling and racing feel better, or gives you a reason to roll today. *(This follows Revenue Rule 5: one pure mechanic leads to high ratings and organic discovery.)*

---

## 3. The 10x pillars

### Pillar 1: Sachcha Dice ("honest dice"), provably fair rolls
The biggest reason people distrust Ludo apps is that they think the dice is rigged. We fix this with cryptography, not marketing:
- Before the match, the server commits to a seed by showing the hash `H(seed)`. Each roll comes from `HMAC(seed, turn#)`. After the match, the seed is revealed, and any player can tap **"Verify my dice"** to recompute every roll on their device.
- **Dice Stats** screen after each match: your distribution of 1–6 against the expected distribution, plus your "six count". Screenshots of this become free marketing.
- Bots get no advantage, and a "This match had N bots" label is always shown.
- *Skill basis:* the `puzzle` and `procedural-gen` skills say to make the board model the single source of truth and the RNG seeded, deterministic, and reproducible. `roblox-networking` says to keep the server authoritative and validate everything there. We apply those principles to the dice.

### Pillar 2: Parivaar Board, async family Ludo across cities
This is the real Indian use case: Dadi in Patna, Papa in Pune, and the kid in a Bengaluru hostel who can't all be online at 9 pm.
- A **persistent family room**. Each player moves whenever they're free, with turn reminders sent as WhatsApp deep links. A game can last 2 hours or 2 days.
- **Voice-note chaal**: attach a 5-second voice note to a move ("Ab dekh beta!"). It costs almost no data and carries most of the emotional value.
- **Family streaks and a family trophy shelf** that persists across games: "Sharma Parivaar: 47 games, Dadi leads 19 wins."
- Live mode is still there for real-time play (voice chat, 2–4 players). Async is the differentiator.

### Pillar 3: Roz ki Chaal, the daily Ludo puzzle (the content engine)
This fixes the two biggest weaknesses of a multiplayer-only game: you can't play solo, and there's nothing new tomorrow.
- **One hand-checked board position per day**, for example: "Red to move. Capture yellow and reach home in 3 rolls. Rolls are shown." It takes about 2 minutes, you play it solo, and it works fully offline.
- You share the result as an emoji grid on WhatsApp, Wordle-style: `🎲 Roz ki Chaal #214 🟥🟥⭐ 3/3`.
- Puzzles are **generated and verified by a solver**: the `puzzle` skill's generate-and-verify-solvable pattern plus seeded RNG. Each one is checked by a person before it ships.
- **1,000+ puzzles at launch** in a back-catalogue with 3 difficulty tiers. Target: 5,000.
- This also has a learning angle: "Train your planning brain." It can later support a paid ad-free **Ludo Masterclass** puzzle pack (Revenue Rule 4).

### Pillar 4: Apni Bhasha, Ludo that talks like you
- **Live commentary in 10+ languages**: Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Bhojpuri, and Hinglish. The commentary is written in cricket-commentator style ("Aur yeh gayi goti! Seedha ghar wapas!") and generated from a small set of event templates, so it works offline with no server calls.
- **Bot personalities** are characters, not difficulty sliders:
  - *Dadi*: safe and blocks everything
  - *Bunty*: aggressive and chases every capture
  - *Professor*: optimal and probabilistic
  - *Chhotu*: makes kid mistakes, for playing with children

  Built with the `game-ai` and `ai-behavior-trees-utility-ai` skills (utility-AI scoring of capture, safety, progress, and blocking).

### Pillar 5: Bharat-grade performance and offline play
- **Under 30 MB install, runs on 2 GB RAM phones, holds 30 fps** on Helio/Unisoc-class chips (`performance-optimization` skill: profile a release build on target hardware and enforce frame and asset budgets).
- **Fully offline:** vs bots, pass-and-play, Roz ki Chaal, and **local multiplayer over Wi-Fi hotspot or Bluetooth** with zero mobile data (trains, villages, weddings). *(Revenue Rule 6.)*
- **No-rage reconnect:** if you drop, you get 60 seconds to rejoin while your *chosen* bot personality plays for you. Leaving a match on purpose costs a cosmetic streak, never coins.
- Data-saver mode: no voice and no avatars, under 1 MB per match.

### Pillar 6: Desi game feel (the juice)
From the `game-feel` skill, with feedback tiers matched to the size of the moment:
- **Tier 1 (every roll):** the dice tumble with squash and stretch, plus a haptic tick.
- **Tier 2 (a six):** a dhol hit and a brief zoom-pulse on the board.
- **Tier 3 (a capture):** hit-stop for 80 ms, the captured token "slinks" home, and the opponent's avatar does a dramatic *"Arre!"* reaction.
- **Tier 4 (a token reaches home):** a rangoli bloom trail and shehnai flourish. The winner gets a baraat-style victory lap.
- Festival skins (Diwali diyas, Holi colour splashes, Eid lanterns, Pongal kolam, Onam pookalam) ship as **themed packs inside the evergreen game**, never as a separate app. *(Revenue Rule 3.)*

### Pillar 7: Chaupar heritage mode (later; the cultural moat)
Ludo comes from **Pachisi/Chaupar**, the cross-shaped board game of the Mahabharata and Akbar's life-size court board at Fatehpur Sikri. A beautifully illustrated Chaupar mode with cowrie-shell throws gives us a story no foreign clone can tell, and something press and schools will cover. It ships only after the classic game is rated 4.3★ or higher (depth before breadth).

---

## 4. Modes at launch (kept deliberately small)

| Mode | Players | Online? | Session |
|---|---|---|---|
| **Classic** (live) | 2–4, friends, random, or bots | Online or local hotspot | 10–20 min |
| **Quick Ludo**: 2 tokens, first one home wins | 2–4 | Either | 4–6 min |
| **Parivaar Board** (async) | 2–4, family room | Online, turns cached offline | Hours to days |
| **Roz ki Chaal** daily puzzle | Solo | Offline | 2 min |

**Not at launch:** Chaupar, tournaments, clans, spectator mode, power-up "magic" Ludo. Each one comes only after reviews ask for it.

---

## 5. Monetization: ads players don't hate, no real money

*(Revenue Rule 1: rewarded video is the main ad format and **we never use banner ads**.)*

- **Rewarded video** (opt-in only): an extra Roz ki Chaal hint, a double daily cosmetic reward, or a "revive streak".
- **Interstitial** only *between* matches, at most 1 every 3 minutes of play. Never in the first session, never in a family async game, never in a puzzle.
- **Cosmetic IAP via UPI, priced for India:**
  - Dice or token skins: ₹10–₹49
  - Board themes: ₹29–₹99
  - Festival packs: ₹49
  - **Adda Pass** (monthly cosmetic track): ₹49
  - **Remove ads forever:** ₹149
- **Legal guardrails** (under the 2025 Act): no entry fees and no prize pools. Coins can't be bought back, cashed out, or traded. There are no paid loot boxes; any random cosmetic drop shows its odds. Match records and age gating are kept per the 2026 Rules.

**Revenue sanity check** (from the skill's India benchmarks, at 50K DAU, about 3 sessions per day):
- Rewarded video: 50,000 users × 40% watch rate × $5 eCPM ≈ **$100/day**
- Interstitials: 50,000 users × 1 per day × $1 eCPM ≈ **$50/day**
- IAP: 1.5% of DAU spend about ₹60 per month, so 750 users × ₹60 ≈ ₹45K/month ≈ **$18/day**
- Total: about **$170/day, or ₹4.3 lakh/month**. This is a sustainable base for a small team, and it scales with family rooms (where 1 install brings 3 more).

---

## 6. Growth loops

1. **Family invite loop:** creating a Parivaar Board *requires* inviting family over a WhatsApp link, so each organic install brings in 2–3 more.
2. **Daily share loop:** the Roz ki Chaal emoji grid gets shared in family and college WhatsApp groups every day.
3. **Proof loop:** "Verify my dice" and Dice Stats screenshots answer "is it rigged?" publicly, on Reels and YouTube Shorts.
4. **Creator rooms (Next):** a streamer hosts a live room, and viewers make **free** predictions ("Will Red capture this turn?") for cosmetic badges. There's no money involved.

---

## 7. Tech plan, mapped to `awesome-gamedev-agent-skills`

Source: [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills), 77 agent skills. Install it with `/plugin marketplace add gamedev-skills/awesome-gamedev-agent-skills`.

| Layer | Choice | Skills to load |
|---|---|---|
| Engine | **Godot 4.x** (best skill coverage, small Android export). Defold is the fallback if the APK goes over 30 MB. | `godot-gdscript`, `godot-nodes-scenes`, `godot-signals-groups`, `godot-ui-control`, `godot-animation`, `godot-export`, `godot-gdscript-headless-testing` |
| Board rules | A pure, deterministic `LudoRules` model (no rendering code). Visuals only render state, and input is locked while a move resolves. | `puzzle` (board as single source of truth), `card-game` (turn structure and zones) |
| Dice | Server-seeded commit-reveal HMAC. Offline uses a local seed, revealed afterwards. | `procedural-gen` (seeded RNG) |
| Multiplayer | **Nakama** (open-source and has a Godot client), server-authoritative match handler. Async rooms are stored as a turn log. | `godot-multiplayer`; principles from `roblox-networking` (server validation, rate limits) |
| Bots | Utility AI that scores capture, safety, progress, and blocking, with weights per personality | `game-ai`, `ai-behavior-trees-utility-ai` |
| Save and reconnect | Versioned snapshots plus the turn log, autosaved after every move | `save-systems` |
| Feel | 4-tier feedback system, tweens, haptics | `game-feel`, `audio-design` |
| Art | One locked art direction (warm, hand-drawn, Indian textile patterns) | `create-game-assets` |
| UI | Big tap targets (48dp+), notch safe areas, one-thumb play, readable for grandparents | `game-ui-ux`, `input-systems` |
| Perf | 30 fps lock, under 150 MB RAM, budgets checked in CI | `performance-optimization` |

---

## 8. Prototype plan (week 1), from the `prototype-fast` skill

- **The one question:** *"Is async family Ludo plus the daily puzzle something people come back to tomorrow?"*
- **Timeboxes:**
  - 90 minutes: a greybox board with rules and bots
  - 1 day: an async turn log faked with local storage
  - 1 day: 30 hand-made Roz ki Chaal puzzles
- **Keep/kill criteria, set before writing any code:**
  - KEEP if a cold player solves a Roz ki Chaal puzzle within 30 seconds of opening and asks for another one.
  - KEEP if at least 3 of 5 test families make an async move the next day without a reminder from us.
  - KILL or rethink if testers only ever play live with bots. That would mean we're just Ludo King with nicer dice.
- A KEEP means **rewriting** the code properly, not shipping the spike.

---

## 9. Roadmap (Now / Next / Later)

**NOW (months 1–3), to launch:**
- Classic, Quick, and bots
- Provably fair dice
- Parivaar Board
- Roz ki Chaal with 1,000 puzzles
- Hindi, English, and Hinglish
- Hotspot local multiplayer
- Rewarded video and between-match interstitials only
- Under 30 MB, Android 8+

**NEXT (months 4–6):**
- 8 more languages with voice commentary
- Voice-note moves
- Festival packs
- Adda Pass
- Creator rooms
- iOS

**LATER (month 7+):**
- Chaupar heritage mode
- Ludo Masterclass paid puzzle pack
- School and college inter-hostel leagues (free, esports-style, as recognised under the 2025 Act)
- Smart TV / JioTV casting for living-room family play

**Deliberately NOT building:**
- Real-money or "convertible coin" modes (illegal, and they destroy trust)
- Banner ads
- Power-up "magic" Ludo at launch (it breaks the one-mechanic rule)
- Standalone festival apps
- Gacha with hidden odds

---

## 10. Scorecard (Indie Game PM evaluation matrix)

| Dimension | Score | Why |
|---|---|---|
| Market demand | 2 | Huge demand, but Ludo King owns the category, so we need the differentiators |
| Mechanic clarity | 3 | "Roll and race." Everyone in India already knows it. |
| Monetization fit | 2 | Rewarded video plus micro-IAP is clear. Real money is off the table. |
| Content scalability | 3 | Solver-generated daily puzzles, cosmetic packs |
| Feasibility | 2 | Classic offline play is easy. Async rooms and fair-dice backend add real work. |
| Offline viability | 2 | Core play, puzzles, and hotspot play are offline. Family async needs a network to sync. |
| Retention mechanism | 3 | Daily puzzle, family streaks, async turns |
| **Total** | **17 / 21** | **GO**, on condition that launch leads with the differentiators |

**The single most important fix:** don't market "a better Ludo". Market **"Family Ludo you can trust"**, built on Parivaar Board, Sachcha Dice, and Roz ki Chaal. Without those three, this is a clone into a market with a 1.25B-download incumbent.

---

### Sources
- [awesome-gamedev-agent-skills (GitHub)](https://github.com/gamedev-skills/awesome-gamedev-agent-skills)
- [Top 10 most downloaded mobile games in India 2025, Outlook Respawn](https://respawn.outlookindia.com/gaming/gaming-news/top-10-most-downloaded-mobile-games-in-india-in-2025)
- [India mobile app market Q2 2026, Sensor Tower](https://develop.sensortower.com/blog/india-mobile-app-market-q2-2026)
- [Sensor Tower: India Mobile Games Market in 2025](https://gamedevreports.substack.com/p/sensor-tower-india-mobile-games-market)
- [Zupee crosses 150M users, Free Press Journal](https://www.freepressjournal.in/tech/zupee-ludo-gaming-app-crosses-150-million-users-125-million-gameplays)
- [Online Gaming Act 2025 and Rules 2026, Mondaq](https://www.mondaq.com/india/social-media/1785870/the-promotion-and-regulation-of-online-gaming-act-2025-and-the-promotion-and-regulation-of-online-gaming-rules-2026)
- [RMG platforms suspend activities after the Online Gaming Bill, The Week](https://www.theweek.in/news/india/2025/08/22/real-money-game-platforms-suspend-activities-after-parliament-passes-online-gaming-bill-2025.amp.html)
