import { Scene, GameObjects } from 'phaser';
import { play, isValidBet, RiskType } from '../games/coinFlip';

const WIN_TARGET = 300;
const BET_OPTIONS = [5, 25, 50];
const ANIM_DURATION = 1200;

const COLOR = {
  bg: 0x2a1a10,
  gold: '#c9a66b',
  goldNum: 0xc9a66b,
  offWhite: '#e8e0d0',
  btnDefault: 0x4a3020,
  btnHover: 0x5a4030,
  btnActive: 0xc9a66b,
  btnActiveText: '#1a0a00',
  btnDisabled: 0x2e2018,
  btnDisabledText: '#6a5a4a',
  playBtn: 0xc9a66b,
  playBtnText: '#1a0a00',
  leaveBtn: 0x3a2a1a,
  leaveBtnText: '#c9a66b',
  winText: '#4aff7a',
  loseText: '#ff4a4a',
};

export class CoinFlipScene extends Scene {
  private currentCoins: number = 200;
  private currentFloor: number = 1;
  private selectedBet: number = 0;
  private riskType: RiskType = 'flip';
  private diceGuess: 'low' | 'high' = 'low';
  private animating: boolean = false;

  // UI references
  private coinsText!: GameObjects.Text;
  private resultText!: GameObjects.Text;
  private targetText!: GameObjects.Text;
  private playBtn!: GameObjects.Graphics;
  private playBtnText!: GameObjects.Text;
  private leaveBtn!: GameObjects.Graphics;
  private leaveBtnText!: GameObjects.Text;
  private betButtons!: Array<{ bg: GameObjects.Graphics; label: GameObjects.Text; bet: number }>;
  private flipBtn!: { bg: GameObjects.Graphics; label: GameObjects.Text };
  private diceBtn!: { bg: GameObjects.Graphics; label: GameObjects.Text };
  private diceGuessGroup!: GameObjects.Container;
  private lowBtn!: { bg: GameObjects.Graphics; label: GameObjects.Text };
  private highBtn!: { bg: GameObjects.Graphics; label: GameObjects.Text };
  private animGraphic!: GameObjects.Graphics;
  private animText!: GameObjects.Text;
  private targetReachedText!: GameObjects.Text;

  constructor() {
    super('CoinFlipScene');
  }

  init(data: { coins: number; floor: number }) {
    this.currentCoins = data.coins ?? 200;
    this.currentFloor = data.floor ?? 1;
    this.selectedBet = 0;
    this.riskType = 'flip';
    this.diceGuess = 'low';
    this.animating = false;
  }

  create() {
    const W = 1024;
    const H = 768;

    // Background overlay
    const bg = this.add.graphics();
    bg.fillStyle(COLOR.bg, 0.97);
    bg.fillRect(0, 0, W, H);

    // Decorative border
    const border = this.add.graphics();
    border.lineStyle(2, COLOR.goldNum, 0.4);
    border.strokeRect(20, 20, W - 40, H - 40);

    // Title
    this.add.text(W / 2, 48, 'FLOOR 1 — THE LOBBY', {
      fontSize: '32px',
      color: COLOR.gold,
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
      shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 4, fill: true },
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(W / 2, 92, 'Coin Flip / Dice Duel', {
      fontSize: '20px',
      color: COLOR.offWhite,
      fontFamily: 'Georgia, serif',
    }).setOrigin(0.5);

    // Coins display (top right)
    this.coinsText = this.add.text(W - 40, 48, `Coins: ${this.currentCoins}`, {
      fontSize: '22px',
      color: COLOR.gold,
      fontFamily: 'monospace',
    }).setOrigin(1, 0.5);

    this.targetText = this.add.text(W - 40, 78, `Target: ${WIN_TARGET} to advance`, {
      fontSize: '16px',
      color: COLOR.gold,
      fontFamily: 'monospace',
    }).setOrigin(1, 0.5);

    // Divider line
    const divider = this.add.graphics();
    divider.lineStyle(1, COLOR.goldNum, 0.3);
    divider.lineBetween(60, 118, W - 60, 118);

    // --- Bet buttons ---
    const betY = 185;
    this.add.text(W / 2, 148, 'SELECT BET', {
      fontSize: '14px',
      color: COLOR.gold,
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.betButtons = [];
    const btnW = 110;
    const btnH = 50;
    const betSpacing = 140;
    const betStartX = W / 2 - betSpacing;

    BET_OPTIONS.forEach((bet, i) => {
      const x = betStartX + i * betSpacing;
      const bg = this.add.graphics();
      const label = this.add.text(x, betY, `BET ${bet}`, {
        fontSize: '18px',
        color: COLOR.offWhite,
        fontFamily: 'monospace',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      this.drawRoundBtn(bg, x, betY, btnW, btnH, COLOR.btnDefault);

      const zone = this.add.zone(x, betY, btnW, btnH).setInteractive({ cursor: 'pointer' });
      zone.on('pointerover', () => { if (this.selectedBet !== bet && !this.animating) this.drawRoundBtn(bg, x, betY, btnW, btnH, COLOR.btnHover); });
      zone.on('pointerout', () => { if (this.selectedBet !== bet) this.drawRoundBtn(bg, x, betY, btnW, btnH, COLOR.btnDefault); });
      zone.on('pointerdown', () => { if (!this.animating) this.selectBet(bet); });

      this.betButtons.push({ bg, label, bet });
    });

    // --- Risk mode toggle ---
    this.add.text(W / 2, 258, 'SELECT MODE', {
      fontSize: '14px',
      color: COLOR.gold,
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    const modeY = 305;
    const modeBtnW = 180;
    const modeBtnH = 50;

    // COIN FLIP button
    const flipBg = this.add.graphics();
    const flipLabel = this.add.text(W / 2 - 110, modeY, 'COIN FLIP\n2x · 50%', {
      fontSize: '15px',
      color: COLOR.btnActiveText,
      fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5);
    this.drawRoundBtn(flipBg, W / 2 - 110, modeY, modeBtnW, modeBtnH, COLOR.btnActive);
    this.flipBtn = { bg: flipBg, label: flipLabel };

    const flipZone = this.add.zone(W / 2 - 110, modeY, modeBtnW, modeBtnH).setInteractive({ cursor: 'pointer' });
    flipZone.on('pointerdown', () => { if (!this.animating) this.selectMode('flip'); });

    // DICE DUEL button
    const diceBg = this.add.graphics();
    const diceLabel = this.add.text(W / 2 + 110, modeY, 'DICE DUEL\n2x · 50%', {
      fontSize: '15px',
      color: COLOR.offWhite,
      fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5);
    this.drawRoundBtn(diceBg, W / 2 + 110, modeY, modeBtnW, modeBtnH, COLOR.btnDefault);
    this.diceBtn = { bg: diceBg, label: diceLabel };

    const diceZone = this.add.zone(W / 2 + 110, modeY, modeBtnW, modeBtnH).setInteractive({ cursor: 'pointer' });
    diceZone.on('pointerdown', () => { if (!this.animating) this.selectMode('dice'); });

    // --- Dice guess group (LOW / HIGH) ---
    this.diceGuessGroup = this.add.container(0, 0);
    this.diceGuessGroup.setVisible(false);

    const guessY = 376;
    const guessBtnW = 130;
    const guessBtnH = 40;

    const lowBg = this.add.graphics();
    const lowLabel = this.add.text(W / 2 - 90, guessY, 'LOW (1-3)', {
      fontSize: '14px', color: COLOR.btnActiveText, fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.drawRoundBtn(lowBg, W / 2 - 90, guessY, guessBtnW, guessBtnH, COLOR.btnActive);
    this.lowBtn = { bg: lowBg, label: lowLabel };

    const highBg = this.add.graphics();
    const highLabel = this.add.text(W / 2 + 90, guessY, 'HIGH (4-6)', {
      fontSize: '14px', color: COLOR.offWhite, fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.drawRoundBtn(highBg, W / 2 + 90, guessY, guessBtnW, guessBtnH, COLOR.btnDefault);
    this.highBtn = { bg: highBg, label: highLabel };

    const lowZone = this.add.zone(W / 2 - 90, guessY, guessBtnW, guessBtnH).setInteractive({ cursor: 'pointer' });
    lowZone.on('pointerdown', () => { if (!this.animating) this.selectGuess('low'); });
    const highZone = this.add.zone(W / 2 + 90, guessY, guessBtnW, guessBtnH).setInteractive({ cursor: 'pointer' });
    highZone.on('pointerdown', () => { if (!this.animating) this.selectGuess('high'); });

    this.diceGuessGroup.add([lowBg, lowLabel, highBg, highLabel]);
    lowZone.setVisible(false);
    highZone.setVisible(false);

    // Store zone refs for show/hide
    (this.diceGuessGroup as any).lowZone = lowZone;
    (this.diceGuessGroup as any).highZone = highZone;

    // --- Animation area ---
    this.animGraphic = this.add.graphics();
    this.animText = this.add.text(W / 2, 450, '', {
      fontSize: '28px',
      color: COLOR.offWhite,
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // --- Result text ---
    this.resultText = this.add.text(W / 2, 510, '', {
      fontSize: '26px',
      color: COLOR.winText,
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // --- Target reached text ---
    this.targetReachedText = this.add.text(W / 2, 555, '', {
      fontSize: '20px',
      color: COLOR.gold,
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false);

    // --- PLAY button ---
    const playY = 610;
    this.playBtn = this.add.graphics();
    this.playBtnText = this.add.text(W / 2, playY, 'PLAY', {
      fontSize: '28px',
      color: COLOR.playBtnText,
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.drawRoundBtn(this.playBtn, W / 2, playY, 200, 60, COLOR.btnDisabled);
    this.playBtnText.setColor(COLOR.btnDisabledText);

    const playZone = this.add.zone(W / 2, playY, 200, 60).setInteractive({ cursor: 'pointer' });
    playZone.on('pointerover', () => {
      if (this.canPlay() && !this.animating) this.drawRoundBtn(this.playBtn, W / 2, playY, 200, 60, COLOR.btnHover);
    });
    playZone.on('pointerout', () => {
      if (this.canPlay() && !this.animating) this.drawRoundBtn(this.playBtn, W / 2, playY, 200, 60, COLOR.playBtn);
    });
    playZone.on('pointerdown', () => { if (this.canPlay() && !this.animating) this.startPlay(); });

    // --- LEAVE TABLE button ---
    const leaveY = 700;
    this.leaveBtn = this.add.graphics();
    this.leaveBtnText = this.add.text(W / 2, leaveY, 'LEAVE TABLE', {
      fontSize: '18px',
      color: COLOR.leaveBtnText,
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.drawRoundBtn(this.leaveBtn, W / 2, leaveY, 200, 46, COLOR.leaveBtn);

    const leaveZone = this.add.zone(W / 2, leaveY, 200, 46).setInteractive({ cursor: 'pointer' });
    leaveZone.on('pointerover', () => { if (!this.animating) this.drawRoundBtn(this.leaveBtn, W / 2, leaveY, 200, 46, COLOR.btnHover); });
    leaveZone.on('pointerout', () => { if (!this.animating) this.drawRoundBtn(this.leaveBtn, W / 2, leaveY, 200, 46, COLOR.leaveBtn); });
    leaveZone.on('pointerdown', () => { if (!this.animating) this.leaveTable(); });

    // Store play zone for enable/disable
    (this as any)._playZone = playZone;
    (this as any)._playY = playY;
    (this as any)._leaveY = leaveY;

    this.updatePlayButton();
    this.refreshBetButtons();
  }

  // ---- UI helpers ----

  private drawRoundBtn(g: GameObjects.Graphics, cx: number, cy: number, w: number, h: number, color: number, alpha: number = 1) {
    g.clear();
    g.fillStyle(color, alpha);
    g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
  }

  private selectBet(bet: number) {
    this.selectedBet = this.selectedBet === bet ? 0 : bet;
    this.refreshBetButtons();
    this.updatePlayButton();
  }

  private refreshBetButtons() {
    const W = 1024;
    const betY = 185;
    const btnW = 110;
    const btnH = 50;
    const betSpacing = 140;
    const betStartX = W / 2 - betSpacing;

    this.betButtons.forEach(({ bg, label, bet }, i) => {
      const x = betStartX + i * betSpacing;
      const disabled = bet > this.currentCoins;
      const active = this.selectedBet === bet;

      if (active) {
        this.drawRoundBtn(bg, x, betY, btnW, btnH, COLOR.btnActive);
        label.setColor(COLOR.btnActiveText);
      } else if (disabled) {
        this.drawRoundBtn(bg, x, betY, btnW, btnH, COLOR.btnDisabled);
        label.setColor(COLOR.btnDisabledText);
      } else {
        this.drawRoundBtn(bg, x, betY, btnW, btnH, COLOR.btnDefault);
        label.setColor(COLOR.offWhite);
      }
    });
  }

  private selectMode(mode: RiskType) {
    this.riskType = mode;

    if (mode === 'flip') {
      this.drawRoundBtn(this.flipBtn.bg, 1024 / 2 - 110, 305, 180, 50, COLOR.btnActive);
      this.flipBtn.label.setColor(COLOR.btnActiveText);
      this.drawRoundBtn(this.diceBtn.bg, 1024 / 2 + 110, 305, 180, 50, COLOR.btnDefault);
      this.diceBtn.label.setColor(COLOR.offWhite);
      this.diceGuessGroup.setVisible(false);
      (this.diceGuessGroup as any).lowZone?.setVisible(false);
      (this.diceGuessGroup as any).highZone?.setVisible(false);
    } else {
      this.drawRoundBtn(this.diceBtn.bg, 1024 / 2 + 110, 305, 180, 50, COLOR.btnActive);
      this.diceBtn.label.setColor(COLOR.btnActiveText);
      this.drawRoundBtn(this.flipBtn.bg, 1024 / 2 - 110, 305, 180, 50, COLOR.btnDefault);
      this.flipBtn.label.setColor(COLOR.offWhite);
      this.diceGuessGroup.setVisible(true);
      (this.diceGuessGroup as any).lowZone?.setVisible(true);
      (this.diceGuessGroup as any).highZone?.setVisible(true);
    }
  }

  private selectGuess(guess: 'low' | 'high') {
    this.diceGuess = guess;
    const guessY = 376;
    const guessBtnW = 130;
    const guessBtnH = 40;

    if (guess === 'low') {
      this.drawRoundBtn(this.lowBtn.bg, 1024 / 2 - 90, guessY, guessBtnW, guessBtnH, COLOR.btnActive);
      this.lowBtn.label.setColor(COLOR.btnActiveText);
      this.drawRoundBtn(this.highBtn.bg, 1024 / 2 + 90, guessY, guessBtnW, guessBtnH, COLOR.btnDefault);
      this.highBtn.label.setColor(COLOR.offWhite);
    } else {
      this.drawRoundBtn(this.highBtn.bg, 1024 / 2 + 90, guessY, guessBtnW, guessBtnH, COLOR.btnActive);
      this.highBtn.label.setColor(COLOR.btnActiveText);
      this.drawRoundBtn(this.lowBtn.bg, 1024 / 2 - 90, guessY, guessBtnW, guessBtnH, COLOR.btnDefault);
      this.lowBtn.label.setColor(COLOR.offWhite);
    }
  }

  private canPlay(): boolean {
    return isValidBet(this.currentCoins, this.selectedBet) && !this.animating;
  }

  private updatePlayButton() {
    const playY = (this as any)._playY ?? 610;
    if (this.canPlay()) {
      this.drawRoundBtn(this.playBtn, 1024 / 2, playY, 200, 60, COLOR.playBtn);
      this.playBtnText.setColor(COLOR.playBtnText);
    } else {
      this.drawRoundBtn(this.playBtn, 1024 / 2, playY, 200, 60, COLOR.btnDisabled);
      this.playBtnText.setColor(COLOR.btnDisabledText);
    }
  }

  // ---- Game logic ----

  private startPlay() {
    this.animating = true;
    this.resultText.setText('');
    this.targetReachedText.setVisible(false);
    this.updatePlayButton();

    const W = 1024;
    const animCX = W / 2;
    const animCY = 450;

    if (this.riskType === 'flip') {
      this.runCoinAnimation(animCX, animCY);
    } else {
      this.runDiceAnimation(animCX, animCY);
    }
  }

  private runCoinAnimation(cx: number, cy: number) {
    const frames = Math.floor(ANIM_DURATION / 80);
    let frame = 0;
    const sides = ['H', 'T'];

    const ticker = this.time.addEvent({
      delay: 80,
      repeat: frames - 1,
      callback: () => {
        frame++;
        const side = sides[frame % 2];
        this.animGraphic.clear();

        // Draw coin
        const scale = 0.7 + 0.3 * Math.abs(Math.sin(frame * 0.6));
        this.animGraphic.fillStyle(COLOR.goldNum, 1);
        this.animGraphic.fillEllipse(cx, cy, 80 * scale, 80);
        this.animGraphic.lineStyle(3, 0xa07830, 1);
        this.animGraphic.strokeEllipse(cx, cy, 80 * scale, 80);

        this.animText.setText(side);
        this.animText.setPosition(cx, cy);

        if (frame >= frames) {
          ticker.remove();
          this.resolvePlay();
        }
      },
    });
  }

  private runDiceAnimation(cx: number, cy: number) {
    const frames = Math.floor(ANIM_DURATION / 80);
    let frame = 0;

    const ticker = this.time.addEvent({
      delay: 80,
      repeat: frames - 1,
      callback: () => {
        frame++;
        const roll = Math.floor(Math.random() * 6) + 1;
        this.drawDieFace(cx, cy, roll);
        this.animText.setText(String(roll));
        this.animText.setPosition(cx, cy);

        if (frame >= frames) {
          ticker.remove();
          this.resolvePlay();
        }
      },
    });
  }

  private drawDieFace(cx: number, cy: number, value: number) {
    const size = 70;
    this.animGraphic.clear();
    this.animGraphic.fillStyle(0xf5f0e8, 1);
    this.animGraphic.fillRoundedRect(cx - size / 2, cy - size / 2, size, size, 10);
    this.animGraphic.lineStyle(3, 0x333333, 1);
    this.animGraphic.strokeRoundedRect(cx - size / 2, cy - size / 2, size, size, 10);

    // Pips
    this.animGraphic.fillStyle(0x222222, 1);
    const pipR = 6;
    const off = 18;
    const pipMap: Array<[number, number][]> = [
      [[0, 0]],
      [[-1, -1], [1, 1]],
      [[-1, -1], [0, 0], [1, 1]],
      [[-1, -1], [1, -1], [-1, 1], [1, 1]],
      [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
      [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
    ];
    pipMap[value - 1].forEach(([px, py]) => {
      this.animGraphic.fillCircle(cx + px * off, cy + py * off, pipR);
    });
  }

  private resolvePlay() {
    const result = play({
      coins: this.currentCoins,
      bet: this.selectedBet,
      riskType: this.riskType,
      diceGuess: this.diceGuess,
    });

    // Show final animation frame
    if (this.riskType === 'flip') {
      const side = result.displayResult === 'Heads!' ? 'H' : 'T';
      const cx = 1024 / 2;
      const cy = 450;
      this.animGraphic.clear();
      this.animGraphic.fillStyle(COLOR.goldNum, 1);
      this.animGraphic.fillEllipse(cx, cy, 80, 80);
      this.animGraphic.lineStyle(3, 0xa07830, 1);
      this.animGraphic.strokeEllipse(cx, cy, 80, 80);
      this.animText.setText(side).setPosition(cx, cy);
    } else {
      // Show final die face by extracting the number
      const match = result.displayResult.match(/Rolled (\d+)/);
      if (match) {
        const finalRoll = parseInt(match[1], 10);
        this.drawDieFace(1024 / 2, 450, finalRoll);
        this.animText.setText(String(finalRoll)).setPosition(1024 / 2, 450);
      }
    }

    // Update coins
    this.currentCoins = result.newCoins;
    this.coinsText.setText(`Coins: ${this.currentCoins}`);

    // Show result
    this.resultText.setText(
      result.won
        ? `${result.displayResult} — +${result.payout / 2} coins!`
        : `${result.displayResult} — Lost ${this.selectedBet} coins`
    );
    this.resultText.setColor(result.won ? COLOR.winText : COLOR.loseText);

    // Check target reached
    if (this.currentCoins >= WIN_TARGET) {
      this.targetReachedText.setText('Target reached! You may advance.').setVisible(true);
    }

    this.animating = false;

    if (this.currentCoins === 0) {
      // Force end
      this.time.delayedCall(1200, () => this.leaveTable());
      return;
    }

    // Refresh bet buttons (some may now be disabled)
    this.refreshBetButtons();
    // Revalidate bet selection
    if (!isValidBet(this.currentCoins, this.selectedBet)) {
      this.selectedBet = 0;
    }
    this.updatePlayButton();
  }

  private leaveTable() {
    const won = this.currentCoins >= WIN_TARGET;
    try {
      this.scene.get('DungeonScene').events.emit('game-complete', {
        coins: this.currentCoins,
        won,
      });
    } catch (_) {
      // DungeonScene may not exist in isolated testing
    }
    this.scene.stop('CoinFlipScene');
  }
}
