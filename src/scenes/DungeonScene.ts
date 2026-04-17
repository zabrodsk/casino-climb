import { Scene, Tilemaps, Physics, GameObjects } from 'phaser';
import { getCoins, getFloor, setCoins, setFloor, resetRun } from '../state/coinState';

// ── Tile indices into dungeon_tileset.png (304×208, 19 cols × 13 rows, 16×16 tiles)
// Verified via PIL pixel analysis:
//
//   FLOOR:
//   idx=154 (r8,c2): RGB=(92,89,97) — near-neutral gray stone, high texture detail (std=40.6)
//                    R≈G≈B means no blue/warm bias. Best stone floor in the set.
//   idx=211 (r11,c2): RGB=(84,71,84) — warm-neutral gray, R-B=+0.5 (slightly warm stone)
//                    Very uniform (std=4.7) — good accent tile.
//
//   WALL-TOP (bright neon-green accent on top, dark body — seen from above in 3/4 view):
//   idx=57 (r3,c0): top rows bright (152→171), mid dark (~99-134) — wall-top left
//   idx=58 (r3,c1): same structure — wall-top mid
//   idx=59 (r3,c2): same — wall-top right
//
//   WALL-FACE (near-black body with neon-green glow at bottom — seen from front in 3/4 view):
//   idx=133 (r7,c0): rows 0-9 dark (12), rows 10-15 neon-green glow (49→122)
//                    Pairs perfectly with wall-top: same color family, different orientation.
//   idx=134 (r7,c1): identical structure — wall-face mid
//
//   WALL SOLID (interior wall body, pure black):
//   idx=20  (r1,c1): RGB=(13,7,17) — near-black, uniform
//
//   PROPS:
//   idx=142 (r7,c9): neon green casino table
//   idx=73  (r3,c16): teal stairs (locked)
//   idx=92  (r4,c16): teal stairs (open)

const TILE_VOID         = -1;

// Floor — neutral stone tiles (no blue bias)
const TILE_FLOOR_A      = 154;  // r8,c2 — textured gray stone (primary)
const TILE_FLOOR_B      = 211;  // r11,c2 — warm-neutral stone (accent)

// Wall top cap: bright neon-green edge visible from above (3/4 perspective top row)
const TILE_WALL_TOP_L   = 57;   // r3,c0
const TILE_WALL_TOP_M   = 58;   // r3,c1
const TILE_WALL_TOP_R   = 59;   // r3,c2

// Wall face: dark body with neon glow at bottom (drawn on the floor row below wall-top)
const TILE_WALL_FACE_L  = 133;  // r7,c0
const TILE_WALL_FACE_M  = 134;  // r7,c1
const TILE_WALL_FACE_R  = 134;  // r7,c1 (no distinct right variant, reuse mid)

// Wall solid (interior wall body)
const TILE_WALL_SOLID   = 20;   // r1,c1 — near-black

// Props
const TILE_TABLE        = 142;  // r7,c9 — neon green casino table
const TILE_STAIRS_L     = 73;   // r3,c16 — teal, locked stairs
const TILE_STAIRS_O     = 92;   // r4,c16 — teal open stairs

// ── Map dimensions: 24×18 — snug dungeon room, camera zoom 4× makes it feel right
const COLS = 24;
const ROWS = 18;
const TILE_SIZE = 16;

// ── Seeded PRNG for consistent floor tile variation
function pseudoRandom(x: number, y: number): number {
  const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

// ── Build logical map (2-cell thick perimeter walls, open interior)
// 0 = floor, 1 = wall, 2 = casino table, 3 = stairs
function buildMapLogic(): number[][] {
  const map: number[][] = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));

  // 2-cell thick perimeter walls
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r < 2 || r >= ROWS - 2 || c < 2 || c >= COLS - 2) {
        map[r][c] = 1;
      }
    }
  }

  // Casino table at col 12, row 9
  map[9][12] = 2;

  // Stairs at col 21, row 2
  map[2][21] = 3;

  return map;
}

const MAP_LOGIC = buildMapLogic();

// Player starts at col 3, row 15 (bottom-left interior)
const PLAYER_START_X = 3 * TILE_SIZE + 8;
const PLAYER_START_Y = 15 * TILE_SIZE + 8;

const DOOR_COL = 12;
const DOOR_ROW = 9;

const STAIRS_COL = 21;
const STAIRS_ROW = 2;

// ── Layer builders ────────────────────────────────────────────────────────────

/** Floor layer: every cell gets a stone tile, varied by seeded PRNG. NO TINT. */
function buildFloorData(): number[][] {
  return MAP_LOGIC.map((row, r) =>
    row.map((_v, c) => {
      const rnd = pseudoRandom(c, r);
      return rnd < 0.85 ? TILE_FLOOR_A : TILE_FLOOR_B;  // 85% primary, 15% accent
    })
  );
}

/**
 * Wall layer — 3/4 perspective:
 *
 * For each wall cell:
 *   - If the cell ABOVE it is NOT a wall (exposed top): draw wall-top tile (the bright
 *     neon-green cap you see from above).
 *   - If the cell above IS a wall (interior body): draw wall-solid (near-black fill).
 *
 * Left/mid/right variants follow the horizontal neighbor pattern.
 */
function buildWallData(): number[][] {
  const data: number[][] = Array.from({ length: ROWS }, () =>
    new Array(COLS).fill(TILE_VOID)
  );

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP_LOGIC[r][c] !== 1) continue;

      const aboveIsWall = r > 0 && MAP_LOGIC[r - 1][c] === 1;
      if (!aboveIsWall) {
        // Exposed wall top — use neon-cap tile
        const leftIsWall  = c > 0 && MAP_LOGIC[r][c - 1] === 1;
        const rightIsWall = c < COLS - 1 && MAP_LOGIC[r][c + 1] === 1;
        if      (!leftIsWall && rightIsWall)  data[r][c] = TILE_WALL_TOP_L;
        else if (leftIsWall && !rightIsWall)  data[r][c] = TILE_WALL_TOP_R;
        else                                  data[r][c] = TILE_WALL_TOP_M;
      } else {
        data[r][c] = TILE_WALL_SOLID;
      }
    }
  }

  return data;
}

/**
 * Wall-face layer — 3/4 perspective depth:
 *
 * For each floor cell that has a wall cell directly ABOVE it, draw a wall-face tile.
 * This is the vertical "front" of the wall block as seen from the player's eye level.
 * The neon-green glow at the bottom of the face tile makes it read as lit from the floor,
 * creating the illusion of a 3D block.
 *
 * Wall faces are placed at depth 2 (above floor, below player).
 */
function buildWallFaceData(): number[][] {
  const data: number[][] = Array.from({ length: ROWS }, () =>
    new Array(COLS).fill(TILE_VOID)
  );

  for (let r = 1; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      // Only place face on open cells (floor, table, or stairs)
      if (MAP_LOGIC[r][c] === 1) continue;
      // The cell above must be a wall
      if (MAP_LOGIC[r - 1][c] !== 1) continue;

      const leftAbove  = c > 0 && MAP_LOGIC[r - 1][c - 1] === 1;
      const rightAbove = c < COLS - 1 && MAP_LOGIC[r - 1][c + 1] === 1;

      if      (!leftAbove && rightAbove)  data[r][c] = TILE_WALL_FACE_L;
      else if (leftAbove && !rightAbove)  data[r][c] = TILE_WALL_FACE_R;
      else                                data[r][c] = TILE_WALL_FACE_M;
    }
  }

  return data;
}

/** Prop layer: table and stairs */
function buildPropData(stairsOpen = false): number[][] {
  const data: number[][] = Array.from({ length: ROWS }, () =>
    new Array(COLS).fill(TILE_VOID)
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

    // ── Layer 0: Floor (depth 0) — stone tiles, NO tint ──────────────────
    const floorMap = this.make.tilemap({ data: buildFloorData(), tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const floorTs = floorMap.addTilesetImage('dungeon-tiles', 'dungeon-tiles', TILE_SIZE, TILE_SIZE, 0, 0)!;
    const floorLayer = floorMap.createLayer(0, floorTs, 0, 0)!;
    floorLayer.setDepth(0);
    // No tint — stone tiles look correct as-is

    // ── Layer 1: Wall solid (depth 1) ─────────────────────────────────────
    const wallMap = this.make.tilemap({ data: buildWallData(), tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const wallTs = wallMap.addTilesetImage('dungeon-tiles', 'dungeon-tiles', TILE_SIZE, TILE_SIZE, 0, 0)!;
    const wallLayer = wallMap.createLayer(0, wallTs, 0, 0)!;
    wallLayer.setDepth(1);

    // ── Layer 2: Wall face — 3/4 depth effect (depth 2) ──────────────────
    const wallFaceMap = this.make.tilemap({ data: buildWallFaceData(), tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const wallFaceTs = wallFaceMap.addTilesetImage('dungeon-tiles', 'dungeon-tiles', TILE_SIZE, TILE_SIZE, 0, 0)!;
    const wallFaceLayer = wallFaceMap.createLayer(0, wallFaceTs, 0, 0)!;
    wallFaceLayer.setDepth(2);

    // ── Layer 3: Props (depth 3) ──────────────────────────────────────────
    this.propMap = this.make.tilemap({ data: buildPropData(false), tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const propTs = this.propMap.addTilesetImage('dungeon-tiles', 'dungeon-tiles', TILE_SIZE, TILE_SIZE, 0, 0)!;
    this.propLayer = this.propMap.createLayer(0, propTs, 0, 0)!;
    this.propLayer.setDepth(3);

    // ── Collision layer (invisible, logical map) ──────────────────────────
    const collisionData = MAP_LOGIC.map(row =>
      row.map(v => (v === 1 ? 1 : v === 2 ? 2 : v === 3 ? 3 : 0))
    );
    const collMap = this.make.tilemap({ data: collisionData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
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
    this.player.body!.setSize(14, 16);
    this.player.body!.setOffset(9, 28);
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
    this.cameras.main.setZoom(4);

    // ── Atmosphere: vignette (softer — max alpha 0.3, clear center 0.65) ─
    const { width: sw, height: sh } = this.scale;
    const vignette = this.add.graphics();
    vignette.setScrollFactor(0);
    vignette.setDepth(50);
    this._drawVignette(vignette, sw, sh);

    // ── Atmosphere: torchlight at casino table ────────────────────────────
    const torchX = DOOR_COL * TILE_SIZE + 8;
    const torchY = DOOR_ROW * TILE_SIZE + 8;
    const torchLight = this.add.pointlight(torchX, torchY, 0xffaa33, 60, 0.08, 0.05);
    torchLight.setDepth(4);
    this.tweens.add({
      targets: torchLight,
      intensity: { from: 0.05, to: 0.12 },
      attenuation: { from: 0.04, to: 0.07 },
      duration: 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ── Perimeter torches: 6 total for the smaller room ───────────────────
    // 2 on north wall interior face (row 2)
    this._addTorch(7 * TILE_SIZE + 8,  2 * TILE_SIZE + 14);
    this._addTorch(17 * TILE_SIZE + 8, 2 * TILE_SIZE + 14);
    // 2 on south wall interior face (row 15)
    this._addTorch(7 * TILE_SIZE + 8,  15 * TILE_SIZE + 4);
    this._addTorch(17 * TILE_SIZE + 8, 15 * TILE_SIZE + 4);
    // 1 on each side wall
    this._addTorch(2 * TILE_SIZE + 14, 9 * TILE_SIZE + 8);   // west wall
    this._addTorch(21 * TILE_SIZE + 2, 9 * TILE_SIZE + 8);   // east wall

    // ── HUD ───────────────────────────────────────────────────────────────
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
      .text(sw - 8, 8, `Floor ${getFloor()} — The Lobby`, {
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

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  /** Add a torch flame sprite + flickering pointlight at world position (x, y) */
  private _addTorch(x: number, y: number): void {
    const flame = this.add.graphics();
    flame.setDepth(4);
    flame.fillStyle(0xff6600, 0.9);
    flame.fillEllipse(0, 0, 6, 8);
    flame.fillStyle(0xffee00, 0.8);
    flame.fillEllipse(0, 1, 3, 5);
    flame.setPosition(x, y);

    const flameDuration = 160 + Math.random() * 80;
    this.tweens.add({
      targets: flame,
      alpha: { from: 0.7, to: 1.0 },
      duration: flameDuration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const light = this.add.pointlight(x, y, 0xff8833, 25, 0.09, 0.05);
    light.setDepth(4);

    const lightDuration = 160 + Math.random() * 80;
    this.tweens.add({
      targets: light,
      intensity: { from: 0.06, to: 0.12 },
      duration: lightDuration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private _drawVignette(g: GameObjects.Graphics, w: number, h: number): void {
    g.clear();
    const steps = 12;
    const cx = w / 2;
    const cy = h / 2;
    // Larger clear center (0.65) and softer max alpha (0.3)
    const rx = w * 0.65;
    const ry = h * 0.65;

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const alpha = t * t * 0.3;  // max alpha 0.3
      g.fillStyle(0x000000, alpha);
      const innerRx = rx * (1 - t);
      const innerRy = ry * (1 - t);
      g.fillRect(0, 0, w, cy - innerRy);
      g.fillRect(0, cy + innerRy, w, h - cy - innerRy);
      g.fillRect(0, cy - innerRy, cx - innerRx, innerRy * 2);
      g.fillRect(cx + innerRx, cy - innerRy, w - cx - innerRx, innerRy * 2);
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

    if (vx !== 0 && vy !== 0) {
      const norm = Math.SQRT2;
      vx = vx / norm;
      vy = vy / norm;
    }

    body.setVelocity(vx, vy);

    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      this.player.play('player-walk', true);
      if (vx < 0) this.player.setFlipX(true);
      else if (vx > 0) this.player.setFlipX(false);
    } else {
      this.player.play('player-idle', true);
    }

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

    this.wallCollisionLayer.setCollision([1, 2]);

    const stairsTile = this.propLayer.getTileAt(STAIRS_COL, STAIRS_ROW);
    if (stairsTile) {
      stairsTile.index = TILE_STAIRS_O;
    }

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
