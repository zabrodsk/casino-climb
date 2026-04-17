<div align="center">
  <img src="public/assets/logo.png" alt="Casino Climb logo" width="180" />
  <h1>🎰 Casino Climb</h1>
  <p><strong>Escape the dungeon. Outsmart the House. Climb or lose everything.</strong></p>

  <p>
    <a href="https://zabrodsk.github.io/casino-climb/">
      <img src="https://img.shields.io/badge/▶_Play_Live-ff4d8d?style=for-the-badge" alt="Play Live" />
    </a>
    <a href="https://phaser.io/">
      <img src="https://img.shields.io/badge/Phaser-3.90-6f42c1?style=for-the-badge" alt="Phaser" />
    </a>
    <a href="https://www.typescriptlang.org/">
      <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=for-the-badge" alt="TypeScript" />
    </a>
    <a href="https://vitejs.dev/">
      <img src="https://img.shields.io/badge/Vite-6.x-646cff?style=for-the-badge" alt="Vite" />
    </a>
  </p>
</div>

![Casino Climb atmosphere](public/assets/bg.png)

> You wake up inside a casino dungeon with no memory, **200 coins**, and one rule:  
> **The House always gets paid.**

## ✨ Why this game is catchy

| Hook | What makes it fun |
|---|---|
| **Narrative pressure** | Every floor reveals more of the mystery while raising the stakes. |
| **Arcade tension** | Fast betting loops + risky choices keep every run intense. |
| **Run economy** | Coins persist across floors, so every win and loss matters. |
| **Style** | Pixel-art dungeon vibe with neon casino energy. |

## 🎮 Gameplay snapshot

- **Start:** 200 coins on Floor 1
- **Floors:** Coin Flip / Dice Duel → Crash → Blackjack (+ optional Wheel of Fate)
- **Goal:** hit the floor target to unlock stairs
- **Fail state:** 0 coins resets the run

### Floor targets

| Floor | Name | Target |
|---|---|---|
| 1 | The Lobby | **300** |
| 2 | The Crash Hall | **350** |
| 3 | The Blackjack Parlor | **400** |

## 🕹 Controls

- **Move in dungeon:** `WASD` or Arrow keys
- **Menus & minigames:** mouse / pointer

## 🚀 Play and run

**Live game:** https://zabrodsk.github.io/casino-climb/

```bash
npm install
npm run dev
```

Local dev server runs on port `8080` by default.

### Production build

```bash
npm run build
```

Output is generated in `dist/`.

## 🧱 Stack

- **Phaser 3** for gameplay and scenes
- **TypeScript** for game logic
- **Vite** for fast dev/build
- **GitHub Actions + GitHub Pages** for deployment

## 📁 Structure

```text
src/
  scenes/   # Dungeon + game scenes
  games/    # Core game mechanics
  state/    # Run state (coins, floor, effects)
  ui/       # HUD + visual theme
  data/     # Floor configs
public/assets/  # Sprites, tilemaps, audio
```

## 📚 Docs

- Concept + story: [`DESIGN.md`](./DESIGN.md)
- Build notes: [`PLAN.md`](./PLAN.md)

## 📄 License

MIT
