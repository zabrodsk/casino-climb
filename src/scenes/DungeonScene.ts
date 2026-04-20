import { Scene, Tilemaps, Physics, GameObjects } from 'phaser';
import { getCoins, getFloor, getRunStats, setCoins, setFloor, resetRun } from '../state/coinState';
import { creditGold } from '../state/wardrobeState';
import { HUD } from '../ui/HUD';
import { FLOOR_CONFIG, FloorConfig } from '../data/floorConfig';
import { drawFramedPanel, drawNestedButton, buttonLabelStyle, neonTitleStyle, bodyTextStyle } from '../ui/theme';
import { AudioManager } from '../audio/AudioManager';
import { addGameplaySettingsGear } from '../ui/gameplaySettings';
import { isDeveloperModeEnabled, registerDeveloperUnlockHotkey } from '../dev/developerHotkeys';
import {
  clearRefreshResume,
  isRefreshResumeEnabled,
  setRefreshResume,
  setRefreshResumeEnabled,
} from '../dev/refreshResume';
import { resetMemoryRunState } from '../state/memoryState';
import { HouseController } from '../ui/HouseController';
import { VirtualJoystick } from '../ui/VirtualJoystick';

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
const CROSSING_BET_OPTIONS = [10, 25, 50];

interface CrossingColumn {
  x: number;
  direction: 1 | -1;
  speed: number;
  cardTexture: string;
  chip: Phaser.GameObjects.Image;
  blockade: Phaser.GameObjects.Rectangle;
  laneLine: Phaser.GameObjects.Rectangle;
  sprites: Phaser.GameObjects.Image[];
}

// ── Seeded PRNG for consistent floor tile variation
function pseudoRandom(x: number, y: number): number {
  const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

// ── Build logical map given table and stairs positions
// 0 = floor, 1 = wall, 2 = casino table, 3 = stairs
function buildMapLogic(
  tablePos: { col: number; row: number },
  stairsPos: { col: number; row: number },
  includeTable = true,
  extraTablePositions: Array<{ col: number; row: number }> = [],
): number[][] {
  const map: number[][] = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));

  // 1-cell thick perimeter walls
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r < 1 || r >= ROWS - 1 || c < 1 || c >= COLS - 1) {
        map[r][c] = 1;
      }
    }
  }

  if (includeTable) {
    map[tablePos.row][tablePos.col] = 2;
  }
  for (const p of extraTablePositions) {
    map[p.row][p.col] = 2;
  }
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
  private lastStepAt = 0;
  private goalSoundsPlayed = false;
  private fromTransition = false;
  private envTimer: Phaser.Time.TimerEvent | null = null;
  private floorEntrySpeechTimer: Phaser.Time.TimerEvent | null = null;
  private devLevelButtonBg?: Phaser.GameObjects.Graphics;
  private devLevelButtonLabel?: Phaser.GameObjects.Text;
  private devLevelButtonZone?: Phaser.GameObjects.Zone;
  private devLevelPanel?: Phaser.GameObjects.Container;
  private devSetCoinsButtonBg?: Phaser.GameObjects.Graphics;
  private devSetCoinsButtonLabel?: Phaser.GameObjects.Text;
  private devSetCoinsButtonZone?: Phaser.GameObjects.Zone;
  private devRefreshToggleButtonBg?: Phaser.GameObjects.Graphics;
  private devRefreshToggleButtonLabel?: Phaser.GameObjects.Text;
  private devRefreshToggleButtonZone?: Phaser.GameObjects.Zone;
  private devModeLabel?: Phaser.GameObjects.Text;

  private stairsSprite!: Phaser.GameObjects.Image;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;

  private hud!: HUD;
  private _lastHudCoins = -1;
  private _lastResumeCoins = -1;

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
  private displayFloorNumber!: number;
  private lastTablePos!: { col: number; row: number };
  private resumeMinigame: string | null = null;

  private crossingMode = false;
  private crossingColumns: CrossingColumn[] = [];
  private crossingBoardObjects: Phaser.GameObjects.GameObject[] = [];
  private crossingButtons: Array<{ bg: GameObjects.Graphics; label: GameObjects.Text; bet: number }> = [];
  private selectedCrossingBet = 0;
  private crossingInteractKey!: Phaser.Input.Keyboard.Key;
  private crossingCashOutKey!: Phaser.Input.Keyboard.Key;
  private crossingStatusText!: GameObjects.Text;
  private crossingGoalText!: GameObjects.Text;
  private crossingPromptText!: GameObjects.Text;
  private crossingHomeChip!: Phaser.GameObjects.Image;
  private crossingFreeRoamBarrier?: Phaser.GameObjects.Zone;
  private crossingRunActive = false;
  private crossingBusy = false;
  private crossingReturning = false;
  private crossingMultiplier = 1;
  private crossingBaseY = 0;
  private crossingCurrentColumnIndex = 0;
  private lastCardWooshAt = 0;

  private joystick: VirtualJoystick | null = null;
  private touchCollectBtn: { arc: GameObjects.Graphics; label: GameObjects.Text; zone: GameObjects.Zone } | null = null;
  private touchCashBtn: { arc: GameObjects.Graphics; label: GameObjects.Text; zone: GameObjects.Zone } | null = null;
  private touchCollectPressed = false;
  private touchCashPressed = false;

  constructor() {
    super({ key: 'DungeonScene' });
  }

  init(data?: { floor?: number; fromTransition?: boolean; resumeMinigame?: string }): void {
    this.currentFloor = data?.floor ?? getFloor() ?? 1;
    this.fromTransition = data?.fromTransition ?? false;
    this.resumeMinigame = data?.resumeMinigame ?? null;
    this.config = FLOOR_CONFIG[this.currentFloor] ?? FLOOR_CONFIG[1];
    this.displayFloorNumber = this.config.displayFloorNumber ?? this.currentFloor;
    this.crossingMode = this.config.mode === 'crossing';
    const extraTablePositions = (this.config.interactables ?? []).map((i) => i.pos);
    this.mapLogic = buildMapLogic(
      this.config.tablePos,
      this.config.stairsPos,
      !this.crossingMode,
      extraTablePositions,
    );
    this.lastTablePos = this.config.tablePos;
  }

  create(): void {
    this.stairsUnlocked = false;
    this.doorTriggered = false;
    this.justExitedTable = false;
    this.goalSoundsPlayed = false;
    this.crossingColumns = [];
    this.crossingBoardObjects = [];
    this.crossingButtons = [];
    this.crossingRunActive = false;
    this.crossingBusy = false;
    this.crossingReturning = false;
    this.crossingMultiplier = this.config.crossing?.startMultiplier ?? 1;
    this.crossingCurrentColumnIndex = 0;
    this.lastCardWooshAt = 0;
    if (this.envTimer) {
      this.envTimer.remove(false);
      this.envTimer = null;
    }

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
      const primaryTableScale = cfg.gameSceneKey === 'WheelScene'
        ? 2
        : cfg.gameSceneKey === 'BlackjackScene'
          ? 1.35
          : cfg.gameSceneKey === 'CoinFlipScene'
            ? 0.05
          : 1;
      this.add
        .image(
          tablePos.col * TILE_SIZE + TILE_SIZE / 2,
          tablePos.row * TILE_SIZE + TILE_SIZE / 2,
          tableTexture
        )
        .setOrigin(0.5, 0.5)
        .setDepth(3)
        .setScale(primaryTableScale);
    } else {
      const tableTile = this.propLayer.getTileAt(tablePos.col, tablePos.row);
      if (tableTile) tableTile.tint = cfg.propTint.table;
    }

    const isFateRoom = cfg.gameSceneKey === 'WheelScene';

    // Extra interactables: composite sprites for secondary stations
    for (const it of cfg.interactables ?? []) {
      this.propLayer.removeTileAt(it.pos.col, it.pos.row);
      // In Room of Fate, slot machines are shown as one wall-row overlay image.
      const hideLegacySlotSprite =
        isFateRoom && it.gameSceneKey === 'SlotMachineScene';
      if (!hideLegacySlotSprite) {
        const texture = it.compositeTableTexture ?? 'casino-table';
        this.add
          .image(
            it.pos.col * TILE_SIZE + TILE_SIZE / 2,
            it.pos.row * TILE_SIZE + TILE_SIZE / 2,
            texture,
          )
          .setOrigin(0.5, 0.5)
          .setDepth(3)
          .setScale(it.spriteScale ?? 1)
          .setAngle(it.rotationDeg ?? 0);
      }
    }

    if (isFateRoom) {
      const slotRow = this.add.image(0, TILE_SIZE, 'fate-slot-row')
        .setOrigin(-0.4, -0.05)
        .setDepth(3);
      const targetHeight = TILE_SIZE * 10;
      slotRow.setScale(targetHeight / slotRow.height);
    }
    // Remove tileset stairs tile; composite sprite replaces it
    this.propLayer.removeTileAt(stairsPos.col, stairsPos.row);
    const stairsX = stairsPos.col * TILE_SIZE + TILE_SIZE / 2;
    const stairsY = stairsPos.row * TILE_SIZE + TILE_SIZE;
    this.stairsSprite = this.add.image(stairsX, stairsY, 'stairs-sprite-locked')
      .setOrigin(0.5, 1)
      .setDepth(3);
    if (cfg.gameSceneKey === 'VaultScene') {
      this.stairsSprite.setVisible(false);
    }

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
    this.cameras.main.setBounds(-TILE_SIZE, -TILE_SIZE, mapW + TILE_SIZE * 2, mapH + TILE_SIZE * 2);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(this.crossingMode ? (this.config.crossing?.cameraZoom ?? 5.6) : 5);

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

    // ── Table labels + door zones ─────────────────────────────────────────
    if (!this.crossingMode) {
      const addStation = (
        pos: { col: number; row: number },
        label: string,
        gameSceneKey: string,
        useComposite: boolean,
      ) => {
        // Floor 4 uses custom art layout; hide station labels for cleaner composition.
        if (!isFateRoom) {
          const labelY = pos.row * TILE_SIZE - (useComposite ? 20 : 4);
          this.add
            .text(pos.col * TILE_SIZE + 8, labelY, label, {
              fontSize: '5px',
              color: '#c9a66b',
              fontFamily: 'monospace',
              shadow: { offsetX: 0, offsetY: 1, color: '#000000', blur: 0, fill: true },
            })
            .setOrigin(0.5, 1)
            .setDepth(6);
        }

        const zone = this.add
          .zone(pos.col * TILE_SIZE + 8, pos.row * TILE_SIZE + 8, 3 * TILE_SIZE, 3 * TILE_SIZE)
          .setDepth(1);
        this.physics.add.existing(zone, true);
        this.physics.add.overlap(
          this.player,
          zone,
          () => this._onInteractableOverlap(gameSceneKey, pos),
          undefined,
          this,
        );
      };

      addStation(tablePos, cfg.tableLabel, cfg.gameSceneKey, cfg.useCompositeTable);
      for (const it of cfg.interactables ?? []) {
        addStation(it.pos, it.tableLabel, it.gameSceneKey, true);
      }
    }

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
    this.hud.setFloor(this.displayFloorNumber, cfg.name);
    this.hud.setProgress(getCoins(), cfg.target);
    this.floorEntrySpeechTimer?.remove(false);
    this.floorEntrySpeechTimer = this.time.delayedCall(1800, () => {
      const isFirstEverRun = getRunStats().runCount === 0;
      const isFirstFloor = this.displayFloorNumber === 1;
      const trigger = isFirstFloor && isFirstEverRun ? 'floorEntryFirst' : 'floorEntry';
      HouseController.say(this, trigger, String(this.displayFloorNumber));
      this.floorEntrySpeechTimer = null;
    });
    this._lastHudCoins = getCoins();
    this._lastResumeCoins = getCoins();
    this.cameras.main.ignore(this.hud.getObjects());

    // Joystick + touch buttons should only render on phone devices.
    // They must be created AFTER uiCam.ignore so the uiCam renders them;
    // main camera (5x zoom world cam) ignores them.
    if (this.shouldShowMobileControls()) {
      this.joystick = new VirtualJoystick(this);
      this.cameras.main.ignore(this.joystick.getObjects());
      this.buildTouchActionButtons();
    }

    this.ensureDevModeLabel();

    // ── game-complete listener ─────────────────────────────────────────────
    this.events.on('game-complete', this._onGameComplete, this);
    this.events.once('shutdown', () => {
      this.events.off('game-complete', this._onGameComplete, this);
      this.floorEntrySpeechTimer?.remove(false);
      this.floorEntrySpeechTimer = null;
      if (this.envTimer) {
        this.envTimer.remove(false);
        this.envTimer = null;
      }
      this.destroyDevLevelSelector();
      this.destroyDevSetCoinsButton();
      this.destroyDevRefreshToggleButton();
      this.devModeLabel?.destroy();
      this.devModeLabel = undefined;
      this.joystick?.destroy();
      this.joystick = null;
    });

    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.uiCam.fadeIn(300, 0, 0, 0);
    if (this.config.gameSceneKey === 'VaultScene') {
      AudioManager.playSfx(this, 'vault-enter', { volume: 1.6, cooldownMs: 500, allowOverlap: false });
    }
    if (this.fromTransition) {
      AudioManager.playSfx(this, 'transition-exit', { volume: 0.9, cooldownMs: 350, allowOverlap: false });
      this.fromTransition = false;
    }
    this._applyFloorAmbience();
    this._scheduleEnvironmentSfx();
    addGameplaySettingsGear(this, 'DungeonScene');
    this.ensureDevLevelSelector();
    registerDeveloperUnlockHotkey(
      this,
      () => {
        setCoins(999);
        this._lastHudCoins = getCoins();
        this.hud.setCoins(this._lastHudCoins);
        this.hud.setProgress(this._lastHudCoins, this.config.target);
        this.hud.showSpeech('Dev mode enabled.');
        this.applyDevModeState();
      },
      () => {
        this._lastHudCoins = getCoins();
        this.hud.setCoins(this._lastHudCoins);
        this.hud.setProgress(this._lastHudCoins, this.config.target);
        this.hud.showSpeech('Dev mode disabled.');
        this.applyDevModeState();
      },
    );

    if (this.crossingMode) {
      this._setupCrossingMode();
    } else {
      this.hud.hideRunPanel();
    }

    this.applyDevModeState();
    this._syncFloorRefreshResume();
    if (this.resumeMinigame) {
      const pendingMinigame = this.resumeMinigame;
      this.resumeMinigame = null;
      this.time.delayedCall(60, () => {
        this._launchMinigameDirect(pendingMinigame);
      });
    }
  }

  private _setupCrossingMode(): void {
    const crossing = this.config.crossing;
    if (!crossing) return;

    this.crossingBaseY = this.player.y;
    this.player.play('player-idle');

    const laneTop = crossing.laneTop;
    const laneBottom = crossing.laneBottom;
    const laneHeight = laneBottom - laneTop;
    const centerY = laneTop + laneHeight / 2;
    // Barrier should only cover the flying-card lanes, not the home chip.
    const firstLaneX = crossing.chipX + crossing.columnSpacing;
    const lastLaneX = crossing.chipX + crossing.columnSpacing * crossing.laneCount;
    const boardPadding = Math.max(18, Math.floor(crossing.barricadeWidth / 2) + 8);
    const boardLeft = firstLaneX - boardPadding;
    const boardRight = lastLaneX + boardPadding;
    const boardWidth = boardRight - boardLeft;

    const boardGlow = this.add.rectangle(
      boardLeft + boardWidth / 2,
      centerY,
      boardWidth,
      laneHeight + 22,
      0xf6cf79,
      0.08,
    ).setDepth(2.5);
    this.crossingBoardObjects.push(boardGlow);

    this.crossingFreeRoamBarrier = this.add.zone(
      boardLeft + boardWidth / 2,
      centerY,
      boardWidth,
      laneHeight,
    ).setDepth(1);
    this.physics.add.existing(this.crossingFreeRoamBarrier, true);
    this.physics.add.collider(this.player, this.crossingFreeRoamBarrier);

    this.crossingHomeChip = this.add.image(crossing.chipX, this.crossingBaseY, 'poker-chip-safe')
      .setDepth(4)
      .setScale(1.15);
    this.crossingBoardObjects.push(this.crossingHomeChip);

    for (let i = 0; i < crossing.laneCount; i++) {
      const x = crossing.chipX + (i + 1) * crossing.columnSpacing;
      const laneLine = this.add.rectangle(x, centerY, 2, laneHeight + 8, 0xd7b56a, 0.18).setDepth(3);
      const chip = this.add.image(x, this.crossingBaseY, 'poker-chip-safe')
        .setDepth(4)
        .setScale(1);
      const blockade = this.add.rectangle(
        x,
        this.crossingBaseY,
        crossing.barricadeWidth,
        6,
        0xf6cf79,
        0.92,
      ).setDepth(4.6).setVisible(false);
      const column: CrossingColumn = {
        x,
        direction: i % 2 === 0 ? 1 : -1,
        speed: crossing.speedBase + i * crossing.speedStep,
        cardTexture: i % 2 === 0 ? 'poker-card-red' : 'poker-card-black',
        chip,
        blockade,
        laneLine,
        sprites: [],
      };
      this._resetCrossingColumn(column, true);
      this.crossingColumns.push(column);
      this.crossingBoardObjects.push(laneLine, blockade, chip, ...column.sprites);
    }

    this.selectedCrossingBet = crossing.defaultBet;

    const betY = this.scale.height - 122;
    const betStartX = this.scale.width / 2 - 150;
    CROSSING_BET_OPTIONS.forEach((bet, idx) => {
      const x = betStartX + idx * 150;
      const bg = this.add.graphics().setScrollFactor(0).setDepth(HUD.DEPTH + 1);
      const label = this.add.text(x, betY, `BET ${bet}`, buttonLabelStyle(18))
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(HUD.DEPTH + 2);
      const zone = this.add.zone(x, betY, 112, 48).setScrollFactor(0).setDepth(HUD.DEPTH + 3).setInteractive({ cursor: 'pointer' });
      zone.on('pointerdown', () => {
        if (this.crossingRunActive || this.crossingBusy) return;
        this.selectedCrossingBet = this.selectedCrossingBet === bet ? 0 : bet;
        this._refreshCrossingButtons();
        this._refreshCrossingHud();
        AudioManager.playSfx(this, 'bet-select', { volume: 1.2, cooldownMs: 50, allowOverlap: false });
      });
      this.crossingButtons.push({ bg, label, bet });
    });

    this.crossingStatusText = this.add.text(this.scale.width / 2, this.scale.height - 162, '', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#f7dc96',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD.DEPTH + 2);

    this.crossingGoalText = this.add.text(this.scale.width / 2, 94, '', {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: '#ffe7a8',
      stroke: '#2c120d',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(HUD.DEPTH + 2);

    this.crossingPromptText = this.add.text(crossing.chipX, this.crossingBaseY - 18, '', {
      fontSize: '9px',
      fontFamily: 'monospace',
      color: '#f7dc96',
      stroke: '#2c120d',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5, 1).setDepth(6).setVisible(false);
    this.crossingBoardObjects.push(this.crossingPromptText);

    this.crossingInteractKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.crossingCashOutKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    const crossingUi = [
      this.crossingGoalText,
      this.crossingStatusText,
      ...this.crossingButtons.flatMap(({ bg, label }) => [bg, label]),
    ];
    this.uiCam.ignore(this.crossingBoardObjects);
    this.cameras.main.ignore(crossingUi);

    this.hud.showSpeech('You can roam freely here. Go straight up for the stairs when they unlock, or head to the first chip and press E to play.');
    this._refreshCrossingButtons();
    this._refreshCrossingHud();
    this._refreshCrossingFrontier();
    this._refreshCrossingBarrier();
  }

  private _resetCrossingColumn(column: CrossingColumn, initial = false): void {
    const crossing = this.config.crossing;
    if (!crossing) return;

    const laneTop = crossing.laneTop;
    const laneBottom = crossing.laneBottom;
    column.direction = Phaser.Math.Between(0, 1) === 0 ? 1 : -1;
    column.speed = crossing.speedBase
      + Math.min(6, this.crossingCurrentColumnIndex) * crossing.speedStep
      + Phaser.Math.Between(-crossing.speedVariance, crossing.speedVariance);
    column.cardTexture = Phaser.Math.Between(0, 1) === 0 ? 'poker-card-red' : 'poker-card-black';
    column.chip.setTexture('poker-chip-safe');
    column.chip.setPosition(column.x, this.crossingBaseY);
    column.chip.setScale(1);
    column.blockade.setVisible(false);

    const cardCount = 2;
    if (initial && column.sprites.length === 0) {
      for (let i = 0; i < cardCount; i++) {
        const sprite = this.add.image(column.x, 0, column.cardTexture).setDepth(4);
        column.sprites.push(sprite);
      }
    }

    let cursor = column.direction > 0
      ? laneTop - Phaser.Math.Between(12, crossing.respawnJitter)
      : laneBottom + Phaser.Math.Between(12, crossing.respawnJitter);

    column.sprites.forEach((sprite) => {
      const nextGap = crossing.laneSpacing * Phaser.Math.FloatBetween(1.15, 2.5);
      sprite.setTexture(column.cardTexture);
      sprite.setData('speedScale', Phaser.Math.FloatBetween(0.82, 1.28));
      sprite.setData('xOffset', Phaser.Math.Between(-4, 4));
      sprite.setData('wasNearPlayer', false);
      sprite.setPosition(
        column.x + (((sprite.getData('xOffset') as number | undefined) ?? 0)),
        cursor,
      );
      sprite.setAlpha(1);
      cursor += column.direction > 0 ? -nextGap : nextGap;
    });
  }

  private _refreshCrossingButtons(): void {
    this.crossingButtons.forEach(({ bg, label, bet }) => {
      drawNestedButton(bg, label.x, label.y, 112, 48, this.selectedCrossingBet === bet);
      label.setAlpha(this.crossingRunActive || this.crossingReturning ? 0.65 : 1);
    });
  }

  private _refreshCrossingHud(): void {
    const remainingToUnlock = Math.max(0, this.config.target - getCoins());
    const projectedPayout = this.selectedCrossingBet > 0
      ? Math.max(this.selectedCrossingBet, Math.round(this.selectedCrossingBet * this.crossingMultiplier))
      : 0;
    this.hud.showRunPanel('CHIP CROSS', [
      `Bet ${this.selectedCrossingBet || '--'}  |  Bank ${projectedPayout || '--'}`,
      `Run x${this.crossingMultiplier.toFixed(2)}  |  Chips ${this.crossingCurrentColumnIndex}/${this.crossingColumns.length}`,
      this.crossingRunActive
        ? 'Press E to jump right  |  C to bank and walk back'
        : (this.stairsUnlocked
          ? 'Target reached. Press your luck or head north to leave.'
          : `Need ${remainingToUnlock} more  |  Press E on first chip to start.`),
    ]);

    this.crossingGoalText.setText('');

    if (this.crossingRunActive) {
      this.crossingStatusText.setText(
        `Run live  x${this.crossingMultiplier.toFixed(2)}  |  projected ${projectedPayout}  |  ${remainingToUnlock} to unlock`,
      );
      return;
    }
    if (this.crossingReturning) {
      this.crossingStatusText.setText('Walking back to the start with your stack secured.');
      return;
    }
    if (this.stairsUnlocked) {
      this.crossingStatusText.setText('Target reached. Play again or walk north to leave.');
      return;
    }
    this.crossingStatusText.setText(
      `Walk around freely. You still need ${remainingToUnlock} more before the stairs open.`,
    );
  }

  private buildTouchActionButtons(): void {
    const H = this.scale.height;
    const makeBtn = (x: number, y: number, label: string, color: number, onPress: () => void) => {
      const arc = this.add.graphics().setScrollFactor(0).setDepth(200).setVisible(false);
      arc.fillStyle(color, 0.80); arc.fillCircle(x, y, 38);
      arc.lineStyle(2, 0xe0a242, 0.85); arc.strokeCircle(x, y, 38);
      const txt = this.add.text(x, y, label, {
        fontSize: '11px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setVisible(false);
      const zone = this.add.zone(x, y, 76, 76).setScrollFactor(0).setDepth(202).setInteractive();
      zone.setVisible(false);
      zone.on('pointerdown', onPress);
      return { arc, label: txt, zone };
    };
    this.touchCollectBtn = makeBtn(934, H - 90, 'COLLECT', 0x1d5a1d, () => { this.touchCollectPressed = true; });
    this.touchCashBtn    = makeBtn(820, H - 90, 'CASH',    0x5a1d1d, () => { this.touchCashPressed = true; });
    this.cameras.main.ignore([
      this.touchCollectBtn.arc, this.touchCollectBtn.label,
      this.touchCashBtn.arc,    this.touchCashBtn.label,
    ]);
  }

  private setTouchCrossingBtnsVisible(v: boolean): void {
    if (!this.touchCollectBtn || !this.touchCashBtn) return;
    [this.touchCollectBtn, this.touchCashBtn].forEach(({ arc, label, zone }) => {
      arc.setVisible(v); label.setVisible(v); zone.setVisible(v);
      if (v) zone.setInteractive(); else zone.disableInteractive();
    });
  }

  private _startCrossingRun(): void {
    if (this.crossingBusy || this.crossingReturning || this.selectedCrossingBet <= 0) return;
    this.crossingRunActive = true;
    this.setTouchCrossingBtnsVisible(true);
    this.crossingMultiplier = this.config.crossing?.startMultiplier ?? 1;
    this.crossingCurrentColumnIndex = 0;
    this.player.setPosition(this.config.crossing?.chipX ?? this.player.x, this.crossingBaseY);
    this.crossingColumns.forEach((column) => this._resetCrossingColumn(column));
    this._refreshCrossingFrontier();
    this._refreshCrossingButtons();
    this._refreshCrossingHud();
    this._refreshCrossingBarrier();
    AudioManager.playSfx(this, 'ui-click', { volume: 0.9, cooldownMs: 40, allowOverlap: false });
  }

  private _attemptCrossingStep(): void {
    if (!this.crossingRunActive || this.crossingBusy) return;

    const nextIndex = this.crossingCurrentColumnIndex + 1;
    const column = this.crossingColumns[nextIndex - 1];
    const crossing = this.config.crossing;
    if (!crossing || !column) {
      this._refreshCrossingButtons();
      return;
    }

    this.crossingBusy = true;
    const safe = this._columnIsSafe(column);
    this.player.play('player-walk', true);
    this.player.setFlipX(false);

    this.tweens.add({
      targets: this.player,
      x: column.x,
      duration: 150,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (!safe) {
          this._bustCrossingRun();
          return;
        }

        this.crossingCurrentColumnIndex = nextIndex;
        this.crossingMultiplier += crossing.multiplierStep;
        AudioManager.playSfx(this, 'step', { volume: 0.4, cooldownMs: 80, allowOverlap: false });
        this._refreshCrossingFrontier();
        this.crossingBusy = false;
        this.player.play('player-idle', true);
        this._refreshCrossingButtons();
        this._refreshCrossingHud();
      },
    });
  }

  private _columnIsSafe(column: CrossingColumn): boolean {
    const crossing = this.config.crossing;
    if (!crossing) return false;
    const hitHalfHeight = crossing.cardHeight / 2 + 6;
    return column.sprites.every((sprite) => Math.abs(sprite.y - this.crossingBaseY) > hitHalfHeight);
  }

  private _cashOutCrossingRun(): void {
    if (!this.crossingRunActive || this.crossingBusy || this.crossingReturning) return;

    const wasBelowTarget = getCoins() < this.config.target;
    const grossPayout = Math.max(this.selectedCrossingBet, Math.round(this.selectedCrossingBet * this.crossingMultiplier));
    const profit = grossPayout - this.selectedCrossingBet;
    setCoins(getCoins() + profit);
    this.crossingRunActive = false;
    this.setTouchCrossingBtnsVisible(false);
    this.hud.showSpeech(`You bank ${grossPayout}. The House lets you breathe for a second.`);
    AudioManager.playSfx(this, 'chip-cross-bank', { volume: 0.9, cooldownMs: 180, allowOverlap: false });

    const reachedTargetNow = wasBelowTarget && getCoins() >= this.config.target;
    if (reachedTargetNow) {
      AudioManager.playSfx(this, 'goal-victory', { volume: 0.6, cooldownMs: 250, allowOverlap: false });
    }
    if (getCoins() >= this.config.target) {
      this._unlockStairs();
    }
    this._returnCrossingPlayerToStart(false);
  }

  private _bustCrossingRun(): void {
    this.crossingRunActive = false;
    this.setTouchCrossingBtnsVisible(false);
    setCoins(Math.max(0, getCoins() - this.selectedCrossingBet));
    this.hud.showSpeech('A card clips you. The House drags your bet off the felt.');
    AudioManager.playSfx(this, 'game-over', { volume: 0.6, cooldownMs: 250, allowOverlap: false });

    if (getCoins() <= 0) {
      resetMemoryRunState();
      resetRun();
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.restart({ floor: 1 });
      });
      return;
    }
    this._returnCrossingPlayerToStart(true);
  }

  private _returnCrossingPlayerToStart(fromBust: boolean): void {
    const startX = this.config.crossing?.chipX ?? this.player.x;
    this.crossingBusy = true;
    this.crossingReturning = true;
    this._refreshCrossingButtons();
    this._refreshCrossingHud();
    this._refreshCrossingFrontier();
    this._refreshCrossingBarrier();

    this.player.setFlipX(true);
    this.player.play('player-walk', true);

    this.tweens.add({
      targets: this.player,
      x: startX,
      duration: 260 + Math.abs(this.player.x - startX) * 4,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.player.setFlipX(false);
        this.player.play('player-idle', true);
        this.crossingBusy = false;
        this.crossingReturning = false;
        this.crossingCurrentColumnIndex = 0;
        this.crossingMultiplier = this.config.crossing?.startMultiplier ?? 1;
        this.crossingColumns.forEach((column) => this._resetCrossingColumn(column));
        this._refreshCrossingFrontier();
        this._refreshCrossingButtons();
        this._refreshCrossingHud();
        this._refreshCrossingBarrier();
        if (fromBust) {
          AudioManager.playSfx(this, 'ui-click', { volume: 0.55, cooldownMs: 50, allowOverlap: false });
        }
      },
    });
  }

  private _refreshCrossingFrontier(): void {
    this.crossingColumns.forEach((column, index) => {
      const cleared = index < this.crossingCurrentColumnIndex;
      column.blockade.setVisible(cleared);
      column.sprites.forEach((sprite) => sprite.setAlpha(cleared ? 0.45 : 1));
    });
  }

  private _refreshCrossingBarrier(): void {
    const body = this.crossingFreeRoamBarrier?.body as Physics.Arcade.StaticBody | undefined;
    if (!body) return;

    const freeRoamActive = !this.crossingRunActive && !this.crossingReturning && !this.crossingBusy;
    body.enable = freeRoamActive;
    this.crossingFreeRoamBarrier?.setActive(freeRoamActive);
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

  private _isNearCrossingStartChip(): boolean {
    const crossing = this.config.crossing;
    if (!crossing) return false;
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, crossing.chipX, this.crossingBaseY) <= crossing.startPromptRadius;
  }

  private _updateCrossingPrompt(): void {
    if (this.crossingRunActive || this.crossingReturning || this.crossingBusy) {
      this.crossingPromptText.setVisible(false);
      return;
    }

    const nearStart = this._isNearCrossingStartChip();
    this.crossingPromptText.setVisible(nearStart);
    if (!nearStart) return;

    const prompt = this.selectedCrossingBet > 0
      ? `PRESS E\nBET ${this.selectedCrossingBet}`
      : 'PICK A BET';
    this.crossingPromptText.setText(prompt);
  }

  private _updatePlayerMovement(enabled: boolean): void {
    const speed = 120;
    const body = this.player.body as Physics.Arcade.Body;

    if (!enabled) {
      body.setVelocity(0, 0);
      if (!this.crossingReturning && !this.crossingBusy) {
        this.player.play('player-idle', true);
      }
      return;
    }

    let vx = 0;
    let vy = 0;

    if (this.joystick && (this.joystick.dx !== 0 || this.joystick.dy !== 0)) {
      vx = this.joystick.dx * speed;
      vy = this.joystick.dy * speed;
    } else {
      if (this.cursors.left.isDown || this.wasd.left.isDown) vx = -speed;
      else if (this.cursors.right.isDown || this.wasd.right.isDown) vx = speed;

      if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -speed;
      else if (this.cursors.down.isDown || this.wasd.down.isDown) vy = speed;

      if (vx !== 0 && vy !== 0) {
        vx /= Math.SQRT2;
        vy /= Math.SQRT2;
      }
    }

    body.setVelocity(vx, vy);

    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      this.player.play('player-walk', true);
      if (vx < 0) this.player.setFlipX(true);
      else if (vx > 0) this.player.setFlipX(false);

      const now = Date.now();
      if (now - this.lastStepAt > 220) {
        this.lastStepAt = now;
        AudioManager.playSfx(this, 'step', { volume: 0.25, cooldownMs: 120, allowOverlap: false });
      }
    } else if (!this.crossingReturning && !this.crossingBusy) {
      this.player.play('player-idle', true);
    }
  }

  update(): void {
    if (this.crossingMode) {
      const deltaSeconds = this.game.loop.delta / 1000;
      const crossing = this.config.crossing;
      const laneTop = crossing?.laneTop ?? 92;
      const laneBottom = crossing?.laneBottom ?? (ROWS * TILE_SIZE - 16);
      const cardWooshDistance = 14;
      for (const column of this.crossingColumns) {
        for (const sprite of column.sprites) {
          const speedScale = (sprite.getData('speedScale') as number | undefined) ?? 1;
          sprite.y += column.direction * column.speed * speedScale * deltaSeconds;

          const distanceToPlayer = Math.abs(sprite.y - this.player.y);
          const isNearPlayer = distanceToPlayer <= cardWooshDistance;
          const wasNearPlayer = (sprite.getData('wasNearPlayer') as boolean | undefined) ?? false;
          if (isNearPlayer && !wasNearPlayer) {
            const now = this.time.now;
            if (now - this.lastCardWooshAt >= 140) {
              const proximity = 1 - Phaser.Math.Clamp(distanceToPlayer / cardWooshDistance, 0, 1);
              AudioManager.playSfx(this, 'card-woosh', {
                volume: 0.14 + proximity * 0.12,
                rate: Phaser.Math.FloatBetween(0.94, 1.06),
                cooldownMs: 110,
                allowOverlap: false,
              });
              this.lastCardWooshAt = now;
            }
          }
          sprite.setData('wasNearPlayer', isNearPlayer);
        }

        if (column.direction > 0) {
          const topMost = Math.min(...column.sprites.map((sprite) => sprite.y));
          column.sprites.forEach((sprite) => {
            if (sprite.y > laneBottom + 18) {
              sprite.setData('speedScale', Phaser.Math.FloatBetween(0.82, 1.28));
              sprite.setData('xOffset', Phaser.Math.Between(-4, 4));
              sprite.setData('wasNearPlayer', false);
              sprite.x = column.x + (((sprite.getData('xOffset') as number | undefined) ?? 0));
              sprite.y = topMost - crossing!.laneSpacing * Phaser.Math.FloatBetween(1.1, 2.6);
            }
          });
        } else {
          const bottomMost = Math.max(...column.sprites.map((sprite) => sprite.y));
          column.sprites.forEach((sprite) => {
            if (sprite.y < laneTop - 18) {
              sprite.setData('speedScale', Phaser.Math.FloatBetween(0.82, 1.28));
              sprite.setData('xOffset', Phaser.Math.Between(-4, 4));
              sprite.setData('wasNearPlayer', false);
              sprite.x = column.x + (((sprite.getData('xOffset') as number | undefined) ?? 0));
              sprite.y = bottomMost + crossing!.laneSpacing * Phaser.Math.FloatBetween(1.1, 2.6);
            }
          });
        }
      }

      const canFreeRoam = !this.crossingRunActive && !this.crossingReturning && !this.crossingBusy;
      this._updatePlayerMovement(canFreeRoam);
      this._updateCrossingPrompt();

      if (Phaser.Input.Keyboard.JustDown(this.crossingInteractKey) || this.touchCollectPressed) {
        this.touchCollectPressed = false;
        if (this.crossingRunActive) {
          this._attemptCrossingStep();
        } else if (this._isNearCrossingStartChip() && this.selectedCrossingBet > 0) {
          this._startCrossingRun();
        }
      }
      if (Phaser.Input.Keyboard.JustDown(this.crossingCashOutKey) || this.touchCashPressed) {
        this.touchCashPressed = false;
        this._cashOutCrossingRun();
      }

      const coins = getCoins();
      if (coins !== this._lastHudCoins) {
        this._lastHudCoins = coins;
        this.hud.setCoins(coins);
        this.hud.setProgress(coins, this.config.target);
        this._refreshCrossingHud();
      }
      if (coins !== this._lastResumeCoins) {
        this._lastResumeCoins = coins;
        this._syncFloorRefreshResume();
      }
      return;
    }
    this._updatePlayerMovement(true);

    const coins = getCoins();
    if (coins !== this._lastHudCoins) {
      this._lastHudCoins = coins;
      this.hud.setCoins(coins);
      this.hud.setProgress(coins, this.config.target);
    }
    if (coins !== this._lastResumeCoins) {
      this._lastResumeCoins = coins;
      this._syncFloorRefreshResume();
    }

    // Clear exit cooldown once player is far enough from the last-used table
    if (this.justExitedTable) {
      const tableX = this.lastTablePos.col * TILE_SIZE + 8;
      const tableY = this.lastTablePos.row * TILE_SIZE + 8;
      const dx = this.player.x - tableX;
      const dy = this.player.y - tableY;
      if (Math.sqrt(dx * dx + dy * dy) > 32) {
        this.justExitedTable = false;
      }
    }
  }

  private _onInteractableOverlap(
    gameSceneKey: string,
    pos: { col: number; row: number },
  ): void {
    if (this.crossingMode) return;
    if (this.doorTriggered || this.justExitedTable) return;
    this.doorTriggered = true;
    this.lastTablePos = pos;
    this.floorEntrySpeechTimer?.remove(false);
    this.floorEntrySpeechTimer = null;
    setRefreshResume({
      floor: this.currentFloor,
      coins: getCoins(),
      minigameSceneKey: gameSceneKey,
    });
    AudioManager.playSfx(this, 'ui-click', { volume: 0.9, cooldownMs: 40, allowOverlap: false });
    if (gameSceneKey === 'WheelScene' || gameSceneKey === 'VaultScene') {
      AudioManager.stopMusic(this);
    }

    const launchMinigame = () => {
      // Ensure we always enter a fresh minigame scene instance.
      if (
        this.scene.isActive(gameSceneKey)
        || this.scene.isPaused(gameSceneKey)
      ) {
        this.scene.stop(gameSceneKey);
      }
      this.scene.launch(gameSceneKey, { coins: getCoins(), floor: this.currentFloor });
      this.scene.pause('DungeonScene');
    };

    this.player.setVelocity(0, 0);
    if (gameSceneKey === 'VaultScene') {
      // Vault is sensitive to cross-scene fade state on re-entry; launch directly.
      this.cameras.main.resetFX();
      this.cameras.main.setAlpha(1);
      launchMinigame();
      return;
    }

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      launchMinigame();
    });
  }

  private _launchMinigameDirect(gameSceneKey: string): void {
    if (!this.scene.manager.keys[gameSceneKey]) {
      return;
    }

    setRefreshResume({
      floor: this.currentFloor,
      coins: getCoins(),
      minigameSceneKey: gameSceneKey,
    });

    this.doorTriggered = true;
    this.lastTablePos = this._resolveTablePosForScene(gameSceneKey);
    this.floorEntrySpeechTimer?.remove(false);
    this.floorEntrySpeechTimer = null;

    if (gameSceneKey === 'WheelScene' || gameSceneKey === 'VaultScene') {
      AudioManager.stopMusic(this);
    }

    if (this.scene.isActive(gameSceneKey) || this.scene.isPaused(gameSceneKey)) {
      this.scene.stop(gameSceneKey);
    }
    this.player.setVelocity(0, 0);
    this.scene.launch(gameSceneKey, { coins: getCoins(), floor: this.currentFloor });
    this.scene.pause('DungeonScene');
  }

  private _resolveTablePosForScene(gameSceneKey: string): { col: number; row: number } {
    if (this.config.gameSceneKey === gameSceneKey) {
      return this.config.tablePos;
    }
    const secondary = (this.config.interactables ?? []).find((it) => it.gameSceneKey === gameSceneKey);
    return secondary?.pos ?? this.config.tablePos;
  }

  private _onStairsOverlap(): void {
    // Vault floor has no onward staircase progression.
    if (this.config.gameSceneKey === 'VaultScene') return;
    if (!this.stairsUnlocked) return;

    // Prevent re-entry
    this.stairsUnlocked = false;

    // Credit 20% of current coins as wardrobe gold on floor ascension
    creditGold(Math.floor(getCoins() * 0.20));

    const nextFloor = this.currentFloor + 1;
    setFloor(nextFloor);

    const nextConfig = FLOOR_CONFIG[nextFloor];

    if (nextConfig) {
      // Transition to the next floor
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('TransitionScene', {
          nextFloor,
          name: nextConfig.name,
          displayFloorNumber: nextConfig.displayFloorNumber ?? nextFloor,
        });
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
      resetMemoryRunState();
      resetRun();
      this.scene.start('DungeonScene', { floor: 1 });
    });
  }

  private _onGameComplete({ coins, won }: { coins: number; won: boolean }): void {
    clearRefreshResume();
    setCoins(coins);

    if (won) {
      const streak = HouseController.incrementWinStreak();
      if (streak >= 3) {
        HouseController.say(this, 'playerActions', 'winStreak');
      }
    } else if (coins <= 0) {
      HouseController.say(this, 'playerActions', 'busted');
      HouseController.resetWinStreak();
    } else {
      HouseController.resetWinStreak();
    }

    if (won) {
      if (this.currentFloor === 6) {
        this.scene.resume('DungeonScene');
        this._applyFloorAmbience();
        this.cameras.main.fadeOut(350, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('EndScene', { coins });
        });
        return;
      }

      this.hud.showSpeech('The stairs unlock. Take them.');
      this._unlockStairs();
      if (!this.goalSoundsPlayed) {
        AudioManager.playSfx(this, 'door-open', { volume: 1.8, cooldownMs: 300, allowOverlap: true });
        if (this.config.gameSceneKey !== 'WheelScene') {
          AudioManager.playSfx(this, 'goal-victory', { volume: 0.6, cooldownMs: 300, allowOverlap: false });
        }
        this.goalSoundsPlayed = true;
      }
    } else if (coins <= 0) {
      this.hud.showSpeech('The house always wins.');
      AudioManager.playSfx(this, 'game-over', { volume: 1.0, cooldownMs: 300, allowOverlap: false });
      resetMemoryRunState();
      resetRun();
      this.scene.resume('DungeonScene');
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.restart({ floor: 1 });
      });
      return;
    }
    if (!won) {
      // Allow win fanfare to play again only after objective status is lost.
      this.goalSoundsPlayed = false;
    }

    // Nudge player out of trigger zone after minigame close.
    // Slot machines in the Fate room sit on the left wall, so move right instead of down.
    const exitPos = this.lastTablePos;
    if (this.config.gameSceneKey === 'WheelScene' && exitPos.col <= 1) {
      this.player.setPosition((exitPos.col + 2) * TILE_SIZE + 8, exitPos.row * TILE_SIZE + 8);
    } else {
      this.player.setPosition(exitPos.col * TILE_SIZE + 8, (exitPos.row + 2) * TILE_SIZE + 8);
    }
    this.justExitedTable = true;

    this.scene.resume('DungeonScene');
    this._applyFloorAmbience();
    AudioManager.playSfx(this, 'ui-click', { volume: 0.8, cooldownMs: 40, allowOverlap: false });
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.doorTriggered = false;
  }

  private _applyFloorAmbience(): void {
    const activeMusic = AudioManager.getMusic(this);
    if (this.config.gameSceneKey === 'VaultScene') {
      if (activeMusic) {
        AudioManager.stopMusic(this);
      }
      return;
    }

    if (this.crossingMode) {
      if (activeMusic?.key !== 'chip-cross' || !activeMusic.isPlaying) {
        AudioManager.playMusic(this, 'chip-cross', { loop: true, restart: true, volume: 1.0 });
      } else {
        (activeMusic as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).setVolume(
          AudioManager.getMusicVolume(this) * 1.0,
        );
      }
      return;
    }

    if (this.config.gameSceneKey === 'WheelScene') {
      if (activeMusic?.key !== 'wheel-choir' || !activeMusic.isPlaying) {
        AudioManager.playMusic(this, 'wheel-choir', { loop: true, restart: true, volume: 0.5 });
      } else {
        (activeMusic as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).setVolume(
          AudioManager.getMusicVolume(this) * 0.5,
        );
      }
      return;
    }

    if (activeMusic?.key !== 'casino-music' || !activeMusic.isPlaying) {
      AudioManager.playMusic(this, 'casino-music', { loop: true, restart: true });
    }
  }

  private _unlockStairs(playFx = true): void {
    if (this.stairsUnlocked) return;
    this.stairsUnlocked = true;
    if (playFx) {
      AudioManager.playSfx(this, 'stairs-unlock', { volume: 0.95, cooldownMs: 250, allowOverlap: false });
    }

    if (this.stairsBlocker.body) {
      this.stairsBlocker.destroy();
    }

    // Swap the composite sprite to the open variant
    this.stairsSprite.setTexture('stairs-sprite-open');

    if (playFx) {
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
    if (this.crossingMode) {
      this._refreshCrossingButtons();
      this._refreshCrossingHud();
    }
  }

  private _lockStairs(): void {
    this.stairsUnlocked = false;
    this.stairsSprite.setTexture('stairs-sprite-locked');

    if (!this.stairsBlocker || !this.stairsBlocker.active) {
      const { stairsPos } = this.config;
      this.stairsBlocker = this.add
        .zone(stairsPos.col * TILE_SIZE + 8, stairsPos.row * TILE_SIZE + 8, TILE_SIZE, TILE_SIZE)
        .setDepth(1);
      this.physics.add.existing(this.stairsBlocker, true);
      this.physics.add.collider(this.player, this.stairsBlocker);
    }
    if (this.crossingMode) {
      this._refreshCrossingButtons();
      this._refreshCrossingHud();
    }
  }

  private applyDevModeState(): void {
    this.ensureDevModeLabel();
    this.ensureDevLevelSelector();
    this.ensureDevSetCoinsButton();
    this.ensureDevRefreshToggleButton();

    if (isDeveloperModeEnabled()) {
      this._unlockStairs(false);
      return;
    }

    const meetsTarget = this.config.target <= 0 || getCoins() >= this.config.target;
    if (meetsTarget) {
      this._unlockStairs(false);
      return;
    }
    this._lockStairs();
  }

  private ensureDevModeLabel(): void {
    if (!this.devModeLabel) {
      this.devModeLabel = this.add.text(50, 44, 'Dev Mode Active', {
        fontFamily: 'Courier New',
        fontSize: '11px',
        color: '#ffcf7f',
        stroke: '#2a1710',
        strokeThickness: 2,
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(1000);
      this.cameras.main.ignore(this.devModeLabel);
    }
    this.devModeLabel.setVisible(isDeveloperModeEnabled());
  }

  private ensureDevLevelSelector(): void {
    if (!isDeveloperModeEnabled()) {
      this.destroyDevLevelSelector();
      return;
    }
    if (this.devLevelButtonBg) {
      return;
    }

    const x = 86;
    const y = this.scale.height - 34;
    const w = 68;
    const h = 44;
    const depth = 1000;

    this.devLevelButtonBg = this.add.graphics().setScrollFactor(0).setDepth(depth);
    this.devLevelButtonLabel = this.add.text(x, y, 'LEVELS', {
      fontFamily: 'Courier New',
      fontSize: '12px',
      color: '#f5e5c7',
      stroke: '#24130e',
      strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
    this.devLevelButtonZone = this.add.zone(x, y, w, h).setScrollFactor(0).setDepth(depth + 2);

    const redraw = (hovered: boolean): void => {
      this.devLevelButtonBg?.clear();
      this.devLevelButtonBg?.fillStyle(hovered ? 0xf1cc82 : 0xc8a364, 1);
      this.devLevelButtonBg?.fillRect(x - w / 2, y - h / 2, w, h);
      this.devLevelButtonBg?.fillStyle(0x3b2417, 1);
      this.devLevelButtonBg?.fillRect(x - w / 2 + 4, y - h / 2 + 4, w - 8, h - 8);
      this.devLevelButtonBg?.fillStyle(hovered ? 0x6e2937 : 0x5a2230, 0.92);
      this.devLevelButtonBg?.fillRect(x - w / 2 + 8, y - h / 2 + 8, w - 16, h - 16);
    };

    redraw(false);
    this.devLevelButtonZone.setInteractive({ cursor: 'pointer' });
    this.devLevelButtonZone.on('pointerover', () => {
      redraw(true);
      AudioManager.playSfx(this, 'ui-hover', { volume: 0.8, cooldownMs: 45, allowOverlap: false });
    });
    this.devLevelButtonZone.on('pointerout', () => redraw(false));
    this.devLevelButtonZone.on('pointerdown', () => {
      AudioManager.playSfx(this, 'ui-click', { volume: 0.85, cooldownMs: 45, allowOverlap: false });
      this.toggleDevLevelPanel();
    });
  }

  private ensureDevSetCoinsButton(): void {
    if (!isDeveloperModeEnabled()) {
      this.destroyDevSetCoinsButton();
      return;
    }
    if (this.devSetCoinsButtonBg) {
      return;
    }

    const x = 92;
    const y = 62;
    const w = 132;
    const h = 24;
    const depth = 1000;

    this.devSetCoinsButtonBg = this.add.graphics().setScrollFactor(0).setDepth(depth);
    this.devSetCoinsButtonLabel = this.add.text(x, y, 'Set Coin Amount', {
      fontFamily: 'Courier New',
      fontSize: '11px',
      color: '#f5e5c7',
      stroke: '#24130e',
      strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
    this.devSetCoinsButtonZone = this.add.zone(x, y, w, h).setScrollFactor(0).setDepth(depth + 2);

    const redraw = (hovered: boolean): void => {
      this.devSetCoinsButtonBg?.clear();
      this.devSetCoinsButtonBg?.fillStyle(hovered ? 0xf1cc82 : 0xc8a364, 1);
      this.devSetCoinsButtonBg?.fillRect(x - w / 2, y - h / 2, w, h);
      this.devSetCoinsButtonBg?.fillStyle(0x3b2417, 1);
      this.devSetCoinsButtonBg?.fillRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6);
      this.devSetCoinsButtonBg?.fillStyle(hovered ? 0x6e2937 : 0x5a2230, 0.92);
      this.devSetCoinsButtonBg?.fillRect(x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 12);
    };

    redraw(false);
    this.devSetCoinsButtonZone.setInteractive({ cursor: 'pointer' });
    this.devSetCoinsButtonZone.on('pointerover', () => {
      redraw(true);
      AudioManager.playSfx(this, 'ui-hover', { volume: 0.8, cooldownMs: 45, allowOverlap: false });
    });
    this.devSetCoinsButtonZone.on('pointerout', () => redraw(false));
    this.devSetCoinsButtonZone.on('pointerdown', () => {
      AudioManager.playSfx(this, 'ui-click', { volume: 0.85, cooldownMs: 45, allowOverlap: false });
      const raw = window.prompt('Set coin amount:', String(getCoins()));
      if (raw === null) return;
      const value = Number.parseInt(raw.trim(), 10);
      if (!Number.isFinite(value) || Number.isNaN(value) || value < 0) {
        this.hud.showSpeech('Enter a valid coin amount (0 or more).');
        return;
      }

      const nextCoins = Math.floor(value);
      setCoins(nextCoins);
      this._lastHudCoins = nextCoins;
      this.hud.setCoins(nextCoins);
      this.hud.setProgress(nextCoins, this.config.target);
      if (this.crossingMode) {
        this._refreshCrossingHud();
        this._refreshCrossingButtons();
      }
      this.applyDevModeState();
    });
  }

  private ensureDevRefreshToggleButton(): void {
    if (!isDeveloperModeEnabled()) {
      this.destroyDevRefreshToggleButton();
      return;
    }
    if (this.devRefreshToggleButtonBg) {
      this.devRefreshToggleButtonLabel?.setText(`Refresh Resume: ${isRefreshResumeEnabled() ? 'ON' : 'OFF'}`);
      return;
    }

    const x = 252;
    const y = 62;
    const w = 170;
    const h = 24;
    const depth = 1000;

    this.devRefreshToggleButtonBg = this.add.graphics().setScrollFactor(0).setDepth(depth);
    this.devRefreshToggleButtonLabel = this.add.text(x, y, '', {
      fontFamily: 'Courier New',
      fontSize: '11px',
      color: '#f5e5c7',
      stroke: '#24130e',
      strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
    this.devRefreshToggleButtonZone = this.add.zone(x, y, w, h).setScrollFactor(0).setDepth(depth + 2);

    const redraw = (hovered: boolean): void => {
      this.devRefreshToggleButtonBg?.clear();
      this.devRefreshToggleButtonBg?.fillStyle(hovered ? 0xf1cc82 : 0xc8a364, 1);
      this.devRefreshToggleButtonBg?.fillRect(x - w / 2, y - h / 2, w, h);
      this.devRefreshToggleButtonBg?.fillStyle(0x3b2417, 1);
      this.devRefreshToggleButtonBg?.fillRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6);
      this.devRefreshToggleButtonBg?.fillStyle(hovered ? 0x6e2937 : 0x5a2230, 0.92);
      this.devRefreshToggleButtonBg?.fillRect(x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 12);
    };

    redraw(false);
    this.devRefreshToggleButtonLabel.setText(`Refresh Resume: ${isRefreshResumeEnabled() ? 'ON' : 'OFF'}`);
    this.devRefreshToggleButtonZone.setInteractive({ cursor: 'pointer' });
    this.devRefreshToggleButtonZone.on('pointerover', () => {
      redraw(true);
      AudioManager.playSfx(this, 'ui-hover', { volume: 0.8, cooldownMs: 45, allowOverlap: false });
    });
    this.devRefreshToggleButtonZone.on('pointerout', () => redraw(false));
    this.devRefreshToggleButtonZone.on('pointerdown', () => {
      AudioManager.playSfx(this, 'ui-click', { volume: 0.85, cooldownMs: 45, allowOverlap: false });
      const next = !isRefreshResumeEnabled();
      setRefreshResumeEnabled(next);
      this.devRefreshToggleButtonLabel?.setText(`Refresh Resume: ${next ? 'ON' : 'OFF'}`);
      this.hud.showSpeech(next ? 'Refresh resume enabled.' : 'Refresh resume disabled.');
    });
  }

  private toggleDevLevelPanel(): void {
    if (this.devLevelPanel?.visible) {
      this.devLevelPanel.setVisible(false);
      return;
    }
    if (!this.devLevelPanel) {
      this.devLevelPanel = this.createDevLevelPanel();
    }
    this.devLevelPanel.setVisible(true);
  }

  private createDevLevelPanel(): Phaser.GameObjects.Container {
    const panel = this.add.container(0, 0).setScrollFactor(0).setDepth(1010);
    const x = 116;
    const panelW = 164;
    const floorKeys = Object.keys(FLOOR_CONFIG).map((value) => Number(value)).sort((a, b) => a - b);
    const buttonColumns = 2;
    const rowCount = Math.ceil(floorKeys.length / buttonColumns);
    const panelH = 116 + Math.max(0, rowCount - 2) * 36;
    const selectorButtonCenterY = this.scale.height - 34;
    const selectorButtonHalfH = 22;
    const gapAboveSelector = 12;
    const panelBottom = selectorButtonCenterY - selectorButtonHalfH - gapAboveSelector;
    const y = panelBottom - panelH / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x1b0e12, 0.96);
    bg.fillRoundedRect(x - panelW / 2, y - panelH / 2, panelW, panelH, 8);
    bg.lineStyle(2, 0xc8a364, 1);
    bg.strokeRoundedRect(x - panelW / 2, y - panelH / 2, panelW, panelH, 8);

    const title = this.add.text(x, y - 44, 'LEVEL SELECT', {
      fontFamily: 'Courier New',
      fontSize: '13px',
      color: '#f4dfb4',
    }).setOrigin(0.5);

    panel.add([bg, title]);

    floorKeys.forEach((floor, index) => {
      const row = Math.floor(index / buttonColumns);
      const col = index % buttonColumns;
      const bx = x - 38 + col * 76;
      const by = y - 12 + row * 36;
      const bw = 66;
      const bh = 28;

      const buttonBg = this.add.graphics();
      const redrawButton = (hovered: boolean): void => {
        buttonBg.clear();
        buttonBg.fillStyle(hovered ? 0xf1cc82 : 0xc8a364, 1);
        buttonBg.fillRect(bx - bw / 2, by - bh / 2, bw, bh);
        buttonBg.fillStyle(0x3b2417, 1);
        buttonBg.fillRect(bx - bw / 2 + 3, by - bh / 2 + 3, bw - 6, bh - 6);
        buttonBg.fillStyle(hovered ? 0x6e2937 : 0x5a2230, 0.92);
        buttonBg.fillRect(bx - bw / 2 + 6, by - bh / 2 + 6, bw - 12, bh - 12);
      };
      redrawButton(false);

      const label = this.add.text(bx, by, `F${floor}`, {
        fontFamily: 'Courier New',
        fontSize: '13px',
        color: '#f5e5c7',
        stroke: '#24130e',
        strokeThickness: 2,
      }).setOrigin(0.5);

      const zone = this.add.zone(bx, by, bw, bh).setInteractive({ cursor: 'pointer' });
      zone.on('pointerover', () => {
        redrawButton(true);
        AudioManager.playSfx(this, 'ui-hover', { volume: 0.8, cooldownMs: 45, allowOverlap: false });
      });
      zone.on('pointerout', () => redrawButton(false));
      zone.on('pointerdown', () => {
        AudioManager.playSfx(this, 'ui-click', { volume: 0.85, cooldownMs: 45, allowOverlap: false });
        this.devLevelPanel?.setVisible(false);
        setFloor(floor);
        this.scene.restart({ floor, fromTransition: false });
      });

      panel.add([buttonBg, label, zone]);
    });

    panel.setVisible(false);
    return panel;
  }

  private destroyDevLevelSelector(): void {
    this.devLevelButtonZone?.destroy();
    this.devLevelButtonLabel?.destroy();
    this.devLevelButtonBg?.destroy();
    this.devLevelPanel?.destroy(true);
    this.devLevelButtonZone = undefined;
    this.devLevelButtonLabel = undefined;
    this.devLevelButtonBg = undefined;
    this.devLevelPanel = undefined;
  }

  private destroyDevSetCoinsButton(): void {
    this.devSetCoinsButtonZone?.destroy();
    this.devSetCoinsButtonLabel?.destroy();
    this.devSetCoinsButtonBg?.destroy();
    this.devSetCoinsButtonZone = undefined;
    this.devSetCoinsButtonLabel = undefined;
    this.devSetCoinsButtonBg = undefined;
  }

  private destroyDevRefreshToggleButton(): void {
    this.devRefreshToggleButtonZone?.destroy();
    this.devRefreshToggleButtonLabel?.destroy();
    this.devRefreshToggleButtonBg?.destroy();
    this.devRefreshToggleButtonZone = undefined;
    this.devRefreshToggleButtonLabel = undefined;
    this.devRefreshToggleButtonBg = undefined;
  }

  private _scheduleEnvironmentSfx(): void {
    const delay = Phaser.Math.Between(7000, 14000);
    this.envTimer = this.time.delayedCall(delay, () => {
      this._playEnvironmentSfx();
      this._scheduleEnvironmentSfx();
    });
  }

  private shouldShowMobileControls(): boolean {
    const ua = window.navigator.userAgent.toLowerCase();
    const phoneUa = /iphone|ipod|android.+mobile|windows phone|blackberry/i.test(ua);
    const isDesktop = this.sys.game.device.os.desktop;
    return phoneUa && !isDesktop;
  }

  private _syncFloorRefreshResume(): void {
    setRefreshResume({
      floor: this.currentFloor,
      coins: getCoins(),
      minigameSceneKey: null,
    });
  }

  private _playEnvironmentSfx(): void {
    const roll = Phaser.Math.Between(0, 2);
    if (roll === 0) {
      AudioManager.playSfx(this, 'env-wind', { volume: 0.28, cooldownMs: 4500, allowOverlap: false });
      return;
    }
    if (roll === 1) {
      AudioManager.playSfx(this, 'env-torch', { volume: 0.2, cooldownMs: 3500, allowOverlap: false });
      return;
    }
    AudioManager.playSfx(this, 'env-casino-murmur', { volume: 0.16, cooldownMs: 5000, allowOverlap: false });
  }
}
