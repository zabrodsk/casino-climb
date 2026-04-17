import { Scene, GameObjects } from 'phaser';

export class BootScene extends Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const { width, height } = this.scale;

    // Loading screen
    this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0, 0);
    this.add
      .text(width / 2, height / 2, 'Loading...', {
        fontSize: '24px',
        color: '#ffffff',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    // Load tileset image (304x208, 16x16 tiles, 19 cols x 13 rows)
    this.load.image('dungeon-tiles', 'assets/tilemaps/dungeon_tileset.png');

    // Note: player spritesheet is generated procedurally in create()
  }

  create(): void {
    // Generate procedural hooded-gambler player spritesheet (288x48, 9 frames)
    const g = this.add.graphics();
    for (let i = 0; i < 9; i++) {
      this._drawPlayerFrame(g, i * 32, 0, i);
    }
    g.generateTexture('player', 288, 48);
    g.destroy();

    // Register 9 sliced frames so generateFrameNumbers works
    const tex = this.textures.get('player');
    for (let i = 0; i < 9; i++) {
      tex.add(i, 0, i * 32, 0, 32, 48);
    }

    // Idle: frames 0-3 (first 4 frames, standing)
    this.anims.create({
      key: 'player-idle',
      frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1,
    });

    // Walk: frames 4-8 (remaining 5 frames)
    this.anims.create({
      key: 'player-walk',
      frames: this.anims.generateFrameNumbers('player', { start: 4, end: 8 }),
      frameRate: 10,
      repeat: -1,
    });

    // Also generate legacy programmatic textures for stairs/door overlays
    this._generateFallbackTextures();

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MenuScene');
    });
  }

  /**
   * Draw one 32x48 frame of the hooded-gambler player sprite at world offset (ox, oy).
   * frameIdx 0-3 = idle (breathing bob), 4-8 = walk cycle (leg alternation).
   */
  private _drawPlayerFrame(g: GameObjects.Graphics, ox: number, oy: number, frameIdx: number): void {
    const breathShift = frameIdx === 1 || frameIdx === 3 ? 1 : 0;
    const walkShift = frameIdx === 6 ? -1 : 0;
    const dy = oy + breathShift + walkShift;

    g.fillStyle(0x1a1a1a);
    g.fillRect(ox + 14, dy + 4, 4, 2);

    g.fillStyle(0x1a1a1a);
    g.fillRect(ox + 12, dy + 6, 8, 4);
    g.fillStyle(0x0a0a0a);
    g.fillRect(ox + 13, dy + 7, 6, 3);

    g.fillStyle(0x1a1a1a);
    g.fillRect(ox + 10, dy + 10, 2, 4);
    g.fillRect(ox + 20, dy + 10, 2, 4);
    g.fillStyle(0x0a0a0a);
    g.fillRect(ox + 12, dy + 10, 8, 4);

    g.fillStyle(0x1a1a1a);
    g.fillRect(ox + 11, dy + 14, 2, 4);
    g.fillRect(ox + 19, dy + 14, 2, 4);
    g.fillStyle(0x0a0a0a);
    g.fillRect(ox + 13, dy + 14, 2, 4);
    g.fillRect(ox + 17, dy + 14, 2, 4);
    g.fillStyle(0x8b7355);
    g.fillRect(ox + 15, dy + 15, 2, 2);

    g.fillStyle(0x1a1a1a);
    g.fillRect(ox + 10, dy + 18, 12, 3);
    g.fillStyle(0x3a3a3a);
    g.fillRect(ox + 11, dy + 18, 10, 2);

    g.fillStyle(0x1a1a1a);
    g.fillRect(ox + 9, dy + 21, 14, 7);
    g.fillStyle(0x2a2a2a);
    g.fillRect(ox + 10, dy + 21, 12, 7);
    g.fillStyle(0x3a3a3a);
    g.fillRect(ox + 11, dy + 22, 2, 5);

    g.fillStyle(0x1a1a1a);
    g.fillRect(ox + 9, dy + 28, 14, 2);
    g.fillStyle(0xc9a66b);
    g.fillRect(ox + 10, dy + 28, 12, 2);

    g.fillStyle(0x1a1a1a);
    g.fillRect(ox + 9, dy + 30, 14, 6);
    g.fillStyle(0x2a2a2a);
    g.fillRect(ox + 10, dy + 30, 12, 6);

    g.fillStyle(0x1a1a1a);
    g.fillRect(ox + 10, dy + 36, 12, 3);
    g.fillStyle(0x2a2a2a);
    g.fillRect(ox + 11, dy + 36, 10, 3);

    if (frameIdx === 5) {
      g.fillStyle(0x2a2a2a);
      g.fillRect(ox + 12, dy + 38, 9, 1);
    } else if (frameIdx === 7) {
      g.fillStyle(0x2a2a2a);
      g.fillRect(ox + 11, dy + 38, 9, 1);
    }

    if (frameIdx >= 4) {
      if (frameIdx === 5) {
        g.fillStyle(0x2a2a2a);
        g.fillRect(ox + 13, dy + 40, 4, 3);
        g.fillRect(ox + 18, dy + 39, 4, 4);
      } else if (frameIdx === 7) {
        g.fillStyle(0x2a2a2a);
        g.fillRect(ox + 12, dy + 39, 4, 4);
        g.fillRect(ox + 17, dy + 40, 4, 3);
      } else {
        g.fillStyle(0x2a2a2a);
        g.fillRect(ox + 12, dy + 39, 4, 4);
        g.fillRect(ox + 18, dy + 39, 4, 4);
      }
    } else {
      g.fillStyle(0x2a2a2a);
      g.fillRect(ox + 12, dy + 39, 4, 4);
      g.fillRect(ox + 18, dy + 39, 4, 4);
    }

    if (frameIdx === 5) {
      g.fillStyle(0x3a2318);
      g.fillRect(ox + 13, dy + 43, 4, 2);
      g.fillRect(ox + 18, dy + 43, 4, 3);
    } else if (frameIdx === 7) {
      g.fillStyle(0x3a2318);
      g.fillRect(ox + 12, dy + 43, 4, 3);
      g.fillRect(ox + 17, dy + 43, 4, 2);
    } else {
      g.fillStyle(0x3a2318);
      g.fillRect(ox + 12, dy + 43, 4, 3);
      g.fillRect(ox + 18, dy + 43, 4, 3);
    }

    g.fillStyle(0x0a0a0a, 0.3);
    g.fillEllipse(ox + 16, oy + 46, 14, 2);
  }

  private _generateFallbackTextures(): void {
    const g = this.add.graphics();

    g.clear();
    g.fillStyle(0x555555);
    g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0x444444);
      g.fillRect(i * 2, 14 - i * 3, 16 - i * 2, 2);
      g.fillStyle(0x666666);
      g.fillRect(i * 2, 13 - i * 3, 16 - i * 2, 1);
    }
    g.fillStyle(0x888888);
    g.fillRect(6, 6, 4, 3);
    g.fillStyle(0x666666);
    g.fillRect(7, 3, 2, 4);
    g.generateTexture('stairs-locked', 16, 16);

    g.clear();
    g.fillStyle(0x443300);
    g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0xaa8800);
      g.fillRect(i * 2, 14 - i * 3, 16 - i * 2, 2);
      g.fillStyle(0xffcc00);
      g.fillRect(i * 2, 13 - i * 3, 16 - i * 2, 1);
    }
    g.fillStyle(0xffee88);
    g.fillRect(7, 2, 2, 2);
    g.generateTexture('stairs-open', 16, 16);

    g.clear();
    g.fillStyle(0x3a3a3a);
    g.fillRect(2, 0, 6, 48);
    g.fillStyle(0x5a5a5a);
    g.fillRect(2, 0, 1, 48);
    g.fillStyle(0x3a3a3a);
    g.fillRect(24, 0, 6, 48);
    g.fillStyle(0x5a5a5a);
    g.fillRect(29, 0, 1, 48);
    g.fillStyle(0x3a3a3a);
    g.fillRect(8, 0, 16, 10);
    g.fillStyle(0x0a0a0a);
    g.fillRect(8, 10, 16, 34);
    g.lineStyle(2, 0x1a1a1a, 1);
    g.strokeRect(2, 0, 6, 48);
    g.strokeRect(24, 0, 6, 48);
    g.strokeRect(8, 0, 16, 10);
    g.fillStyle(0x2a2a2a);
    g.fillRect(14, 2, 4, 6);
    g.fillStyle(0x8a6f3a);
    g.fillRect(15, 4, 2, 2);
    const stepWidths = [18, 16, 14, 11, 8];
    const stepHeights = [42, 36, 30, 24, 18];
    for (let i = 0; i < 5; i++) {
      const sw = stepWidths[i];
      const stepX = 16 - Math.floor(sw / 2);
      const stepY = stepHeights[i] - 4;
      g.fillStyle(0x4a4a4a);
      g.fillRect(stepX, stepY, sw, 4);
      g.fillStyle(0x6a6a6a);
      g.fillRect(stepX, stepY, sw, 1);
    }
    g.fillStyle(0x2a2a2a);
    g.fillRect(11, 12, 2, 30);
    g.fillRect(15, 12, 2, 30);
    g.fillRect(19, 12, 2, 30);
    g.fillRect(10, 26, 12, 2);
    g.fillStyle(0x4a4a4a);
    g.fillRect(11, 12, 1, 30);
    g.fillRect(15, 12, 1, 30);
    g.fillRect(19, 12, 1, 30);
    g.fillStyle(0x4a4a4a);
    g.fillRect(2, 44, 28, 4);
    g.fillStyle(0x6a6a6a);
    g.fillRect(2, 44, 28, 1);
    g.generateTexture('stairs-sprite-locked', 32, 48);

    g.clear();
    g.fillStyle(0x3a3a3a);
    g.fillRect(2, 0, 6, 48);
    g.fillStyle(0x5a5a5a);
    g.fillRect(2, 0, 1, 48);
    g.fillStyle(0x3a3a3a);
    g.fillRect(24, 0, 6, 48);
    g.fillStyle(0x5a5a5a);
    g.fillRect(29, 0, 1, 48);
    g.fillStyle(0x3a3a3a);
    g.fillRect(8, 0, 16, 10);
    g.fillStyle(0xffd07a, 0.25);
    g.fillRect(8, 6, 16, 6);
    const openStepColors = [0x6a4a1a, 0x8a6830, 0xc9a66b, 0xe2b95f, 0xffd878];
    const openStepWidths = [18, 16, 14, 11, 8];
    const openStepYs = [42, 36, 30, 24, 18];
    g.fillStyle(0x0a0a0a);
    g.fillRect(8, 10, 16, 34);
    g.fillStyle(0xffd878, 0.35);
    for (let ay = 4; ay <= 14; ay++) {
      const spread = Math.floor(((ay - 4) / 10) * 7);
      g.fillRect(14 - spread, ay, 4 + spread * 2, 1);
    }
    for (let i = 0; i < 5; i++) {
      const sw = openStepWidths[i];
      const stepX = 16 - Math.floor(sw / 2);
      const stepY = openStepYs[i] - 4;
      g.fillStyle(openStepColors[i]);
      g.fillRect(stepX, stepY, sw, 4);
      g.fillStyle(0xffd878);
      g.fillRect(stepX, stepY, sw, 1);
    }
    g.lineStyle(2, 0x1a1a1a, 1);
    g.strokeRect(2, 0, 6, 48);
    g.strokeRect(24, 0, 6, 48);
    g.strokeRect(8, 0, 16, 10);
    g.fillStyle(0x2a2a2a);
    g.fillRect(14, 2, 4, 6);
    g.fillStyle(0xffd07a);
    g.fillRect(15, 4, 2, 2);
    g.fillStyle(0x4a4a4a);
    g.fillRect(2, 44, 28, 4);
    g.fillStyle(0x6a6a6a);
    g.fillRect(2, 44, 28, 1);
    g.generateTexture('stairs-sprite-open', 32, 48);

    g.clear();
    g.fillStyle(0x6a6a6a);
    g.fillRect(0, 0, 16, 16);
    const specks = [[2, 3], [5, 1], [9, 4], [13, 2], [3, 11], [7, 8], [11, 13], [14, 6], [1, 14], [6, 6]];
    for (const [sx, sy] of specks) {
      g.fillStyle(0x4a4a4a);
      g.fillRect(sx, sy, 2, 2);
    }
    g.fillStyle(0x7a7a7a);
    g.fillRect(4, 7, 3, 2);
    g.fillRect(10, 11, 2, 3);
    g.fillRect(12, 3, 3, 2);
    g.generateTexture('stone-floor-a', 16, 16);

    g.clear();
    g.fillStyle(0x606060);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x3a3a3a);
    g.fillRect(2, 2, 2, 2);
    g.fillRect(4, 4, 2, 2);
    g.fillRect(6, 6, 2, 2);
    g.fillRect(8, 8, 2, 2);
    g.fillRect(10, 10, 2, 2);
    g.fillStyle(0x787878);
    g.fillRect(1, 9, 3, 2);
    g.fillRect(11, 2, 2, 3);
    g.generateTexture('stone-floor-b', 16, 16);

    g.clear();
    g.fillStyle(0x505050);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x2a2a2a);
    g.fillRect(0, 7, 16, 1);
    g.fillRect(8, 0, 1, 7);
    g.fillRect(0, 8, 1, 8);
    g.fillRect(12, 8, 1, 8);
    g.fillStyle(0x707070);
    g.fillRect(0, 0, 16, 2);
    g.fillStyle(0x484848);
    g.fillRect(1, 3, 6, 3);
    g.fillRect(10, 3, 5, 3);
    g.fillRect(2, 10, 9, 4);
    g.generateTexture('stone-wall-top', 16, 16);

    g.clear();
    g.fillStyle(0x404040);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x2a2a2a);
    g.fillRect(0, 5, 16, 1);
    g.fillRect(0, 11, 16, 1);
    g.fillRect(4, 0, 1, 5);
    g.fillRect(12, 6, 1, 5);
    g.fillRect(6, 12, 1, 4);
    g.fillStyle(0x2a2a2a);
    g.fillRect(0, 14, 16, 2);
    g.fillStyle(0x484848);
    g.fillRect(1, 1, 2, 3);
    g.fillRect(6, 7, 5, 3);
    g.generateTexture('stone-wall-face', 16, 16);

    g.clear();
    g.fillStyle(0x5a1828);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0xc9a66b);
    const diamondCenters = [[4, 4], [12, 4], [4, 12], [12, 12]];
    for (const [dx, dy] of diamondCenters) {
      g.fillRect(dx, dy - 2, 1, 1);
      g.fillRect(dx - 2, dy, 1, 1);
      g.fillRect(dx + 2, dy, 1, 1);
      g.fillRect(dx, dy + 2, 1, 1);
      g.fillRect(dx - 1, dy - 1, 1, 1);
      g.fillRect(dx + 1, dy - 1, 1, 1);
      g.fillRect(dx - 1, dy + 1, 1, 1);
      g.fillRect(dx + 1, dy + 1, 1, 1);
    }
    g.fillRect(4, 0, 1, 2);
    g.fillRect(4, 14, 1, 2);
    g.fillRect(12, 0, 1, 2);
    g.fillRect(12, 14, 1, 2);
    g.fillRect(0, 4, 2, 1);
    g.fillRect(14, 4, 2, 1);
    g.fillRect(0, 12, 2, 1);
    g.fillRect(14, 12, 2, 1);
    g.fillRect(6, 4, 4, 1);
    g.fillRect(6, 12, 4, 1);
    g.fillRect(4, 6, 1, 4);
    g.fillRect(12, 6, 1, 4);
    g.fillStyle(0x3a0818);
    g.fillRect(2, 7, 1, 1);
    g.fillRect(9, 3, 1, 1);
    g.fillRect(14, 10, 1, 1);
    g.generateTexture('casino-carpet-a', 16, 16);

    g.clear();
    g.fillStyle(0x4a1020);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0xc9a66b);
    const accentDiamonds = [[4, 4], [12, 4], [4, 12]];
    for (const [dx, dy] of accentDiamonds) {
      g.fillRect(dx, dy - 2, 1, 1);
      g.fillRect(dx - 2, dy, 1, 1);
      g.fillRect(dx + 2, dy, 1, 1);
      g.fillRect(dx, dy + 2, 1, 1);
      g.fillRect(dx - 1, dy - 1, 1, 1);
      g.fillRect(dx + 1, dy - 1, 1, 1);
      g.fillRect(dx - 1, dy + 1, 1, 1);
      g.fillRect(dx + 1, dy + 1, 1, 1);
    }
    g.fillRect(11, 10, 3, 1);
    g.fillRect(12, 11, 1, 2);
    g.fillRect(10, 11, 1, 2);
    g.fillRect(14, 11, 1, 2);
    g.fillRect(11, 13, 3, 1);
    g.fillRect(4, 6, 1, 4);
    g.fillRect(6, 4, 4, 1);
    g.fillRect(6, 12, 4, 1);
    g.fillRect(12, 6, 1, 4);
    g.fillStyle(0x3a0818);
    g.fillRect(1, 1, 1, 1);
    g.fillRect(2, 2, 1, 1);
    g.fillRect(3, 3, 1, 1);
    g.generateTexture('casino-carpet-b', 16, 16);

    g.clear();
    g.fillStyle(0x181430);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x2d2460);
    g.fillRect(0, 0, 16, 2);
    g.fillRect(0, 14, 16, 2);
    g.fillStyle(0x4a2b72);
    g.fillRect(3, 3, 10, 10);
    g.fillStyle(0xff6aa8);
    g.fillRect(4, 4, 8, 1);
    g.fillRect(4, 11, 8, 1);
    g.fillRect(4, 5, 1, 6);
    g.fillRect(11, 5, 1, 6);
    g.fillStyle(0x7be7ff);
    g.fillRect(7, 6, 2, 2);
    g.fillRect(6, 8, 4, 1);
    g.generateTexture('crash-floor-a', 16, 16);

    g.clear();
    g.fillStyle(0x120f26);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x23346d);
    g.fillRect(0, 3, 16, 1);
    g.fillRect(0, 12, 16, 1);
    g.fillStyle(0x3d2760);
    g.fillRect(2, 2, 4, 4);
    g.fillRect(10, 2, 4, 4);
    g.fillRect(2, 10, 4, 4);
    g.fillRect(10, 10, 4, 4);
    g.fillStyle(0xff8cc4);
    g.fillRect(4, 4, 1, 1);
    g.fillRect(11, 4, 1, 1);
    g.fillRect(4, 11, 1, 1);
    g.fillRect(11, 11, 1, 1);
    g.fillStyle(0x78d8ff);
    g.fillRect(7, 7, 2, 2);
    g.generateTexture('crash-floor-b', 16, 16);

    g.clear();
    g.fillStyle(0x163624);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x29553a);
    g.fillRect(0, 0, 16, 2);
    g.fillRect(0, 7, 16, 1);
    g.fillRect(0, 14, 16, 2);
    g.fillStyle(0x406f50);
    g.fillRect(4, 3, 8, 1);
    g.fillRect(2, 10, 12, 1);
    g.fillStyle(0xb8904b);
    g.fillRect(2, 2, 1, 1);
    g.fillRect(13, 4, 1, 1);
    g.fillRect(5, 12, 1, 1);
    g.generateTexture('parlor-floor-a', 16, 16);

    g.clear();
    g.fillStyle(0x11301f);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x8f6e36);
    g.fillRect(0, 4, 16, 1);
    g.fillRect(0, 11, 16, 1);
    g.fillRect(4, 0, 1, 16);
    g.fillRect(11, 0, 1, 16);
    g.fillStyle(0x1f4c33);
    g.fillRect(1, 1, 3, 3);
    g.fillRect(12, 1, 3, 3);
    g.fillRect(1, 12, 3, 3);
    g.fillRect(12, 12, 3, 3);
    g.fillStyle(0xd2b06d);
    g.fillRect(7, 7, 2, 2);
    g.generateTexture('parlor-floor-b', 16, 16);

    // Lobby table: coin + dice laid out to sell the floor 1 minigames.
    g.clear();
    g.fillStyle(0xc9a66b);
    g.fillRect(0, 0, 48, 32);
    g.fillStyle(0x8a7448);
    g.fillRect(1, 1, 46, 30);
    g.fillStyle(0x1a5a2a);
    g.fillRect(2, 2, 44, 28);
    g.fillStyle(0xc9a66b);
    g.fillRect(12, 8, 24, 2);
    g.fillRect(14, 6, 20, 2);
    g.fillRect(18, 4, 12, 2);
    g.fillRect(20, 3, 8, 1);
    g.fillStyle(0xffd878);
    g.fillCircle(14, 20, 5);
    g.fillStyle(0x7a4e18);
    g.fillRect(13, 17, 2, 6);
    g.fillRect(11, 19, 6, 2);
    g.fillStyle(0xf5eeda);
    g.fillRect(25, 16, 7, 7);
    g.fillRect(33, 14, 7, 7);
    g.fillStyle(0xc9a66b);
    g.fillRect(25, 16, 7, 1);
    g.fillRect(25, 22, 7, 1);
    g.fillRect(33, 14, 7, 1);
    g.fillRect(33, 20, 7, 1);
    g.fillStyle(0x2e1b00);
    g.fillRect(27, 18, 1, 1);
    g.fillRect(30, 18, 1, 1);
    g.fillRect(28, 21, 1, 1);
    g.fillRect(35, 16, 1, 1);
    g.fillRect(38, 16, 1, 1);
    g.fillRect(35, 19, 1, 1);
    g.fillRect(38, 19, 1, 1);
    g.fillStyle(0xc94a3a);
    g.fillRect(4, 24, 5, 2);
    g.fillRect(5, 22, 4, 2);
    g.fillRect(39, 24, 5, 2);
    g.fillRect(39, 22, 4, 2);
    g.fillStyle(0x000000);
    g.fillRect(0, 30, 48, 2);
    g.generateTexture('table-lobby', 48, 32);

    // Crash table: monitor-like betting station with chart spike and cash-out strips.
    g.clear();
    g.fillStyle(0xe2b95f);
    g.fillRect(0, 0, 48, 32);
    g.fillStyle(0x69442d);
    g.fillRect(1, 1, 46, 30);
    g.fillStyle(0x131b36);
    g.fillRect(2, 2, 44, 28);
    g.fillStyle(0x27c9ff);
    g.fillRect(6, 8, 26, 11);
    g.fillStyle(0x081223);
    g.fillRect(7, 9, 24, 9);
    g.fillStyle(0xff5e9c);
    g.fillRect(10, 15, 4, 1);
    g.fillRect(14, 14, 4, 1);
    g.fillRect(18, 12, 4, 1);
    g.fillRect(22, 10, 4, 1);
    g.fillRect(26, 8, 3, 1);
    g.fillStyle(0x7be7ff);
    g.fillRect(10, 11, 1, 5);
    g.fillRect(10, 15, 18, 1);
    g.fillStyle(0x30204f);
    g.fillRect(34, 8, 8, 4);
    g.fillRect(34, 14, 8, 4);
    g.fillStyle(0xffd878);
    g.fillRect(35, 9, 6, 2);
    g.fillRect(35, 15, 6, 2);
    g.fillStyle(0xaa3366);
    g.fillRect(6, 22, 15, 4);
    g.fillRect(27, 22, 15, 4);
    g.fillStyle(0xf5eeda);
    g.fillRect(10, 23, 7, 2);
    g.fillRect(31, 23, 7, 2);
    g.fillStyle(0x000000);
    g.fillRect(0, 30, 48, 2);
    g.generateTexture('table-crash', 48, 32);

    // Blackjack table: cards and betting spots laid out for the actual game.
    g.clear();
    g.fillStyle(0xc9a66b);
    g.fillRect(0, 0, 48, 32);
    g.fillStyle(0x8a7448);
    g.fillRect(1, 1, 46, 30);
    g.fillStyle(0x17452b);
    g.fillRect(2, 2, 44, 28);
    g.fillStyle(0xc9a66b);
    g.fillRect(12, 8, 24, 2);
    g.fillRect(14, 6, 20, 2);
    g.fillRect(18, 4, 12, 2);
    g.fillRect(20, 3, 8, 1);
    g.fillStyle(0xd8c58a);
    g.fillRect(8, 22, 8, 1);
    g.fillRect(20, 22, 8, 1);
    g.fillRect(32, 22, 8, 1);
    g.fillStyle(0xf5eeda);
    g.fillRect(10, 13, 6, 8);
    g.fillRect(16, 14, 6, 8);
    g.fillRect(28, 11, 6, 8);
    g.fillRect(34, 12, 6, 8);
    g.fillStyle(0xc9a66b);
    g.fillRect(10, 13, 6, 1);
    g.fillRect(16, 14, 6, 1);
    g.fillRect(28, 11, 6, 1);
    g.fillRect(34, 12, 6, 1);
    g.fillStyle(0xc94a3a);
    g.fillRect(12, 16, 2, 2);
    g.fillRect(18, 17, 2, 2);
    g.fillStyle(0xff5e9c);
    g.fillRect(30, 14, 2, 2);
    g.fillRect(36, 15, 2, 2);
    g.fillStyle(0xe2b95f);
    g.fillRect(5, 24, 4, 2);
    g.fillRect(6, 22, 3, 2);
    g.fillRect(39, 24, 4, 2);
    g.fillRect(39, 22, 3, 2);
    g.fillStyle(0x000000);
    g.fillRect(0, 30, 48, 2);
    g.generateTexture('table-blackjack', 48, 32);

    g.clear();
    g.fillStyle(0x1a1a1a);
    g.fillRect(0, 0, 16, 32);
    g.fillStyle(0xc9a66b);
    g.fillRect(1, 1, 14, 3);
    g.fillStyle(0x8a6a38);
    g.fillRect(1, 3, 14, 1);
    g.fillStyle(0x1a0a0a);
    g.fillRect(3, 4, 11, 11);
    const reelX = [4, 8, 12];
    for (const rx of reelX) {
      g.fillStyle(0x2a1010);
      g.fillRect(rx, 6, 3, 7);
      g.fillStyle(0xc94a3a);
      g.fillRect(rx, 6, 3, 1);
      g.fillRect(rx + 2, 7, 1, 2);
      g.fillRect(rx + 1, 9, 2, 1);
      g.fillRect(rx, 10, 1, 2);
    }
    g.fillStyle(0xc9a66b);
    g.fillRect(1, 15, 14, 12);
    g.fillStyle(0xa07830);
    g.fillRect(3, 17, 10, 8);
    g.fillStyle(0x3a2010);
    g.fillRect(1, 27, 14, 4);
    g.fillStyle(0xc9a66b);
    g.fillRect(4, 28, 3, 1);
    g.fillRect(9, 29, 3, 1);
    g.fillStyle(0xc94a3a);
    g.fillRect(13, 8, 2, 10);
    g.fillRect(12, 7, 3, 2);
    g.generateTexture('slot-machine', 16, 32);

    g.destroy();
  }
}
