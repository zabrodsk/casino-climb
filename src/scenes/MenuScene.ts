import { Scene, GameObjects } from 'phaser';

type MenuAction = 'play' | 'settings';

export class MenuScene extends Scene {
  private settingsPanel?: GameObjects.Container;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x120819);

    this.drawBackdrop();
    this.drawCasinoFacade();
    this.drawTitle();
    this.createActionButton(512, 520, 270, 62, 'PLAY', 'play');
    this.createActionButton(512, 598, 270, 62, 'SETTINGS', 'settings');
    this.createSettingsPanel();

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.settingsPanel?.visible) {
        this.settingsPanel.setVisible(false);
      }
    });
  }

  private drawBackdrop(): void {
    const g = this.add.graphics();

    g.fillStyle(0x120819, 1);
    g.fillRect(0, 0, 1024, 768);

    g.fillStyle(0x271537, 1);
    g.fillRect(0, 442, 1024, 326);

    for (let y = 442; y < 768; y += 12) {
      for (let x = 0; x < 1024; x += 18) {
        const checker = ((x / 18) + (y / 12)) % 2 === 0;
        g.fillStyle(checker ? 0x321f41 : 0x2a1a35, 1);
        g.fillRect(x, y, 18, 12);
      }
    }

    const moon = this.add.graphics();
    moon.fillStyle(0xf9d98b, 1);
    moon.fillRect(112, 78, 58, 58);
    moon.fillStyle(0xe2bc68, 1);
    moon.fillRect(118, 84, 46, 46);
    moon.fillStyle(0x8f6b35, 1);
    moon.fillRect(125, 91, 32, 32);
  }

  private drawCasinoFacade(): void {
    const g = this.add.graphics();

    this.drawBuilding(g, 96, 174, 248, 258, 0x2e1f3d, 0x4d325f);
    this.drawBuilding(g, 358, 142, 308, 290, 0x2b1c37, 0x412a50);
    this.drawBuilding(g, 680, 174, 248, 258, 0x301f3f, 0x503468);

    g.fillStyle(0x6a2a73, 1);
    g.fillRect(344, 184, 336, 56);

    const sign = this.add.text(512, 212, 'CASINO', {
      fontFamily: 'monospace',
      fontSize: '52px',
      color: '#ff89bf',
      stroke: '#ff327b',
      strokeThickness: 10,
    });
    sign.setOrigin(0.5);

    this.tweens.add({
      targets: sign,
      alpha: { from: 0.86, to: 1 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.addMarqueeLights();
    this.drawChipStacks(g);
  }

  private drawBuilding(
    g: GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    bodyColor: number,
    topColor: number
  ): void {
    g.fillStyle(bodyColor, 1);
    g.fillRect(x, y, width, height);

    g.fillStyle(topColor, 1);
    g.fillRect(x + 8, y + 8, width - 16, 20);

    const cols = Math.floor((width - 20) / 24);
    const rows = Math.floor((height - 60) / 28);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const lit = (row + col) % 3 !== 0;
        g.fillStyle(lit ? 0xffd07a : 0x3a2720, 1);
        g.fillRect(x + 10 + (col * 24), y + 38 + (row * 28), 14, 12);
      }
    }
  }

  private addMarqueeLights(): void {
    const points = [352, 398, 444, 490, 536, 582, 628, 674];

    points.forEach((x, idx) => {
      const orb = this.add.rectangle(x, 244, 11, 11, 0xffd878).setOrigin(0.5);
      this.tweens.add({
        targets: orb,
        alpha: { from: 0.4, to: 1 },
        duration: 420,
        yoyo: true,
        repeat: -1,
        delay: idx * 90,
      });
    });
  }

  private drawChipStacks(g: GameObjects.Graphics): void {
    const leftX = 154;
    const rightX = 802;
    const baseY = 690;
    const colors = [0xd34368, 0xf5d363, 0x55bed0];

    colors.forEach((color, i) => {
      const y = baseY - (i * 16);
      g.fillStyle(color, 1);
      g.fillRect(leftX, y, 74, 12);
      g.fillStyle(0xfff4d2, 1);
      g.fillRect(leftX + 8, y + 2, 8, 8);
      g.fillRect(leftX + 58, y + 2, 8, 8);
    });

    [...colors].reverse().forEach((color, i) => {
      const y = baseY - (i * 16);
      g.fillStyle(color, 1);
      g.fillRect(rightX, y, 74, 12);
      g.fillStyle(0xfff4d2, 1);
      g.fillRect(rightX + 8, y + 2, 8, 8);
      g.fillRect(rightX + 58, y + 2, 8, 8);
    });
  }

  private drawTitle(): void {
    this.add
      .text(512, 92, 'THE HOUSE ALWAYS WINS', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#f7dc96',
      })
      .setOrigin(0.5);
  }

  private createActionButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    action: MenuAction
  ): void {
    const button = this.add.graphics();

    const redraw = (hover: boolean): void => {
      button.clear();
      button.fillStyle(hover ? 0xf8cf72 : 0xe2b95f, 1);
      button.fillRect(x - width / 2, y - height / 2, width, height);

      button.fillStyle(0x4b2e10, 1);
      button.fillRect(x - width / 2 + 6, y - height / 2 + 6, width - 12, height - 12);

      button.fillStyle(hover ? 0x7c173f : 0x611231, 1);
      button.fillRect(x - width / 2 + 10, y - height / 2 + 10, width - 20, height - 20);
    };

    redraw(false);

    const text = this.add.text(x, y, label, {
      fontFamily: 'monospace',
      fontSize: '30px',
      color: '#fff4d1',
      stroke: '#2e1b00',
      strokeThickness: 5,
    });
    text.setOrigin(0.5);

    const zone = this.add.rectangle(x, y, width, height, 0x000000, 0);
    zone.setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => redraw(true));
    zone.on('pointerout', () => redraw(false));
    zone.on('pointerdown', () => this.handleAction(action));
  }

  private createSettingsPanel(): void {
    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x110910, 0.92);
    panelBg.fillRect(212, 206, 600, 320);
    panelBg.lineStyle(3, 0xe6bc61, 1);
    panelBg.strokeRect(212, 206, 600, 320);

    const title = this.add.text(512, 250, 'SETTINGS', {
      fontFamily: 'monospace',
      fontSize: '34px',
      color: '#f7dc96',
    }).setOrigin(0.5);

    const body = this.add.text(512, 352,
      'Audio, controls, and game options\nwill be added here in the next step.\n\nPress ESC or Close.', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#f0e3bd',
        align: 'center',
      }
    ).setOrigin(0.5);

    const close = this.add.text(512, 468, 'CLOSE', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#2a1200',
      backgroundColor: '#e4be66',
      padding: { left: 20, right: 20, top: 8, bottom: 8 },
    }).setOrigin(0.5);
    close.setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => {
      this.settingsPanel?.setVisible(false);
    });

    this.settingsPanel = this.add.container(0, 0, [panelBg, title, body, close]);
    this.settingsPanel.setVisible(false);
    this.settingsPanel.setDepth(20);
  }

  private handleAction(action: MenuAction): void {
    if (action === 'play') {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('DungeonScene', { floor: 1 });
      });
      return;
    }

    this.settingsPanel?.setVisible(true);
  }
}
