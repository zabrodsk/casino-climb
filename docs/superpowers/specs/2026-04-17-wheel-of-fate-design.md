# Wheel of Fate — Floor 4 Design Spec
_2026-04-17_

## Overview

Floor 4 is an optional spin-wheel event room. The player can walk past the wheel and continue their run unchanged, or tempt fate for a high-variance outcome. The wheel is never the optimal choice — it is a temptation mechanic that rewards boldness, punishes greed, and reveals player personality.

---

## Floor 4 Room (Dungeon)

- **Name:** THE FATE CHAMBER
- **Aesthetic:** Deep void/purple, violet torch glow, dark floor tiles
- **Table label:** WHEEL
- **Progression:** Stairs are always unlocked — no coin target required. `won: true` is emitted by both skip and spin paths. The wheel room is a pass-through.
- **Config key:** `4` in `FLOOR_CONFIG`
- **gameSceneKey:** `'WheelScene'`

---

## WheelScene Flow

1. Fade in → display current coins and two buttons:
   - **PASS BY** — return to dungeon immediately, coins unchanged, `won: true`
   - **TEMPT FATE** — proceed to spin
2. On spin: animated wheel (pie segments) accelerates then decelerates to a stop
3. Segment lands under the pointer → outcome revealed
4. Speech bubble plays typewriter flavor text for the outcome
5. Brief pause → `game-complete` emitted with updated coins and `won: true`

---

## Wheel Segments

12 segments, total weight = 100.

| Key | Weight | Coin Delta | Effect | Flavor |
|---|---|---|---|---|
| JACKPOT | 5 | +500 | — | "The wheel sings your name." |
| WINDFALL | 10 | +200 | — | "Fortune favors the bold." |
| REVIVE_TOKEN | 5 | 0 | Revive token granted | "A second chance, sealed in fate." |
| LUCKY | 5 | +100 | — | "Luck was always on your side." |
| GOLDEN_HAND | 5 | 0 | +25% coin gains next game | "Your hands are gilded." |
| TAILWIND | 15 | +50 | — | "A gentle push forward." |
| NEUTRAL | 5 | +10 | — | "The wheel watches. Waiting." |
| MIXED_OMEN | 15 | +30 | Curse (HEXED) applied to next game | "Coins now. Pain later." |
| PENALTY | 10 | −80 | — | "The house remembers." |
| HEAVY_LOSS | 10 | −150 | — | "Fate is not your friend today." |
| HEXED | 10 | 0 | −25% coin gains next game | "Something follows you now." |
| RUINOUS | 5 | −250 | — | "You should have walked away." |

Penalties are applied as-is. If coins go ≤ 0 and the player holds a revive token, they survive with 50 coins and the token is consumed. Otherwise it is a normal game-over (run resets).

---

## State Additions (`coinState.ts`)

```typescript
// Revive token — survive one bust
let _reviveToken = false;
export function hasReviveToken(): boolean
export function grantReviveToken(): void
export function consumeReviveToken(): void   // sets to false

// Active effect — buff or curse for one game
export type ActiveEffect = { type: 'buff' | 'curse'; magnitude: number } | null;
let _activeEffect: ActiveEffect = null;
export function getActiveEffect(): ActiveEffect
export function setActiveEffect(e: ActiveEffect): void
export function clearActiveEffect(): void
```

---

## Effect Wiring in Game Scenes

Each of `CoinFlipScene`, `CrashScene`, `BlackjackScene`:

1. **`init()`** — call `getActiveEffect()`, store as `this._activeEffect`
2. **Payout logic** — multiply coin *gains* by `(1 + magnitude)` for buff, `(1 - magnitude)` for curse. Losses are unaffected.
3. **On `game-complete` emit** — call `clearActiveEffect()`

### Revive token
In `_onGameComplete` inside `DungeonScene`: if `coins <= 0` and `hasReviveToken()`:
- call `consumeReviveToken()`
- set coins to 50
- show speech: "Your revive token shatters. You survive with 50 coins."
- do not reset run

### HUD indicator
`HUD` gains an optional status badge (small colored rect + text, bottom-left of coin panel):
- Gold: "GOLDEN HAND"
- Red: "HEXED"
- Hidden when no active effect

---

## New Files

| File | Purpose |
|---|---|
| `src/games/wheel.ts` | Segment definitions, weighted random picker, effect application |
| `src/scenes/WheelScene.ts` | Full scene: skip/spin UI, wheel animation, outcome display |

## Modified Files

| File | Change |
|---|---|
| `src/state/coinState.ts` | Add reviveToken + activeEffect state |
| `src/data/floorConfig.ts` | Add Floor 4 config |
| `src/scenes/CoinFlipScene.ts` | Read + apply activeEffect; clear on complete |
| `src/scenes/CrashScene.ts` | Read + apply activeEffect; clear on complete |
| `src/scenes/BlackjackScene.ts` | Read + apply activeEffect; clear on complete |
| `src/scenes/DungeonScene.ts` | Revive token check in `_onGameComplete` |
| `src/ui/HUD.ts` | Add effect status badge |
| `src/main.ts` | Register WheelScene |
