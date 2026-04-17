import { Scene, Tilemaps, Physics, GameObjects } from 'phaser';
import { getCoins, getFloor, setCoins, setFloor, resetRun } from '../state/coinState';
import { HUD } from '../ui/HUD';
import { FLOOR_CONFIG, FloorConfig } from '../data/floorConfig';
import { drawFramedPanel, neonTitleStyle, bodyTextStyle } from '../ui/theme';

// Prop tile indices into dungeon_tileset.png. Floor + walls render as procedural
// stone sprites (see BootScene); only the table + stairs still come from the tileset.
const TILE_VOID         = -1;
const TILE_TABLE        = 142;
const TILE_STAIRS_L     = 73;
const TILE_STAIRS_O     = 92;

// ── Map dimensions: 18x13 — enough room to circle the table comfortably
const COLS = 18;
const ROWS = 13;
const TILE_SIZE = 16;

// ── Seeded PRNG for consistent floor tile variation
function pseudoRandom(x: number, y: number): number {
  const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

// ── Build logical map given table and stairs positions
// 0 = floor, 1 = wall, 2 = casino table, 3 = stairs
function buildMapLogic(tablePos: { col: number; row: number }, stairsPos: { col: number; row: number }): number[][] {
  const map: number[][] = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));

  // 2-cell thick perimeter walls
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r < 2 || r >= ROWS - 2 || c < 2 || c >= COLS - 2) {
        map[r][c] = 1;
      }
    }
  }

  map[tablePos.row][tablePos.col] = 2;
  map[stairsPos.row][stairsPos.col] = 3;

  return map;
}

/** Prop layer: table and stairs */
function buildPropData(mapLogic: number[][], stairsOpen = false): number[][] {
  const data: number[][] = Array.from({ length: ROWS }, () =>
    new Array(COLS).fill(TILE_VOID)
  );

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (mapLogic[r][c] === 2) data[r][c] = TILE_TABLE;
      if (mapLogic[r][c] === 3) data[r][c] = stairsOpen ? TILE_STAIRS_O : TILE_STAIRS_L;
    }
  }

  return data;
}

export class DungeonScene extends Scene {
  private player!: Physics.Arcade.Sprite;
  private wallCollisionLayer!: Tilemaps.TilemapLayer;
  private propLayer!: Tilemaps.TilemapLayer;
  private propMap!: Tilemaps.Tilemap;
  private stairsBlocker!: Phaser.GameObjects.Zone;

  private stairsUnlocked = false;
  private doorTriggered = false;
  private justExitedTable = false;

  private stairsSprite!: Phaser.GameObjects.Image;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;

  private hud!: HUD;
  private _lastHudCoins = -1;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private config!: FloorConfig;
  private currentFloor!: number;
  private mapLogic!: number[][];

  constructor() {
    super({ key: 'DungeonScene' });
  }

  init(data?: { floor?: number }): void {
    this.currentFloor = data?.floor ?? getFloor() ?? 1;
    this.config = FLOOR_CONFIG[this.currentFloor] ?? FLOOR_CONFIG[1];
    this.mapLogic = buildMapLogic(this.config.tablePos, this.config.stairsPos);
  }

  create(): void {
    this.stairsUnlocked = false;
    this.doorTriggered = false;
    this.justExitedTable = false;

    const cfg = this.config;
    const { tablePos, stairsPos, playerStart } = cfg;

    const mapW = COLS * TILE_SIZE;
    const mapH = ROWS * TILE_SIZE;

    // ── Layers 0-2: Floor + Wall + Wall-face — programmatic gray stone sprites ──
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.mapLogic[r][c];
        const px = c * TILE_SIZE;
        const py = r * TILE_SIZE;

        if (cell !== 1) {
          // Floor tile (0 = open, 2 = table, 3 = stairs)
          const variant = pseudoRandom(c, r) < 0.85
            ? cfg.floorTextures.primary
            : cfg.floorTextures.accent;
          this.add.image(px, py, variant).setOrigin(0).setDepth(0);
        } else {
          // Wall top cap
          this.add.image(px, py, 'stone-wall-top').setOrigin(0).setDepth(1);
        }

        // Wall face on any floor cell that has a wall directly above it
        if (r > 0 && cell !== 1 && this.mapLogic[r - 1][c] === 1) {
          this.add.image(px, py, 'stone-wall-face').setOrigin(0).setDepth(2);
        }
      }
    }

    // ── Layer 3: Props (depth 3) ──────────────────────────────────────────
    this.propMap = this.make.tilemap({ data: buildPropData(this.mapLogic, false), tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const propTs = this.propMap.addTilesetImage('dungeon-tiles', 'dungeon-tiles', TILE_SIZE, TILE_SIZE, 0, 0)!;
    this.propLayer = this.propMap.createLayer(0, propTs, 0, 0)!;
    this.propLayer.setDepth(3);

    // Retint tileset props
    if (cfg.useCompositeTable) {
      // Hide the tileset table tile; composite sprite is placed below
      this.propLayer.removeTileAt(tablePos.col, tablePos.row);
      const tableTexture = cfg.compositeTableTexture ?? 'casino-table';
      this.add
        .image(
          tablePos.col * TILE_SIZE + TILE_SIZE / 2,
          tablePos.row * TILE_SIZE + TILE_SIZE / 2,
          tableTexture
        )
        .setOrigin(0.5, 0.5)
        .setDepth(3);
    } else {
      const tableTile = this.propLayer.getTileAt(tablePos.col, tablePos.row);
      if (tableTile) tableTile.tint = cfg.propTint.table;
    }
    // Remove tileset stairs tile; composite sprite replaces it
    this.propLayer.removeTileAt(stairsPos.col, stairsPos.row);
    const stairsX = stairsPos.col * TILE_SIZE + TILE_SIZE / 2;
    const stairsY = stairsPos.row * TILE_SIZE + TILE_SIZE;
    this.stairsSprite = this.add.image(stairsX, stairsY, 'stairs-sprite-locked')
      .setOrigin(0.5, 1)
      .setDepth(3);

    // ── Collision layer (invisible, logical map) ──────────────────────────
    const collisionData = this.mapLogic.map(row =>
      row.map(v => (v === 1 ? 1 : v === 2 ? 2 : 0))
    );
    const collMap = this.make.tilemap({ data: collisionData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const collTs = collMap.addTilesetImage('dungeon-tiles', 'dungeon-tiles', TILE_SIZE, TILE_SIZE, 0, 0)!;
    this.wallCollisionLayer = collMap.createLayer(0, collTs, 0, 0)!;
    this.wallCollisionLayer.setVisible(false);
    this.wallCollisionLayer.setDepth(0);
    this.wallCollisionLayer.setCollision([1, 2]);

    // ── Physics world ─────────────────────────────────────────────────────
    this.physics.world.setBounds(0, 0, mapW, mapH);

    const startX = playerStart.col * TILE_SIZE + 8;
    const startY = playerStart.row * TILE_SIZE + 8;
    this.player = this.physics.add.sprite(startX, startY, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(5);
    this.player.body!.setSize(14, 16);
    this.player.body!.setOffset(9, 28);
    this.player.setScale(0.7);
    this.player.play('player-idle');

    this.physics.add.collider(this.player, this.wallCollisionLayer);

    // Slot machines (decorative, with physics colliders)
    for (const s of cfg.slotMachines) {
      const sx = s.col * TILE_SIZE + TILE_SIZE / 2;
      const sy = s.row * TILE_SIZE;
      this.add.image(sx, sy, 'slot-machine').setOrigin(0.5, 0).setDepth(3);
      const zone = this.add.zone(sx, sy + TILE_SIZE, TILE_SIZE - 2, TILE_SIZE * 2 - 2);
      this.physics.add.existing(zone, true);
      this.physics.add.collider(this.player, zone);
    }

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
    this.cameras.main.setZoom(5);

    // ── Atmosphere: vignette ───────────────────────────────────────────────
    const { width: sw, height: sh } = this.scale;
    const vignette = this.add.graphics();
    vignette.setScrollFactor(0);
    vignette.setDepth(50);
    this._drawVignette(vignette, sw, sh);

    // ── Atmosphere: torchlight at casino table ────────────────────────────
    const torchX = tablePos.col * TILE_SIZE + 8;
    const torchY = tablePos.row * TILE_SIZE + 8;
    const torchLight = this.add.pointlight(torchX, torchY, cfg.torchColor, 60, 0.08, 0.05);
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

    // ── Perimeter torches — 4 torches at interior corners of the walkable room ──
    const westTorchCol = 2;
    const eastTorchCol = COLS - 3;
    const northTorchRow = 2;
    const southTorchRow = ROWS - 3;
    this._addTorch(westTorchCol * TILE_SIZE + 8, northTorchRow * TILE_SIZE + 14, cfg.torchColor, cfg.torchGlow);
    this._addTorch(eastTorchCol * TILE_SIZE + 8, northTorchRow * TILE_SIZE + 14, cfg.torchColor, cfg.torchGlow);
    this._addTorch(westTorchCol * TILE_SIZE + 8, southTorchRow * TILE_SIZE + 4, cfg.torchColor, cfg.torchGlow);
    this._addTorch(eastTorchCol * TILE_SIZE + 8, southTorchRow * TILE_SIZE + 4, cfg.torchColor, cfg.torchGlow);

    // ── Table label ───────────────────────────────────────────────────────
    const tableLabelY = tablePos.row * TILE_SIZE - (cfg.useCompositeTable ? 20 : 4);
    this.add
      .text(tablePos.col * TILE_SIZE + 8, tableLabelY, cfg.tableLabel, {
        fontSize: '5px',
        color: '#c9a66b',
        fontFamily: 'monospace',
        shadow: { offsetX: 0, offsetY: 1, color: '#000000', blur: 0, fill: true },
      })
      .setOrigin(0.5, 1)
      .setDepth(6);

    // ── Door overlap zone ──────────────────────────────────────────────────
    const doorZone = this.add
      .zone(tablePos.col * TILE_SIZE + 8, tablePos.row * TILE_SIZE + 8, 3 * TILE_SIZE, 3 * TILE_SIZE)
      .setDepth(1);
    this.physics.add.existing(doorZone, true);
    this.physics.add.overlap(this.player, doorZone, this._onDoorOverlap, undefined, this);

    // ── Stairs overlap zone ───────────────────────────────────────────────
    const stairsZone = this.add
      .zone(stairsPos.col * TILE_SIZE + 8, stairsPos.row * TILE_SIZE + 8, TILE_SIZE, TILE_SIZE)
      .setDepth(1);
    this.physics.add.existing(stairsZone, true);
    this.physics.add.overlap(this.player, stairsZone, this._onStairsOverlap, undefined, this);

    // Separate blocker in front of locked stairs. We remove this on unlock instead of
    // mutating tile collisions at runtime, which is more reliable across scene transitions.
    this.stairsBlocker = this.add
      .zone(stairsPos.col * TILE_SIZE + 8, stairsPos.row * TILE_SIZE + 8, TILE_SIZE, TILE_SIZE)
      .setDepth(1);
    this.physics.add.existing(this.stairsBlocker, true);
    this.physics.add.collider(this.player, this.stairsBlocker);

    // ── UI camera + HUD ───────────────────────────────────────────────────
    this.uiCam = this.cameras.add(0, 0, sw, sh);
    this.uiCam.setScroll(0, 0);
    this.uiCam.ignore(this.children.list);

    this.hud = new HUD(this, { target: cfg.target });
    this.hud.setCoins(getCoins());
    this.hud.setFloor(this.currentFloor, cfg.name);
    this.hud.setProgress(getCoins(), cfg.target);
    this._lastHudCoins = getCoins();
    this.cameras.main.ignore(this.hud.getObjects());

    // ── game-complete listener ─────────────────────────────────────────────
    this.events.on('game-complete', this._onGameComplete, this);

    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.uiCam.fadeIn(300, 0, 0, 0);
  }

  /** Add a torch flame sprite + flickering pointlight at world position (x, y) */
  private _addTorch(x: number, y: number, torchColor: number, glowColor: number): void {
    const flame = this.add.graphics();
    flame.setDepth(4);
    flame.fillStyle(torchColor, 0.9);
    flame.fillEllipse(0, 0, 6, 8);
    flame.fillStyle(glowColor, 0.8);
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

    const light = this.add.pointlight(x, y, torchColor, 25, 0.09, 0.05);
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
    const rx = w * 0.65;
    const ry = h * 0.65;

    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const alpha = t * t * 0.3;
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

    const coins = getCoins();
    if (coins !== this._lastHudCoins) {
      this._lastHudCoins = coins;
      this.hud.setCoins(coins);
      this.hud.setProgress(coins, this.config.target);
    }

    // Clear exit cooldown once player is far enough from the table
    if (this.justExitedTable) {
      const tableX = this.config.tablePos.col * TILE_SIZE + 8;
      const tableY = this.config.tablePos.row * TILE_SIZE + 8;
      const dx = this.player.x - tableX;
      const dy = this.player.y - tableY;
      if (Math.sqrt(dx * dx + dy * dy) > 32) {
        this.justExitedTable = false;
      }
    }
  }

  private _onDoorOverlap(): void {
    if (this.doorTriggered || this.justExitedTable) return;
    this.doorTriggered = true;

    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.launch(this.config.gameSceneKey, { coins: getCoins(), floor: this.currentFloor });
      this.scene.pause('DungeonScene');
    });
  }

  private _onStairsOverlap(): void {
    if (!this.stairsUnlocked) return;

    // Prevent re-entry
    this.stairsUnlocked = false;

    const nextFloor = this.currentFloor + 1;
    setFloor(nextFloor);

    const nextConfig = FLOOR_CONFIG[nextFloor];

    if (nextConfig) {
      // Transition to the next floor
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('TransitionScene', { nextFloor, name: nextConfig.name });
      });
    } else {
      // End of demo — show styled panel then reset
      this._showEndOfDemo();
    }
  }

  private _showEndOfDemo(): void {
    const { width, height } = this.scale;

    const panelW = 400;
    const panelH = 140;
    const px = (width - panelW) / 2;
    const py = (height - panelH) / 2;

    const panel = this.add.graphics().setScrollFactor(0).setDepth(200);
    drawFramedPanel(panel, px, py, panelW, panelH, { borderWidth: 3, alpha: 0.95 });

    const title = this.add.text(width / 2, py + 44, 'END OF DEMO',
      neonTitleStyle(28)
    ).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    const subtitle = this.add.text(width / 2, py + 96, 'Thanks for playing.',
      bodyTextStyle(16)
    ).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    this.cameras.main.ignore([panel, title, subtitle]);

    this.time.delayedCall(3000, () => {
      resetRun();
      this.scene.start('DungeonScene', { floor: 1 });
    });
  }

  private _onGameComplete({ coins, won }: { coins: number; won: boolean }): void {
    setCoins(coins);

    if (won) {
      this.hud.showSpeech('The stairs unlock. Take them.');
      this._unlockStairs();
    } else if (coins <= 0) {
      this.hud.showSpeech('The house always wins.');
      resetRun();
      this.scene.resume('DungeonScene');
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.restart({ floor: 1 });
      });
      return;
    }

    // Nudge player 2 tiles south so they exit the trigger zone immediately
    const { tablePos } = this.config;
    this.player.setPosition(tablePos.col * TILE_SIZE + 8, (tablePos.row + 2) * TILE_SIZE + 8);
    this.justExitedTable = true;

    this.scene.resume('DungeonScene');
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.doorTriggered = false;
  }

  private _unlockStairs(): void {
    if (this.stairsUnlocked) return;
    this.stairsUnlocked = true;

    if (this.stairsBlocker.body) {
      this.stairsBlocker.destroy();
    }

    // Swap the composite sprite to the open variant
    this.stairsSprite.setTexture('stairs-sprite-open');

    // Dramatic unlock flash: quick full-sprite scale pulse + alpha flash
    this.tweens.add({
      targets: this.stairsSprite,
      scaleX: { from: 1.0, to: 1.15 },
      scaleY: { from: 1.0, to: 1.15 },
      yoyo: true,
      duration: 200,
      ease: 'Quad.easeOut',
    });
    const flash = this.add.image(this.stairsSprite.x, this.stairsSprite.y, 'stairs-sprite-open')
      .setOrigin(0.5, 1)
      .setDepth(4)
      .setTint(0xffffff)
      .setAlpha(0.9);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 500,
      onComplete: () => flash.destroy(),
    });

    // Strong pulsing gold pointlight above the stairs (sits on top of the archway)
    const sx = this.stairsSprite.x;
    const sy = this.stairsSprite.y - 24;
    const glow = this.add.pointlight(sx, sy, 0xffdd88, 80, 0.28, 0.05);
    glow.setDepth(4);
    this.tweens.add({
      targets: glow,
      intensity: { from: 0.18, to: 0.38 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Small orbiting sparkle dots (3 tiny ivory rects) for extra wow
    const sparks: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < 3; i++) {
      const angle0 = (i / 3) * Math.PI * 2;
      const spark = this.add.rectangle(sx, sy, 2, 2, 0xfff4d1);
      spark.setDepth(5);
      sparks.push(spark);
      this.tweens.add({
        targets: spark,
        angle: 360,
        duration: 2000,
        repeat: -1,
        onUpdate: () => {
          const t = this.time.now / 400 + angle0;
          spark.setPosition(sx + Math.cos(t) * 16, sy + Math.sin(t) * 10);
        },
      });
    }

    // Keep glow objects off the UI camera
    this.uiCam.ignore([glow, flash, ...sparks]);
  }
}
