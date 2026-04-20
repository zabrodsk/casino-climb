import { Scene, GameObjects } from 'phaser';
import { AudioManager } from '../audio/AudioManager';

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
    this.load.image('fate-slot-row', 'assets/sprites/slot-machine-row.png');
    this.load.image('table-dice-art', 'assets/sprites/dice-table-art.png');
    this.load.image('table-blackjack-art', 'assets/sprites/blackjack-table-art.png');
    this.load.image('table-roulette-art', 'assets/sprites/roulette-table.png');

    AudioManager.preload(this);

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
      frameRate: 4,
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

    AudioManager.init(this);

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MenuScene');
    });
  }

  /**
   * Draw one 32x48 frame of a street-worn gambler sprite at world offset (ox, oy).
   * frameIdx 0-3 = idle (breathing bob), 4-8 = walk cycle (leg alternation).
   */
  private _drawPlayerFrame(g: GameObjects.Graphics, ox: number, oy: number, frameIdx: number): void {
    const idle = frameIdx <= 3;
    const breath = idle && (frameIdx === 1 || frameIdx === 3) ? 1 : 0;
    const headDip = idle && frameIdx === 2 ? 1 : 0;
    const walkBob = !idle && (frameIdx === 5 || frameIdx === 7) ? 1 : 0;
    const baseY = oy + walkBob;
    const upperY = baseY + breath;

    const cx = ox + 16;

    const skin = 0xdfc7b1;
    const skinShade = 0xbd9a80;
    const hairDark = 0x703c20;
    const hairMid = 0x975f33;
    const hairLight = 0xb17949;
    const shirtDark = 0x4a4f56;
    const shirtMid = 0x616770;
    const shirtLight = 0x7e8791;
    const shirtHighlight = 0x949da8;
    const grimeDark = 0x4f453a;
    const seam = 0x565c65;
    const dirt = 0x6e5a44;
    const pants = 0x2b2a2d;
    const pantsShade = 0x3a393d;
    const belt = 0x6d4727;
    const shoe = 0x2a1f19;

    const armSwing = !idle && frameIdx === 5 ? 1 : !idle && frameIdx === 7 ? -1 : 0;
    const legSwing = armSwing;

    // Head (large chibi head with messy brown hair)
    const headTop = upperY + 5 + headDip;
    g.fillStyle(hairDark);
    g.fillRect(cx - 7, headTop, 14, 2);
    g.fillRect(cx - 8, headTop + 2, 16, 2);
    g.fillStyle(hairMid);
    g.fillRect(cx - 6, headTop + 1, 4, 2);
    g.fillRect(cx + 1, headTop + 1, 4, 2);
    g.fillRect(cx - 1, headTop + 3, 4, 2);
    g.fillStyle(hairLight);
    g.fillRect(cx - 4, headTop + 1, 2, 1);
    g.fillRect(cx + 2, headTop + 2, 2, 1);
    g.fillRect(cx - 1, headTop + 2, 1, 1);
    g.fillRect(cx + 4, headTop + 3, 1, 1);
    g.fillStyle(hairDark);
    g.fillRect(cx - 8, headTop + 4, 2, 4);
    g.fillRect(cx + 6, headTop + 4, 2, 4);
    g.fillRect(cx - 2, headTop + 4, 1, 3);

    g.fillStyle(skin);
    g.fillRect(cx - 7, headTop + 4, 14, 10);
    g.fillStyle(skinShade);
    g.fillRect(cx - 7, headTop + 13, 14, 1);
    g.fillRect(cx - 2, headTop + 10, 4, 1); // nose/lip shade

    // Friendlier facial detail
    g.fillStyle(0x2f2721);
    g.fillRect(cx - 3, headTop + 8, 1, 1);
    g.fillRect(cx + 2, headTop + 8, 1, 1);
    g.fillStyle(0xcdad93);
    g.fillRect(cx - 5, headTop + 9, 1, 1);
    g.fillRect(cx + 4, headTop + 9, 1, 1);
    g.fillStyle(0x8b6e5a);
    g.fillRect(cx - 1, headTop + 11, 2, 1); // soft smile
    g.fillStyle(0x7a604f);
    g.fillRect(cx - 2, headTop + 12, 4, 1);

    // Neck — height 3 so it meets torsoTop (upperY+22) with no gap
    g.fillStyle(skin);
    g.fillRect(cx - 2, headTop + 14, 4, 3);
    g.fillStyle(skinShade);
    g.fillRect(cx - 2, headTop + 15, 4, 2);

    // Body: reference-like shirt silhouette, but old/dirty gray shirt
    const torsoTop = upperY + 22;
    g.fillStyle(shirtDark);
    g.fillRect(cx - 7, torsoTop, 14, 2);
    g.fillStyle(shirtMid);
    g.fillRect(cx - 6, torsoTop + 1, 12, 1);
    g.fillStyle(shirtMid);
    g.fillRect(cx - 7, torsoTop + 2, 14, 10);
    g.fillStyle(shirtLight);
    g.fillRect(cx - 6, torsoTop + 3, 12, 8);
    g.fillStyle(shirtHighlight);
    g.fillRect(cx - 5, torsoTop + 4, 2, 6);
    g.fillRect(cx + 2, torsoTop + 4, 2, 5);

    // Collar
    g.fillStyle(shirtDark);
    g.fillRect(cx - 3, torsoTop + 2, 2, 2);
    g.fillRect(cx + 1, torsoTop + 2, 2, 2);
    g.fillStyle(shirtMid);
    g.fillRect(cx - 1, torsoTop + 3, 2, 1);

    // Dirt/stains/wear
    g.fillStyle(dirt);
    g.fillRect(cx - 4, torsoTop + 5, 2, 2);
    g.fillRect(cx + 2, torsoTop + 7, 1, 2);
    g.fillRect(cx - 1, torsoTop + 9, 2, 1);
    g.fillStyle(grimeDark);
    g.fillRect(cx - 6, torsoTop + 10, 2, 1);
    g.fillRect(cx + 3, torsoTop + 9, 2, 1);

    // Shirt seams/creases
    g.fillStyle(seam);
    g.fillRect(cx - 1, torsoTop + 4, 1, 6);
    g.fillRect(cx - 2, torsoTop + 7, 1, 2);
    g.fillRect(cx + 1, torsoTop + 6, 1, 2);

    // Sleeves/arms (short swing)
    const leftArmTop = torsoTop + 8 + armSwing;
    const rightArmTop = torsoTop + 8 - armSwing;
    g.fillStyle(shirtMid);
    g.fillRect(cx - 8, leftArmTop, 2, 5);
    g.fillRect(cx + 6, rightArmTop, 2, 5);
    g.fillStyle(shirtDark);
    g.fillRect(cx - 8, leftArmTop + 4, 2, 1);
    g.fillRect(cx + 6, rightArmTop + 4, 2, 1);
    g.fillStyle(skin);
    g.fillRect(cx - 8, leftArmTop + 5, 2, 2);
    g.fillRect(cx + 6, rightArmTop + 5, 2, 2);

    // Belt and pants
    // Keep waist anchored to baseY so idle breathing does not lift legs.
    const waistY = baseY + 34;
    g.fillStyle(belt);
    g.fillRect(cx - 6, waistY, 12, 1);
    g.fillStyle(pants);
    g.fillRect(cx - 6, waistY + 1, 12, 6);
    g.fillStyle(pantsShade);
    g.fillRect(cx - 5, waistY + 2, 3, 4);
    g.fillRect(cx + 2, waistY + 2, 2, 4);
    g.fillStyle(0x222225);
    g.fillRect(cx - 1, waistY + 3, 2, 4);

    // Legs
    let leftLegX = cx - 4;
    let rightLegX = cx + 1;
    let leftLegY = waistY + 7;
    let rightLegY = waistY + 7;
    let leftLegH = 4;
    let rightLegH = 4;
    if (!idle) {
      if (legSwing > 0) {
        leftLegY += 1;
        leftLegH = 3;
        rightLegY -= 1;
        rightLegH = 5;
      } else if (legSwing < 0) {
        leftLegY -= 1;
        leftLegH = 5;
        rightLegY += 1;
        rightLegH = 3;
      }
    }
    g.fillStyle(pants);
    g.fillRect(leftLegX, leftLegY, 3, leftLegH);
    g.fillRect(rightLegX, rightLegY, 3, rightLegH);

    // Shoes
    g.fillStyle(shoe);
    g.fillRect(leftLegX - 1, leftLegY + leftLegH, 4, 2);
    g.fillRect(rightLegX - 1, rightLegY + rightLegH, 4, 2);

    // Ground shadow
    g.fillStyle(0x0a0a0a, 0.3);
    g.fillEllipse(cx, oy + 46, 11, 2);
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

    g.clear();
    g.fillStyle(0x2b0f1f);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x4e1830);
    g.fillRect(0, 0, 16, 2);
    g.fillRect(0, 14, 16, 2);
    g.fillStyle(0xcfa45a);
    g.fillRect(7, 0, 2, 16);
    g.fillRect(0, 7, 16, 2);
    g.fillStyle(0xf2d187);
    g.fillRect(3, 3, 2, 2);
    g.fillRect(11, 3, 2, 2);
    g.fillRect(3, 11, 2, 2);
    g.fillRect(11, 11, 2, 2);
    g.fillStyle(0x180810);
    g.fillRect(1, 5, 1, 1);
    g.fillRect(13, 9, 1, 1);
    g.fillRect(5, 13, 1, 1);
    g.generateTexture('poker-floor-a', 16, 16);

    g.clear();
    g.fillStyle(0x220b18);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x5e223a);
    g.fillRect(0, 4, 16, 1);
    g.fillRect(0, 11, 16, 1);
    g.fillRect(4, 0, 1, 16);
    g.fillRect(11, 0, 1, 16);
    g.fillStyle(0xd9b86d);
    g.fillRect(7, 7, 2, 2);
    g.fillRect(1, 1, 2, 2);
    g.fillRect(13, 1, 2, 2);
    g.fillRect(1, 13, 2, 2);
    g.fillRect(13, 13, 2, 2);
    g.fillStyle(0x12050b);
    g.fillRect(2, 8, 1, 1);
    g.fillRect(8, 2, 1, 1);
    g.fillRect(12, 9, 1, 1);
    g.generateTexture('poker-floor-b', 16, 16);

    g.clear();
    g.fillStyle(0x1b2028);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x303846);
    g.fillRect(0, 0, 16, 2);
    g.fillRect(0, 14, 16, 2);
    g.fillStyle(0x86a1be);
    g.fillRect(2, 4, 12, 1);
    g.fillRect(2, 11, 12, 1);
    g.fillRect(4, 2, 1, 12);
    g.fillRect(11, 2, 1, 12);
    g.fillStyle(0xc8d7e8);
    g.fillRect(7, 7, 2, 2);
    g.fillRect(1, 1, 2, 2);
    g.fillRect(13, 13, 2, 2);
    g.fillStyle(0x0c0f14);
    g.fillRect(3, 8, 1, 1);
    g.fillRect(12, 5, 1, 1);
    g.generateTexture('vault-floor-a', 16, 16);

    g.clear();
    g.fillStyle(0x151a21);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x475567);
    g.fillRect(0, 7, 16, 2);
    g.fillRect(7, 0, 2, 16);
    g.fillStyle(0xa9bdd1);
    g.fillRect(1, 1, 2, 2);
    g.fillRect(13, 1, 2, 2);
    g.fillRect(1, 13, 2, 2);
    g.fillRect(13, 13, 2, 2);
    g.fillStyle(0xd9e6f2);
    g.fillRect(7, 7, 2, 2);
    g.fillStyle(0x090d12);
    g.fillRect(5, 5, 1, 1);
    g.fillRect(10, 10, 1, 1);
    g.generateTexture('vault-floor-b', 16, 16);

    // Lobby table: generate fallback only when a custom texture was not preloaded.
    if (!this.textures.exists('table-lobby')) {
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
    }

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

    // Fate floor tiles: deep void-purple with faint arcane specks
    g.clear();
    g.fillStyle(0x0d0018);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x1a0830);
    g.fillRect(0, 0, 16, 1);
    g.fillRect(0, 8, 16, 1);
    g.fillRect(8, 0, 1, 16);
    g.fillStyle(0xcc88ff);
    g.fillRect(3, 3, 1, 1);
    g.fillRect(12, 11, 1, 1);
    g.fillRect(7, 14, 1, 1);
    g.generateTexture('fate-floor-a', 16, 16);

    g.clear();
    g.fillStyle(0x10051e);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x200840);
    g.fillRect(0, 7, 16, 2);
    g.fillRect(7, 0, 2, 16);
    g.fillStyle(0x8844cc);
    g.fillRect(1, 1, 1, 1);
    g.fillRect(14, 1, 1, 1);
    g.fillRect(1, 14, 1, 1);
    g.fillRect(14, 14, 1, 1);
    g.fillStyle(0xffd700);
    g.fillRect(7, 7, 2, 2);
    g.generateTexture('fate-floor-b', 16, 16);

    // Wheel of Fate table: wheel-only motif (no enclosing frame) for dungeon preview
    g.clear();
    g.fillStyle(0xffdf8a);
    g.fillCircle(24, 16, 12);
    g.fillStyle(0xa85a1e);
    g.fillCircle(24, 16, 11);

    // Outer ring wedges (purple/red)
    g.fillStyle(0x9f4ec6);
    g.fillRect(17, 6, 6, 4);
    g.fillRect(12, 11, 4, 5);
    g.fillRect(20, 22, 6, 3);
    g.fillRect(29, 20, 5, 4);
    g.fillStyle(0xc22657);
    g.fillRect(24, 6, 6, 4);
    g.fillRect(9, 16, 4, 4);
    g.fillRect(15, 21, 4, 3);
    g.fillRect(31, 11, 4, 4);

    // Inner green wheel and spokes
    g.fillStyle(0x30c975);
    g.fillCircle(24, 16, 6);
    g.fillStyle(0xffc74f);
    g.fillRect(24, 10, 1, 12);
    g.fillRect(18, 16, 12, 1);
    g.fillRect(20, 12, 1, 8);
    g.fillRect(28, 12, 1, 8);

    g.fillStyle(0xeef6ff);
    g.fillCircle(24, 16, 3);
    g.fillStyle(0xf5b133);
    g.fillRect(23, 15, 2, 2);

    // Top pointer
    g.fillStyle(0xffd35b);
    g.fillRect(23, 3, 3, 4);
    g.fillRect(22, 4, 5, 2);

    // Jewel dots on rim
    g.fillStyle(0x29d087);
    g.fillRect(10, 9, 2, 2);
    g.fillRect(36, 10, 2, 2);
    g.fillRect(12, 22, 2, 2);
    g.fillRect(35, 21, 2, 2);

    // Base
    g.fillStyle(0x6f2a14);
    g.fillRect(10, 26, 28, 3);
    g.fillStyle(0xe0a242);
    g.fillRect(16, 27, 16, 2);
    g.generateTexture('table-wheel', 48, 32);

    g.clear();
    g.fillStyle(0xefe5cf);
    g.fillCircle(12, 12, 11);
    g.fillStyle(0xbf2542);
    g.fillCircle(12, 12, 9);
    g.fillStyle(0xf7edd7);
    g.fillCircle(12, 12, 6);
    g.fillStyle(0xbf2542);
    g.fillCircle(12, 12, 4);
    g.fillStyle(0xf7edd7);
    g.fillRect(11, 4, 2, 16);
    g.fillRect(4, 11, 16, 2);
    g.generateTexture('poker-chip-safe', 24, 24);

    g.clear();
    g.fillStyle(0xf7f0de);
    g.fillRoundedRect(0, 0, 18, 12, 2);
    g.lineStyle(1, 0xb99a68, 1);
    g.strokeRoundedRect(0.5, 0.5, 17, 11, 2);
    g.fillStyle(0xb72d41);
    g.fillRect(2, 2, 4, 4);
    g.fillRect(12, 6, 4, 4);
    g.fillStyle(0x7d1f2f);
    g.fillRect(3, 3, 2, 2);
    g.fillRect(13, 7, 2, 2);
    g.fillStyle(0xd8bf86);
    g.fillRect(8, 2, 2, 8);
    g.generateTexture('poker-card-red', 18, 12);

    g.clear();
    g.fillStyle(0xf7f0de);
    g.fillRoundedRect(0, 0, 18, 12, 2);
    g.lineStyle(1, 0xb99a68, 1);
    g.strokeRoundedRect(0.5, 0.5, 17, 11, 2);
    g.fillStyle(0x24242c);
    g.fillRect(2, 2, 4, 4);
    g.fillRect(12, 6, 4, 4);
    g.fillStyle(0x0f0f14);
    g.fillRect(3, 3, 2, 2);
    g.fillRect(13, 7, 2, 2);
    g.fillStyle(0xd8bf86);
    g.fillRect(8, 2, 2, 8);
    g.generateTexture('poker-card-black', 18, 12);

    g.clear();
    g.fillStyle(0xb6c7db);
    g.fillRect(0, 0, 48, 32);
    g.fillStyle(0x4d5a69);
    g.fillRect(1, 1, 46, 30);
    g.fillStyle(0x0e1319);
    g.fillRect(2, 2, 44, 28);
    g.fillStyle(0x9fb7d0);
    g.fillRect(6, 6, 36, 2);
    g.fillRect(6, 24, 36, 2);
    g.fillStyle(0x2c3641);
    g.fillRect(10, 10, 28, 12);
    g.fillStyle(0xdde8f4);
    g.fillRect(12, 12, 24, 2);
    g.fillRect(12, 18, 24, 2);
    g.fillStyle(0xa7c2dc);
    g.fillRect(22, 8, 4, 16);
    g.fillStyle(0xe4c56d);
    g.fillRect(21, 13, 6, 6);
    g.fillStyle(0x0a0d12);
    g.fillRect(0, 30, 48, 2);
    g.generateTexture('table-vault', 48, 32);

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

    // Roulette table: mini wheel + felt betting layout motif
    g.clear();
    // Green felt base
    g.fillStyle(0x0d5a2e);
    g.fillRect(0, 0, 48, 32);
    g.fillStyle(0x0a4a26);
    g.fillRect(1, 1, 46, 30);
    // Mahogany rim
    g.fillStyle(0x5a2510);
    g.fillRect(0, 0, 48, 2);
    g.fillRect(0, 30, 48, 2);
    g.fillRect(0, 0, 2, 32);
    g.fillRect(46, 0, 2, 32);
    g.fillStyle(0xe0a242);
    g.fillRect(2, 2, 44, 1);
    g.fillRect(2, 29, 44, 1);
    // Wheel disc on the left
    g.fillStyle(0x6a4a28);
    g.fillCircle(13, 16, 9);
    g.fillStyle(0x2a2a2a);
    g.fillCircle(13, 16, 8);
    // Alternating red/black pocket segments
    const pocketColors = [0xbf1d1d, 0x1a1a1a, 0xbf1d1d, 0x1a1a1a, 0xbf1d1d, 0x1a1a1a, 0xbf1d1d, 0x1a1a1a];
    for (let i = 0; i < pocketColors.length; i += 1) {
      const a = (i / pocketColors.length) * Math.PI * 2;
      const cx = 13 + Math.cos(a) * 5;
      const cy = 16 + Math.sin(a) * 5;
      g.fillStyle(pocketColors[i]);
      g.fillRect(Math.round(cx), Math.round(cy), 2, 2);
    }
    // Green zero at top
    g.fillStyle(0x1d8a3a);
    g.fillRect(12, 10, 2, 2);
    // Hub
    g.fillStyle(0xe0a242);
    g.fillCircle(13, 16, 3);
    g.fillStyle(0x5a2510);
    g.fillCircle(13, 16, 1);
    // Hub crossbar (silver)
    g.fillStyle(0xd0d4d8);
    g.fillRect(9, 15, 8, 1);
    g.fillRect(12, 12, 2, 8);
    // Ball
    g.fillStyle(0xf7edd7);
    g.fillRect(17, 14, 2, 2);
    // Betting grid on the right side: 3 rows x 6 cols of numbered cells
    const gridX = 24;
    const gridY = 4;
    const cellW = 3;
    const cellH = 3;
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        const number = col * 3 + row + 1;
        const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(number);
        g.fillStyle(isRed ? 0x8f1818 : 0x1a1a1a);
        g.fillRect(gridX + col * (cellW + 1), gridY + row * (cellH + 1), cellW, cellH);
      }
    }
    // Outside bets row
    g.fillStyle(0x8f1818);
    g.fillRect(24, 20, 5, 3);
    g.fillStyle(0x1a1a1a);
    g.fillRect(30, 20, 5, 3);
    g.fillStyle(0xe0a242);
    g.fillRect(36, 20, 5, 3); // gold "ODD/EVEN" marker
    g.fillStyle(0xf3e3b6);
    g.fillRect(24, 25, 17, 2); // racetrack accent
    g.generateTexture('table-roulette', 48, 32);

    // Larger playable slot machine for the Room of Fate (32x32)
    g.clear();
    // Cabinet
    g.fillStyle(0x1a1a1a);
    g.fillRect(0, 0, 32, 32);
    // Brass top
    g.fillStyle(0xe0a242);
    g.fillRect(2, 1, 28, 4);
    g.fillStyle(0x8a6a38);
    g.fillRect(2, 5, 28, 1);
    // Marquee jewel
    g.fillStyle(0xc94a3a);
    g.fillRect(14, 2, 4, 2);
    g.fillStyle(0xffdf6a);
    g.fillRect(15, 2, 2, 1);
    // Reel window
    g.fillStyle(0x0a0a0a);
    g.fillRect(4, 8, 24, 10);
    g.fillStyle(0xefe5cf);
    g.fillRect(5, 9, 22, 8);
    // Three reel slots with simple symbols
    const reelsX = [6, 13, 20];
    for (let i = 0; i < reelsX.length; i += 1) {
      const rx = reelsX[i];
      g.fillStyle(0xfaf3df);
      g.fillRect(rx, 10, 6, 6);
      if (i === 0) {
        g.fillStyle(0xc22657);
        g.fillCircle(rx + 3, 13, 2);
      } else if (i === 1) {
        g.fillStyle(0xe0a242);
        g.fillRect(rx + 1, 11, 4, 4);
        g.fillStyle(0xffdf6a);
        g.fillRect(rx + 2, 12, 2, 2);
      } else {
        g.fillStyle(0x1a1a1a);
        g.fillRect(rx + 1, 11, 4, 1);
        g.fillRect(rx + 1, 13, 4, 1);
        g.fillRect(rx + 1, 15, 4, 0.5 + 0.5);
      }
    }
    // Payline stripe
    g.fillStyle(0xc94a3a);
    g.fillRect(5, 13, 22, 1);
    // Coin tray
    g.fillStyle(0x8a6a38);
    g.fillRect(2, 20, 28, 2);
    g.fillStyle(0x3a2010);
    g.fillRect(4, 22, 24, 8);
    g.fillStyle(0xe0a242);
    g.fillRect(6, 24, 4, 2);
    g.fillRect(13, 26, 4, 2);
    g.fillRect(20, 24, 4, 2);
    // Lever on right side
    g.fillStyle(0x6a4a28);
    g.fillRect(29, 10, 2, 10);
    g.fillStyle(0xc22657);
    g.fillCircle(30, 10, 2);
    // Base
    g.fillStyle(0x0a0a0a);
    g.fillRect(0, 30, 32, 2);
    g.generateTexture('slot-machine-big', 32, 32);

    g.clear();
    g.fillStyle(0xffffff);
    g.fillCircle(4, 4, 4);
    g.generateTexture('particle-dot', 8, 8);

    g.destroy();
  }
}
