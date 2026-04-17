# Scene Interface Contract

All game scenes (CoinFlipScene, CrashScene, BlackjackScene, WheelOfFateScene) follow this exact contract.

## Launch

```ts
this.scene.launch('CoinFlipScene', {
  coins: state.coins,
  floor: state.floor
});
```

## Complete

Game scenes emit a `game-complete` event on the DungeonScene when the player exits:

```ts
this.scene.get('DungeonScene').events.emit('game-complete', {
  coins: newCoins,   // updated coin total
  won: boolean       // did the player meet the floor win condition?
});
```

## Contract rules

1. Game scenes never mutate state directly. They emit the new values via `game-complete`.
2. DungeonScene is the sole listener. On receiving the event:
   - Updates the coin state module
   - If `won === true`: unlocks exit stairs
   - If `won === false && coins === 0`: triggers run-restart flow
3. Game scenes are always launched as overlays on top of DungeonScene (not `scene.start` — keep DungeonScene alive via `this.scene.pause('DungeonScene')` and `this.scene.resume('DungeonScene')`).
4. No exceptions. All four game scenes obey this contract.
