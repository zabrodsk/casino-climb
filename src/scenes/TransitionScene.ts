import { Scene } from 'phaser';
import { THEME, COLOR, neonTitleStyle } from '../ui/theme';

export class TransitionScene extends Scene {
  constructor() {
    super({ key: 'TransitionScene' });
  }

  create(data: { nextFloor: number; name: string }): void {
    const { nextFloor, name } = data;
    const W = 1024;
    const H = 768;

    // Black background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 1);
    bg.fillRect(0, 0, W, H);

    // Floor number — enormous pink-stroke neon
    this.add.text(W / 2, H / 2 - 50, `FLOOR ${nextFloor}`, neonTitleStyle(72)).setOrigin(0.5);

    // Floor name below
    this.add.text(W / 2, H / 2 + 40, name.toUpperCase(), {
      fontFamily: 'monospace',
      fontSize: '26px',
      color: COLOR.goldText,
    }).setOrigin(0.5);

    // Marquee dots along top and bottom of screen
    this._addMarqueeLights(H);

    // Disable all input during transition
    this.input.enabled = false;

    // Fade in → hold → fade out → start DungeonScene
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.time.delayedCall(400 + 1200, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('DungeonScene', { floor: nextFloor });
      });
    });
  }

  private _addMarqueeLights(H: number): void {
    const W = 1024;
    const topY = 24;
    const bottomY = H - 24;
    // 7 dots evenly spaced across the width
    const count = 7;
    const spacing = W / (count + 1);

    for (let i = 0; i < count; i++) {
      const x = spacing * (i + 1);

      const topDot = this.add.rectangle(x, topY, 8, 8, THEME.goldLamp).setOrigin(0.5);
      this.tweens.add({
        targets: topDot,
        alpha: { from: 0.4, to: 1 },
        duration: 420,
        yoyo: true,
        repeat: -1,
        delay: i * 90,
      });

      const botDot = this.add.rectangle(x, bottomY, 8, 8, THEME.goldLamp).setOrigin(0.5);
      this.tweens.add({
        targets: botDot,
        alpha: { from: 0.4, to: 1 },
        duration: 420,
        yoyo: true,
        repeat: -1,
        delay: i * 90 + 210,
      });
    }
  }
}
