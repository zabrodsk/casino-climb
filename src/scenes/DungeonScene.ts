import { Scene, Tilemaps, Physics, GameObjects } from 'phaser';
import { getCoins, getFloor, setCoins, setFloor, resetRun } from '../state/coinState';

// Tile indices
const TILE_FLOOR = 0;
const TILE_WALL = 1;
const TILE_DOOR = 2;
const TILE_STAIRS = 3;

// Floor 1 — The Lobby — 20 wide × 15 tall
// 0=floor, 1=wall, 2=door(game room), 3=stairs
const MAP_FLOOR1: number[][] = [
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

// Player entrance: col=2, row=12 (bottom-left area)
const PLAYER_START_X = 2 * 16 + 8;
const PLAYER_START_Y = 12 * 16 + 8;

// Door tile position: col=10, row=7
const DOOR_COL = 10;
const DOOR_ROW = 7;

// Stairs tile position: col=17, row=1
const STAIRS_COL = 17;
const STAIRS_ROW = 1;

export class DungeonScene extends Scene {
  private player!: Physics.Arcade.Sprite;
  private wallLayer!: Tilemaps.TilemapLayer;

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

    // Build a combined tileset canvas (16×64):
    //   index 0 = floor-tile, 1 = wall-tile, 2 = door-closed, 3 = stairs-locked
    this._buildCombinedTileset();

    const map2 = this.make.tilemap({
      data: MAP_FLOOR1,
      tileWidth: 16,
      tileHeight: 16,
    });

    const tileset = map2.addTilesetImage('combined-tiles', 'combined-tiles', 16, 16, 0, 0);
    if (!tileset) {
      console.error('Failed to create tileset');
      return;
    }

    // Floor layer: replace all non-floor tiles with floor for background
    const floorData = MAP_FLOOR1.map(row => row.map(() => TILE_FLOOR));
    const map3 = this.make.tilemap({
      data: floorData,
      tileWidth: 16,
      tileHeight: 16,
    });
    const floorTileset = map3.addTilesetImage('combined-tiles', 'combined-tiles', 16, 16, 0, 0)!;
    const floorLayer = map3.createLayer(0, floorTileset, 0, 0)!;
    floorLayer.setDepth(0);

    // Wall / door / stairs layer
    const wallLayer = map2.createLayer(0, tileset, 0, 0)!;
    wallLayer.setDepth(1);

    // Set collisions on wall, door, and stairs tiles
    wallLayer.setCollision([TILE_WALL, TILE_DOOR, TILE_STAIRS]);

    // Hide floor tiles on wall layer (they're transparent — walls/doors/stairs are drawn on top)
    wallLayer.forEachTile(tile => {
      if (tile.index === TILE_FLOOR) {
        tile.setVisible(false);
      }
    });

    this.wallLayer = wallLayer;

    // ── Physics ──
    this.physics.world.setBounds(0, 0, 20 * 16, 15 * 16);

    this.player = this.physics.add.sprite(PLAYER_START_X, PLAYER_START_Y, 'character');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(2);
    this.player.body!.setSize(10, 10);
    this.player.body!.setOffset(3, 6);

    this.physics.add.collider(this.player, wallLayer);

    // ── Input ──
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // ── Camera ──
    this.cameras.main.setBounds(0, 0, 20 * 16, 15 * 16);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(2);

    // ── Door overlap zone ──
    const doorZone = this.add
      .zone(DOOR_COL * 16 + 8, DOOR_ROW * 16 + 8, 16, 16)
      .setDepth(1);
    this.physics.add.existing(doorZone, true);
    this.physics.add.overlap(this.player, doorZone, this._onDoorOverlap, undefined, this);

    // ── Stairs overlap zone ──
    const stairsZone = this.add
      .zone(STAIRS_COL * 16 + 8, STAIRS_ROW * 16 + 8, 16, 16)
      .setDepth(1);
    this.physics.add.existing(stairsZone, true);
    this.physics.add.overlap(this.player, stairsZone, this._onStairsOverlap, undefined, this);

    // ── HUD (camera-fixed) ──
    this.coinText = this.add
      .text(8, 8, `Coins: ${getCoins()}`, {
        fontSize: '12px',
        color: '#ffffff',
        fontFamily: 'monospace',
        shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 0, fill: true },
      })
      .setScrollFactor(0)
      .setDepth(10);

    this.floorText = this.add
      .text(1024 - 8, 8, 'Floor 1 — The Lobby', {
        fontSize: '12px',
        color: '#ffffff',
        fontFamily: 'monospace',
        shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 0, fill: true },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(10);

    // ── game-complete listener ──
    this.events.on('game-complete', this._onGameComplete, this);

    // Fade in
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private _buildCombinedTileset(): void {
    // Build a 16×64 canvas (4 tiles tall: floor, wall, door-closed, stairs-locked)
    // so Phaser can use it as a single tileset where:
    //   tile index 0 = floor-tile (y=0)
    //   tile index 1 = wall-tile  (y=16)
    //   tile index 2 = door-closed (y=32)
    //   tile index 3 = stairs-locked (y=48)

    if (this.textures.exists('combined-tiles')) return;

    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    const tileKeys = ['floor-tile', 'wall-tile', 'door-closed', 'stairs-locked'];
    tileKeys.forEach((key, i) => {
      const tex = this.textures.get(key);
      const src = tex.getSourceImage() as HTMLCanvasElement | HTMLImageElement;
      ctx.drawImage(src, 0, i * 16, 16, 16);
    });

    this.textures.addCanvas('combined-tiles', canvas);
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
      vx = (vx / norm);
      vy = (vy / norm);
    }

    body.setVelocity(vx, vy);

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
    // Floor 2+ not yet built — show brief message and restart on floor 1
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
      .setDepth(20);

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

    // Swap stairs tile from locked to open texture on the wall layer
    const stairsTile = this.wallLayer.getTileAt(STAIRS_COL, STAIRS_ROW);
    if (stairsTile) {
      // Replace collision entry — remove stairs from collision
      this.wallLayer.setCollision([TILE_WALL, TILE_DOOR]);

      // Swap texture: rebuild combined tileset with stairs-open at index 3
      this._rebuildTilesetWithOpenStairs();
    }
  }

  private _rebuildTilesetWithOpenStairs(): void {
    // Draw a new combined canvas with stairs-open at index 3
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    const tileKeys = ['floor-tile', 'wall-tile', 'door-closed', 'stairs-open'];
    tileKeys.forEach((key, i) => {
      const tex = this.textures.get(key);
      const src = tex.getSourceImage() as HTMLCanvasElement | HTMLImageElement;
      ctx.drawImage(src, 0, i * 16, 16, 16);
    });

    // Update existing texture
    const existing = this.textures.get('combined-tiles');
    if (existing) {
      const source = existing.source[0];
      (source as any).canvas = canvas;
      (source as any).image = canvas;
      source.width = 16;
      source.height = 64;
      existing.refresh();
    }
  }
}
