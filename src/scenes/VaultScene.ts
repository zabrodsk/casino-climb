import Phaser, { Scene, GameObjects } from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { COLOR, FONT, buttonLabelStyle, drawFramedPanel, drawNestedButton, neonTitleStyle } from '../ui/theme';
import { addGameplaySettingsGear } from '../ui/gameplaySettings';
import { registerDeveloperUnlockHotkey } from '../dev/developerHotkeys';

type TrialPhase = 'timing' | 'strategy' | 'wager' | 'resolved';
type StrategyOption = '+3' | '+6' | 'STAND';

const TIMING_TARGET_LEFT = 440;
const TIMING_TARGET_RIGHT = 584;
const TIMING_TRACK_LEFT = 284;
const TIMING_TRACK_RIGHT = 740;
const TIMING_ROW_Y = 344;
const STRATEGY_CORRECT: StrategyOption = '+6';
const WAGER_COST = 75;
const WAGER_REWARD = 150;

export class VaultScene extends Scene {
  private currentCoins = 200;
  private phase: TrialPhase = 'timing';
  private resolved = false;

  private coinsText!: GameObjects.Text;
  private promptText!: GameObjects.Text;
  private flavorText!: GameObjects.Text;
  private resultText!: GameObjects.Text;

  private timingTrack!: GameObjects.Graphics;
  private timingTarget!: GameObjects.Rectangle;
  private timingMarker!: GameObjects.Rectangle;
  private timingTween?: Phaser.Tweens.Tween;

  private actionBg!: GameObjects.Graphics;
  private actionText!: GameObjects.Text;
  private actionZone!: GameObjects.Zone;

  private choiceButtons: Array<{
    option: string;
    bg: GameObjects.Graphics;
    label: GameObjects.Text;
    zone: GameObjects.Zone;
  }> = [];

  private continueBg!: GameObjects.Graphics;
  private continueText!: GameObjects.Text;
  private continueZone!: GameObjects.Zone;

  constructor() {
    super('VaultScene');
  }

  init(data: { coins: number }): void {
    this.currentCoins = data.coins ?? 200;
    this.phase = 'timing';
    this.resolved = false;
  }

  create(): void {
    const W = 1024;
    const H = 768;

    AudioManager.stopMusic(this);

    this.drawBackground(W, H);

    this.add.text(W / 2, 58, 'FLOOR 6 — THE VAULT', neonTitleStyle(28)).setOrigin(0.5);
    this.coinsText = this.add.text(W - 40, 52, `Coins: ${this.currentCoins}`, {
      fontSize: '22px',
      color: '#dfeaf5',
      fontFamily: FONT.mono,
    }).setOrigin(1, 0.5);

    this.promptText = this.add.text(W / 2, 148, 'The House finally speaks plainly.', {
      fontFamily: FONT.mono,
      fontSize: '20px',
      color: '#c8d7e8',
    }).setOrigin(0.5);

    this.flavorText = this.add.text(W / 2, 198, '“One timing cut. One decision. One last wager.”', {
      fontFamily: FONT.mono,
      fontSize: '18px',
      color: COLOR.goldText,
      align: 'center',
      wordWrap: { width: 700 },
    }).setOrigin(0.5);

    const panel = this.add.graphics();
    drawFramedPanel(panel, 168, 236, 688, 276, { borderWidth: 3, alpha: 0.96, fill: 0x10161d });

    this.timingTrack = this.add.graphics();
    this.timingTarget = this.add.rectangle(
      (TIMING_TARGET_LEFT + TIMING_TARGET_RIGHT) / 2,
      TIMING_ROW_Y,
      TIMING_TARGET_RIGHT - TIMING_TARGET_LEFT,
      42,
      0xd7c07d,
      0.24,
    ).setVisible(false);
    this.timingMarker = this.add.rectangle(TIMING_TRACK_LEFT, TIMING_ROW_Y, 10, 58, 0xe8f1fa, 1).setVisible(false);

    this.actionBg = this.add.graphics();
    this.actionText = this.add.text(W / 2, 454, '', buttonLabelStyle(22)).setOrigin(0.5);
    this.actionZone = this.add.zone(W / 2, 454, 240, 58).setInteractive({ cursor: 'pointer' });
    this.actionZone.on('pointerover', () => {
      if (this.phase === 'timing' && !this.resolved) {
        drawNestedButton(this.actionBg, W / 2, 454, 240, 58, true);
      }
    });
    this.actionZone.on('pointerout', () => {
      if (this.phase === 'timing' && !this.resolved) {
        drawNestedButton(this.actionBg, W / 2, 454, 240, 58, false);
      }
    });
    this.actionZone.on('pointerdown', () => {
      if (this.phase === 'timing' && !this.resolved) {
        this.resolveTimingTrial();
      }
    });

    this.resultText = this.add.text(W / 2, 548, '', {
      fontFamily: FONT.mono,
      fontSize: '18px',
      color: '#dfeaf5',
      align: 'center',
      wordWrap: { width: 720 },
    }).setOrigin(0.5).setAlpha(0);

    this.createStrategyButtons();
    this.createContinueButton();

    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.phase === 'timing' && !this.resolved) {
        this.resolveTimingTrial();
      }
    });

    this.events.once('shutdown', () => {
      this.timingTween?.stop();
    });

    addGameplaySettingsGear(this, 'VaultScene');
    registerDeveloperUnlockHotkey(this, () => this.resolveVaultSuccess(true));
    this.input.keyboard?.on('keydown-ESC', () => this.leaveVault());
    this.enterTimingPhase();
  }

  private drawBackground(width: number, height: number): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x070a0f, 1);
    bg.fillRect(0, 0, width, height);

    bg.fillStyle(0x0d1218, 1);
    bg.fillRect(0, 0, width, 220);

    bg.fillStyle(0x0a0f14, 1);
    bg.fillRect(0, 220, width, 548);

    bg.lineStyle(1, 0x3d4d60, 0.25);
    for (let y = 250; y < height; y += 22) {
      bg.lineBetween(96, y, width - 96, y);
    }
    for (let x = 144; x < width - 144; x += 32) {
      bg.lineBetween(x, 250, x, height - 84);
    }

    const halo = this.add.ellipse(width / 2, 210, 620, 180, 0x97abc4, 0.07);
    halo.setBlendMode(Phaser.BlendModes.SCREEN);
    this.tweens.add({
      targets: halo,
      alpha: { from: 0.03, to: 0.1 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
    });
  }

  private createStrategyButtons(): void {
    const options: StrategyOption[] = ['+3', '+6', 'STAND'];
    const startX = 332;
    options.forEach((option, index) => {
      const x = startX + index * 180;
      const bg = this.add.graphics().setVisible(false);
      const label = this.add.text(x, 396, option, buttonLabelStyle(20)).setOrigin(0.5).setVisible(false);
      const zone = this.add.zone(x, 396, 150, 54).setInteractive({ cursor: 'pointer' }).setVisible(false);

      zone.on('pointerover', () => {
        if (this.phase === 'strategy' && !this.resolved) {
          drawNestedButton(bg, x, 396, 150, 54, true);
        }
      });
      zone.on('pointerout', () => {
        if (this.phase === 'strategy' && !this.resolved) {
          drawNestedButton(bg, x, 396, 150, 54, false);
        }
      });
      zone.on('pointerdown', () => {
        if (this.phase === 'strategy' && !this.resolved) {
          this.resolveStrategyTrial(option);
        }
      });

      this.choiceButtons.push({ option, bg, label, zone });
    });
  }

  private createContinueButton(): void {
    this.continueBg = this.add.graphics().setVisible(false);
    this.continueText = this.add.text(512, 454, '', buttonLabelStyle(22)).setOrigin(0.5).setVisible(false);
    this.continueZone = this.add.zone(512, 454, 260, 58).setInteractive({ cursor: 'pointer' }).setVisible(false);
    this.continueZone.on('pointerover', () => {
      if (this.phase === 'wager' && !this.resolved) {
        drawNestedButton(this.continueBg, 512, 454, 260, 58, true);
      }
    });
    this.continueZone.on('pointerout', () => {
      if (this.phase === 'wager' && !this.resolved) {
        drawNestedButton(this.continueBg, 512, 454, 260, 58, false);
      }
    });
    this.continueZone.on('pointerdown', () => {
      if (this.phase === 'wager' && !this.resolved) {
        this.resolveWagerTrial();
      }
    });
  }

  private enterTimingPhase(): void {
    this.phase = 'timing';
    this.resolved = false;
    this.resultText.setAlpha(0).setText('');
    this.promptText.setText('Timing Trial');
    this.flavorText.setText('Press SPACE or click LOCK IN while the marker is inside the pale vault window.');

    this.choiceButtons.forEach(({ bg, label, zone }) => {
      bg.setVisible(false);
      label.setVisible(false);
      zone.setVisible(false);
      zone.disableInteractive();
    });
    this.continueBg.setVisible(false);
    this.continueText.setVisible(false);
    this.continueZone.setVisible(false);
    this.continueZone.disableInteractive();

    this.timingTrack.clear();
    this.timingTrack.fillStyle(0x273341, 1);
    this.timingTrack.fillRect(TIMING_TRACK_LEFT, TIMING_ROW_Y - 10, TIMING_TRACK_RIGHT - TIMING_TRACK_LEFT, 20);
    this.timingTrack.fillStyle(0x90a9c0, 0.2);
    this.timingTrack.fillRect(TIMING_TRACK_LEFT, TIMING_ROW_Y - 2, TIMING_TRACK_RIGHT - TIMING_TRACK_LEFT, 4);

    this.timingTarget.setVisible(true);
    this.timingMarker.setVisible(true).setX(TIMING_TRACK_LEFT);
    drawNestedButton(this.actionBg, 512, 454, 240, 58, false);
    this.actionText.setText('LOCK IN');
    this.actionZone.setVisible(true);
    this.actionZone.setInteractive({ cursor: 'pointer' });

    this.timingTween?.stop();
    this.timingTween = this.tweens.add({
      targets: this.timingMarker,
      x: TIMING_TRACK_RIGHT,
      duration: 950,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private resolveTimingTrial(): void {
    if (this.phase !== 'timing' || this.resolved) return;
    this.resolved = true;
    this.timingTween?.stop();
    this.actionZone.disableInteractive();

    const success = this.timingMarker.x >= TIMING_TARGET_LEFT && this.timingMarker.x <= TIMING_TARGET_RIGHT;
    if (success) {
      AudioManager.playSfx(this, 'win', { volume: 0.75, cooldownMs: 80, allowOverlap: false });
      this.showResult('Clean. The lock yields on rhythm alone.', COLOR.winGreen, () => this.enterStrategyPhase());
      return;
    }

    this.applyPenalty(20, 'Too early. Too late. The vault takes 20 coins and asks again.');
    this.time.delayedCall(900, () => this.enterTimingPhase());
  }

  private enterStrategyPhase(): void {
    this.phase = 'strategy';
    this.resolved = false;
    this.promptText.setText('Strategic Trial');
    this.flavorText.setText('Your hand sits at 14. One move reaches exactly 20. Choose it.');
    this.timingTrack.clear();
    this.timingTarget.setVisible(false);
    this.timingMarker.setVisible(false);
    this.actionBg.clear();
    this.actionText.setText('');
    this.actionZone.setVisible(false);
    this.actionZone.disableInteractive();

    this.choiceButtons.forEach(({ option, bg, label, zone }) => {
      bg.setVisible(true);
      label.setVisible(true);
      zone.setVisible(true);
      zone.setInteractive({ cursor: 'pointer' });
      drawNestedButton(bg, label.x, label.y, 150, 54, false);
      label.setText(option);
    });
  }

  private resolveStrategyTrial(option: StrategyOption): void {
    if (this.phase !== 'strategy' || this.resolved) return;
    this.resolved = true;
    this.choiceButtons.forEach(({ zone }) => zone.disableInteractive());

    if (option === STRATEGY_CORRECT) {
      AudioManager.playSfx(this, 'win', { volume: 0.75, cooldownMs: 80, allowOverlap: false });
      this.showResult('Exact. You stop where greed cannot ruin the total.', COLOR.winGreen, () => this.enterWagerPhase());
      return;
    }

    this.applyPenalty(30, `Wrong move. ${option} leaves the hand dead. The vault takes 30 coins.`);
    this.time.delayedCall(900, () => this.enterStrategyPhase());
  }

  private enterWagerPhase(): void {
    this.phase = 'wager';
    this.resolved = false;
    this.promptText.setText('Final Wager');
    this.flavorText.setText(`Stake ${WAGER_COST} coins to open the vault. Refusal means leaving empty-handed.`);

    this.choiceButtons.forEach(({ bg, label, zone }) => {
      bg.setVisible(false);
      label.setVisible(false);
      zone.setVisible(false);
      zone.disableInteractive();
    });

    this.continueBg.setVisible(true);
    this.continueText.setVisible(true).setText(`WAGER ${WAGER_COST}`);
    this.continueZone.setVisible(true);
    this.continueZone.setInteractive({ cursor: 'pointer' });
    drawNestedButton(this.continueBg, 512, 454, 260, 58, false);
  }

  private resolveWagerTrial(): void {
    if (this.phase !== 'wager' || this.resolved) return;
    this.resolved = true;
    this.continueZone.disableInteractive();

    if (this.currentCoins < WAGER_COST) {
      this.applyPenalty(0, 'You do not have enough left to stake the final wager.');
      this.time.delayedCall(900, () => this.enterWagerPhase());
      return;
    }

    this.currentCoins -= WAGER_COST;
    this.refreshCoins();
    AudioManager.playSfx(this, 'coin-settle', { volume: 0.8, cooldownMs: 90, allowOverlap: false });

    this.showResult('The vault takes its proof, then gives it back doubled.', COLOR.goldText, () => {
      this.currentCoins += WAGER_REWARD;
      this.refreshCoins();
      this.resolveVaultSuccess(false);
    });
  }

  private applyPenalty(amount: number, message: string): void {
    if (amount > 0) {
      this.currentCoins = Math.max(0, this.currentCoins - amount);
      this.refreshCoins();
    }
    AudioManager.playSfx(this, this.currentCoins <= 0 ? 'game-over' : 'lose', {
      volume: 0.8,
      cooldownMs: 90,
      allowOverlap: false,
    });
    this.showResult(message, COLOR.loseRed);

    if (this.currentCoins <= 0) {
      this.time.delayedCall(1100, () => {
        this.scene.get('DungeonScene').events.emit('game-complete', { coins: 0, won: false });
        this.scene.stop('VaultScene');
      });
    }
  }

  private resolveVaultSuccess(fromDevUnlock: boolean): void {
    this.phase = 'resolved';
    this.resolved = true;
    this.resultText.setAlpha(1).setColor(COLOR.winGreen);
    this.resultText.setText(fromDevUnlock
      ? 'The vault recognizes the shortcut. The House is not impressed.'
      : 'The vault opens. All of it comes back at once.');

    this.promptText.setText('Full Recall');
    this.flavorText.setText([
      'The recruiter. The contract. The debt.',
      'You climbed here willingly, because you needed what was behind this door.',
      'Now you can leave knowing exactly what the House is.',
    ].join('\n'));

    this.timingTrack.clear();
    this.timingTarget.setVisible(false);
    this.timingMarker.setVisible(false);
    this.actionBg.clear();
    this.actionText.setText('');
    this.actionZone.setVisible(false);
    this.actionZone.disableInteractive();
    this.choiceButtons.forEach(({ bg, label, zone }) => {
      bg.setVisible(false);
      label.setVisible(false);
      zone.setVisible(false);
      zone.disableInteractive();
    });
    this.continueBg.setVisible(false);
    this.continueText.setVisible(false);
    this.continueZone.setVisible(false);
    this.continueZone.disableInteractive();

    AudioManager.playSfx(this, 'goal-victory', { volume: 0.85, cooldownMs: 120, allowOverlap: false });
    this.time.delayedCall(1500, () => {
      this.scene.get('DungeonScene').events.emit('game-complete', { coins: this.currentCoins, won: true });
      this.scene.stop('VaultScene');
    });
  }

  private showResult(message: string, color: string, onComplete?: () => void): void {
    this.resultText.setAlpha(0).setColor(color).setText(message);
    this.tweens.add({
      targets: this.resultText,
      alpha: 1,
      duration: 180,
      onComplete: () => {
        if (onComplete) {
          this.time.delayedCall(700, onComplete);
        }
      },
    });
  }

  private refreshCoins(): void {
    this.coinsText.setText(`Coins: ${this.currentCoins}`);
  }

  private leaveVault(): void {
    this.timingTween?.stop();
    this.scene.get('DungeonScene').events.emit('game-complete', { coins: this.currentCoins, won: false });
    this.scene.stop('VaultScene');
  }
}
