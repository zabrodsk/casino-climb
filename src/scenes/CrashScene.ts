import { Scene, GameObjects } from 'phaser';
import { resolve, nextCrashPoint, isValidBet, CRASH_K, crashTimeFromPoint } from '../games/crash';
import { THEME, COLOR, FONT, drawNestedButton, neonTitleStyle, buttonLabelStyle } from '../ui/theme';
import { AudioManager } from '../audio/AudioManager';
import { addGameplaySettingsGear } from '../ui/gameplaySettings';
import { registerDeveloperUnlockHotkey } from '../dev/developerHotkeys';
import { winBurst, addCrtScanlines } from '../ui/particles';
import { getDiscountedBetAmount, hasDiscountForFloor } from '../state/coinState';
import { HouseController } from '../ui/HouseController';

const WIN_TARGET = 350;
const BET_OPTIONS = [10, 25, 50];

export class CrashScene extends Scene {
  private currentCoins: number = 200;
  private floorNumber: number = 1;
  private selectedBet: number = 0;

  // Round state
  private playing: boolean = false;
  private currentMult: number = 1.0;
  private crashPoint: number = 2.0;
  private cashedOut: boolean = false;
  private successfulCashOuts: number = 0;
  private warningPlayed: boolean = false;
  private autoCashout: number = 0;          // 0 = disabled
  private roundHistory: number[] = [];       // last crash points
  private inBetPhase: boolean = false;
  private betPhaseEnd: number = 0;
  private roundStartTime: number = 0;
  private crashTimeForRound: number = 0;
  private lastGraphTime: number = 0;
  private lastSoundTime: number = 0;
  private lastPulseTime: number = 0;

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
  private betButtons!: Array<{ bg: GameObjects.Graphics; label: GameObjects.Text; bet: number; zone: GameObjects.Zone }>;
  private allInBetButton!: { bg: GameObjects.Graphics; label: GameObjects.Text; zone: GameObjects.Zone };
  private flashOverlay!: GameObjects.Graphics;
  private autoCashoutBtns!: Array<{ bg: GameObjects.Graphics; label: GameObjects.Text; value: number; zone: GameObjects.Zone }>;
  private historyContainer!: GameObjects.Graphics;
  private historyLabels!: GameObjects.Text[];
  private countdownText!: GameObjects.Text;

  // Zone refs stored for enable/disable
  private _playZone!: GameObjects.Zone;
  private _cashOutZone!: GameObjects.Zone;

  constructor() {
    super('CrashScene');
  }

  init(data: { coins: number; floor?: number }) {
    this.currentCoins = data.coins ?? 200;
    this.floorNumber = data.floor ?? 1;
    this.selectedBet = 0;
    this.playing = false;
    this.currentMult = 1.0;
    this.cashedOut = false;
    this.successfulCashOuts = 0;
    this.warningPlayed = false;
    this.graphPoints = [];
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

    if (hasDiscountForFloor(this.floorNumber)) {
      this.add.text(40, 78, 'SUPPORT DISCOUNT ACTIVE — bets cost 20% less here', {
        fontFamily: FONT.mono,
        fontSize: '14px',
        color: COLOR.goldText,
      }).setOrigin(0, 0.5);
    }

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

    // ── Auto-cashout row ───────────────────────────────────────────────────
    this.add.text(W / 2, 145, 'AUTO CASHOUT', {
      fontSize: '13px',
      color: COLOR.goldText,
      fontFamily: FONT.mono,
    }).setOrigin(0.5);

    const AUTO_OPTIONS = [0, 1.5, 2, 3, 5];
    const AUTO_LABELS  = ['OFF', '1.5×', '2×', '3×', '5×'];
    const autoBtnW = 72, autoBtnH = 30, autoGap = 10;
    const autoStartX = W / 2 - ((AUTO_OPTIONS.length * (autoBtnW + autoGap)) - autoGap) / 2 + autoBtnW / 2;
    this.autoCashoutBtns = [];
    AUTO_OPTIONS.forEach((val, i) => {
      const ax = autoStartX + i * (autoBtnW + autoGap);
      const ay = 170;
      const abg = this.add.graphics();
      drawNestedButton(abg, ax, ay, autoBtnW, autoBtnH, i === 0);
      if (i === 0) {
        abg.lineStyle(2, THEME.ivory, 0.6);
        abg.strokeRect(ax - autoBtnW / 2, ay - autoBtnH / 2, autoBtnW, autoBtnH);
      }
      const albl = this.add.text(ax, ay, AUTO_LABELS[i], { ...buttonLabelStyle(14), fontSize: '14px' }).setOrigin(0.5);
      if (i !== 0) albl.setColor(COLOR.ivory).setStroke(COLOR.woodDeep, 5);
      const azone = this.add.zone(ax, ay, autoBtnW, autoBtnH).setInteractive({ cursor: 'pointer' });
      azone.on('pointerdown', () => { if (!this.playing && !this.inBetPhase) this.setAutoCashout(val); });
      this.autoCashoutBtns.push({ bg: abg, label: albl, value: val, zone: azone });
    });

    // ── Round history strip ────────────────────────────────────────────────
    this.add.text(W / 2, 208, 'RECENT ROUNDS', {
      fontSize: '11px',
      color: COLOR.goldText,
      fontFamily: FONT.mono,
      alpha: 0.7,
    }).setOrigin(0.5);
    this.historyContainer = this.add.graphics();
    this.historyLabels = [];
    for (let hi = 0; hi < 8; hi++) {
      this.historyLabels.push(
        this.add.text(0, 0, '', { fontSize: '11px', fontFamily: FONT.mono, color: '#ffffff' })
          .setOrigin(0.5).setVisible(false),
      );
    }
    this._drawHistory();

    // --- Bet buttons ---
    const betY = 245;
    this.add.text(W / 2, 240, 'SELECT BET', {
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

      this.betButtons.push({ bg, label, bet, zone });
    });
    const allInBg = this.add.graphics().setVisible(false);
    const allInLabel = this.add.text(W / 2, betY, '', buttonLabelStyle(18)).setOrigin(0.5).setVisible(false);
    const allInZone = this.add.zone(W / 2, betY, 220, btnH).setVisible(false);
    allInZone.on('pointerdown', () => {
      if (this.playing || !this.isLowCoinBetMode()) return;
      this.selectedBet = this.currentCoins;
      AudioManager.playSfx(this, 'bet-select', { volume: 1.3, cooldownMs: 50, allowOverlap: false });
      this.refreshBetButtons();
      this.updatePlayButton();
    });
    this.allInBetButton = { bg: allInBg, label: allInLabel, zone: allInZone };

    // --- Multiplier display (center) ---
    this.multDisplay = this.add.text(W / 2, 340, '1.00x', {
      fontSize: '72px',
      color: COLOR.goldBright,
      fontFamily: FONT.mono,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.countdownText = this.add.text(W / 2, 395, '', {
      fontSize: '20px',
      color: COLOR.goldText,
      fontFamily: FONT.mono,
    }).setOrigin(0.5).setVisible(false);

    // --- Graph ---
    const graphY = 415;
    const graphH = 120;
    const graphW = 600;
    const graphX = (W - graphW) / 2;

    const graphBorder = this.add.graphics();
    graphBorder.lineStyle(1, THEME.goldDim, 0.2);
    graphBorder.strokeRect(graphX, graphY, graphW, graphH);

    this.graphGraphics = this.add.graphics();

    // --- Result text ---
    this.resultText = this.add.text(W / 2, 560, '', {
      fontSize: '22px',
      color: COLOR.winGreen,
      fontFamily: FONT.mono,
    }).setOrigin(0.5);

    // --- Target reached text ---
    this.targetReachedText = this.add.text(W / 2, 590, '', {
      fontSize: '18px',
      color: COLOR.pink,
      fontFamily: FONT.mono,
    }).setOrigin(0.5).setVisible(false);

    // --- PLAY button ---
    const playY = 630;
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
    const cashOutY = 630;
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
    const leaveY = 720;
    this.leaveBtn = this.add.graphics();
    this.add.text(W / 2, leaveY, 'EXIT TO HALL', buttonLabelStyle(18)).setOrigin(0.5);
    drawNestedButton(this.leaveBtn, W / 2, leaveY, 220, 36, false);

    const leaveZone = this.add.zone(W / 2, leaveY, 220, 36).setInteractive({ cursor: 'pointer' });
    leaveZone.on('pointerover', () => { if (!this.playing) drawNestedButton(this.leaveBtn, W / 2, leaveY, 220, 36, true); });
    leaveZone.on('pointerout', () => { if (!this.playing) drawNestedButton(this.leaveBtn, W / 2, leaveY, 220, 36, false); });
    leaveZone.on('pointerdown', () => { if (!this.playing) this.leave(); });

    addCrtScanlines(this);
    this.updatePlayButton();
    this.refreshBetButtons();
    AudioManager.playMusic(this, 'crash-game', { loop: true, restart: true });
    this.events.once('shutdown', () => {
      AudioManager.playMusic(this, 'casino-music', { loop: true, restart: true });
    });

    addGameplaySettingsGear(this, 'CrashScene');
    registerDeveloperUnlockHotkey(this, () => {
      this.currentCoins = 999;
      this.coinsText.setText(`Coins: ${this.currentCoins}`);
      this.leave();
    });
    this.input.keyboard?.on('keydown-ESC', () => { if (!this.playing) this.leave(); });
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
    if (this.isLowCoinBetMode()) return;
    this.selectedBet = this.selectedBet === bet ? 0 : bet;
    AudioManager.playSfx(this, 'bet-select', { volume: 1.3, cooldownMs: 50, allowOverlap: false });
    this.refreshBetButtons();
    this.updatePlayButton();
  }

  private refreshBetButtons() {
    const W = 1024;
    const betY = 245;
    const btnW = 110;
    const btnH = 50;
    const betSpacing = 140;
    const betStartX = W / 2 - betSpacing;

    const lowCoinMode = this.isLowCoinBetMode();
    this.betButtons.forEach(({ bg, label, bet, zone }, i) => {
      const x = betStartX + i * betSpacing;
      if (lowCoinMode) {
        bg.setVisible(false);
        label.setVisible(false);
        zone.disableInteractive();
        return;
      }
      bg.setVisible(true);
      label.setVisible(true);
      zone.setInteractive({ cursor: 'pointer' });
      const disabled = this.getBetCost(bet) > this.currentCoins;
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

    if (lowCoinMode) {
      this.selectedBet = this.currentCoins;
      this._drawSelectedBtn(this.allInBetButton.bg, W / 2, betY, 220, btnH);
      this.allInBetButton.label
        .setText(`BET ${this.currentCoins}`)
        .setColor(COLOR.ivory)
        .setStroke(COLOR.woodDeep, 5)
        .setVisible(true);
      this.allInBetButton.bg.setVisible(true);
      this.allInBetButton.zone.setVisible(true).setInteractive({ cursor: 'pointer' });
      return;
    }

    this.allInBetButton.bg.setVisible(false);
    this.allInBetButton.label.setVisible(false);
    this.allInBetButton.zone.disableInteractive().setVisible(false);
  }

  private canPlay(): boolean {
    return this.isBetPlayable() && !this.playing;
  }

  private getBetCost(bet = this.selectedBet): number {
    if (this.isLowCoinBetMode()) {
      return this.currentCoins;
    }
    return getDiscountedBetAmount(bet, this.floorNumber);
  }

  private isLowCoinBetMode(): boolean {
    return this.currentCoins > 0 && this.currentCoins < 10;
  }

  private isBetPlayable(): boolean {
    const betCost = this.getBetCost();
    if (this.isLowCoinBetMode()) {
      return betCost > 0 && betCost <= this.currentCoins;
    }
    return isValidBet(this.currentCoins, betCost);
  }

  private updatePlayButton() {
    const W = 1024;
    const playY = 630;
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
    AudioManager.playSfx(this, 'ui-click', { volume: 0.85, cooldownMs: 50, allowOverlap: false });
    this.cashedOut = false;
    this.warningPlayed = false;
    this.currentMult = 1.0;
    this.graphPoints = [];
    this.lastGraphTime = 0;
    this.lastSoundTime = 0;
    this.lastPulseTime = 0;

    this.crashPoint = nextCrashPoint();
    this.crashTimeForRound = crashTimeFromPoint(this.crashPoint);

    this.resultText.setText('');
    this.targetReachedText.setVisible(false);

    this.playBtn.setVisible(false);
    this.playBtnText.setVisible(false);
    this._playZone.setVisible(false);
    this.cashOutBtn.setVisible(false);
    this.cashOutBtnText.setVisible(false);
    this._cashOutZone.setVisible(false);

    this.refreshBetButtons();
    this.graphGraphics.clear();
    this.multDisplay.setText('STARTING...');
    this.multDisplay.setColor(COLOR.goldText);
    this.countdownText.setVisible(false);

    this.inBetPhase = true;
    this.playing = false;
    this.betPhaseEnd = this.time.now + 1500;
  }

  update(): void {
    if (!this.inBetPhase && !this.playing) return;
    const now = this.time.now;

    // ── Betting countdown phase ──────────────────────────────────────────
    if (this.inBetPhase) {
      const remaining = this.betPhaseEnd - now;
      if (remaining <= 0) {
        this.inBetPhase = false;
        this.playing = true;
        this.roundStartTime = now;
        this.multDisplay.setText('1.00x');
        this.multDisplay.setColor(COLOR.goldBright);
        this.cashOutBtn.setVisible(true);
        this.cashOutBtnText.setVisible(true);
        this._cashOutZone.setVisible(true);
        this.countdownText.setVisible(false);
      }
      return;
    }

    // ── Running phase ────────────────────────────────────────────────────
    const t = (now - this.roundStartTime) / 1000;
    const mult = Math.exp(CRASH_K * t);
    this.currentMult = Math.floor(mult * 100) / 100;

    // Check crash
    if (t >= this.crashTimeForRound) {
      this.currentMult = this.crashPoint;
      this._doCrash();
      return;
    }

    // Auto-cashout
    if (this.autoCashout > 0 && this.currentMult >= this.autoCashout && !this.cashedOut) {
      this.doCashOut();
      return;
    }

    // Warn when close to crash
    if (!this.warningPlayed && (this.crashTimeForRound - t) <= 0.5) {
      this.warningPlayed = true;
      AudioManager.playSfx(this, 'crash-warning', { volume: 1.35, cooldownMs: 200, allowOverlap: false });
    }

    // Update multiplier display
    const color = this.multColor(this.currentMult);
    this.multDisplay.setText(this.currentMult.toFixed(2) + 'x');
    this.multDisplay.setColor(color);

    // Pulse animation (rate-limited)
    if (now - this.lastPulseTime > 100) {
      this.lastPulseTime = now;
      this.tweens.add({
        targets: this.multDisplay,
        scaleX: { from: 1.04, to: 1.0 },
        scaleY: { from: 1.04, to: 1.0 },
        duration: 80,
        ease: 'Sine.easeOut',
      });
    }

    // Tick sound (rate-limited)
    if (now - this.lastSoundTime > 180) {
      this.lastSoundTime = now;
      AudioManager.playSfx(this, 'ui-hover', {
        volume: Math.min(0.16 + this.currentMult * 0.02, 0.28),
        rate: Math.min(1 + this.currentMult * 0.03, 1.35),
        cooldownMs: 180,
        allowOverlap: false,
      });
    }

    // Graph (rate-limited to ~15fps)
    if (now - this.lastGraphTime > 66) {
      this.lastGraphTime = now;
      this._drawGraph();
    }
  }

  private _drawGraph() {
    const W = 1024;
    const graphW = 600;
    const graphH = 120;
    const graphX = (W - graphW) / 2;
    const graphY = 415;
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

  private setAutoCashout(value: number): void {
    this.autoCashout = value;
    const W = 1024;
    const autoBtnW = 72, autoBtnH = 30, autoGap = 10;
    const autoStartX = W / 2 - ((this.autoCashoutBtns.length * (autoBtnW + autoGap)) - autoGap) / 2 + autoBtnW / 2;
    this.autoCashoutBtns.forEach(({ bg, label, value: val }, i) => {
      const ax = autoStartX + i * (autoBtnW + autoGap);
      const ay = 170;
      const selected = val === value;
      drawNestedButton(bg, ax, ay, autoBtnW, autoBtnH, selected);
      if (selected) {
        bg.lineStyle(2, THEME.ivory, 0.6);
        bg.strokeRect(ax - autoBtnW / 2, ay - autoBtnH / 2, autoBtnW, autoBtnH);
      }
      label.setColor(COLOR.ivory).setStroke(COLOR.woodDeep, 5);
    });
    AudioManager.playSfx(this, 'bet-select', { volume: 1.0, cooldownMs: 50, allowOverlap: false });
  }

  private _drawHistory(): void {
    const W = 1024;
    this.historyContainer.clear();
    const pillW = 52, pillH = 18, pillGap = 6;
    const count = Math.min(this.roundHistory.length, 8);
    if (count === 0) return;
    const totalW = count * (pillW + pillGap) - pillGap;
    const startX = W / 2 - totalW / 2;
    const py = 222;
    for (let i = 0; i < count; i++) {
      const cp = this.roundHistory[this.roundHistory.length - count + i];
      const px = startX + i * (pillW + pillGap) + pillW / 2;
      const col = cp < 1.5 ? 0xb83030 : cp < 3 ? 0xb8821a : 0x22a022;
      this.historyContainer.fillStyle(col, 0.85);
      this.historyContainer.fillRoundedRect(px - pillW / 2, py - pillH / 2, pillW, pillH, 4);
      this.historyLabels[i].setVisible(true);
      this.historyLabels[i].setPosition(px, py);
      this.historyLabels[i].setText(cp.toFixed(2) + 'x');
    }
    for (let i = count; i < 8; i++) {
      this.historyLabels[i].setVisible(false);
    }
  }

  private _doCrash() {
    AudioManager.playSfx(this, 'crash', { volume: 1.45, cooldownMs: 250, allowOverlap: false });
    this.playing = false;

    this.roundHistory.push(this.crashPoint);
    if (this.roundHistory.length > 8) this.roundHistory.shift();
    this._drawHistory();

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

    const betCost = this.getBetCost();
    this.currentCoins -= betCost;
    this.coinsText.setText(`Coins: ${this.currentCoins}`);

    this.resultText.setText(`CRASHED @ ${this.crashPoint.toFixed(2)}x — lost ${betCost}`);
    this.resultText.setColor(COLOR.loseRed);
    if (this.currentCoins <= 0) {
      this.time.delayedCall(700, () => this.leave());
      return;
    }

    HouseController.say(this, 'gameSpecific', 'crashLost');
    if (this.currentCoins < 120) {
      this.time.delayedCall(4500, () => HouseController.say(this, 'playerActions', 'lowChips'));
    }

    this.successfulCashOuts = 0;

    this.cashOutBtn.setVisible(false);
    this.cashOutBtnText.setVisible(false);
    this._cashOutZone.setVisible(false);
    this.playBtn.setVisible(true);
    this.playBtnText.setVisible(true);
    this._playZone.setVisible(true);

    if (!this.isBetPlayable()) {
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

    this.playing = false;

    this.roundHistory.push(this.crashPoint);
    if (this.roundHistory.length > 8) this.roundHistory.shift();
    this._drawHistory();

    const betCost = this.getBetCost();
    const result = resolve({
      coins: this.currentCoins,
      bet: betCost,
      cashOutAt: mult,
      crashPoint: this.crashPoint,
    });

    this.currentCoins = result.newCoins;
    this.coinsText.setText(`Coins: ${this.currentCoins}`);

    const winnings = result.payout - betCost;
    this.resultText.setText(`+${winnings} coins at ${mult.toFixed(2)}x`);
    this.resultText.setColor(COLOR.winGreen);
    AudioManager.playSfx(this, 'cashout', { volume: 1.45, cooldownMs: 120, allowOverlap: false });
    AudioManager.playSfx(this, 'win', { volume: 1.2, cooldownMs: 120, allowOverlap: false });
    winBurst(this, 1024 / 2, 310);

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

    if (!this.isBetPlayable()) {
      this.selectedBet = 0;
    }
    this.refreshBetButtons();
    this.updatePlayButton();
    if (this.currentCoins <= 0) {
      this.time.delayedCall(700, () => this.leave());
    }
  }

  leave() {
    AudioManager.playSfx(this, 'ui-click', { volume: 0.8, cooldownMs: 50, allowOverlap: false });
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
