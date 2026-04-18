import { Scene, GameObjects } from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import {
  COLOR,
  THEME,
  bodyTextStyle,
  buttonLabelStyle,
  drawNestedButton,
  neonTitleStyle,
} from '../ui/theme';
import { resetRun } from '../state/coinState';
import { resetNarrativeRunState } from '../state/narrativeState';
import { resetMemoryRunState } from '../state/memoryState';

const AUTO_START_RUN_STORAGE_KEY = 'casino.autostart.floor1';

type Phase = 'reveal' | 'choice' | 'leave_epilogue' | 'thanks';

type Beat = { title: string; lines: string[] };

const REVEAL_BEATS: Beat[] = [
  {
    title: 'THE VAULT',
    lines: [
      'The doors fall open.',
      'The light inside is warmer than you expected.',
      'You step through.',
    ],
  },
  {
    title: 'THE MASKED MAN',
    lines: [
      'You remember him now.',
      'A mask. A gloved hand. A quiet voice at the station.',
      '"There is money waiting for whoever reaches the vault."',
    ],
  },
  {
    title: 'THE DEBT',
    lines: [
      'The notices. The calls you let ring out.',
      'The number that kept growing while you pretended to sleep.',
      'That was what drove you here.',
    ],
  },
  {
    title: 'YOU CHOSE THIS',
    lines: [
      'No one dragged you into the House.',
      'You descended willingly.',
      'You signed before he finished talking.',
    ],
  },
  {
    title: 'THE TRUTH',
    lines: [
      'The vault holds no treasure.',
      'It gives you back your memory.',
      'Now you can leave knowing exactly what the House is.',
    ],
  },
];

const EPILOGUE_BEATS: Beat[] = [
  {
    title: 'OUTSIDE',
    lines: [
      'You walk out of the House.',
      'The air is cold and wet and real.',
    ],
  },
  {
    title: 'THE ROAD',
    lines: [
      'Trees. Birdsong. Morning light.',
      'Nothing out here asks you for anything.',
    ],
  },
];

const FADE_MS = 360;
const HOLD_MS = 2600;
const PINK_STROKE = '#ff327b';
const GREEN_TITLE = '#d6f4d3';
const GREEN_STROKE = '#2a7f4a';
const GOLD_TITLE = '#f8cf72';
const GOLD_STROKE = '#8d5a1c';

export class EndScene extends Scene {
  private coins = 0;
  private phase: Phase = 'reveal';
  private beatIndex = 0;
  private skipBusy = false;
  private transitioning = false;
  private timer: Phaser.Time.TimerEvent | null = null;

  private bg!: GameObjects.Graphics;
  private titleText!: GameObjects.Text;
  private bodyText!: GameObjects.Text;
  private hintText!: GameObjects.Text;
  private choiceObjects: GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'EndScene' });
  }

  init(data: { coins?: number }): void {
    this.coins = data?.coins ?? 0;
    this.phase = 'reveal';
    this.beatIndex = 0;
    this.skipBusy = false;
    this.transitioning = false;
    this.timer = null;
    this.choiceObjects = [];
  }

  create(): void {
    const { width, height } = this.scale;

    this.bg = this.add.graphics();
    this._drawVaultBackdrop();

    this.titleText = this.add.text(width / 2, height / 2 - 110, '', neonTitleStyle(30))
      .setOrigin(0.5)
      .setAlpha(0);

    this.bodyText = this.add.text(width / 2, height / 2, '', {
      ...bodyTextStyle(20),
      color: COLOR.ivory,
      align: 'center',
      wordWrap: { width: width * 0.72 },
      lineSpacing: 10,
    }).setOrigin(0.5).setAlpha(0);

    this.hintText = this.add.text(width / 2, height - 38, 'click or press any key to skip', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#70604a',
      align: 'center',
    }).setOrigin(0.5);

    this.input.keyboard!.on('keydown', this._onSkipInput, this);
    this.input.on('pointerdown', this._onSkipInput, this);

    this.events.once('shutdown', this._cleanup, this);
    this.events.once('destroy', this._cleanup, this);

    this.cameras.main.fadeIn(400, 0, 0, 0);
    this._showRevealBeat(0);
  }

  private _cleanup(): void {
    this._clearTimer();
    this.tweens.killAll();
    this.input.keyboard?.off('keydown', this._onSkipInput, this);
    this.input.off('pointerdown', this._onSkipInput, this);
  }

  // ── Reveal phase ─────────────────────────────────────────

  private _showRevealBeat(index: number): void {
    if (index >= REVEAL_BEATS.length) {
      this._enterChoice();
      return;
    }
    this.beatIndex = index;
    this._renderBeat(REVEAL_BEATS[index], COLOR.pink, PINK_STROKE, () => {
      this.timer = this.time.delayedCall(HOLD_MS, () => this._advanceReveal());
    });
  }

  private _advanceReveal(): void {
    this._clearTimer();
    this.skipBusy = true;
    this.tweens.add({
      targets: [this.titleText, this.bodyText],
      alpha: 0,
      duration: FADE_MS,
      onComplete: () => this._showRevealBeat(this.beatIndex + 1),
    });
  }

  // ── Choice phase ─────────────────────────────────────────

  private _enterChoice(): void {
    this.phase = 'choice';
    this._clearTimer();
    this.skipBusy = false;

    const { width, height } = this.scale;

    this.titleText.setText('THE VAULT IS OPEN')
      .setStyle({ ...neonTitleStyle(30), color: COLOR.pink, stroke: PINK_STROKE })
      .setAlpha(0);

    this.bodyText.setText(`You carry ${this.coins} coins out of the House.\nWhat do you do?`)
      .setAlpha(0);

    this.hintText.setText('');

    this.tweens.add({
      targets: [this.titleText, this.bodyText],
      alpha: 1,
      duration: 500,
    });

    const buttonY = Math.min(height - 140, height / 2 + 150);
    const replay = this._makeButton(
      width / 2 - 150, buttonY, 230, 56, 'PLAY AGAIN',
      () => this._playAgain(),
    );
    const leave = this._makeButton(
      width / 2 + 150, buttonY, 180, 56, 'LEAVE',
      () => this._beginLeave(),
    );
    this.choiceObjects.push(...replay, ...leave);

    replay.concat(leave).forEach((obj) => {
      if ('setAlpha' in obj) (obj as GameObjects.Graphics).setAlpha(0);
    });

    this.tweens.add({
      targets: [...replay, ...leave],
      alpha: 1,
      duration: 500,
      delay: 300,
    });
  }

  private _makeButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
  ): GameObjects.GameObject[] {
    const bg = this.add.graphics();
    drawNestedButton(bg, x, y, w, h, false);
    const text = this.add.text(x, y, label, buttonLabelStyle(22)).setOrigin(0.5);
    const zone = this.add.zone(x, y, w, h).setInteractive({ cursor: 'pointer' });
    zone.on('pointerover', () => drawNestedButton(bg, x, y, w, h, true));
    zone.on('pointerout', () => drawNestedButton(bg, x, y, w, h, false));
    zone.on('pointerdown', () => {
      if (this.transitioning) return;
      AudioManager.playSfx(this, 'ui-click', { volume: 0.9, cooldownMs: 50, allowOverlap: false });
      onClick();
    });
    return [bg, text, zone];
  }

  private _disableChoiceButtons(): void {
    this.choiceObjects.forEach((obj) => {
      if (obj instanceof GameObjects.Zone) obj.disableInteractive();
    });
  }

  // ── PLAY AGAIN ───────────────────────────────────────────

  private _playAgain(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this._disableChoiceButtons();
    this._clearTimer();
    resetNarrativeRunState();
    resetMemoryRunState();
    resetRun();
    this.cameras.main.fadeOut(320, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this._forcePageReload(true);
    });
  }

  // ── LEAVE flow: epilogue → thanks → menu ────────────────

  private _beginLeave(): void {
    if (this.transitioning) return;
    this.phase = 'leave_epilogue';
    this._disableChoiceButtons();

    this.tweens.add({
      targets: [this.titleText, this.bodyText, ...this.choiceObjects],
      alpha: 0,
      duration: 400,
      onComplete: () => {
        this.choiceObjects.forEach((o) => o.destroy());
        this.choiceObjects = [];
        this._fadeBackdropTo(() => {
          this._drawNatureBackdrop();
          this.hintText.setText('click or press any key to skip');
          this._showEpilogueBeat(0);
        });
      },
    });
  }

  private _fadeBackdropTo(after: () => void): void {
    this.tweens.add({
      targets: this.bg,
      alpha: 0,
      duration: 420,
      onComplete: () => {
        after();
        this.tweens.add({
          targets: this.bg,
          alpha: 1,
          duration: 600,
        });
      },
    });
  }

  private _showEpilogueBeat(index: number): void {
    if (index >= EPILOGUE_BEATS.length) {
      this._showThanks();
      return;
    }
    this.beatIndex = index;
    this._renderBeat(EPILOGUE_BEATS[index], GREEN_TITLE, GREEN_STROKE, () => {
      this.timer = this.time.delayedCall(HOLD_MS, () => this._advanceEpilogue());
    });
  }

  private _advanceEpilogue(): void {
    this._clearTimer();
    this.skipBusy = true;
    this.tweens.add({
      targets: [this.titleText, this.bodyText],
      alpha: 0,
      duration: FADE_MS,
      onComplete: () => this._showEpilogueBeat(this.beatIndex + 1),
    });
  }

  private _showThanks(): void {
    this.phase = 'thanks';
    this._clearTimer();
    this.hintText.setText('');

    this.titleText.setText('THANK YOU FOR PLAYING')
      .setStyle({ ...neonTitleStyle(28), color: GOLD_TITLE, stroke: GOLD_STROKE })
      .setAlpha(0);

    this.bodyText.setText('Casino Climb\n\nYou leave the House with your memory intact.\n\nMade by Dusan & Tomas')
      .setAlpha(0);

    this.tweens.add({
      targets: [this.titleText, this.bodyText],
      alpha: 1,
      duration: 600,
    });

    this.time.delayedCall(4000, () => this._returnToMenu());
  }

  private _returnToMenu(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this._clearTimer();
    resetNarrativeRunState();
    resetMemoryRunState();
    resetRun();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this._forcePageReload();
    });
  }

  private _forcePageReload(autoStartFloor1 = false): void {
    if (typeof window !== 'undefined' && window.location) {
      if (autoStartFloor1 && window.sessionStorage) {
        try {
          window.sessionStorage.setItem(AUTO_START_RUN_STORAGE_KEY, '1');
        } catch {
          // Ignore storage failures and continue with reload fallback behavior.
        }
      }
      window.location.reload();
      return;
    }

    // Fallback for non-browser runtimes.
    this.scene.start('MenuScene');
  }

  // ── Skip input ──────────────────────────────────────────

  private _onSkipInput(): void {
    if (this.transitioning || this.skipBusy) return;
    if (this.phase === 'reveal') this._advanceReveal();
    // Keep leave sequence order deterministic: nature epilogue -> thanks -> menu.
    // Do not allow skip input to jump these beats.
  }

  // ── Beat rendering ──────────────────────────────────────

  private _renderBeat(beat: Beat, titleColor: string, titleStroke: string, onShown: () => void): void {
    this.skipBusy = true;
    this.titleText
      .setText(beat.title)
      .setStyle({ ...neonTitleStyle(30), color: titleColor, stroke: titleStroke, align: 'center' })
      .setAlpha(0);
    this.bodyText
      .setText(beat.lines.join('\n'))
      .setAlpha(0);

    this.tweens.add({
      targets: [this.titleText, this.bodyText],
      alpha: 1,
      duration: FADE_MS,
      onComplete: () => {
        this.skipBusy = false;
        onShown();
      },
    });
  }

  private _clearTimer(): void {
    if (this.timer) {
      this.timer.remove(false);
      this.timer = null;
    }
  }

  // ── Backdrops ───────────────────────────────────────────

  private _drawVaultBackdrop(): void {
    const { width, height } = this.scale;
    this.bg.clear();
    this.bg.fillStyle(THEME.bgDeep, 1);
    this.bg.fillRect(0, 0, width, height);
    this.bg.fillStyle(THEME.goldBright, 0.06);
    this.bg.fillCircle(width / 2, height * 0.22, 280);
    this.bg.fillStyle(THEME.pink, 0.04);
    this.bg.fillCircle(width * 0.2, height * 0.32, 160);
    this.bg.fillCircle(width * 0.8, height * 0.32, 160);
    this.bg.fillStyle(THEME.ivorySoft, 0.04);
    this.bg.fillRect(width * 0.12, height * 0.72, width * 0.76, 2);
  }

  private _drawNatureBackdrop(): void {
    const { width, height } = this.scale;
    const horizon = height * 0.58;
    this.bg.clear();

    // Night-to-dawn sky
    this.bg.fillStyle(0x141c2a, 1);
    this.bg.fillRect(0, 0, width, horizon);

    // Warm horizon glow
    this.bg.fillStyle(0xf8cf72, 0.14);
    this.bg.fillCircle(width * 0.68, horizon - 20, 170);

    // Distant field line
    this.bg.fillStyle(0x14301c, 1);
    this.bg.fillRect(0, horizon, width, 6);

    // Ground
    this.bg.fillStyle(0x0a1a10, 1);
    this.bg.fillRect(0, horizon + 6, width, height - (horizon + 6));

    // Tree silhouettes
    this.bg.fillStyle(0x040d07, 1);
    const drawTree = (x: number, base: number, hw: number, th: number) => {
      this.bg.fillTriangle(x, base - th, x - hw, base, x + hw, base);
      this.bg.fillRect(x - 3, base, 6, 12);
    };
    drawTree(62, horizon, 22, 72);
    drawTree(114, horizon, 17, 54);
    drawTree(162, horizon, 14, 42);
    drawTree(width - 62, horizon, 24, 76);
    drawTree(width - 114, horizon, 19, 58);
    drawTree(width - 162, horizon, 16, 46);

    // Hills behind trees
    this.bg.fillStyle(0x0b1c12, 0.85);
    this.bg.fillEllipse(width / 2, horizon + height * 0.18, width * 1.2, height * 0.28);

    // Stars (deterministic layout)
    this.bg.fillStyle(0xfff4d1, 0.7);
    for (let i = 0; i < 34; i++) {
      const sx = 20 + (i * 73 + 37) % (width - 40);
      const sy = 16 + (i * 41 + 19) % Math.floor(horizon * 0.7);
      this.bg.fillCircle(sx, sy, 1);
    }
  }
}
