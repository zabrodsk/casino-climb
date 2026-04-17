import { Scene, GameObjects } from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { buttonLabelStyle, drawFramedPanel, drawNestedButton, neonTitleStyle } from '../ui/theme';
import { getRunStats, resetRun, setFloor } from '../state/coinState';
import { resetNarrativeRunState } from '../state/narrativeState';

const ENDING_LINES = [
  'You remember all of it.',
  'The recruiter. The contract. The debt that drove you here.',
  'The vault was never an exit. It was the truth waiting at the top.',
  'Now you can leave knowing exactly what the House is.',
];

export class EndScene extends Scene {
  private coins = 0;
  private lineTexts: GameObjects.Text[] = [];
  private leaveZone!: GameObjects.Zone;
  private replayZone!: GameObjects.Zone;

  constructor() {
    super({ key: 'EndScene' });
  }

  init(data: { coins: number }): void {
    this.coins = data.coins ?? 0;
  }

  create(): void {
    const { width, height } = this.scale;
    const stats = getRunStats();

    this.add.rectangle(0, 0, width, height, 0x050505).setOrigin(0, 0);
    this.add.text(width / 2, 88, 'THE HOUSE ALWAYS WINS', neonTitleStyle(28)).setOrigin(0.5);

    ENDING_LINES.forEach((line, index) => {
      const text = this.add.text(width / 2, 210 + index * 56, line, {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#f4e7c3',
        align: 'center',
      }).setOrigin(0.5).setAlpha(0);
      this.lineTexts.push(text);

      this.tweens.add({
        targets: text,
        alpha: 1,
        duration: 360,
        delay: index * 420,
      });
    });

    const panel = this.add.graphics();
    drawFramedPanel(panel, width / 2 - 210, 470, 420, 136, { borderWidth: 3, alpha: 0.96 });

    this.add.text(width / 2, 502, `Final Coins: ${this.coins}`, {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#d8b26a',
    }).setOrigin(0.5);

    this.add.text(width / 2, 548, `Runs ${stats.runCount}  |  Highest Floor ${stats.highestFloor}  |  Total Coins ${stats.totalCoins}`, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#f4e7c3',
      align: 'center',
    }).setOrigin(0.5);

    const leaveBg = this.add.graphics();
    const leaveText = this.add.text(width / 2 - 140, 654, 'LEAVE', buttonLabelStyle(20)).setOrigin(0.5);
    drawNestedButton(leaveBg, width / 2 - 140, 654, 180, 52, false);
    this.leaveZone = this.add.zone(width / 2 - 140, 654, 180, 52).setInteractive({ cursor: 'pointer' });
    this.leaveZone.on('pointerover', () => drawNestedButton(leaveBg, width / 2 - 140, 654, 180, 52, true));
    this.leaveZone.on('pointerout', () => drawNestedButton(leaveBg, width / 2 - 140, 654, 180, 52, false));
    this.leaveZone.on('pointerdown', () => this.leaveEnding());

    const replayBg = this.add.graphics();
    const replayText = this.add.text(width / 2 + 140, 654, 'PLAY AGAIN', buttonLabelStyle(20)).setOrigin(0.5);
    drawNestedButton(replayBg, width / 2 + 140, 654, 220, 52, false);
    this.replayZone = this.add.zone(width / 2 + 140, 654, 220, 52).setInteractive({ cursor: 'pointer' });
    this.replayZone.on('pointerover', () => drawNestedButton(replayBg, width / 2 + 140, 654, 220, 52, true));
    this.replayZone.on('pointerout', () => drawNestedButton(replayBg, width / 2 + 140, 654, 220, 52, false));
    this.replayZone.on('pointerdown', () => this.playAgain());
  }

  private leaveEnding(): void {
    this.leaveZone.disableInteractive();
    this.replayZone.disableInteractive();
    AudioManager.playSfx(this, 'ui-click', { volume: 0.9, cooldownMs: 50, allowOverlap: false });

    const { width, height } = this.scale;
    const finalQuote = this.add.text(width / 2, height - 94, 'You can leave. The hunger follows you anyway.', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#d8b26a',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: finalQuote, alpha: 1, duration: 280 });
    this.time.delayedCall(1300, () => {
      resetNarrativeRunState();
      resetRun();
      this.cameras.main.fadeOut(420, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MenuScene');
      });
    });
  }

  private playAgain(): void {
    this.leaveZone.disableInteractive();
    this.replayZone.disableInteractive();
    AudioManager.playSfx(this, 'ui-click', { volume: 0.9, cooldownMs: 50, allowOverlap: false });
    resetNarrativeRunState();
    resetRun({ keepCoins: true });
    setFloor(1);
    this.cameras.main.fadeOut(320, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('DungeonScene', { floor: 1 });
    });
  }
}
