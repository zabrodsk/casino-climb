import { Scene, Tilemaps, Physics, GameObjects } from 'phaser';
import { getCoins, getFloor, setCoins, setFloor, resetRun } from '../state/coinState';

// ── Tile indices into dungeon_tileset.png (304×208, 19 cols × 13 rows, 16×16 tiles)
// Index = row * 19 + col
//
// Verified via pixel analysis (PIL color extraction):
//   idx=76  (r4,c0): blue-gray floor tile, dom=(52,74,97)
//   idx=95  (r5,c0): blue-gray floor tile variant, dom=(52,74,97)
//   idx=114 (r6,c0): blue-gray floor tile variant, dom=(52,74,97)
//   idx=20  (r1,c1): pure near-black (13,7,17) — solid wall fill
//   idx=57  (r3,c0): teal/neon-green wall top accent, dom=(79,144,149)
//   idx=58  (r3,c1): teal wall top mid
//   idx=59  (r3,c2): teal wall top right
//   idx=6   (r0,c6): solid pink/mauve wall face (179,136,162)
//   idx=7   (r0,c7): pink wall face mid
//   idx=142 (r7,c9): highest neon-green count — casino table tile
//   idx=73  (r3,c16): strong teal accent — stairs tile (locked)
//   idx=92  (r4,c16): teal accent — stairs open variant
const TILE_VOID          = -1;

// Floor
const TILE_FLOOR_A       = 76;   // r4,c0 — blue-gray stone
const TILE_FLOOR_B       = 95;   // r5,c0 — floor variant
const TILE_FLOOR_C       = 114;  // r6,c0 — floor variant

// Wall — solid fill (Option A: single layer, no 3/4 split)
const TILE_WALL_SOLID    = 20;   // r1,c1 — near-black solid wall

// Wall top cap (teal accent row at top edge of a wall block, facing floor below)
const TILE_WALL_TOP_L    = 57;   // r3,c0
const TILE_WALL_TOP_M    = 58;   // r3,c1
const TILE_WALL_TOP_R    = 59;   // r3,c2

// Wall face (pink mauve row drawn on the floor tile just below the wall top)
const TILE_WALL_FACE_L   = 6;    // r0,c6
const TILE_WALL_FACE_M   = 7;    // r0,c7
const TILE_WALL_FACE_R   = 8;    // r0,c8

// Props
const TILE_TABLE         = 142;  // r7,c9 — neon green casino table
const TILE_STAIRS_L      = 73;   // r3,c16 — teal, locked stairs
const TILE_STAIRS_O      = 92;   // r4,c16 — teal open stairs

// ── 3/4 Perspective Map: 20 wide × 15 tall
// 0 = floor, 1 = wall, 2 = door/casino table, 3 = stairs (locked)
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

const PLAYER_START_X = 2 * TILE_SIZE + 8;
const PLAYER_START_Y = 12 * TILE_SIZE + 8;

const DOOR_COL = 10;
const DOOR_ROW = 7;

const STAIRS_COL = 17;
const STAIRS_ROW = 1;

// ── Layer builders ────────────────────────────────────────────────────────────

/** Floor layer: every cell gets a floor tile */
function buildFloorData(): number[][] {
  const floorVariants = [TILE_FLOOR_A, TILE_FLOOR_B, TILE_FLOOR_C];
  return MAP_LOGIC.map((row, r) =>
    row.map((_v, c) => floorVariants[(r * 3 + c * 7) % 3])
  );
}

/** Wall layer (Option A — solid single layer):
 *  Walls that have no wall above them get the WALL_TOP tile (teal cap).
 *  Walls that have wall above get WALL_SOLID (near-black fill).
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
        // Exposed top — use teal cap tile
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

/** Wall face layer: placed on floor cells directly below a wall row, giving 3/4 depth */
function buildWallFaceData(): number[][] {
  const data: number[][] = Array.from({ length: ROWS }, () =>
    new Array(COLS).fill(TILE_VOID)
  );

  for (let r = 1; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP_LOGIC[r][c] !== 0 && MAP_LOGIC[r][c] !== 2 && MAP_LOGIC[r][c] !== 3) continue;
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

    // ── Layer 0: Floor (depth 0) ──────────────────────────────────────────
    const floorMap = this.make.tilemap({ data: buildFloorData(), tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const floorTs = floorMap.addTilesetImage('dungeon-tiles', 'dungeon-tiles', TILE_SIZE, TILE_SIZE, 0, 0)!;
    const floorLayer = floorMap.createLayer(0, floorTs, 0, 0)!;
    floorLayer.setDepth(0);
    floorLayer.setTint(0xffeecc); // warm gold tint, reduced intensity

    // ── Layer 1: Wall solid (depth 1) ─────────────────────────────────────
    const wallMap = this.make.tilemap({ data: buildWallData(), tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const wallTs = wallMap.addTilesetImage('dungeon-tiles', 'dungeon-tiles', TILE_SIZE, TILE_SIZE, 0, 0)!;
    const wallLayer = wallMap.createLayer(0, wallTs, 0, 0)!;
    wallLayer.setDepth(1);

    // ── Layer 2: Wall face 3/4 perspective (depth 2) ─────────────────────
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
    this.cameras.main.setZoom(2);

    // ── Atmosphere: vignette (reduced intensity, max alpha 0.4) ──────────
    const { width: sw, height: sh } = this.scale;
    const vignette = this.add.graphics();
    vignette.setScrollFactor(0);
    vignette.setDepth(50);
    this._drawVignette(vignette, sw, sh);

    // ── Atmosphere: torchlight flicker near casino table ──────────────────
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

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private _drawVignette(g: GameObjects.Graphics, w: number, h: number): void {
    g.clear();
    const steps = 12;
    const cx = w / 2;
    const cy = h / 2;
    const rx = w * 0.6;  // larger clear center
    const ry = h * 0.6;

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const alpha = t * t * 0.4; // reduced max from 0.75 to 0.4
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
