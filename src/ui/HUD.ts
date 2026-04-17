import Phaser from 'phaser';
import { THEME, COLOR, FONT, drawFramedPanel } from './theme';

export class HUD {
  private scene: Phaser.Scene;

  // Coin panel
  private coinPanelBg!: Phaser.GameObjects.Graphics;
  private coinIcon!: Phaser.GameObjects.Graphics;
  private coinLabel!: Phaser.GameObjects.Text;
  private _displayCoins = 0;
  private _coinTween: Phaser.Tweens.Tween | null = null;

  // Floor panel
  private floorPanelBg!: Phaser.GameObjects.Graphics;
  private floorIcon!: Phaser.GameObjects.Graphics;
  private floorLabel!: Phaser.GameObjects.Text;

  // Progress bar
  private progressBg!: Phaser.GameObjects.Graphics;
  private progressFill!: Phaser.GameObjects.Graphics;
  private progressLabel!: Phaser.GameObjects.Text;
  private _target: number;
  private _progressPulseTween: Phaser.Tweens.Tween | null = null;
  private _marqueDots: Phaser.GameObjects.Rectangle[] = [];

  // Speech bubble
  private speechBg!: Phaser.GameObjects.Graphics;
  private speechText!: Phaser.GameObjects.Text;
  private _speechReveal: Phaser.Time.TimerEvent | null = null;
  private _speechDismiss: Phaser.Time.TimerEvent | null = null;

  private static readonly PANEL_H = 44;
  private static readonly COIN_PANEL_W = 180;
  private static readonly FLOOR_PANEL_W = 240;
  private static readonly BAR_W = 320;
  private static readonly BAR_H = 14;
  private static readonly BAR_Y = 58;
  static readonly DEPTH = 100;

  constructor(scene: Phaser.Scene, opts?: { target?: number }) {
    this.scene = scene;
    this._target = opts?.target ?? 300;
    this._buildCoinPanel();
    this._buildFloorPanel();
    this._buildProgressBar();
    this._buildSpeechBubble();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  setCoins(coins: number): void {
    if (this._coinTween) {
      this._coinTween.stop();
      this._coinTween = null;
    }
    const from = this._displayCoins;
    this._coinTween = this.scene.tweens.addCounter({
      from,
      to: coins,
      duration: 300,
      ease: 'Linear',
      onUpdate: (tween) => {
        const v = Math.round(tween.getValue() ?? 0);
        this.coinLabel.setText(String(v));
      },
      onComplete: () => {
        this._displayCoins = coins;
        this.coinLabel.setText(String(coins));
      },
    });
  }

  setFloor(floor: number, name: string): void {
    this.floorLabel.setText(`FLOOR ${floor} — ${name.toUpperCase()}`);
  }

  setProgress(current: number, target: number): void {
    const ratio = Math.min(current / target, 1);
    this._drawProgressFill(ratio);

    if (ratio >= 1) {
      this.progressLabel.setText('TARGET REACHED');
      this.progressLabel.setColor(COLOR.pink);
      this.progressLabel.setAlpha(1);
      if (!this._progressPulseTween) {
        this._progressPulseTween = this.scene.tweens.add({
          targets: this.progressFill,
          scaleX: { from: 1, to: 1.05 },
          scaleY: { from: 1, to: 1.05 },
          duration: 250,
          yoyo: true,
          repeat: 0,
          ease: 'Sine.easeInOut',
          onComplete: () => { this._progressPulseTween = null; },
        });
      }
      this._showMarqueDots();
    } else {
      this.progressLabel.setText(`— ADVANCE AT ${target} COINS —`);
      this.progressLabel.setColor(COLOR.ivorySoft);
      this.progressLabel.setAlpha(0.7);
      this._hideMarqueDots();
    }
  }

  showSpeech(text: string): void {
    if (this._speechReveal) {
      this._speechReveal.remove(false);
      this._speechReveal = null;
    }
    if (this._speechDismiss) {
      this._speechDismiss.remove(false);
      this._speechDismiss = null;
    }

    this.speechBg.setVisible(true).setAlpha(1);
    this.speechText.setVisible(true).setAlpha(1).setText('');

    let i = 0;
    this._speechReveal = this.scene.time.addEvent({
      delay: 30,
      repeat: text.length - 1,
      callback: () => {
        i++;
        this.speechText.setText(text.slice(0, i));
        if (i >= text.length) {
          this._speechReveal = null;
          this._speechDismiss = this.scene.time.delayedCall(3000, () => {
            this.scene.tweens.add({
              targets: [this.speechBg, this.speechText],
              alpha: 0,
              duration: 250,
              onComplete: () => {
                this.speechBg.setVisible(false);
                this.speechText.setVisible(false);
              },
            });
            this._speechDismiss = null;
          });
        }
      },
    });
  }

  hideSpeech(): void {
    if (this._speechReveal) { this._speechReveal.remove(false); this._speechReveal = null; }
    if (this._speechDismiss) { this._speechDismiss.remove(false); this._speechDismiss = null; }
    this.speechBg.setVisible(false);
    this.speechText.setVisible(false);
  }

  getObjects(): Phaser.GameObjects.GameObject[] {
    return [
      this.coinPanelBg, this.coinIcon, this.coinLabel,
      this.floorPanelBg, this.floorIcon, this.floorLabel,
      this.progressBg, this.progressFill, this.progressLabel,
      this.speechBg, this.speechText,
      ...this._marqueDots,
    ];
  }

  destroy(): void {
    this.hideSpeech();
    if (this._coinTween) { this._coinTween.stop(); }
    if (this._progressPulseTween) { this._progressPulseTween.stop(); }
    this.coinPanelBg.destroy();
    this.coinIcon.destroy();
    this.coinLabel.destroy();
    this.floorPanelBg.destroy();
    this.floorIcon.destroy();
    this.floorLabel.destroy();
    this.progressBg.destroy();
    this.progressFill.destroy();
    this.progressLabel.destroy();
    this.speechBg.destroy();
    this.speechText.destroy();
    this._marqueDots.forEach(d => d.destroy());
    this._marqueDots = [];
  }

  // ── Private builders ──────────────────────────────────────────────────────

  private _buildCoinPanel(): void {
    const x = 8;
    const y = 8;
    const w = HUD.COIN_PANEL_W;
    const h = HUD.PANEL_H;

    this.coinPanelBg = this.scene.add.graphics();
    this.coinPanelBg.setScrollFactor(0).setDepth(HUD.DEPTH);
    drawFramedPanel(this.coinPanelBg, x, y, w, h, { borderWidth: 2, alpha: 0.92 });

    // 3-layer nested pixel chip icon (poker chip: gold outer, wood middle, pink inner)
    this.coinIcon = this.scene.add.graphics();
    this.coinIcon.setScrollFactor(0).setDepth(HUD.DEPTH + 1);
    const iconCX = x + 22;
    const iconCY = y + h / 2;
    // Outer gold layer
    this.coinIcon.fillStyle(THEME.goldPrimary, 1);
    this.coinIcon.fillRect(iconCX - 10, iconCY - 10, 20, 20);
    // Middle wood layer
    this.coinIcon.fillStyle(THEME.woodDark, 1);
    this.coinIcon.fillRect(iconCX - 7, iconCY - 7, 14, 14);
    // Inner pink layer
    this.coinIcon.fillStyle(THEME.pinkDeep, 1);
    this.coinIcon.fillRect(iconCX - 4, iconCY - 4, 8, 8);
    // Tiny ivory highlight dot top-left
    this.coinIcon.fillStyle(THEME.ivory, 1);
    this.coinIcon.fillRect(iconCX - 6, iconCY - 6, 3, 3);

    this.coinLabel = this.scene.add.text(x + 40, y + h / 2, '0', {
      fontSize: '20px',
      fontFamily: FONT.mono,
      fontStyle: 'bold',
      color: COLOR.ivory,
      stroke: COLOR.woodDeep,
      strokeThickness: 3,
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(HUD.DEPTH + 1);
  }

  private _buildFloorPanel(): void {
    const { width: sw } = this.scene.scale;
    const w = HUD.FLOOR_PANEL_W;
    const h = HUD.PANEL_H;
    const x = sw - 8 - w;
    const y = 8;

    this.floorPanelBg = this.scene.add.graphics();
    this.floorPanelBg.setScrollFactor(0).setDepth(HUD.DEPTH);
    drawFramedPanel(this.floorPanelBg, x, y, w, h, { borderWidth: 2, alpha: 0.92 });

    // Arch icon drawn with flat rects in goldDim
    this.floorIcon = this.scene.add.graphics();
    this.floorIcon.setScrollFactor(0).setDepth(HUD.DEPTH + 1);
    const iconX = x + 14;
    const iconY = y + h / 2;
    this.floorIcon.fillStyle(THEME.goldDim, 0.9);
    // Left pillar
    this.floorIcon.fillRect(iconX - 6, iconY - 7, 4, 10);
    // Right pillar
    this.floorIcon.fillRect(iconX + 2, iconY - 7, 4, 10);
    // Arch top
    this.floorIcon.fillRect(iconX - 6, iconY - 9, 12, 4);

    this.floorLabel = this.scene.add.text(x + 28, y + h / 2, 'FLOOR 1', {
      fontSize: '14px',
      fontFamily: FONT.mono,
      color: COLOR.goldText,
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(HUD.DEPTH + 1);
  }

  private _buildProgressBar(): void {
    const { width: sw } = this.scene.scale;
    const barX = (sw - HUD.BAR_W) / 2;
    const barY = HUD.BAR_Y;

    // Label above bar
    this.progressLabel = this.scene.add.text(sw / 2, barY - 2, `— ADVANCE AT ${this._target} COINS —`, {
      fontSize: '12px',
      fontFamily: FONT.mono,
      color: COLOR.ivorySoft,
    }).setAlpha(0.7).setOrigin(0.5, 1).setScrollFactor(0).setDepth(HUD.DEPTH);

    // Background flat rect with gold border
    this.progressBg = this.scene.add.graphics();
    this.progressBg.setScrollFactor(0).setDepth(HUD.DEPTH);
    this.progressBg.fillStyle(THEME.bgPanelDark, 0.9);
    this.progressBg.fillRect(barX, barY, HUD.BAR_W, HUD.BAR_H);
    this.progressBg.lineStyle(2, THEME.goldDim, 1);
    this.progressBg.strokeRect(barX, barY, HUD.BAR_W, HUD.BAR_H);

    // Fill (drawn separately so we can redraw)
    this.progressFill = this.scene.add.graphics();
    this.progressFill.setScrollFactor(0).setDepth(HUD.DEPTH + 1);
    this._drawProgressFill(0);

    // Marquee dots below bar (hidden until target reached)
    const dotY = barY + HUD.BAR_H + 6;
    const dotPositions = [barX + 20, barX + 80, barX + 160, barX + 240, barX + 300];
    dotPositions.forEach((dx, _idx) => {
      const dot = this.scene.add.rectangle(dx, dotY, 5, 5, THEME.ivory);
      dot.setScrollFactor(0).setDepth(HUD.DEPTH + 1).setAlpha(0).setVisible(false);
      this._marqueDots.push(dot);
    });
  }

  private _drawProgressFill(ratio: number): void {
    const { width: sw } = this.scene.scale;
    const barX = (sw - HUD.BAR_W) / 2;
    const barY = HUD.BAR_Y;
    const innerW = HUD.BAR_W - 4;
    const fillW = Math.max(0, Math.min(ratio * innerW, innerW));

    this.progressFill.clear();
    if (fillW < 2) return;

    const fx = barX + 2;
    const fy = barY + 2;
    const fh = HUD.BAR_H - 4;

    // Three layered flat rectangles for depth
    this.progressFill.fillStyle(THEME.goldPrimary, 1);
    this.progressFill.fillRect(fx, fy, fillW, fh);

    this.progressFill.fillStyle(THEME.goldBright, 0.6);
    this.progressFill.fillRect(fx, fy, fillW, Math.floor(fh * 0.5));

    this.progressFill.fillStyle(THEME.goldLamp, 0.35);
    this.progressFill.fillRect(fx, fy, fillW, Math.floor(fh * 0.25));
  }

  private _showMarqueDots(): void {
    this._marqueDots.forEach((dot, idx) => {
      dot.setVisible(true);
      if (!dot.getData('tweening')) {
        dot.setData('tweening', true);
        this.scene.tweens.add({
          targets: dot,
          alpha: { from: 0.4, to: 1 },
          duration: 420,
          yoyo: true,
          repeat: -1,
          delay: idx * 90,
        });
      }
    });
  }

  private _hideMarqueDots(): void {
    this._marqueDots.forEach(dot => {
      dot.setVisible(false).setAlpha(0);
      dot.setData('tweening', false);
    });
  }

  private _buildSpeechBubble(): void {
    const { width: sw, height: sh } = this.scene.scale;
    const bubbleW = Math.max(420, Math.min(sw * 0.6, 720));
    const bubbleH = 80;
    const bx = (sw - bubbleW) / 2;
    const by = sh - 24 - bubbleH;

    this.speechBg = this.scene.add.graphics();
    this.speechBg.setScrollFactor(0).setDepth(HUD.DEPTH + 2);
    drawFramedPanel(this.speechBg, bx, by, bubbleW, bubbleH, { borderWidth: 3, alpha: 0.92 });
    this.speechBg.setVisible(false);

    this.speechText = this.scene.add.text(bx + 12, by + 12, '', {
      fontSize: '16px',
      fontFamily: FONT.mono,
      color: COLOR.ivorySoft,
      wordWrap: { width: bubbleW - 24 },
    }).setScrollFactor(0).setDepth(HUD.DEPTH + 3).setVisible(false);
  }
}
