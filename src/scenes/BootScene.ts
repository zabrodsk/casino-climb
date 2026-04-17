import { Scene } from 'phaser';

export class BootScene extends Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0, 0);
    this.add
      .text(width / 2, height / 2, 'Loading...', {
        fontSize: '24px',
        color: '#ffffff',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    this.load.image('dungeon-tiles', 'assets/tilemaps/dungeon_tileset.png');
    this.load.spritesheet('player', 'assets/sprites/dude.png', {
      frameWidth: 32,
      frameHeight: 48,
    });
  }

  create(): void {
    this.anims.create({
      key: 'player-idle',
      frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1,
    });

    this.anims.create({
      key: 'player-walk',
      frames: this.anims.generateFrameNumbers('player', { start: 4, end: 8 }),
      frameRate: 10,
      repeat: -1,
    });

    this.generateFallbackTextures();
    this.scene.start('MenuScene');
  }

  private generateFallbackTextures(): void {
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

    g.destroy();
  }
}
