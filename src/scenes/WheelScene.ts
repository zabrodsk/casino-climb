import Phaser, { Scene, GameObjects } from 'phaser';
import { WHEEL_SEGMENTS, spinWheel, segmentToEffect, WheelSegment } from '../games/wheel';
import {
  getActiveEffect, setActiveEffect, grantReviveToken,
  hasReviveToken,
} from '../state/coinState';
import { THEME, COLOR, FONT, drawNestedButton, neonTitleStyle, buttonLabelStyle, drawFramedPanel } from '../ui/theme';
import { addGameplaySettingsGear } from '../ui/gameplaySettings';
import { registerDeveloperUnlockHotkey } from '../dev/developerHotkeys';

const WHEEL_CX = 512;
const WHEEL_CY = 330;
const WHEEL_R  = 190;

export class WheelScene extends Scene {
  private currentCoins = 200;
  private wheelContainer!: GameObjects.Container;
  private pointerGraphic!: GameObjects.Graphics;
  private coinsText!: GameObjects.Text;
  private phaseText!: GameObjects.Text;
  private resultPanel!: GameObjects.Graphics;
  private resultTitle!: GameObjects.Text;
  private resultFlavor!: GameObjects.Text;
  private resultCoins!: GameObjects.Text;
  private continueBtn!: GameObjects.Graphics;
  private continueBtnText!: GameObjects.Text;
  private continueZone!: GameObjects.Zone;

  private speechBg!: GameObjects.Graphics;
  private speechText!: GameObjects.Text;
  private _speechReveal: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('WheelScene');
  }

  init(data: { coins: number }) {
    this.currentCoins = data.coins ?? 200;
  }

  create() {
    const W = 1024, H = 768;

    // ── Background ────────────────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(0x05000f, 1);
    bg.fillRect(0, 0, W, H);
    // Starfield
    for (let i = 0; i < 120; i++) {
      const sx = Math.floor(Math.random() * W);
      const sy = Math.floor(Math.random() * H);
      const alpha = 0.2 + Math.random() * 0.5;
      bg.fillStyle(0xcc88ff, alpha);
      bg.fillRect(sx, sy, 1, 1);
    }

    const border = this.add.graphics();
    border.lineStyle(3, 0xcc44ff, 1);
    border.strokeRect(20, 20, W - 40, H - 40);

    this.add.text(W / 2, 48, 'FLOOR 4 — THE FATE CHAMBER', neonTitleStyle(30)).setOrigin(0.5);

    this.coinsText = this.add.text(W - 40, 48, `Coins: ${this.currentCoins}`, {
      fontSize: '22px', color: COLOR.ivory, fontFamily: FONT.mono,
    }).setOrigin(1, 0.5);

    // Active effect indicator
    const effect = getActiveEffect();
    if (effect) {
      const effectLabel = effect.type === 'buff' ? '✦ GOLDEN HAND active' : '✦ HEXED active';
      const effectColor = effect.type === 'buff' ? COLOR.goldText : '#ff6666';
      this.add.text(40, 48, effectLabel, { fontSize: '14px', color: effectColor, fontFamily: FONT.mono }).setOrigin(0, 0.5);
    }

    if (hasReviveToken()) {
      this.add.text(40, 72, '✦ REVIVE TOKEN held', { fontSize: '14px', color: '#40e0d0', fontFamily: FONT.mono }).setOrigin(0, 0.5);
    }

    const divider = this.add.graphics();
    divider.lineStyle(1, 0x6600cc, 0.4);
    divider.lineBetween(60, 88, W - 60, 88);

    // ── Wheel ─────────────────────────────────────────────────────────────
    this._buildWheel();
    this._buildPointer();

    // ── Speech bubble ─────────────────────────────────────────────────────
    this._buildSpeechBubble();

    // ── Result panel (hidden initially) ───────────────────────────────────
    this._buildResultPanel();

    // ── Choice screen ─────────────────────────────────────────────────────
    this._showChoicePhase();
    addGameplaySettingsGear(this, 'WheelScene');
    registerDeveloperUnlockHotkey(this, () => this.unlockForDevelopers());

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // ── Wheel construction ─────────────────────────────────────────────────

  private _buildWheel(): void {
    this.wheelContainer = this.add.container(WHEEL_CX, WHEEL_CY);

    const g = this.add.graphics();
    const labelObjects: GameObjects.Text[] = [];

    // Draw each segment
    for (const seg of WHEEL_SEGMENTS) {
      const startRad = Phaser.Math.DegToRad(seg.startDeg - 90); // -90 so 0° = top
      const endRad   = Phaser.Math.DegToRad(seg.startDeg + seg.arcDeg - 90);

      g.fillStyle(seg.color, 1);
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, WHEEL_R, startRad, endRad, false);
      g.closePath();
      g.fillPath();

      // Segment divider line
      g.lineStyle(1, 0x000000, 0.5);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(startRad) * WHEEL_R, Math.sin(startRad) * WHEEL_R);
      g.strokePath();

      // Label
      const midRad = Phaser.Math.DegToRad(seg.startDeg + seg.arcDeg / 2 - 90);
      const lx = Math.cos(midRad) * WHEEL_R * 0.66;
      const ly = Math.sin(midRad) * WHEEL_R * 0.66;
      const label = this.add.text(lx, ly, seg.label, {
        fontSize: '11px',
        fontFamily: FONT.mono,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);
      labelObjects.push(label);
    }

    // Outer rim
    g.lineStyle(4, 0xffd700, 1);
    g.strokeCircle(0, 0, WHEEL_R);

    // Center hub
    g.fillStyle(0x1a0030, 1);
    g.fillCircle(0, 0, 18);
    g.lineStyle(3, 0xffd700, 1);
    g.strokeCircle(0, 0, 18);

    this.wheelContainer.add(g);
    labelObjects.forEach(l => this.wheelContainer.add(l));
  }

  private _buildPointer(): void {
    this.pointerGraphic = this.add.graphics();
    const px = WHEEL_CX;
    const py = WHEEL_CY - WHEEL_R - 6;

    this.pointerGraphic.fillStyle(0xffd700, 1);
    // Downward-pointing triangle
    this.pointerGraphic.fillTriangle(px - 12, py - 20, px + 12, py - 20, px, py + 4);
    this.pointerGraphic.lineStyle(2, 0xffffff, 0.8);
    this.pointerGraphic.strokeTriangle(px - 12, py - 20, px + 12, py - 20, px, py + 4);
    this.pointerGraphic.setDepth(10);
  }

  // ── Choice phase ───────────────────────────────────────────────────────

  private _showChoicePhase(): void {
    const W = 1024;

    this.phaseText = this.add.text(W / 2, 590, 'The Wheel of Fate awaits.\nSpin at your own risk.', {
      fontSize: '18px', fontFamily: FONT.mono, color: COLOR.ivorySoft,
      align: 'center',
    }).setOrigin(0.5);

    // PASS BY button (left)
    const passBtn = this.add.graphics();
    const passBtnText = this.add.text(W / 2 - 140, 660, 'PASS BY', buttonLabelStyle(22)).setOrigin(0.5);
    drawNestedButton(passBtn, W / 2 - 140, 660, 180, 56, false);
    const passZone = this.add.zone(W / 2 - 140, 660, 180, 56).setInteractive({ cursor: 'pointer' });
    passZone.on('pointerover', () => drawNestedButton(passBtn, W / 2 - 140, 660, 180, 56, true));
    passZone.on('pointerout',  () => drawNestedButton(passBtn, W / 2 - 140, 660, 180, 56, false));
    passZone.on('pointerdown', () => {
      passZone.disableInteractive();
      this._showSpeech('You walk past the wheel. Wise... or cowardly?');
      this.time.delayedCall(1800, () => this._leave());
    });

    // TEMPT FATE button (right)
    const fateBtn = this.add.graphics();
    const fateBtnText = this.add.text(W / 2 + 140, 660, 'TEMPT FATE', buttonLabelStyle(22)).setOrigin(0.5);
    this._drawFateButton(fateBtn, W / 2 + 140, 660, 200, 56, false);
    const fateZone = this.add.zone(W / 2 + 140, 660, 200, 56).setInteractive({ cursor: 'pointer' });
    fateZone.on('pointerover', () => this._drawFateButton(fateBtn, W / 2 + 140, 660, 200, 56, true));
    fateZone.on('pointerout',  () => this._drawFateButton(fateBtn, W / 2 + 140, 660, 200, 56, false));
    fateZone.on('pointerdown', () => {
      fateZone.disableInteractive();
      passZone.disableInteractive();
      passBtn.setVisible(false); passBtnText.setVisible(false);
      fateBtn.setVisible(false); fateBtnText.setVisible(false);
      this.phaseText.setVisible(false);
      this._doSpin();
    });
  }

  private _drawFateButton(g: GameObjects.Graphics, cx: number, cy: number, w: number, h: number, hover: boolean): void {
    g.clear();
    g.fillStyle(hover ? 0x5500aa : 0x3a0088, 1);
    g.fillRect(cx - w / 2, cy - h / 2, w, h);
    g.fillStyle(hover ? 0x8833dd : 0x6600cc, 1);
    g.fillRect(cx - w / 2 + 4, cy - h / 2 + 4, w - 8, h - 8);
    g.lineStyle(2, 0xcc44ff, 1);
    g.strokeRect(cx - w / 2, cy - h / 2, w, h);
  }

  // ── Spin phase ─────────────────────────────────────────────────────────

  private _doSpin(): void {
    const chosen = spinWheel();

    // Target angle: spin 7 full rotations + offset to land chosen segment at top
    const chosenMidDeg = chosen.startDeg + chosen.arcDeg / 2;
    // We want chosenMidDeg (in container space, measured from top) to end at 0°
    // container.angle = 360*N - chosenMidDeg  (N=7)
    const targetAngle = 360 * 7 - chosenMidDeg;

    this._showSpeech('The wheel turns...');

    this.tweens.add({
      targets: this.wheelContainer,
      angle: targetAngle,
      duration: 4500,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.time.delayedCall(400, () => this._showResult(chosen));
      },
    });
  }

  // ── Result phase ───────────────────────────────────────────────────────

  private _showResult(seg: WheelSegment): void {
    // Apply coin delta
    const prevCoins = this.currentCoins;
    this.currentCoins = Math.max(0, this.currentCoins + seg.coinDelta);

    // Apply effect
    if (seg.effectType === 'revive') {
      grantReviveToken();
    } else if (seg.effectType === 'buff' || seg.effectType === 'curse') {
      setActiveEffect(segmentToEffect(seg));
    }

    // Update coins display
    this.coinsText.setText(`Coins: ${this.currentCoins}`);

    // Show result panel
    this.resultPanel.setVisible(true);
    this.resultTitle.setText(seg.label).setVisible(true);

    let detailLine = '';
    if (seg.coinDelta > 0)  detailLine = `+${seg.coinDelta} coins`;
    if (seg.coinDelta < 0)  detailLine = `${seg.coinDelta} coins`;
    if (seg.effectType === 'revive') detailLine = 'Revive token granted';
    if (seg.effectType === 'buff')   detailLine = '+25% gains next game';
    if (seg.effectType === 'curse' && seg.coinDelta > 0)  detailLine = `+${seg.coinDelta} coins — HEXED next game`;
    if (seg.effectType === 'curse' && seg.coinDelta === 0) detailLine = '-25% gains next game';

    this.resultCoins.setText(detailLine).setVisible(true);
    this.resultFlavor.setText(seg.flavor).setVisible(true);
    this.continueBtn.setVisible(true);
    this.continueBtnText.setVisible(true);
    this.continueZone.setInteractive({ cursor: 'pointer' });

    this._showSpeech(seg.flavor);

    // Colour result title based on outcome
    const isGood = seg.coinDelta > 0 || seg.effectType === 'revive' || seg.effectType === 'buff';
    const isBad  = seg.coinDelta < 0 || seg.effectType === 'curse';
    this.resultTitle.setColor(isGood ? COLOR.winGreen : isBad ? COLOR.loseRed : COLOR.goldText);
  }

  private _buildResultPanel(): void {
    const W = 1024;
    const panelW = 480, panelH = 140;
    const px = (W - panelW) / 2;
    const py = 570;

    this.resultPanel = this.add.graphics().setVisible(false);
    drawFramedPanel(this.resultPanel, px, py, panelW, panelH, { borderWidth: 2, alpha: 0.95 });

    this.resultTitle = this.add.text(W / 2, py + 30, '', {
      fontSize: '28px', fontFamily: FONT.mono, fontStyle: 'bold', color: COLOR.winGreen,
    }).setOrigin(0.5).setVisible(false);

    this.resultCoins = this.add.text(W / 2, py + 64, '', {
      fontSize: '18px', fontFamily: FONT.mono, color: COLOR.ivory,
    }).setOrigin(0.5).setVisible(false);

    this.resultFlavor = this.add.text(W / 2, py + 92, '', {
      fontSize: '14px', fontFamily: FONT.mono, color: COLOR.ivorySoft,
    }).setOrigin(0.5).setVisible(false);

    const contY = py + panelH + 30;
    this.continueBtn = this.add.graphics().setVisible(false);
    this.continueBtnText = this.add.text(W / 2, contY, 'CONTINUE', buttonLabelStyle(22)).setOrigin(0.5).setVisible(false);
    drawNestedButton(this.continueBtn, W / 2, contY, 200, 52, false);

    this.continueZone = this.add.zone(W / 2, contY, 200, 52);
    this.continueZone.on('pointerover', () => drawNestedButton(this.continueBtn, W / 2, contY, 200, 52, true));
    this.continueZone.on('pointerout',  () => drawNestedButton(this.continueBtn, W / 2, contY, 200, 52, false));
    this.continueZone.on('pointerdown', () => {
      this.continueZone.disableInteractive();
      this._leave();
    });
  }

  private unlockForDevelopers(): void {
    this.currentCoins = Math.max(this.currentCoins, 999);
    this.coinsText.setText(`Coins: ${this.currentCoins}`);
    this._leave();
  }

  // ── Leave ──────────────────────────────────────────────────────────────

  private _leave(): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      try {
        this.scene.get('DungeonScene').events.emit('game-complete', {
          coins: this.currentCoins,
          won: true,
        });
      } catch (_) {}
      this.scene.stop('WheelScene');
    });
  }

  // ── Speech bubble ──────────────────────────────────────────────────────

  private _buildSpeechBubble(): void {
    const W = 1024, H = 768;
    const bubbleW = 640, bubbleH = 64;
    const bx = (W - bubbleW) / 2;
    const by = H - 20 - bubbleH;

    this.speechBg = this.add.graphics();
    drawFramedPanel(this.speechBg, bx, by, bubbleW, bubbleH, { borderWidth: 2, alpha: 0.95 });
    this.speechBg.setVisible(false).setDepth(20);

    this.speechText = this.add.text(bx + 12, by + 10, '', {
      fontSize: '15px', fontFamily: FONT.mono, color: COLOR.ivorySoft,
      wordWrap: { width: bubbleW - 24 },
    }).setVisible(false).setDepth(21);
  }

  private _showSpeech(text: string): void {
    if (this._speechReveal) { this._speechReveal.remove(false); this._speechReveal = null; }

    this.speechBg.setVisible(true).setAlpha(1);
    this.speechText.setVisible(true).setAlpha(1).setText('');

    let i = 0;
    this._speechReveal = this.time.addEvent({
      delay: 28,
      repeat: text.length - 1,
      callback: () => {
        i++;
        this.speechText.setText(text.slice(0, i));
        if (i >= text.length) this._speechReveal = null;
      },
    });
  }
}
