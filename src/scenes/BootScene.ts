import { Scene } from 'phaser';

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

    this._generateTextures();
  }

  private _generateTextures(): void {
    const g = this.add.graphics();

    // ── floor-tile: 16×16 dark warm stone base #2a2420 with speckle ──
    g.clear();
    g.fillStyle(0x2a2420);
    g.fillRect(0, 0, 16, 16);
    const speckles = [0x332820, 0x251e1a, 0x30251f];
    for (let i = 0; i < 8; i++) {
      g.fillStyle(speckles[i % speckles.length]);
      g.fillRect((i * 7 + 1) % 14, (i * 5 + 2) % 14, 2, 2);
    }
    g.generateTexture('floor-tile', 16, 16);

    // ── wall-tile: 16×16 darker wall #151015 with vertical stripes ──
    g.clear();
    g.fillStyle(0x151015);
    g.fillRect(0, 0, 16, 16);
    for (let x = 0; x < 16; x += 4) {
      g.fillStyle(0x1a141a);
      g.fillRect(x, 0, 2, 16);
    }
    g.fillStyle(0x201820);
    g.fillRect(0, 0, 16, 1);
    g.generateTexture('wall-tile', 16, 16);

    // ── door-closed: 16×16 brown door with dark outline ──
    g.clear();
    g.fillStyle(0x6a4a2a);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x2a1a0a);
    g.fillRect(0, 0, 16, 1);
    g.fillRect(0, 15, 16, 1);
    g.fillRect(0, 0, 1, 16);
    g.fillRect(15, 0, 1, 16);
    g.fillStyle(0x7a5a3a);
    g.fillRect(3, 3, 10, 10);
    g.fillStyle(0x5a3a1a);
    g.fillRect(6, 3, 1, 10);
    g.fillRect(3, 7, 10, 1);
    g.generateTexture('door-closed', 16, 16);

    // ── door-open: floor color with black interior ──
    g.clear();
    g.fillStyle(0x2a2420);
    g.fillRect(0, 0, 16, 16);
    g.fillStyle(0x000000);
    g.fillRect(2, 2, 12, 12);
    g.fillStyle(0x4a3828);
    g.fillRect(0, 0, 16, 2);
    g.fillRect(0, 14, 16, 2);
    g.fillRect(0, 0, 2, 16);
    g.fillRect(14, 0, 2, 16);
    g.generateTexture('door-open', 16, 16);

    // ── stairs-locked: grey locked stairs ──
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

    // ── stairs-open: gold glowing stairs ──
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

    // ── character: 16×16 top-down character (skin body, dark hat) ──
    g.clear();
    // body
    g.fillStyle(0xc8956c);
    g.fillRect(5, 6, 6, 8);
    // head
    g.fillStyle(0xc8956c);
    g.fillRect(5, 2, 6, 5);
    // hat
    g.fillStyle(0x222222);
    g.fillRect(4, 1, 8, 2);
    g.fillRect(5, 0, 6, 2);
    // eyes
    g.fillStyle(0x333333);
    g.fillRect(6, 4, 1, 1);
    g.fillRect(9, 4, 1, 1);
    // arms
    g.fillStyle(0xc8956c);
    g.fillRect(3, 7, 2, 4);
    g.fillRect(11, 7, 2, 4);
    // legs
    g.fillStyle(0x334466);
    g.fillRect(5, 14, 2, 2);
    g.fillRect(9, 14, 2, 2);
    g.generateTexture('character', 16, 16);

    g.destroy();
  }

  create(): void {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('DungeonScene', { floor: 1 });
    });
  }
}
