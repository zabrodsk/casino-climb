import { Scene, GameObjects } from 'phaser';
import { resolve, nextCrashPoint, isValidBet } from '../games/crash';
import { THEME, COLOR, FONT, drawNestedButton, neonTitleStyle, buttonLabelStyle } from '../ui/theme';
import { getActiveEffect, clearActiveEffect } from '../state/coinState';

const WIN_TARGET = 350;
const BET_OPTIONS = [10, 25, 50];

export class CrashScene extends Scene {
  private currentCoins: number = 200;
  private selectedBet: number = 0;

  // Round state
  private playing: boolean = false;
  private currentMult: number = 1.0;
  private crashPoint: number = 2.0;
  private cashedOut: boolean = false;
  private successfulCashOuts: number = 0;

  // Ticker
  private tickEvent: Phaser.Time.TimerEvent | null = null;

  // Graph points
  private graphPoints: Array<{ x: number; y: number }> = [];

  // UI references
  private coinsText!: GameObjects.Text;
  private multDisplay!: GameObjects.Text;
  private graphGraphics!: GameObjects.Graphics;
  private resultText!: GameObjects.Text;
  private targetReachedText!: GameObjects.Text;
  private playBtn!: GameObjects.Graphics;
  private playBtnText!: GameObjects.Text;
  private cashOutBtn!: GameObjects.Graphics;
  private cashOutBtnText!: GameObjects.Text;
  private leaveBtn!: GameObjects.Graphics;
  private betButtons!: Array<{ bg: GameObjects.Graphics; label: GameObjects.Text; bet: number }>;
  private flashOverlay!: GameObjects.Graphics;

  // Zone refs stored for enable/disable
  private _playZone!: GameObjects.Zone;
  private _cashOutZone!: GameObjects.Zone;

  constructor() {
    super('CrashScene');
  }

  init(data: { coins: number; floor?: number }) {
    this.currentCoins = data.coins ?? 200;
    this.selectedBet = 0;
    this.playing = false;
    this.currentMult = 1.0;
    this.cashedOut = false;
    this.successfulCashOuts = 0;
    this.graphPoints = [];
    this.tickEvent = null;
  }

  create() {
    const W = 1024;
    const H = 768;

    // Deep purple background
    const bg = this.add.graphics();
    bg.fillStyle(THEME.bgDeep, 0.97);
    bg.fillRect(0, 0, W, H);

    // Checker ground pattern in bottom third
    for (let y = 442; y < H; y += 12) {
      for (let x = 0; x < W; x += 18) {
        const checker = ((x / 18) + (y / 12)) % 2 === 0;
        bg.fillStyle(checker ? THEME.bgInset : THEME.bgPanelAlt, 1);
        bg.fillRect(x, y, 18, 12);
      }
    }

    // Border: 3px gold rect inset 20px
    const border = this.add.graphics();
    border.lineStyle(3, THEME.goldDim, 1);
    border.strokeRect(20, 20, W - 40, H - 40);

    // Title
    this.add.text(W / 2, 48, 'FLOOR 2 — THE CRASH HALL', neonTitleStyle(32)).setOrigin(0.5);

    // Subtitle
    this.add.text(W / 2, 92, 'Cash out before the crash.', {
      fontFamily: FONT.mono,
      fontSize: '20px',
      color: COLOR.goldText,
    }).setOrigin(0.5);

    // Coins display (top right)
    this.coinsText = this.add.text(W - 40, 48, `Coins: ${this.currentCoins}`, {
      fontSize: '22px',
      color: COLOR.ivory,
      fontFamily: FONT.mono,
    }).setOrigin(1, 0.5);

    this.add.text(W - 40, 78, `Target: ${WIN_TARGET} to advance`, {
      fontSize: '16px',
      color: COLOR.goldText,
      fontFamily: FONT.mono,
    }).setOrigin(1, 0.5);

    // Divider line
    const divider = this.add.graphics();
    divider.lineStyle(1, THEME.goldDim, 0.3);
    divider.lineBetween(60, 118, W - 60, 118);

    // --- Bet buttons ---
    const betY = 175;
    this.add.text(W / 2, 140, 'SELECT BET', {
      fontSize: '14px',
      color: COLOR.goldText,
      fontFamily: FONT.mono,
    }).setOrigin(0.5);

    this.betButtons = [];
    const btnW = 110;
    const btnH = 50;
    const betSpacing = 140;
    const betStartX = W / 2 - betSpacing;

    BET_OPTIONS.forEach((bet, i) => {
      const x = betStartX + i * betSpacing;
      const bg = this.add.graphics();
      const label = this.add.text(x, betY, `BET ${bet}`, buttonLabelStyle(18)).setOrigin(0.5);

      drawNestedButton(bg, x, betY, btnW, btnH, false);

      const zone = this.add.zone(x, betY, btnW, btnH).setInteractive({ cursor: 'pointer' });
      zone.on('pointerover', () => {
        if (this.selectedBet !== bet && !this.playing) drawNestedButton(bg, x, betY, btnW, btnH, true);
      });
      zone.on('pointerout', () => {
        if (this.selectedBet !== bet) drawNestedButton(bg, x, betY, btnW, btnH, false);
      });
      zone.on('pointerdown', () => { if (!this.playing) this.selectBet(bet); });

      this.betButtons.push({ bg, label, bet });
    });

    // --- Multiplier display (center) ---
    this.multDisplay = this.add.text(W / 2, 310, '1.00x', {
      fontSize: '72px',
      color: COLOR.goldBright,
      fontFamily: FONT.mono,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // --- Graph ---
    const graphY = 360;
    const graphH = 120;
    const graphW = 600;
    const graphX = (W - graphW) / 2;

    const graphBorder = this.add.graphics();
    graphBorder.lineStyle(1, THEME.goldDim, 0.2);
    graphBorder.strokeRect(graphX, graphY, graphW, graphH);

    this.graphGraphics = this.add.graphics();

    // --- Result text ---
    this.resultText = this.add.text(W / 2, 500, '', {
      fontSize: '22px',
      color: COLOR.winGreen,
      fontFamily: FONT.mono,
    }).setOrigin(0.5);

    // --- Target reached text ---
    this.targetReachedText = this.add.text(W / 2, 535, '', {
      fontSize: '18px',
      color: COLOR.pink,
      fontFamily: FONT.mono,
    }).setOrigin(0.5).setVisible(false);

    // --- PLAY button ---
    const playY = 590;
    this.playBtn = this.add.graphics();
    this.playBtnText = this.add.text(W / 2, playY, 'PLAY', buttonLabelStyle(28)).setOrigin(0.5);
    this._drawDisabledBtn(this.playBtn, W / 2, playY, 200, 60);
    this._setDisabledLabelColor(this.playBtnText);

    this._playZone = this.add.zone(W / 2, playY, 200, 60).setInteractive({ cursor: 'pointer' });
    this._playZone.on('pointerover', () => {
      if (this.canPlay()) drawNestedButton(this.playBtn, W / 2, playY, 200, 60, true);
    });
    this._playZone.on('pointerout', () => {
      if (this.canPlay()) drawNestedButton(this.playBtn, W / 2, playY, 200, 60, false);
    });
    this._playZone.on('pointerdown', () => { if (this.canPlay()) this.startRound(); });

    // --- CASH OUT button (hidden until round starts) ---
    const cashOutY = 590;
    this.cashOutBtn = this.add.graphics().setVisible(false);
    this.cashOutBtnText = this.add.text(W / 2, cashOutY, 'CASH OUT', buttonLabelStyle(28)).setOrigin(0.5).setVisible(false);
    drawNestedButton(this.cashOutBtn, W / 2, cashOutY, 220, 60, false);

    this._cashOutZone = this.add.zone(W / 2, cashOutY, 220, 60).setInteractive({ cursor: 'pointer' });
    this._cashOutZone.setVisible(false);
    this._cashOutZone.on('pointerdown', () => { if (this.playing && !this.cashedOut) this.doCashOut(); });

    // --- Flash overlay (full screen red flash on crash) ---
    this.flashOverlay = this.add.graphics();
    this.flashOverlay.fillStyle(0xff0000, 0.3);
    this.flashOverlay.fillRect(0, 0, W, H);
    this.flashOverlay.setAlpha(0);
    this.flashOverlay.setDepth(90);

    // --- EXIT TO HALL button ---
    const leaveY = 700;
    this.leaveBtn = this.add.graphics();
    this.add.text(W / 2, leaveY, 'EXIT TO HALL', buttonLabelStyle(18)).setOrigin(0.5);
    drawNestedButton(this.leaveBtn, W / 2, leaveY, 220, 46, false);

    const leaveZone = this.add.zone(W / 2, leaveY, 220, 46).setInteractive({ cursor: 'pointer' });
    leaveZone.on('pointerover', () => { if (!this.playing) drawNestedButton(this.leaveBtn, W / 2, leaveY, 220, 46, true); });
    leaveZone.on('pointerout', () => { if (!this.playing) drawNestedButton(this.leaveBtn, W / 2, leaveY, 220, 46, false); });
    leaveZone.on('pointerdown', () => { if (!this.playing) this.leave(); });

    this.updatePlayButton();
    this.refreshBetButtons();

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // ---- UI helpers ----

  private _drawDisabledBtn(g: GameObjects.Graphics, cx: number, cy: number, w: number, h: number): void {
    g.clear();
    g.fillStyle(0x2a1f38, 1);
    g.fillRect(cx - w / 2, cy - h / 2, w, h);
    g.fillStyle(THEME.woodDark, 1);
    g.fillRect(cx - w / 2 + 6, cy - h / 2 + 6, w - 12, h - 12);
    g.fillStyle(THEME.pinkDeep, 0.5);
    g.fillRect(cx - w / 2 + 10, cy - h / 2 + 10, w - 20, h - 20);
  }

  private _setDisabledLabelColor(t: GameObjects.Text): void {
    t.setColor('#6a5f78');
    t.setStroke('#6a5f78', 0);
  }

  private _drawSelectedBtn(g: GameObjects.Graphics, cx: number, cy: number, w: number, h: number): void {
    drawNestedButton(g, cx, cy, w, h, true);
    g.lineStyle(2, THEME.ivory, 0.6);
    g.strokeRect(cx - w / 2, cy - h / 2, w, h);
  }

  private selectBet(bet: number) {
    this.selectedBet = this.selectedBet === bet ? 0 : bet;
    this.refreshBetButtons();
    this.updatePlayButton();
  }

  private refreshBetButtons() {
    const W = 1024;
    const betY = 175;
    const btnW = 110;
    const btnH = 50;
    const betSpacing = 140;
    const betStartX = W / 2 - betSpacing;

    this.betButtons.forEach(({ bg, label, bet }, i) => {
      const x = betStartX + i * betSpacing;
      const disabled = bet > this.currentCoins;
      const active = this.selectedBet === bet;

      if (active) {
        this._drawSelectedBtn(bg, x, betY, btnW, btnH);
        label.setColor(COLOR.ivory).setStroke(COLOR.woodDeep, 5);
      } else if (disabled) {
        this._drawDisabledBtn(bg, x, betY, btnW, btnH);
        this._setDisabledLabelColor(label);
      } else {
        drawNestedButton(bg, x, betY, btnW, btnH, false);
        label.setColor(COLOR.ivory).setStroke(COLOR.woodDeep, 5);
      }
    });
  }

  private canPlay(): boolean {
    return isValidBet(this.currentCoins, this.selectedBet) && !this.playing;
  }

  private updatePlayButton() {
    const W = 1024;
    const playY = 590;
    if (this.canPlay()) {
      drawNestedButton(this.playBtn, W / 2, playY, 200, 60, false);
      this.playBtnText.setColor(COLOR.ivory).setStroke(COLOR.woodDeep, 5);
    } else {
      this._drawDisabledBtn(this.playBtn, W / 2, playY, 200, 60);
      this._setDisabledLabelColor(this.playBtnText);
    }
  }

  private multColor(mult: number): string {
    if (mult < 2) return COLOR.goldBright;
    if (mult < 4) return '#ff9933';
    return COLOR.loseRed;
  }

  // ---- Round logic ----

  private startRound() {
    this.playing = true;
    this.cashedOut = false;
    this.currentMult = 1.0;
    this.graphPoints = [];

    this.crashPoint = nextCrashPoint();

    this.resultText.setText('');
    this.targetReachedText.setVisible(false);

    this.playBtn.setVisible(false);
    this.playBtnText.setVisible(false);
    this._playZone.setVisible(false);
    this.cashOutBtn.setVisible(true);
    this.cashOutBtnText.setVisible(true);
    this._cashOutZone.setVisible(true);

    this.refreshBetButtons();

    this.multDisplay.setText('1.00x');
    this.multDisplay.setColor(COLOR.goldBright);
    this.graphGraphics.clear();

    this._scheduleTick();
  }

  private _scheduleTick() {
    const baseDelay = 50;
    const delay = baseDelay / Math.max(1, Math.pow(this.currentMult, 0.3));

    this.tickEvent = this.time.delayedCall(delay, () => {
      this._tick();
    });
  }

  private _tick() {
    if (!this.playing) return;

    const increment = 0.02 + this.currentMult * 0.005;
    this.currentMult = Math.round((this.currentMult + increment) * 100) / 100;

    const color = this.multColor(this.currentMult);
    this.multDisplay.setText(this.currentMult.toFixed(2) + 'x');
    this.multDisplay.setColor(color);

    this.tweens.add({
      targets: this.multDisplay,
      scaleX: { from: 1.05, to: 1.0 },
      scaleY: { from: 1.05, to: 1.0 },
      duration: 80,
      ease: 'Sine.easeOut',
    });

    this._drawGraph();

    if (this.currentMult >= this.crashPoint) {
      this._doCrash();
      return;
    }

    this._scheduleTick();
  }

  private _drawGraph() {
    const W = 1024;
    const graphW = 600;
    const graphH = 120;
    const graphX = (W - graphW) / 2;
    const graphY = 360;
    const maxMult = Math.max(this.currentMult + 1, 3);
    const maxPoints = 120;

    this.graphPoints.push({ x: this.currentMult, y: this.currentMult });

    this.graphGraphics.clear();
    if (this.graphPoints.length < 2) return;

    // Pink neon polyline for rising trajectory
    this.graphGraphics.lineStyle(2, THEME.pink, 0.8);
    this.graphGraphics.beginPath();

    const startIdx = Math.max(0, this.graphPoints.length - maxPoints);
    for (let i = startIdx; i < this.graphPoints.length; i++) {
      const pt = this.graphPoints[i];
      const px = graphX + ((i - startIdx) / Math.max(maxPoints - 1, 1)) * graphW;
      const py = graphY + graphH - ((pt.y - 1) / (maxMult - 1)) * graphH;
      const clampedPy = Math.max(graphY, Math.min(graphY + graphH, py));
      if (i === startIdx) {
        this.graphGraphics.moveTo(px, clampedPy);
      } else {
        this.graphGraphics.lineTo(px, clampedPy);
      }
    }
    this.graphGraphics.strokePath();
  }

  private _doCrash() {
    this.playing = false;

    if (this.tickEvent) {
      this.tickEvent.remove(false);
      this.tickEvent = null;
    }

    this.cameras.main.shake(250, 0.01);

    this.flashOverlay.setAlpha(0.3);
    this.tweens.add({
      targets: this.flashOverlay,
      alpha: 0,
      duration: 250,
      ease: 'Linear',
    });

    this.multDisplay.setText(`CRASHED @ ${this.crashPoint.toFixed(2)}x`);
    this.multDisplay.setColor(COLOR.loseRed);
    this.multDisplay.setFontSize(42);

    this.currentCoins -= this.selectedBet;
    this.coinsText.setText(`Coins: ${this.currentCoins}`);

    this.resultText.setText(`CRASHED @ ${this.crashPoint.toFixed(2)}x — lost ${this.selectedBet}`);
    this.resultText.setColor(COLOR.loseRed);

    this.successfulCashOuts = 0;

    this.cashOutBtn.setVisible(false);
    this.cashOutBtnText.setVisible(false);
    this._cashOutZone.setVisible(false);
    this.playBtn.setVisible(true);
    this.playBtnText.setVisible(true);
    this._playZone.setVisible(true);

    if (!isValidBet(this.currentCoins, this.selectedBet)) {
      this.selectedBet = 0;
    }
    this.refreshBetButtons();
    this.updatePlayButton();

    this.time.delayedCall(600, () => {
      this.multDisplay.setFontSize(72);
    });
  }

  private doCashOut() {
    if (!this.playing || this.cashedOut) return;

    this.cashedOut = true;
    const mult = this.currentMult;

    if (this.tickEvent) {
      this.tickEvent.remove(false);
      this.tickEvent = null;
    }
    this.playing = false;

    const result = resolve({
      coins: this.currentCoins,
      bet: this.selectedBet,
      cashOutAt: mult,
      crashPoint: this.crashPoint,
    });

    this.currentCoins = result.newCoins;
    const winnings = result.payout - this.selectedBet;
    const effect = getActiveEffect();
    if (effect) {
      const adj = Math.round(winnings * effect.magnitude);
      this.currentCoins += effect.type === 'buff' ? adj : -adj;
    }
    this.coinsText.setText(`Coins: ${this.currentCoins}`);

    this.resultText.setText(`+${winnings} coins at ${mult.toFixed(2)}x`);
    this.resultText.setColor(COLOR.winGreen);

    this.successfulCashOuts++;

    const hitTarget = this.currentCoins >= WIN_TARGET;
    const consecutiveHit = this.successfulCashOuts >= 3;

    if (hitTarget || consecutiveHit) {
      this.targetReachedText.setText('TARGET REACHED').setVisible(true);
    }

    this.cashOutBtn.setVisible(false);
    this.cashOutBtnText.setVisible(false);
    this._cashOutZone.setVisible(false);
    this.playBtn.setVisible(true);
    this.playBtnText.setVisible(true);
    this._playZone.setVisible(true);

    if (!isValidBet(this.currentCoins, this.selectedBet)) {
      this.selectedBet = 0;
    }
    this.refreshBetButtons();
    this.updatePlayButton();
  }

  leave() {
    clearActiveEffect();
    const won = this.currentCoins >= WIN_TARGET || this.successfulCashOuts >= 3;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      try {
        this.scene.get('DungeonScene').events.emit('game-complete', {
          coins: this.currentCoins,
          won,
        });
      } catch (_) {
        // DungeonScene may not exist in isolated testing
      }
      this.scene.stop('CrashScene');
    });
  }
}
