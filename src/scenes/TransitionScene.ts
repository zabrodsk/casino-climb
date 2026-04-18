import { Scene } from 'phaser';
import { THEME, COLOR, neonTitleStyle, drawFramedPanel, buttonLabelStyle, drawNestedButton } from '../ui/theme';
import { AudioManager } from '../audio/AudioManager';
import { canSpawnSupportNpc, markSupportNpcSeen, rollSupportReward, SupportReward } from '../state/narrativeState';
import { grantNextFloorDiscount, grantReviveToken } from '../state/coinState';

type TransitionData = { nextFloor: number; name: string; displayFloorNumber?: number };

export class TransitionScene extends Scene {
  private nextFloor = 1;
  private floorName = '';
  private displayFloorNumber = 1;
  private supportReward: SupportReward | null = null;
  private continuing = false;

  constructor() {
    super({ key: 'TransitionScene' });
  }

  create(data: TransitionData): void {
    this.nextFloor = data.nextFloor;
    this.floorName = data.name;
    this.displayFloorNumber = data.displayFloorNumber ?? data.nextFloor;
    this.supportReward = null;
    this.continuing = false;

    const W = 1024;
    const H = 768;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 1);
    bg.fillRect(0, 0, W, H);

    this.add.text(W / 2, H / 2 - 60, `FLOOR ${this.displayFloorNumber}`, neonTitleStyle(72)).setOrigin(0.5);
    this.add.text(W / 2, H / 2 + 28, this.floorName.toUpperCase(), {
      fontFamily: 'monospace',
      fontSize: '26px',
      color: COLOR.goldText,
    }).setOrigin(0.5);

    this._addMarqueeLights(H);
    AudioManager.playSfx(this, 'transition-enter', { volume: 0.9, cooldownMs: 300, allowOverlap: false });

    this.cameras.main.fadeIn(350, 0, 0, 0);

    if (canSpawnSupportNpc(this.nextFloor)) {
      this.supportReward = rollSupportReward();
      this.time.delayedCall(900, () => this.showSupportNpc());
      return;
    }

    this.time.delayedCall(1600, () => this.continueToDungeon());
  }

  private showSupportNpc(): void {
    const W = 1024;
    const reward = this.supportReward;
    if (!reward) {
      this.continueToDungeon();
      return;
    }

    markSupportNpcSeen();

    const panel = this.add.graphics().setDepth(10);
    drawFramedPanel(panel, 220, 432, 584, 196, { borderWidth: 3, alpha: 0.96 });

    this.add.text(W / 2, 472, 'A support clerk steps out of the glow.', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: COLOR.ivory,
    }).setOrigin(0.5).setDepth(11);

    const description = reward.type === 'revive'
      ? '“If the House wipes you out once, this token drags you back.”'
      : '“Next floor, every bet lands 20% lighter. Don’t waste it.”';

    this.add.text(W / 2, 526, description, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: COLOR.ivorySoft,
      align: 'center',
      wordWrap: { width: 500 },
    }).setOrigin(0.5).setDepth(11);

    this.add.text(W / 2, 576, `Reward: ${reward.label}`, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#d8b26a',
    }).setOrigin(0.5).setDepth(11);

    const buttonBg = this.add.graphics().setDepth(11);
    this.add.text(W / 2, 626, 'ACCEPT AND CONTINUE', buttonLabelStyle(18)).setOrigin(0.5).setDepth(12);
    drawNestedButton(buttonBg, W / 2, 626, 260, 50, false);
    const zone = this.add.zone(W / 2, 626, 260, 50).setDepth(13).setInteractive({ cursor: 'pointer' });
    zone.on('pointerover', () => drawNestedButton(buttonBg, W / 2, 626, 260, 50, true));
    zone.on('pointerout', () => drawNestedButton(buttonBg, W / 2, 626, 260, 50, false));
    zone.on('pointerdown', () => {
      if (reward.type === 'revive') {
        grantReviveToken();
      } else {
        grantNextFloorDiscount(this.nextFloor, 0.2);
      }
      this.continueToDungeon();
    });
  }

  private continueToDungeon(): void {
    if (this.continuing) return;
    this.continuing = true;
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('DungeonScene', { floor: this.nextFloor, fromTransition: true });
    });
  }

  private _addMarqueeLights(H: number): void {
    const W = 1024;
    const topY = 24;
    const bottomY = H - 24;
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
