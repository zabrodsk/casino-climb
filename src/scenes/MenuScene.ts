import Phaser, { Scene, GameObjects } from 'phaser';
import { AudioManager } from '../audio/AudioManager';

const INTRO_LINES = [
  'You wake up.',
  'Bright lights. The smell of money.',
  "You don't remember how you got here.",
];
const INTRO_SEEN_KEY = 'menuWakeIntroSeen';

export class MenuScene extends Scene {
  private introTexts: GameObjects.Text[] = [];
  private promptText!: GameObjects.Text;
  private titleText!: GameObjects.Text;
  private readyForInput = false;
  private introPlaying = false;
  private introSeen = false;
  private readonly inputHandler = () => this.handlePrimaryInput();

  constructor() {
    super('MenuScene');
  }

  create(): void {
    const { width, height } = this.scale;

    AudioManager.init(this);
    AudioManager.playMusic(this, 'menu-music', { loop: true });

    this.cameras.main.setBackgroundColor('#000000');

    this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0, 0);

    this.introSeen = this.hasSeenIntro();

    this.titleText = this.add.text(width / 2, 118, 'CASINO CLIMB', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#d8b26a',
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.titleText.setAlpha(0.18);

    this.promptText = this.add.text(width / 2, height - 140, 'PRESS ANY KEY', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#d8b26a',
      letterSpacing: 1,
    }).setOrigin(0.5).setAlpha(0.9);

    INTRO_LINES.forEach((line, index) => {
      const text = this.add.text(width / 2, 268 + index * 68, '', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#f4e7c3',
        align: 'center',
      }).setOrigin(0.5);
      text.setAlpha(0).setVisible(false);
      this.introTexts.push(text);
    });

    this.readyForInput = true;
    this.tweens.add({
      targets: this.promptText,
      alpha: { from: 0.35, to: 1 },
      duration: 720,
      yoyo: true,
      repeat: -1,
    });

    this.input.keyboard?.on('keydown', this.inputHandler);
    this.input.on('pointerdown', this.inputHandler);
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown', this.inputHandler);
      this.input.off('pointerdown', this.inputHandler);
    });
  }

  private typeLine(target: GameObjects.Text, text: string): void {
    target.setAlpha(1);
    let index = 0;
    this.time.addEvent({
      delay: 28,
      repeat: text.length - 1,
      callback: () => {
        index += 1;
        target.setText(text.slice(0, index));
      },
    });
  }

  private handlePrimaryInput(): void {
    if (!this.readyForInput) return;
    if (!this.introSeen && !this.introPlaying) {
      this.startWakeIntro();
      return;
    }
    this.beginRun();
  }

  private startWakeIntro(): void {
    this.introPlaying = true;
    this.readyForInput = false;
    this.introSeen = true;
    this.markIntroSeen();

    this.tweens.killTweensOf(this.promptText);
    this.promptText.setAlpha(0).setText('');

    INTRO_LINES.forEach((line, index) => {
      const text = this.introTexts[index];
      text.setText('').setVisible(true);
      this.time.delayedCall(index * 1100, () => {
        this.typeLine(text, line);
      });
    });

    this.time.delayedCall(INTRO_LINES.length * 1100 + 450, () => {
      this.readyForInput = true;
      this.introPlaying = false;
      this.promptText.setText('PRESS ANY KEY');
      this.tweens.killTweensOf(this.promptText);
      this.tweens.add({
        targets: this.promptText,
        alpha: { from: 0.35, to: 1 },
        duration: 720,
        yoyo: true,
        repeat: -1,
      });
    });
  }

  private beginRun(): void {
    if (!this.readyForInput) return;

    this.readyForInput = false;
    AudioManager.playSfx(this, 'ui-click', { volume: 0.9, cooldownMs: 50, allowOverlap: false });
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('DungeonScene', { floor: 1 });
    });
  }

  private hasSeenIntro(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    return window.localStorage.getItem(INTRO_SEEN_KEY) === '1';
  }

  private markIntroSeen(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(INTRO_SEEN_KEY, '1');
  }
}
