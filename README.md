# Casino Climb

Browser pixel art casino dungeon crawler. A desperate man wakes inside a casino, climbs floor by floor to escape, and uncovers the truth at the top — he came here willingly.

See `DESIGN.md` for game design and `PLAN.md` for the implementation plan.

## Local dev

```bash
npm install
npm run dev
```

Open http://localhost:8080 (or whatever port Vite reports).

## Build

```bash
npm run build
```

Output in `dist/`.

## Deploy

Pushes to `main` auto-deploy to GitHub Pages via Actions.
Live URL: https://zabrodsk.github.io/hackathon-casino/

**First-time setup:** After the first successful Actions run, enable GitHub Pages in repo Settings → Pages → Source: "GitHub Actions".
