import { Scene, GameObjects } from 'phaser';
import { play, isValidBet, RiskType } from '../games/coinFlip';
import { THEME, COLOR, FONT, drawNestedButton, neonTitleStyle, buttonLabelStyle } from '../ui/theme';
import { AudioManager } from '../audio/AudioManager';
import { addGameplaySettingsGear } from '../ui/gameplaySettings';
import { registerDeveloperUnlockHotkey } from '../dev/developerHotkeys';
import { winBurst, betFlash } from '../ui/particles';
import { getDiscountedBetAmount, hasDiscountForFloor } from '../state/coinState';
import { HouseController } from '../ui/HouseController';

const WIN_TARGET = 300;
const BET_OPTIONS = [5, 25, 50];
const ANIM_DURATION = 1200;

export class CoinFlipScene extends Scene {
  private currentCoins: number = 200;
  private floorNumber: number = 1;
  private selectedBet: number = 0;
  private riskType: RiskType = 'flip';
  private diceGuess: 'low' | 'high' = 'low';
  private animating: boolean = false;

  // UI references
  private coinsText!: GameObjects.Text;
  private resultText!: GameObjects.Text;
  private playBtn!: GameObjects.Graphics;
  private playBtnText!: GameObjects.Text;
  private leaveBtn!: GameObjects.Graphics;
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

  init(data: { coins: number; floor?: number }) {
    this.currentCoins = data.coins ?? 200;
    this.floorNumber = data.floor ?? 1;
    this.selectedBet = 0;
    this.riskType = 'flip';
    this.diceGuess = 'low';
    this.animating = false;
  }

  create() {
    const W = 1024;
    const H = 768;

    // Deep purple background
    const bg = this.add.graphics();
    bg.fillStyle(THEME.bgDeep, 0.97);
    bg.fillRect(0, 0, W, H);

    // Checker ground pattern in bottom third (y=442 to 768)
    for (let y = 442; y < H; y += 12) {
      for (let x = 0; x < W; x += 18) {
        const checker = ((x / 18) + (y / 12)) % 2 === 0;
        bg.fillStyle(checker ? THEME.bgInset : THEME.bgPanelAlt, 1);
        bg.fillRect(x, y, 18, 12);
      }
    }

    // Border: 3px gold rect inset 20px from edges
    const border = this.add.graphics();
    border.lineStyle(3, THEME.goldDim, 1);
    border.strokeRect(20, 20, W - 40, H - 40);

    // Title
    this.add.text(W / 2, 56, 'FLOOR 1 — THE LOBBY', neonTitleStyle(32)).setOrigin(0.5);

    // Subtitle
    this.add.text(W / 2, 92, 'Coin Flip / Dice Duel', {
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

    // --- Bet buttons ---
    const betY = 185;
    this.add.text(W / 2, 148, 'SELECT BET', {
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
      zone.on('pointerover', () => { if (this.selectedBet !== bet && !this.animating) drawNestedButton(bg, x, betY, btnW, btnH, true); });
      zone.on('pointerout', () => { if (this.selectedBet !== bet) drawNestedButton(bg, x, betY, btnW, btnH, false); });
      zone.on('pointerdown', () => { if (!this.animating) this.selectBet(bet); });

      this.betButtons.push({ bg, label, bet });
    });

    // --- Risk mode toggle ---
    this.add.text(W / 2, 258, 'SELECT MODE', {
      fontSize: '14px',
      color: COLOR.goldText,
      fontFamily: FONT.mono,
    }).setOrigin(0.5);

    const modeY = 305;
    const modeBtnW = 180;
    const modeBtnH = 50;

    // COIN FLIP button (active by default)
    const flipBg = this.add.graphics();
    const flipLabel = this.add.text(W / 2 - 110, modeY, 'COIN FLIP\n2x · 50%', {
      fontSize: '15px',
      color: COLOR.ivory,
      fontFamily: FONT.mono,
      align: 'center',
    }).setOrigin(0.5);
    drawNestedButton(flipBg, W / 2 - 110, modeY, modeBtnW, modeBtnH, true);
    this.flipBtn = { bg: flipBg, label: flipLabel };

    const flipZone = this.add.zone(W / 2 - 110, modeY, modeBtnW, modeBtnH).setInteractive({ cursor: 'pointer' });
    flipZone.on('pointerdown', () => { if (!this.animating) this.selectMode('flip'); });

    // DICE DUEL button
    const diceBg = this.add.graphics();
    const diceLabel = this.add.text(W / 2 + 110, modeY, 'DICE DUEL\n2x · 50%', {
      fontSize: '15px',
      color: COLOR.ivorySoft,
      fontFamily: FONT.mono,
      align: 'center',
    }).setOrigin(0.5);
    drawNestedButton(diceBg, W / 2 + 110, modeY, modeBtnW, modeBtnH, false);
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
    const lowLabel = this.add.text(W / 2 - 90, guessY, 'LOW (1-3)', buttonLabelStyle(14)).setOrigin(0.5);
    drawNestedButton(lowBg, W / 2 - 90, guessY, guessBtnW, guessBtnH, true);
    this.lowBtn = { bg: lowBg, label: lowLabel };

    const highBg = this.add.graphics();
    const highLabel = this.add.text(W / 2 + 90, guessY, 'HIGH (4-6)', buttonLabelStyle(14)).setOrigin(0.5);
    drawNestedButton(highBg, W / 2 + 90, guessY, guessBtnW, guessBtnH, false);
    this.highBtn = { bg: highBg, label: highLabel };

    const lowZone = this.add.zone(W / 2 - 90, guessY, guessBtnW, guessBtnH).setInteractive({ cursor: 'pointer' });
    lowZone.on('pointerdown', () => { if (!this.animating) this.selectGuess('low'); });
    const highZone = this.add.zone(W / 2 + 90, guessY, guessBtnW, guessBtnH).setInteractive({ cursor: 'pointer' });
    highZone.on('pointerdown', () => { if (!this.animating) this.selectGuess('high'); });

    this.diceGuessGroup.add([lowBg, lowLabel, highBg, highLabel]);
    lowZone.setVisible(false);
    highZone.setVisible(false);

    (this.diceGuessGroup as any).lowZone = lowZone;
    (this.diceGuessGroup as any).highZone = highZone;

    // --- Animation area ---
    this.animGraphic = this.add.graphics();
    this.animText = this.add.text(W / 2, 450, '', {
      fontSize: '28px',
      color: COLOR.ivory,
      fontFamily: FONT.mono,
    }).setOrigin(0.5);

    // --- Result text ---
    this.resultText = this.add.text(W / 2, 510, '', {
      fontSize: '26px',
      color: COLOR.winGreen,
      fontFamily: FONT.mono,
    }).setOrigin(0.5);

    // --- Target reached text ---
    this.targetReachedText = this.add.text(W / 2, 555, '', {
      fontSize: '20px',
      color: COLOR.pink,
      fontFamily: FONT.mono,
    }).setOrigin(0.5).setVisible(false);

    // --- PLAY button ---
    const playY = 610;
    this.playBtn = this.add.graphics();
    this.playBtnText = this.add.text(W / 2, playY, 'PLAY', buttonLabelStyle(26)).setOrigin(0.5);
    this._drawDisabledBtn(this.playBtn, W / 2, playY, 200, 60);
    this._setDisabledLabelColor(this.playBtnText);

    const playZone = this.add.zone(W / 2, playY, 200, 60).setInteractive({ cursor: 'pointer' });
    playZone.on('pointerover', () => {
      if (this.canPlay() && !this.animating) drawNestedButton(this.playBtn, W / 2, playY, 200, 60, true);
    });
    playZone.on('pointerout', () => {
      if (this.canPlay() && !this.animating) drawNestedButton(this.playBtn, W / 2, playY, 200, 60, false);
    });
    playZone.on('pointerdown', () => { if (this.canPlay() && !this.animating) this.startPlay(); });

    // --- EXIT TO LOBBY button ---
    const leaveY = 700;
    this.leaveBtn = this.add.graphics();
    this.add.text(W / 2, leaveY, 'EXIT TO LOBBY', buttonLabelStyle(18)).setOrigin(0.5);
    drawNestedButton(this.leaveBtn, W / 2, leaveY, 200, 46, false);

    const leaveZone = this.add.zone(W / 2, leaveY, 200, 46).setInteractive({ cursor: 'pointer' });
    leaveZone.on('pointerover', () => { if (!this.animating) drawNestedButton(this.leaveBtn, W / 2, leaveY, 200, 46, true); });
    leaveZone.on('pointerout', () => { if (!this.animating) drawNestedButton(this.leaveBtn, W / 2, leaveY, 200, 46, false); });
    leaveZone.on('pointerdown', () => { if (!this.animating) this.leaveTable(); });

    (this as any)._playZone = playZone;
    (this as any)._playY = playY;
    (this as any)._leaveY = leaveY;

    this.updatePlayButton();
    this.refreshBetButtons();

    addGameplaySettingsGear(this, 'CoinFlipScene');
    registerDeveloperUnlockHotkey(this, () => {
      this.currentCoins = 999;
      this.coinsText.setText(`Coins: ${this.currentCoins}`);
      this.leaveTable();
    });
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
    // Hover palette + thin ivory outline
    drawNestedButton(g, cx, cy, w, h, true);
    g.lineStyle(2, THEME.ivory, 0.6);
    g.strokeRect(cx - w / 2, cy - h / 2, w, h);
  }

  private selectBet(bet: number) {
    this.selectedBet = this.selectedBet === bet ? 0 : bet;
    AudioManager.playSfx(this, 'bet-select', { volume: 1.3, cooldownMs: 50, allowOverlap: false });
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
  }

  private selectMode(mode: RiskType) {
    this.riskType = mode;
    AudioManager.playSfx(this, 'ui-click', { volume: 0.85, cooldownMs: 50, allowOverlap: false });

    if (mode === 'flip') {
      drawNestedButton(this.flipBtn.bg, 1024 / 2 - 110, 305, 180, 50, true);
      this.flipBtn.label.setColor(COLOR.ivory);
      drawNestedButton(this.diceBtn.bg, 1024 / 2 + 110, 305, 180, 50, false);
      this.diceBtn.label.setColor(COLOR.ivorySoft);
      this.diceGuessGroup.setVisible(false);
      (this.diceGuessGroup as any).lowZone?.setVisible(false);
      (this.diceGuessGroup as any).highZone?.setVisible(false);
    } else {
      drawNestedButton(this.diceBtn.bg, 1024 / 2 + 110, 305, 180, 50, true);
      this.diceBtn.label.setColor(COLOR.ivory);
      drawNestedButton(this.flipBtn.bg, 1024 / 2 - 110, 305, 180, 50, false);
      this.flipBtn.label.setColor(COLOR.ivorySoft);
      this.diceGuessGroup.setVisible(true);
      (this.diceGuessGroup as any).lowZone?.setVisible(true);
      (this.diceGuessGroup as any).highZone?.setVisible(true);
    }
  }

  private selectGuess(guess: 'low' | 'high') {
    this.diceGuess = guess;
    AudioManager.playSfx(this, 'ui-click', { volume: 0.75, cooldownMs: 50, allowOverlap: false });
    const guessY = 376;
    const guessBtnW = 130;
    const guessBtnH = 40;

    if (guess === 'low') {
      this._drawSelectedBtn(this.lowBtn.bg, 1024 / 2 - 90, guessY, guessBtnW, guessBtnH);
      this.lowBtn.label.setColor(COLOR.ivory).setStroke(COLOR.woodDeep, 5);
      drawNestedButton(this.highBtn.bg, 1024 / 2 + 90, guessY, guessBtnW, guessBtnH, false);
      this.highBtn.label.setColor(COLOR.ivorySoft).setStroke(COLOR.woodDeep, 5);
    } else {
      this._drawSelectedBtn(this.highBtn.bg, 1024 / 2 + 90, guessY, guessBtnW, guessBtnH);
      this.highBtn.label.setColor(COLOR.ivory).setStroke(COLOR.woodDeep, 5);
      drawNestedButton(this.lowBtn.bg, 1024 / 2 - 90, guessY, guessBtnW, guessBtnH, false);
      this.lowBtn.label.setColor(COLOR.ivorySoft).setStroke(COLOR.woodDeep, 5);
    }
  }

  private canPlay(): boolean {
    return isValidBet(this.currentCoins, this.getBetCost()) && !this.animating;
  }

  private getBetCost(bet = this.selectedBet): number {
    return getDiscountedBetAmount(bet, this.floorNumber);
  }

  private updatePlayButton() {
    const playY = (this as any)._playY ?? 610;
    if (this.canPlay()) {
      drawNestedButton(this.playBtn, 1024 / 2, playY, 200, 60, false);
      this.playBtnText.setColor(COLOR.ivory).setStroke(COLOR.woodDeep, 5);
    } else {
      this._drawDisabledBtn(this.playBtn, 1024 / 2, playY, 200, 60);
      this._setDisabledLabelColor(this.playBtnText);
    }
  }

  // ---- Game logic ----

  private startPlay() {
    AudioManager.playSfx(this, 'ui-click', { volume: 0.9, cooldownMs: 40, allowOverlap: false });
    betFlash(this);
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
    AudioManager.playSfx(this, 'coin-flip', { volume: 1.4, cooldownMs: 120, allowOverlap: true });
    const frames = Math.floor(ANIM_DURATION / 80);
    let frame = 0;
    const sides = ['H', 'T'];

    const ticker = this.time.addEvent({
      delay: 80,
      repeat: frames - 1,
      callback: () => {
        frame++;
        AudioManager.playSfx(this, 'coin-flip', { volume: 0.85, cooldownMs: 120, allowOverlap: false });
        const side = sides[frame % 2];
        this.animGraphic.clear();

        const scale = 0.7 + 0.3 * Math.abs(Math.sin(frame * 0.6));
        this.animGraphic.fillStyle(THEME.goldBright, 1);
        this.animGraphic.fillEllipse(cx, cy, 80 * scale, 80);
        this.animGraphic.lineStyle(3, THEME.goldDim, 1);
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
    AudioManager.playSfx(this, 'dice-roll', { volume: 1.25, cooldownMs: 120, allowOverlap: true });
    const frames = Math.floor(ANIM_DURATION / 80);
    let frame = 0;

    const ticker = this.time.addEvent({
      delay: 80,
      repeat: frames - 1,
      callback: () => {
        frame++;
        AudioManager.playSfx(this, 'dice-roll', { volume: 0.78, cooldownMs: 120, allowOverlap: false });
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
    this.animGraphic.fillRect(cx - size / 2, cy - size / 2, size, size);
    this.animGraphic.lineStyle(3, 0x333333, 1);
    this.animGraphic.strokeRect(cx - size / 2, cy - size / 2, size, size);

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
      bet: this.getBetCost(),
      riskType: this.riskType,
      diceGuess: this.diceGuess,
    });

    if (this.riskType === 'flip') {
      const side = result.displayResult === 'Heads!' ? 'H' : 'T';
      const cx = 1024 / 2;
      const cy = 450;
      this.animGraphic.clear();
      this.animGraphic.fillStyle(THEME.goldBright, 1);
      this.animGraphic.fillEllipse(cx, cy, 80, 80);
      this.animGraphic.lineStyle(3, THEME.goldDim, 1);
      this.animGraphic.strokeEllipse(cx, cy, 80, 80);
      this.animText.setText(side).setPosition(cx, cy);
      AudioManager.playSfx(this, 'coin-settle', { volume: 1.35, cooldownMs: 120, allowOverlap: false });
    } else {
      const match = result.displayResult.match(/Rolled (\d+)/);
      if (match) {
        const finalRoll = parseInt(match[1], 10);
        this.drawDieFace(1024 / 2, 450, finalRoll);
        this.animText.setText(String(finalRoll)).setPosition(1024 / 2, 450);
        AudioManager.playSfx(this, 'dice-land', { volume: 1.35, cooldownMs: 120, allowOverlap: false });
      }
    }

    this.currentCoins = result.newCoins;
    this.coinsText.setText(`Coins: ${this.currentCoins}`);
    if (this.currentCoins < 120) {
      this.time.delayedCall(3000, () => HouseController.say(this, 'playerActions', 'lowChips'));
    }

    this.resultText.setText(
      result.won
        ? `${result.displayResult} — +${result.payout / 2} coins!`
        : `${result.displayResult} — Lost ${this.getBetCost()} coins`
    );
    this.resultText.setColor(result.won ? COLOR.winGreen : COLOR.loseRed);
    AudioManager.playSfx(this, result.won ? 'win' : 'lose', {
      volume: result.won ? 1.35 : 1.3,
      cooldownMs: 120,
      allowOverlap: false,
    });
    if (result.won) winBurst(this, 1024 / 2, 450);

    if (this.currentCoins >= WIN_TARGET) {
      this.targetReachedText.setText('Target reached! You may advance.').setVisible(true);
    }

    this.animating = false;

    if (this.currentCoins === 0) {
      this.time.delayedCall(1200, () => this.leaveTable());
      return;
    }

    this.refreshBetButtons();
    if (!isValidBet(this.currentCoins, this.getBetCost())) {
      this.selectedBet = 0;
    }
    this.updatePlayButton();
  }

  private leaveTable() {
    AudioManager.playSfx(this, 'ui-click', { volume: 0.8, cooldownMs: 50, allowOverlap: false });
    const won = this.currentCoins >= WIN_TARGET;
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
      this.scene.stop('CoinFlipScene');
    });
  }
}
