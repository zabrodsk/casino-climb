# Implementation Plan: Casino Dungeon Crawler

**Project:** "The House Always Wins" — browser pixel art casino dungeon game
**Team:** 2 people (Person A: Engine/Dungeon, Person B: Games/Narrative)
**Timeline:** 24 hours total (22 hours of focused work, 2 hours buffer)
**Hackathon scope:** Floors 1–3 (Coin Flip, Crash, Blackjack) + optional Wheel of Fate
**Stack:** Phaser.js 3 + TypeScript, GitHub Pages deploy
**Source of truth:** `DESIGN.md` in the hackathon repo

This plan assumes DESIGN.md has been approved. It breaks the build into 9 sequential phases with parallel tracks inside each phase, explicit verification gates, and a cut list for when things slip.

---

## Principles

1. **Verification gates at every phase.** You do not advance until the gate passes. A bug at Hour 4 that you discover at Hour 20 costs you the demo.
2. **Parallelism where possible, merge points where necessary.** Person A and B work in parallel but sync at every merge checkpoint.
3. **The scene interface contract is law.** Written once at Phase 0, never changed. Every game scene obeys the same launch/complete API.
4. **Ship over perfect.** If a phase runs 30 minutes over, cut scope in the current phase — never push back the next phase.
5. **Deploy from Hour 1.** GitHub Pages is live from the first push. Every commit is a potentially demo-able build.

---

## Dependency Graph

```
Phase 0 (Setup) ──► Phase 1 (Foundations) ──► Phase 2 (Core Loop) ──► Phase 3 (Floor Tilemaps)
                                                                              │
                                                                              ▼
                                                          Phase 4 (Integration Checkpoint) ◄── MERGE
                                                                              │
                                                                              ▼
                                                          Phase 5 (Wheel + Polish)
                                                                              │
                                                                              ▼
                                                          Phase 6 (The House System)
                                                                              │
                                                                              ▼
                                                          Phase 7 (Narrative Layer)
                                                                              │
                                                                              ▼
                                                          Phase 8 (Ship)
```

---

## Phase 0 — Pre-Flight Setup (0:00–0:30, both)

**Goal:** Repo live, deploy pipeline working, tools installed, interface contracts written.

**Tasks (parallel):**
- Person A:
  - `npm create phaser-game@latest` → TypeScript → verify runs in browser (`npm run dev`)
  - Push to `github.com/zabrodsk/hackathon-casino` main branch
  - Add `.github/workflows/deploy.yml` for GitHub Pages build + deploy on push
  - Verify first deploy succeeds (check the Actions tab)
- Person B:
  - Download Anokolisa 16x16 dungeon pack (or confirm unavailable → note to draw custom)
  - Install Tiled map editor
  - Download Minecraft bitmap font (`.fnt` + `.png`)
  - Sketch a 20x15 tile Floor 1 placeholder map in Tiled → export JSON

**Together (last 10 min):**
- Write `docs/CONTRACTS.md` with the Scene Interface Contract (copy from DESIGN.md verbatim)
- Agree on file/folder structure:
  ```
  src/
    scenes/            # One file per scene
    games/             # Game logic modules (pure TS, no Phaser dependencies where possible)
    state/             # Coin state, floor state, localStorage wrapper
    ui/                # HUD components (speech bubble, coin counter)
    data/              # The House lines JSON, memory fragments JSON
  assets/
    tilemaps/          # Tiled JSON + tileset PNGs
    fonts/             # Minecraft.fnt + Minecraft.png
    sprites/           # Character, cards, chips
    audio/             # Music + SFX
  ```

**Verification Gate:**
- [ ] `https://zabrodsk.github.io/hackathon-casino/` loads and shows Phaser's default boot screen
- [ ] `CONTRACTS.md` committed and pushed
- [ ] Tiled installed on both machines
- [ ] First tilemap JSON exists (even if placeholder)

**If behind at 0:30:** Stop. Fix the blocker. Do not proceed to Phase 1 without a working deploy pipeline. This is the one phase you cannot cut.

---

## Phase 1 — Foundations (0:30–3:30, parallel)

**Goal:** Phaser scene system working. Character walks around a tilemap. Coin Flip game is playable in isolation.

### Person A — Engine (3 hours)
**Tasks:**
- `BootScene`: preload tilemap JSON, tileset PNG, Minecraft font, character sprite
- `DungeonScene` v1:
  - Load Floor 1 tilemap
  - Render tile layers (ground, walls)
  - Instantiate character sprite at entrance position
  - WASD/arrow input → velocity-based movement
  - Wall collision via tilemap collision layer
  - Camera follows player with slight lerp
- Coin state module (`src/state/coinState.ts`):
  - `{ coins: number, floor: number }` with getters/setters
  - Module-level singleton accessible from any scene
- Smoke test: character walks around Floor 1 without clipping walls

### Person B — First Game (3 hours)
**Tasks:**
- `CoinFlipScene`:
  - Full-screen overlay scene (dark background, centered UI)
  - Bet input: 3 preset buttons (5, 25, 50 coins)
  - Risk toggle: Coin Flip (2x payout, 50% odds) or Dice Duel (pick 1-3 for 4x, 1-2 for 2x)
  - "Flip!" / "Roll!" button → animated result → payout or loss
  - "Done" button → emit `game-complete` event with new coin total and `won: boolean`
- Pure game logic module (`src/games/coinFlip.ts`) — returns `{ won: boolean, newCoins: number }` given `{ coins, bet, riskType }`
- Smoke test: scene runs standalone in a test route, can play 10 rounds, coin math correct

**Merge Point (3:30):**
- Run CoinFlipScene from DungeonScene via `scene.launch` with coin state passed in
- Verify coins update in state module on game completion

**Verification Gate:**
- [ ] Character moves smoothly on Floor 1 tilemap, can't walk through walls
- [ ] CoinFlipScene launches from within DungeonScene
- [ ] Coins persist correctly after playing Coin Flip
- [ ] No console errors

**If behind at 3:30:** Skip Dice Duel risk mode, ship Coin Flip only. Start Phase 2 with the simpler game.

---

## Phase 2 — Core Loop (3:30–6:30, parallel)

**Goal:** Dungeon → Game → Dungeon → Next Floor loop works with Floor 1 alone. Exit stairs unlock on win.

### Person A — Dungeon Logic (3 hours)
**Tasks:**
- Doorway trigger system:
  - Place invisible trigger zones on specific tiles (via Tiled object layer)
  - Entering trigger = launch the assigned game scene
- Scene return handling:
  - DungeonScene listens for `game-complete` event
  - On `won: true`: unlock ExitStairs trigger (change tilemap layer visually — closed door → open)
  - On `won: false` and `coins === 0`: dispatch to run-restart flow
- ExitStairs trigger: walking onto it → launch TransitionScene (placeholder for now — just fades to next floor)
- Floor advancement:
  - On floor advance, DungeonScene restarts with new tilemap key + new floor number in state
- Floor win conditions wired to coin state (Floor 1: coins >= 300 after finishing game)

### Person B — Crash Game (3 hours)
**Tasks:**
- `CrashScene`:
  - Rising multiplier number (1.00x → increments by 0.01 every 50ms, accelerating)
  - Crash RNG: random crash point between 1.05 and 10.0, weighted toward lower values
  - "Cash Out" button → lock multiplier at current value, win = bet × multiplier
  - If crash hits first → lose bet
  - Screen shake on crash, flash red
  - 3 successful cash-outs in a row OR reach 350 coins → `won: true` and return to dungeon
- Pure logic module (`src/games/crash.ts`)
- Smoke test: play 10 rounds, verify crash distribution feels fair-ish, UI clearly shows the tension

**Verification Gate:**
- [ ] Walking into the Floor 1 game door launches Coin Flip
- [ ] Winning Coin Flip unlocks the exit stairs visually
- [ ] Walking onto exit stairs loads Floor 2 (using Floor 1 tilemap as placeholder if needed)
- [ ] Crash game plays correctly in isolation
- [ ] Coin state is preserved through all scene transitions

**If behind at 6:30:** Ship with one Crash win condition only (coins threshold). Skip the 3-in-a-row logic.

---

## Phase 3 — Floor Variety (6:30–9:30, parallel)

**Goal:** Three visually distinct floors. Per-floor atmosphere. Blackjack playable.

### Person A — Floors 2 & 3 + HUD (3 hours)
**Tasks:**
- Floor 2 tilemap: Crash Hall palette (purple/red/dark grey). Either:
  - Recolor Floor 1 tiles in a paint app (20 min)
  - OR draw custom 16x16 tiles if Anokolisa palette is wrong (2 hours — take this only if you're fast)
- Floor 3 tilemap: Blackjack Parlor palette (dark green felt, brown wood, brass)
- HUD component (`src/ui/HUD.ts`):
  - Coin counter (top left, Minecraft font)
  - Floor indicator (top right, e.g. "Floor 1 — The Lobby")
  - Speech bubble placeholder (bottom, 60% width, hidden by default)
- Wire HUD into DungeonScene — always visible during walking

### Person B — Blackjack (3 hours)
**Tasks:**
- `BlackjackScene`:
  - Dealer area (top), player area (bottom)
  - Card deck logic: 52 cards, shuffle, deal 2 to each
  - Hit / Stand / Bust / Blackjack logic
  - Dealer AI: hit until 17+
  - Bet input before hand starts
  - "Leave Table" button → return to dungeon with current coin total
  - Win condition: win 3 hands OR reach 400 coins → `won: true`
- Pure logic module (`src/games/blackjack.ts`)
- Card sprites: draw 16x16 card back + 4 suit symbols if no free asset (1 hour), or find free card pack

**Verification Gate:**
- [ ] All 3 floors have visually distinct palette
- [ ] Floor name appears in HUD on each floor
- [ ] Coin counter updates in real time during betting
- [ ] Blackjack plays a full hand correctly (including blackjack, bust, push)

**If behind at 9:30:** Skip Floor 3 custom tilemap, reuse Floor 2 with darker tint. Ship Blackjack with only one win condition.

---

## Phase 4 — Integration Checkpoint (9:30–11:30, together)

**Goal:** All three games integrated into the full 3-floor walk-through. Demo path works end to end.

**Joint tasks (both people):**
- Run the full demo path: Start → Floor 1 → Coin Flip → Win → Floor 2 → Crash → Win → Floor 3 → Blackjack → Win → EndScene placeholder
- Fix integration bugs — scene lifecycle issues, coin state leaks, event listener double-registration, tilemap loading order
- Test failure path: play until coins = 0, verify run restart works and returns to Floor 1 with 200 coins
- Test edge cases: what happens if you win Floor 1 with exactly 300 coins? What if you bet the max and lose?

**Verification Gate:**
- [ ] A player can walk from MenuScene to EndScene placeholder in under 5 minutes playing normally
- [ ] Coin state is correct at every point in the run
- [ ] No scene lifecycle errors in console
- [ ] Run restart on 0 coins works and preserves `localStorage.runCount`

**If behind at 11:30:** This phase cannot be cut. Extend it by 30 minutes, take that time from Phase 5.

---

## Phase 5 — Wheel of Fate + Game Polish (11:30–14:30, parallel)

**Goal:** Optional side room works. Games feel polished.

### Person A — Hidden Side Door + Memory System (3 hours)
**Tasks:**
- Add a hidden doorway on Floor 2 tilemap — visually subtle, no label, but has a trigger zone
- Trigger zone launches `WheelOfFateScene`
- Memory fragment system:
  - `src/state/memoryState.ts` — tracks which fragments have fired
  - Fragment display: full-screen fade-to-black with Minecraft font text appearing letter by letter
  - Triggers: Floor 2 entry (recruiter face flash), Floor 3 entry (contract fragment)
- `TransitionScene` upgraded: between-floor pause showing memory fragment + The House line for 5 seconds, then next floor

### Person B — Wheel of Fate + Blackjack Polish (3 hours)
**Tasks:**
- `WheelOfFateScene`:
  - Phaser Graphics API: draw a circle divided into 8 colored segments
  - Each segment has a type: 2x, 1.5x, 0.5x, Push, 🔥 Double, 💀 Lose All, ❓ Random
  - Spin animation: rotate the wheel, decelerate, land on a segment
  - Before each spin: re-randomize the segment layout (the "changing wheel" twist)
  - The House is silent in this scene — no speech bubble
- Blackjack polish: dealer dialogue lines (pulled from The House JSON once that exists), card flip animation, chip animation on bet placement

**Verification Gate:**
- [ ] Wheel of Fate is findable and playable
- [ ] Wheel segments visibly change between spins
- [ ] Memory fragments trigger on floor transitions and look intentional, not buggy
- [ ] TransitionScene feels like a deliberate pause, not a loading screen

**If behind at 14:30:** Cut the Random Effect segment from the wheel. Skip the letter-by-letter fragment animation — just fade it in whole.

---

## Phase 6 — The House System (14:30–17:00, primary: Person A)

**Goal:** The House speaks. The game feels alive.

**Person A tasks (2.5 hours):**
- Write `src/data/houseLines.json`:
  ```json
  {
    "floorEntry": { "1": [...], "2": [...], "3": [...] },
    "playerActions": {
      "winStreak3": [...],
      "lowChips": [...],
      "busted": [...],
      "highBet": [...],
      "longDelay": [...]
    },
    "gameSpecific": {
      "crashLost": [...],
      "blackjackBusted": [...],
      "wheelLoseAll": [...]
    }
  }
  ```
  - Minimum 2-3 lines per trigger so dialogue doesn't feel repetitive
- Speech bubble UI (`src/ui/SpeechBubble.ts`):
  - Appears at bottom of screen, 60% width, Minecraft font
  - Letter-by-letter text reveal (fast — 30ms per char)
  - Auto-dismiss after text complete + 3 seconds
- Trigger hooks:
  - On scene launch: emit "floorEntry" event
  - Games emit their own events (`crash-lost`, `bj-busted`, etc.)
  - A `HouseController` singleton subscribes, picks a line, shows it via SpeechBubble
- Special case: in `WheelOfFateScene`, HouseController is disabled — The House goes silent

**Person B tasks (2.5 hours):**
- Placeholder → real art pass on game UIs
- Sound effect hooks: `assets/audio/coin.wav`, `assets/audio/win.wav`, `assets/audio/lose.wav`, `assets/audio/card-flip.wav`
- Play sounds on appropriate events in each game

**Verification Gate:**
- [ ] The House says something on every floor entry
- [ ] The House says something when player wins 3 in a row
- [ ] The House says something when player busts at Blackjack
- [ ] The House is silent during Wheel of Fate
- [ ] Speech bubble animation feels deliberate, readable

**If behind at 17:00:** Ship with 1 line per trigger instead of 2-3. Drop letter-by-letter reveal (show full text immediately).

---

## Phase 7 — Narrative Layer (17:00–19:00, primary: Person B)

**Goal:** The opening and ending exist. The story is experienced, not just implied.

**Person B tasks (2 hours):**
- `MenuScene`:
  - Black background, Minecraft font
  - Text sequence: "You wake up." / "Bright lights. The smell of money." / "You don't remember how you got here." / "Press any key."
  - On key press → fade to DungeonScene Floor 1
- `EndScene`:
  - Trigger on Floor 3 win (for hackathon demo — real game triggers on Floor 6)
  - Text sequence revealing the full truth:
    - "You remember now."
    - "The recruiter. The promise."
    - "You came here because you needed the money."
    - "You still do."
  - Two buttons: "Leave" (fade to black + final quote) / "Play Again" (restart run from Floor 1, keep coins)
- Support NPC beat after Floor 2:
  - In TransitionScene, 30% chance a Support NPC appears
  - Offers a revive token (localStorage flag that triggers once, prevents run restart on next 0-coins event)
  - Or: a coin discount (next floor bets have -20% cost)

**Person A tasks (2 hours):**
- Wire the win condition on Floor 3 → triggers EndScene (not the next DungeonScene)
- Final coin state display on EndScene
- Run stats in `localStorage` (runCount, highestFloor, totalCoins)

**Verification Gate:**
- [ ] Game opens with MenuScene, not straight into dungeon
- [ ] Winning Floor 3 goes to EndScene
- [ ] "Leave" ends the demo. "Play Again" restarts the run.
- [ ] Support NPC appears at least once in testing

**If behind at 19:00:** Cut Support NPC entirely. Ship without the variance event — it's polish, not core.

---

## Phase 8 — Polish & Ship (19:00–22:30, both)

**Goal:** The demo looks and feels ready for a judge. GitHub Pages URL works reliably.

**Tasks (last-mile polish list, prioritize top-down):**

**Must-have (Hour 19–21):**
- Ambient music loop on DungeonScene (Freesound.org creative commons)
- Sound stings on win/lose
- Camera effects: shake on Crash crash, fade on floor transitions, slight flash on bet placement
- Pixel art pass: anything still showing as a colored rectangle gets replaced with a 16x16 sprite
- Fix any console errors or warnings

**Nice-to-have (Hour 21–22):**
- Particle effects on big wins (Phaser particle emitter)
- Background CRT scanline shader on Floor 2 (Crash Hall digital aesthetic)
- Idle animation on character sprite

**Cut if behind (Hour 22–22:30):**
- Final test pass: play the demo 3 times start to finish, note and fix any rough edges
- Record a 30-second demo video for submission
- Write a concise README.md with: title, pitch, how to play, team names

**Verification Gate (the ship gate):**
- [ ] `https://zabrodsk.github.io/hackathon-casino/` loads in under 10 seconds
- [ ] Full demo can be played start to finish without errors
- [ ] Sound plays on every expected event
- [ ] All 3 floors look visually distinct
- [ ] The House speaks at least 5 times in a typical run
- [ ] EndScene delivers the story beat and offers the choice
- [ ] README.md exists, 30-second demo video recorded

---

## Parallelism Rules

1. **Within a phase, Person A and B work on different files.** Never edit the same file in the same phase.
2. **Merge only at defined checkpoints.** Phase boundaries are merge points.
3. **If one person finishes early, they do NOT start the next phase alone.** They pick up polish items from the cut list, or help the other person's current task.
4. **All Phaser scene keys are reserved before Phase 1.** No ad-hoc scene names invented mid-phase.
5. **Game logic modules have no Phaser imports where possible.** This makes them testable and reduces coupling.

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| GitHub Pages deploy breaks mid-hackathon | Low | High | Deploy pipeline tested in Phase 0. If it breaks, switch to Netlify (5 min fallback). |
| Tiled JSON + Phaser tilemap mismatch | Medium | Medium | First thing in Phase 1. If it fails, use Phaser's in-code tilemap creation instead of Tiled. |
| Scene lifecycle bugs (events firing twice, state leaking) | High | High | Phase 4 integration checkpoint is dedicated to this. Do not skip. |
| Free pixel art pack unavailable/unsuitable | Medium | Low | Art policy in DESIGN.md allows custom draws. 16x16 at Phaser's pixel-perfect scale is forgiving. |
| One person blocked, other idle | Medium | Medium | Cut list exists for every phase. Blocked person picks up from cut list. |
| Hour 20 discovery of critical bug | Medium | High | Phase 4 integration checkpoint catches most of these. Final Phase 8 test pass catches the rest. |
| Feature creep (adding Floor 4 mid-build) | Medium | High | This plan is the contract. Floors 4–6 are explicitly out of hackathon scope. Refuse mid-flight additions. |

---

## Cut List (in order, if behind schedule)

Cut from the bottom up. Each cut buys you 30–90 minutes.

1. **Particle effects and CRT shader (Phase 8 nice-to-have)** — 30 min
2. **Support NPC between floors** — 45 min
3. **Letter-by-letter memory fragment reveal** — 20 min
4. **Wheel of Fate Random Effect segment** — 30 min
5. **Dice Duel risk mode on Floor 1** — 45 min
6. **Floor 3 custom tilemap** (reuse Floor 2 with tint) — 60 min
7. **Blackjack 3-win condition** (coins-only win) — 30 min
8. **Crash 3-in-a-row condition** (coins-only win) — 30 min
9. **Wheel of Fate entirely** (skip the optional side room) — 90 min — LAST RESORT

Never cut:
- GitHub Pages deploy (Phase 0)
- Phase 4 integration checkpoint
- The House speaking at least once per floor
- EndScene with the choice
- Final demo test pass (Phase 8)

---

## Verification Strategy

Every phase has a gate with explicit checkboxes. You run the gate checks before starting the next phase. If a gate fails:
1. Identify the failing item
2. Decide: fix now (5–15 min cap) OR invoke cut list to compensate
3. Never advance while a gate is failing silently

**Final ship gate (Phase 8) is non-negotiable.** If any ship gate item fails at Hour 22:30, the demo is not ready. Use the buffer hours (22:30–24:00) to fix, or accept a degraded submission.

---

## What to commit to the repo

This plan file should be committed as `PLAN.md` alongside `DESIGN.md` in the hackathon repo. DESIGN.md is the "what and why." PLAN.md is the "how and when."
