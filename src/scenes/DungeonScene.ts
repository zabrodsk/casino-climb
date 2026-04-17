import { Scene, Tilemaps, Physics, GameObjects } from 'phaser';
import { getCoins, getFloor, setCoins, setFloor, resetRun } from '../state/coinState';

// ── Tile indices into dungeon_tileset.png (304×208, 19 cols × 13 rows, 16×16 tiles)
// Index = row * 19 + col
//
// Visual layout (from image inspection):
//   Cols 0-5, rows 0-3:  Blue/teal dungeon floor area
//   Cols 6-12, rows 0-3: Pink/mauve wall face tiles (3/4 vertical face)
//   Col 3,13,15 rows 0+: Teal cyan accent (wall top edge / trim)
//   Rows 4-6, cols 6-10: Bright green decorative tiles (carpet/felt)
//   Rows 7-8:            Dark floor / wall bottom transition
//   Rows 8+:             Props, barrels, chests (right side)
//
// Chosen tile indices:
const TILE_VOID        = -1;  // empty (no tile rendered)

// Floor: col 0, row 0 = index 0  (dark blue stone floor)
const TILE_FLOOR_A     = 0;   // col 0, row 0 — dark blue floor
const TILE_FLOOR_B     = 1;   // col 1, row 0 — slightly darker variant
const TILE_FLOOR_C     = 4;   // col 4, row 0 — another floor variant

// Wall top (horizontal cap, seen from 3/4 above) — teal cyan top edge
const TILE_WALL_TOP_L  = 57;  // col 0, row 3 — teal, left wall top
const TILE_WALL_TOP_M  = 58;  // col 1, row 3 — teal, mid wall top
const TILE_WALL_TOP_R  = 59;  // col 2, row 3 — teal, right wall top

// Wall face (vertical 3/4 face visible below the top) — pink/mauve
const TILE_WALL_FACE_L = 25;  // col 6, row 1 — pink, left wall face
const TILE_WALL_FACE_M = 26;  // col 7, row 1 — pink, mid wall face
const TILE_WALL_FACE_R = 30;  // col 11, row 1 — pink, right wall face

// Solid dark wall (upper void — above top edge)
const TILE_WALL_DARK   = 20;  // col 1, row 1 — near-black

// Door / casino table: bright green felt tiles
const TILE_TABLE       = 103; // col 8, row 5 — bright green

// Stairs locked / open: generated programmatically (128×128 canvas)
const TILE_STAIRS_L    = 149; // col 16, row 7 — teal accent (locked placeholder)
const TILE_STAIRS_O    = 130; // col 16, row 6 — teal (open placeholder)

// ── 3/4 Perspective Map: 20 wide × 15 tall
// Encoding (per-cell single value → we will interpret multi-value in create()):
//   0  = floor
//   1  = wall (solid top-to-bottom — fills 2 rows visually: wall-top + wall-face)
//   2  = door / casino table
//   3  = stairs (locked at start)
const MAP_LOGIC: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 0, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const COLS = 20;
const ROWS = 15;
const TILE_SIZE = 16;

// Player entrance: col=2, row=12 (bottom-left area)
const PLAYER_START_X = 2 * TILE_SIZE + 8;
const PLAYER_START_Y = 12 * TILE_SIZE + 8;

// Door tile position: col=10, row=7
const DOOR_COL = 10;
const DOOR_ROW = 7;

// Stairs tile position: col=17, row=1
const STAIRS_COL = 17;
const STAIRS_ROW = 1;

/**
 * Build a 2D tilemap data array for the floor layer (all floor tiles).
 * Walls are transparent on this layer — only floor drawn here.
 */
function buildFloorData(): number[][] {
  return MAP_LOGIC.map(row => row.map(() => TILE_FLOOR_A));
}

/**
 * Build wall-top layer data (the teal horizontal cap row of each wall).
 * Only places a tile on the TOP row of each wall block.
 */
function buildWallTopData(): number[][] {
  const data: number[][] = Array.from({ length: ROWS }, () =>
    new Array(COLS).fill(-1)
  );

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP_LOGIC[r][c] !== 1) continue;

      // Determine if top-cap should show: yes if cell above is not also a wall
      // (or we're at top edge)
      const aboveIsWall = r > 0 && MAP_LOGIC[r - 1][c] === 1;
      if (!aboveIsWall) {
        // This is the exposed top of a wall — use wall-top tile
        const leftIsWall  = c > 0 && MAP_LOGIC[r][c - 1] === 1;
        const rightIsWall = c < COLS - 1 && MAP_LOGIC[r][c + 1] === 1;
        if (!leftIsWall && !rightIsWall) data[r][c] = TILE_WALL_TOP_M; // isolated
        else if (!leftIsWall)            data[r][c] = TILE_WALL_TOP_L;
        else if (!rightIsWall)           data[r][c] = TILE_WALL_TOP_R;
        else                             data[r][c] = TILE_WALL_TOP_M;
      } else {
        // Interior wall body — use dark tile (visible only if not overdrawn)
        data[r][c] = TILE_WALL_DARK;
      }
    }
  }

  return data;
}

/**
 * Build wall-face layer data (the pink vertical face row, drawn one row BELOW
 * the wall-top row, giving 3/4 perspective illusion).
 */
function buildWallFaceData(): number[][] {
  const data: number[][] = Array.from({ length: ROWS }, () =>
    new Array(COLS).fill(-1)
  );

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP_LOGIC[r][c] !== 0 && MAP_LOGIC[r][c] !== 2 && MAP_LOGIC[r][c] !== 3) continue;

      // If the cell directly ABOVE is a wall, this floor cell shows the wall face
      const aboveIsWall = r > 0 && MAP_LOGIC[r - 1][c] === 1;
      if (!aboveIsWall) continue;

      const leftAboveIsWall  = c > 0 && MAP_LOGIC[r - 1][c - 1] === 1;
      const rightAboveIsWall = c < COLS - 1 && MAP_LOGIC[r - 1][c + 1] === 1;

      if (!leftAboveIsWall && !rightAboveIsWall) data[r][c] = TILE_WALL_FACE_M; // isolated
      else if (!leftAboveIsWall)                 data[r][c] = TILE_WALL_FACE_L;
      else if (!rightAboveIsWall)                data[r][c] = TILE_WALL_FACE_R;
      else                                       data[r][c] = TILE_WALL_FACE_M;
    }
  }

  return data;
}

/**
 * Build prop/door/stairs layer data.
 */
function buildPropData(stairsOpen = false): number[][] {
  const data: number[][] = Array.from({ length: ROWS }, () =>
    new Array(COLS).fill(-1)
  );

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP_LOGIC[r][c] === 2) data[r][c] = TILE_TABLE;
      if (MAP_LOGIC[r][c] === 3) data[r][c] = stairsOpen ? TILE_STAIRS_O : TILE_STAIRS_L;
    }
  }

  return data;
}

export class DungeonScene extends Scene {
  private player!: Physics.Arcade.Sprite;
  private wallCollisionLayer!: Tilemaps.TilemapLayer;
  private propLayer!: Tilemaps.TilemapLayer;
  private propMap!: Tilemaps.Tilemap;

  private stairsUnlocked = false;
  private doorTriggered = false;

  private coinText!: GameObjects.Text;
  private floorText!: GameObjects.Text;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  constructor() {
    super({ key: 'DungeonScene' });
  }

  create(_data?: { floor?: number }): void {
    this.stairsUnlocked = false;
    this.doorTriggered = false;

    const mapW = COLS * TILE_SIZE;
    const mapH = ROWS * TILE_SIZE;

    // ── Layer 0: Floor (depth 0) ──────────────────────────────────────────
    const floorMap = this.make.tilemap({ data: buildFloorData(), tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const floorTs = floorMap.addTilesetImage('dungeon-tiles', 'dungeon-tiles', TILE_SIZE, TILE_SIZE, 0, 0)!;
    const floorLayer = floorMap.createLayer(0, floorTs, 0, 0)!;
    floorLayer.setDepth(0);
    // Warm gold tint for Floor 1 — The Lobby
    floorLayer.setTint(0xffe0b0);

    // ── Layer 1: Wall tops (depth 1) ─────────────────────────────────────
    const wallTopMap = this.make.tilemap({ data: buildWallTopData(), tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const wallTopTs = wallTopMap.addTilesetImage('dungeon-tiles', 'dungeon-tiles', TILE_SIZE, TILE_SIZE, 0, 0)!;
    const wallTopLayer = wallTopMap.createLayer(0, wallTopTs, 0, 0)!;
    wallTopLayer.setDepth(1);

    // ── Layer 2: Wall faces — 3/4 perspective (depth 2) ──────────────────
    const wallFaceMap = this.make.tilemap({ data: buildWallFaceData(), tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const wallFaceTs = wallFaceMap.addTilesetImage('dungeon-tiles', 'dungeon-tiles', TILE_SIZE, TILE_SIZE, 0, 0)!;
    const wallFaceLayer = wallFaceMap.createLayer(0, wallFaceTs, 0, 0)!;
    wallFaceLayer.setDepth(2);

    // ── Layer 3: Props — doors / stairs (depth 3) ─────────────────────────
    this.propMap = this.make.tilemap({ data: buildPropData(false), tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const propTs = this.propMap.addTilesetImage('dungeon-tiles', 'dungeon-tiles', TILE_SIZE, TILE_SIZE, 0, 0)!;
    this.propLayer = this.propMap.createLayer(0, propTs, 0, 0)!;
    this.propLayer.setDepth(3);

    // ── Collision layer: wall solid + door/stairs block (use wallTopLayer geometry) ──
    // We need a separate collision map based on the logical MAP_LOGIC
    // Build a collision tilemap that has index 1 for walls, -1 for rest
    const collisionData = MAP_LOGIC.map(row =>
      row.map(v => (v === 1 ? 1 : v === 2 ? 2 : v === 3 ? 3 : 0))
    );
    const collMap = this.make.tilemap({ data: collisionData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    // We need a tileset for it — reuse dungeon-tiles but make it invisible
    const collTs = collMap.addTilesetImage('dungeon-tiles', 'dungeon-tiles', TILE_SIZE, TILE_SIZE, 0, 0)!;
    this.wallCollisionLayer = collMap.createLayer(0, collTs, 0, 0)!;
    this.wallCollisionLayer.setVisible(false);
    this.wallCollisionLayer.setDepth(0);
    this.wallCollisionLayer.setCollision([1, 2, 3]);

    // ── Physics world ─────────────────────────────────────────────────────
    this.physics.world.setBounds(0, 0, mapW, mapH);

    this.player = this.physics.add.sprite(PLAYER_START_X, PLAYER_START_Y, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(5);
    // Adjust collision body to feet area for 3/4 perspective feel
    this.player.body!.setSize(14, 16);
    this.player.body!.setOffset(9, 28);
    // Scale down sprite slightly so it fits nicely in 16×16 tiles at 2× zoom
    this.player.setScale(0.7);
    this.player.play('player-idle');

    this.physics.add.collider(this.player, this.wallCollisionLayer);

    // ── Input ─────────────────────────────────────────────────────────────
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // ── Camera ────────────────────────────────────────────────────────────
    this.cameras.main.setBounds(0, 0, mapW, mapH);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(2);

    // ── Atmosphere: vignette ──────────────────────────────────────────────
    // Full-screen dark rectangle with inner transparent region — stays fixed to camera
    const { width: sw, height: sh } = this.scale;
    const vignette = this.add.graphics();
    vignette.setScrollFactor(0);
    vignette.setDepth(50);
    this._drawVignette(vignette, sw, sh);

    // ── Atmosphere: warm torchlight flicker near casino table ─────────────
    const torchX = DOOR_COL * TILE_SIZE + 8;
    const torchY = DOOR_ROW * TILE_SIZE + 8;
    const torchLight = this.add.pointlight(torchX, torchY, 0xffaa33, 60, 0.08, 0.05);
    torchLight.setDepth(4);
    // Flicker by oscillating intensity
    this.tweens.add({
      targets: torchLight,
      intensity: { from: 0.05, to: 0.12 },
      attenuation: { from: 0.04, to: 0.07 },
      duration: 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ── HUD (camera-fixed) ────────────────────────────────────────────────
    this.coinText = this.add
      .text(8, 8, `Coins: ${getCoins()}`, {
        fontSize: '12px',
        color: '#ffffff',
        fontFamily: 'monospace',
        shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 0, fill: true },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.floorText = this.add
      .text(sw - 8, 8, 'Floor 1 — The Lobby', {
        fontSize: '12px',
        color: '#ffffff',
        fontFamily: 'monospace',
        shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 0, fill: true },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);

    // ── TABLE label ───────────────────────────────────────────────────────
    this.add
      .text(DOOR_COL * TILE_SIZE + 8, DOOR_ROW * TILE_SIZE - 6, 'TABLE', {
        fontSize: '6px',
        color: '#00ff88',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5, 1)
      .setDepth(6);

    // ── Door overlap zone ─────────────────────────────────────────────────
    const doorZone = this.add
      .zone(DOOR_COL * TILE_SIZE + 8, DOOR_ROW * TILE_SIZE + 8, TILE_SIZE, TILE_SIZE)
      .setDepth(1);
    this.physics.add.existing(doorZone, true);
    this.physics.add.overlap(this.player, doorZone, this._onDoorOverlap, undefined, this);

    // ── Stairs overlap zone ───────────────────────────────────────────────
    const stairsZone = this.add
      .zone(STAIRS_COL * TILE_SIZE + 8, STAIRS_ROW * TILE_SIZE + 8, TILE_SIZE, TILE_SIZE)
      .setDepth(1);
    this.physics.add.existing(stairsZone, true);
    this.physics.add.overlap(this.player, stairsZone, this._onStairsOverlap, undefined, this);

    // ── game-complete listener ─────────────────────────────────────────────
    this.events.on('game-complete', this._onGameComplete, this);

    // Fade in
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private _drawVignette(g: GameObjects.Graphics, w: number, h: number): void {
    // Layered dark bands from edges inward, creating a vignette effect
    g.clear();
    const steps = 12;
    const cx = w / 2;
    const cy = h / 2;
    const rx = w * 0.55;
    const ry = h * 0.55;

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const alpha = t * t * 0.75; // quadratic falloff, max 0.75
      g.fillStyle(0x000000, alpha);
      const innerRx = rx * (1 - t);
      const innerRy = ry * (1 - t);
      // Draw bands outside the inner ellipse region at this step
      g.fillRect(0, 0, w, cy - innerRy);                              // top band
      g.fillRect(0, cy + innerRy, w, h - cy - innerRy);              // bottom band
      g.fillRect(0, cy - innerRy, cx - innerRx, innerRy * 2);        // left band
      g.fillRect(cx + innerRx, cy - innerRy, w - cx - innerRx, innerRy * 2); // right band
    }
  }

  update(): void {
    const speed = 120;
    const body = this.player.body as Physics.Arcade.Body;

    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) vx = -speed;
    else if (this.cursors.right.isDown || this.wasd.right.isDown) vx = speed;

    if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -speed;
    else if (this.cursors.down.isDown || this.wasd.down.isDown) vy = speed;

    // Normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
      const norm = Math.SQRT2;
      vx = vx / norm;
      vy = vy / norm;
    }

    body.setVelocity(vx, vy);

    // ── Animation ─────────────────────────────────────────────────────────
    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      this.player.play('player-walk', true);
      // Flip sprite for left movement (sprite faces right by default)
      if (vx < 0) this.player.setFlipX(true);
      else if (vx > 0) this.player.setFlipX(false);
    } else {
      this.player.play('player-idle', true);
    }

    // Update HUD
    this.coinText.setText(`Coins: ${getCoins()}`);
  }

  private _onDoorOverlap(): void {
    if (this.doorTriggered) return;
    this.doorTriggered = true;

    this.scene.launch('CoinFlipScene', { coins: getCoins(), floor: getFloor() });
    this.scene.pause('DungeonScene');
  }

  private _onStairsOverlap(): void {
    if (!this.stairsUnlocked) return;

    setFloor(getFloor() + 1);
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'Floor 2 — Coming Soon', {
        fontSize: '16px',
        color: '#ffcc00',
        fontFamily: 'monospace',
        backgroundColor: '#000000',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200);

    this.time.delayedCall(2000, () => {
      setFloor(1);
      this.scene.restart({ floor: 1 });
    });
  }

  private _onGameComplete({ coins, won }: { coins: number; won: boolean }): void {
    setCoins(coins);
    this.coinText.setText(`Coins: ${getCoins()}`);

    if (won) {
      this._unlockStairs();
    } else if (coins <= 0) {
      resetRun();
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.restart({ floor: 1 });
      });
      return;
    }

    this.doorTriggered = false;
    this.scene.resume('DungeonScene');
  }

  private _unlockStairs(): void {
    if (this.stairsUnlocked) return;
    this.stairsUnlocked = true;

    // Remove stairs from collision
    this.wallCollisionLayer.setCollision([1, 2]);

    // Swap stairs tile to open variant on prop layer
    const stairsTile = this.propLayer.getTileAt(STAIRS_COL, STAIRS_ROW);
    if (stairsTile) {
      stairsTile.index = TILE_STAIRS_O;
    }

    // Gold glow particle effect on stairs
    const sx = STAIRS_COL * TILE_SIZE + 8;
    const sy = STAIRS_ROW * TILE_SIZE + 8;
    const glowLight = this.add.pointlight(sx, sy, 0xffdd00, 50, 0.15, 0.04);
    glowLight.setDepth(4);
    this.tweens.add({
      targets: glowLight,
      intensity: { from: 0.10, to: 0.22 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
