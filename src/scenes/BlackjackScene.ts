import { Scene, GameObjects } from 'phaser';
import {
  Card,
  canDouble,
  canSplit,
  dealerShouldHit,
  drawCard,
  evaluateHand,
  isValidBet,
  settleRound,
  startRound,
} from '../games/blackjack';
import { THEME, COLOR, FONT, drawNestedButton, neonTitleStyle, buttonLabelStyle } from '../ui/theme';
import { AudioManager } from '../audio/AudioManager';
import { addGameplaySettingsGear } from '../ui/gameplaySettings';
import { registerDeveloperUnlockHotkey } from '../dev/developerHotkeys';
import { winBurst, betFlash } from '../ui/particles';
import { DialogueBus } from '../ui/DialogueBus';
import { getDiscountedBetAmount, hasDiscountForFloor } from '../state/coinState';
import { HouseController } from '../ui/HouseController';

const WIN_TARGET = 450;
const HANDS_TO_WIN = 3;
const BET_OPTIONS = [10, 25, 50];

const SUIT_TEXT: Record<Card['suit'], string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const SUIT_COLOR: Record<Card['suit'], string> = {
  spades: '#1a1a2e',
  hearts: '#cc2244',
  diamonds: '#c85c00',
  clubs: '#155724',
};

interface ActionButton {
  bg: GameObjects.Graphics;
  label: GameObjects.Text;
  zone: GameObjects.Zone;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class BlackjackScene extends Scene {
  private currentCoins = 200;
  private floorNumber = 1;
  private selectedBet = 0;
  private handsWon = 0;
  private roundActive = false;

  private deck: Card[] = [];
  private dealerHand: Card[] = [];
  private revealDealer = false;

  // Multi-hand state (for split)
  private playerHands: Card[][] = [];
  private handBets: number[] = [];
  private handFinished: boolean[] = [];
  private activeHandIndex = 0;

  private coinsText!: GameObjects.Text;
  private handsWonText!: GameObjects.Text;
  private dealerScoreText!: GameObjects.Text;
  private resultText!: GameObjects.Text;
  private targetReachedText!: GameObjects.Text;
  private dealerCardsContainer!: GameObjects.Container;
  private playerCardsContainer!: GameObjects.Container;
  private activeHandMarker!: GameObjects.Graphics;

  private dealAction!: ActionButton;
  private hitAction!: ActionButton;
  private standAction!: ActionButton;
  private doubleAction!: ActionButton;
  private splitAction!: ActionButton;

  private leaveBtn!: GameObjects.Graphics;
  private betButtons!: Array<{ bg: GameObjects.Graphics; label: GameObjects.Text; bet: number }>;

  constructor() {
    super('BlackjackScene');
  }

  init(data: { coins: number; floor?: number }) {
    this.currentCoins = data.coins ?? 200;
    this.floorNumber = data.floor ?? 1;
    this.selectedBet = 0;
    this.handsWon = 0;
    this.roundActive = false;
    this.deck = [];
    this.playerHands = [];
    this.handBets = [];
    this.handFinished = [];
    this.activeHandIndex = 0;
    this.dealerHand = [];
    this.revealDealer = false;
  }

  create() {
    const W = 1024;
    const H = 768;

    const bg = this.add.graphics();
    bg.fillStyle(0x09170f, 0.98);
    bg.fillRect(0, 0, W, H);
    bg.fillStyle(0x0f2619, 1);
    bg.fillRect(0, 0, W, H * 0.64);
    bg.fillStyle(0x2d1b11, 1);
    bg.fillRect(0, H * 0.64, W, H * 0.36);

    for (let y = 492; y < H; y += 14) {
      for (let x = 0; x < W; x += 20) {
        const alt = ((x / 20) + (y / 14)) % 2 === 0;
        bg.fillStyle(alt ? 0x412417 : 0x361c12, 1);
        bg.fillRect(x, y, 20, 14);
      }
    }

    const border = this.add.graphics();
    border.lineStyle(3, THEME.goldDim, 1);
    border.strokeRect(20, 20, W - 40, H - 40);

    this.add.text(W / 2, 48, 'FLOOR 3 — THE BLACKJACK PARLOR', neonTitleStyle(30)).setOrigin(0.5);
    this.add.text(W / 2, 92, 'Beat the House at 21.', {
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

    this.handsWonText = this.add.text(40, 48, `Hands Won: ${this.handsWon}/${HANDS_TO_WIN}`, {
      fontSize: '20px',
      color: COLOR.ivory,
      fontFamily: FONT.mono,
    }).setOrigin(0, 0.5);

    this.add.text(40, 78, `Reach ${WIN_TARGET} coins or win 3 hands.`, {
      fontSize: '16px',
      color: COLOR.goldText,
      fontFamily: FONT.mono,
    }).setOrigin(0, 0.5);

    const divider = this.add.graphics();
    divider.lineStyle(1, THEME.goldDim, 0.3);
    divider.lineBetween(60, 118, W - 60, 118);

    this._drawTableSurface();
    this._createBetButtons();
    this._createHandsArea();
    this._createActions();

    this.resultText = this.add.text(W / 2, 556, '', {
      fontSize: '22px',
      color: COLOR.winGreen,
      fontFamily: FONT.mono,
      align: 'center',
    }).setOrigin(0.5);

    this.targetReachedText = this.add.text(W / 2, 590, '', {
      fontSize: '18px',
      color: COLOR.pink,
      fontFamily: FONT.mono,
    }).setOrigin(0.5).setVisible(false);

    this.updateBetButtons();
    this.updateActionButtons();
    this.renderHands();

    this.time.delayedCall(400, () => {
      this._showSpeech('Select a bet, then DEAL. HIT to draw, STAND to hold, DOUBLE to double-bet and take one card, SPLIT matching pairs into two hands.');
    });
    AudioManager.playMusic(this, 'blackjack-jazz', { loop: true, restart: true });
    this.events.once('shutdown', () => {
      AudioManager.playMusic(this, 'casino-music', { loop: true, restart: true });
    });

    addGameplaySettingsGear(this, 'BlackjackScene');
    registerDeveloperUnlockHotkey(this, () => {
      this.currentCoins = 999;
      this.coinsText.setText(`Coins: ${this.currentCoins}`);
      this.leave();
    });
    this.input.keyboard?.on('keydown-ESC', () => this.leave());
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private _drawTableSurface(): void {
    const g = this.add.graphics();
    g.fillStyle(0x17452b, 1);
    g.fillRoundedRect(132, 160, 760, 340, 18);
    g.lineStyle(4, THEME.goldDim, 1);
    g.strokeRoundedRect(132, 160, 760, 340, 18);
    g.lineStyle(2, 0xd2c292, 0.4);
    g.strokeRoundedRect(150, 178, 724, 304, 14);

    this.add.text(512, 196, 'THE HOUSE', {
      fontFamily: FONT.mono,
      fontSize: '20px',
      color: COLOR.goldText,
    }).setOrigin(0.5);

    this.add.text(512, 414, 'PLAYER', {
      fontFamily: FONT.mono,
      fontSize: '20px',
      color: COLOR.goldText,
    }).setOrigin(0.5);
  }

  private _createBetButtons(): void {
    const W = 1024;
    const betY = 640;
    const btnW = 110;
    const btnH = 44;
    const spacing = 140;
    const startX = W / 2 - spacing;

    this.add.text(W / 2, 614, 'SELECT BET', {
      fontFamily: FONT.mono,
      fontSize: '14px',
      color: COLOR.goldText,
    }).setOrigin(0.5);

    this.betButtons = [];

    BET_OPTIONS.forEach((bet, index) => {
      const x = startX + index * spacing;
      const bg = this.add.graphics();
      const label = this.add.text(x, betY, `BET ${bet}`, buttonLabelStyle(18)).setOrigin(0.5);
      drawNestedButton(bg, x, betY, btnW, btnH, false);

      const zone = this.add.zone(x, betY, btnW, btnH).setInteractive({ cursor: 'pointer' });
      zone.on('pointerover', () => {
        if (!this.roundActive && this.selectedBet !== bet && this.getBetCost(bet) <= this.currentCoins) {
          drawNestedButton(bg, x, betY, btnW, btnH, true);
        }
      });
      zone.on('pointerout', () => {
        if (!this.roundActive && this.selectedBet !== bet && this.getBetCost(bet) <= this.currentCoins) {
          drawNestedButton(bg, x, betY, btnW, btnH, false);
        }
      });
      zone.on('pointerdown', () => {
        if (!this.roundActive) {
          AudioManager.playSfx(this, 'bet-select', { volume: 1.3, cooldownMs: 50, allowOverlap: false });
          this.selectedBet = this.selectedBet === bet ? 0 : bet;
          this.updateBetButtons();
          this.updateActionButtons();
        }
      });

      this.betButtons.push({ bg, label, bet });
    });
  }

  private _createHandsArea(): void {
    this.dealerCardsContainer = this.add.container(0, 0);
    this.playerCardsContainer = this.add.container(0, 0);
    this.activeHandMarker = this.add.graphics();

    this.dealerScoreText = this.add.text(160, 226, 'Dealer: --', {
      fontFamily: FONT.mono,
      fontSize: '18px',
      color: COLOR.ivory,
    });
  }

  private _createActions(): void {
    const actionY = 700;
    const btnW = 118;
    const btnH = 46;

    this.dealAction = this._makeActionButton(292, actionY, 170, 54, 'DEAL', 24, () => {
      if (this.canDeal()) {
        AudioManager.playSfx(this, 'ui-click', { volume: 0.85, cooldownMs: 50, allowOverlap: false });
        betFlash(this);
        this.startHand();
      }
    });

    this.hitAction = this._makeActionButton(260, actionY, btnW, btnH, 'HIT', 20, () => {
      if (this.roundActive && !this.handFinished[this.activeHandIndex]) {
        AudioManager.playSfx(this, 'ui-click', { volume: 0.85, cooldownMs: 50, allowOverlap: false });
        this.hit();
      }
    });

    this.standAction = this._makeActionButton(386, actionY, btnW, btnH, 'STAND', 20, () => {
      if (this.roundActive && !this.handFinished[this.activeHandIndex]) {
        AudioManager.playSfx(this, 'ui-click', { volume: 0.85, cooldownMs: 50, allowOverlap: false });
        this.stand();
      }
    });

    this.doubleAction = this._makeActionButton(512, actionY, btnW, btnH, 'DOUBLE', 20, () => {
      if (this.canDoubleActive()) {
        AudioManager.playSfx(this, 'ui-click', { volume: 0.85, cooldownMs: 50, allowOverlap: false });
        this.double();
      }
    });

    this.splitAction = this._makeActionButton(638, actionY, btnW, btnH, 'SPLIT', 20, () => {
      if (this.canSplitActive()) {
        AudioManager.playSfx(this, 'ui-click', { volume: 0.85, cooldownMs: 50, allowOverlap: false });
        this.split();
      }
    });

    const leaveY = actionY;
    this.leaveBtn = this.add.graphics();
    drawNestedButton(this.leaveBtn, 878, leaveY, 180, 44, false);
    this.add.text(878, leaveY, 'EXIT TO HALL', buttonLabelStyle(16)).setOrigin(0.5);
    const leaveZone = this.add.zone(878, leaveY, 180, 44).setInteractive({ cursor: 'pointer' });
    leaveZone.on('pointerover', () => {
      if (!this.roundActive) {
        drawNestedButton(this.leaveBtn, 878, leaveY, 180, 44, true);
      }
    });
    leaveZone.on('pointerout', () => {
      if (!this.roundActive) {
        drawNestedButton(this.leaveBtn, 878, leaveY, 180, 44, false);
      }
    });
    leaveZone.on('pointerdown', () => {
      if (!this.roundActive) {
        AudioManager.playSfx(this, 'ui-click', { volume: 0.85, cooldownMs: 50, allowOverlap: false });
        this.leave();
      }
    });
  }

  private _makeActionButton(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    fontSize: number,
    onClick: () => void,
  ): ActionButton {
    const bg = this.add.graphics();
    const label = this.add.text(x, y, text, buttonLabelStyle(fontSize)).setOrigin(0.5);
    const zone = this.add.zone(x, y, w, h).setInteractive({ cursor: 'pointer' });
    zone.on('pointerdown', onClick);
    return { bg, label, zone, x, y, w, h };
  }

  private canDeal(): boolean {
    return !this.roundActive && isValidBet(this.currentCoins, this.getBetCost());
  }

  private canDoubleActive(): boolean {
    if (!this.roundActive) return false;
    const hand = this.playerHands[this.activeHandIndex];
    if (!hand || this.handFinished[this.activeHandIndex]) return false;
    if (!canDouble(hand)) return false;
    const bet = this.handBets[this.activeHandIndex];
    return this.currentCoins >= bet;
  }

  private canSplitActive(): boolean {
    if (!this.roundActive) return false;
    if (this.playerHands.length >= 2) return false; // only allow one split for simplicity
    const hand = this.playerHands[this.activeHandIndex];
    if (!hand || this.handFinished[this.activeHandIndex]) return false;
    if (!canSplit(hand)) return false;
    const bet = this.handBets[this.activeHandIndex];
    return this.currentCoins >= bet;
  }

  private getBetCost(bet = this.selectedBet): number {
    return getDiscountedBetAmount(bet, this.floorNumber);
  }

  private updateBetButtons(): void {
    const W = 1024;
    const betY = 640;
    const btnW = 110;
    const btnH = 44;
    const spacing = 140;
    const startX = W / 2 - spacing;

    this.betButtons.forEach(({ bg, label, bet }, index) => {
      const x = startX + index * spacing;
      const disabled = this.roundActive || this.getBetCost(bet) > this.currentCoins;
      const active = this.selectedBet === bet;

      if (active && !disabled) {
        drawNestedButton(bg, x, betY, btnW, btnH, true);
        bg.lineStyle(2, THEME.ivory, 0.7);
        bg.strokeRect(x - btnW / 2, betY - btnH / 2, btnW, btnH);
        label.setColor(COLOR.ivory).setStroke(COLOR.woodDeep, 5);
      } else if (disabled) {
        this.drawDisabledButton(bg, x, betY, btnW, btnH);
        this.setDisabledLabel(label);
      } else {
        drawNestedButton(bg, x, betY, btnW, btnH, false);
        label.setColor(COLOR.ivory).setStroke(COLOR.woodDeep, 5);
      }
    });
  }

  private updateActionButtons(): void {
    // DEAL only visible when round not active
    this.setActionVisible(this.dealAction, !this.roundActive);
    this.setActionVisible(this.hitAction, this.roundActive);
    this.setActionVisible(this.standAction, this.roundActive);
    this.setActionVisible(this.doubleAction, this.roundActive);
    this.setActionVisible(this.splitAction, this.roundActive);

    this.updatePrimaryButton(this.dealAction, this.canDeal());
    const handActive = this.roundActive && !this.handFinished[this.activeHandIndex];
    this.updatePrimaryButton(this.hitAction, handActive);
    this.updatePrimaryButton(this.standAction, handActive);
    this.updatePrimaryButton(this.doubleAction, this.canDoubleActive());
    this.updatePrimaryButton(this.splitAction, this.canSplitActive());
  }

  private setActionVisible(action: ActionButton, visible: boolean): void {
    action.bg.setVisible(visible);
    action.label.setVisible(visible);
    if (visible) {
      action.zone.setInteractive({ cursor: 'pointer' });
    } else {
      action.zone.disableInteractive();
    }
  }

  private updatePrimaryButton(action: ActionButton, enabled: boolean): void {
    if (enabled) {
      drawNestedButton(action.bg, action.x, action.y, action.w, action.h, false);
      action.label.setColor(COLOR.ivory).setStroke(COLOR.woodDeep, 5);
    } else {
      this.drawDisabledButton(action.bg, action.x, action.y, action.w, action.h);
      this.setDisabledLabel(action.label);
    }
  }

  private drawDisabledButton(g: GameObjects.Graphics, cx: number, cy: number, w: number, h: number): void {
    g.clear();
    g.fillStyle(0x1f281f, 1);
    g.fillRect(cx - w / 2, cy - h / 2, w, h);
    g.fillStyle(0x3d2a1a, 1);
    g.fillRect(cx - w / 2 + 6, cy - h / 2 + 6, w - 12, h - 12);
    g.fillStyle(0x27452d, 0.6);
    g.fillRect(cx - w / 2 + 10, cy - h / 2 + 10, w - 20, h - 20);
  }

  private setDisabledLabel(label: GameObjects.Text): void {
    label.setColor('#718271').setStroke('#718271', 0);
  }

  private startHand(): void {
    AudioManager.playSfx(this, 'deal-card', { volume: 1.4, cooldownMs: 50, allowOverlap: true });
    const round = startRound();
    const bet = this.getBetCost();
    this.deck = round.deck;
    this.playerHands = [round.player];
    this.handBets = [bet];
    this.handFinished = [false];
    this.activeHandIndex = 0;
    this.dealerHand = round.dealer;
    this.roundActive = true;
    this.revealDealer = false;
    this.resultText.setText('');
    this.targetReachedText.setVisible(false);

    this.renderHands();
    this.updateBetButtons();
    this.updateActionButtons();

    const playerValue = evaluateHand(this.playerHands[0]);
    const dealerValue = evaluateHand(this.dealerHand);
    if (playerValue.blackjack || dealerValue.blackjack) {
      this.handFinished[0] = true;
      this.finishRound();
    }
  }

  private hit(): void {
    AudioManager.playSfx(this, 'deal-card', { volume: 1.4, cooldownMs: 50, allowOverlap: true });
    const drawn = drawCard(this.deck);
    this.deck = drawn.deck;
    this.playerHands[this.activeHandIndex] = [...this.playerHands[this.activeHandIndex], drawn.card];
    this.renderHands();
    this.updateActionButtons();

    if (evaluateHand(this.playerHands[this.activeHandIndex]).busted) {
      this.handFinished[this.activeHandIndex] = true;
      this.advanceHand();
    }
  }

  private stand(): void {
    AudioManager.playSfx(this, 'deal-card', { volume: 1.2, cooldownMs: 40, allowOverlap: false });
    this.handFinished[this.activeHandIndex] = true;
    this.advanceHand();
  }

  private double(): void {
    AudioManager.playSfx(this, 'deal-card', { volume: 1.4, cooldownMs: 50, allowOverlap: true });
    // Double the bet on this hand
    this.handBets[this.activeHandIndex] = this.handBets[this.activeHandIndex] * 2;
    // Deal exactly one card
    const drawn = drawCard(this.deck);
    this.deck = drawn.deck;
    this.playerHands[this.activeHandIndex] = [...this.playerHands[this.activeHandIndex], drawn.card];
    this.handFinished[this.activeHandIndex] = true;
    this.renderHands();
    this.advanceHand();
  }

  private split(): void {
    AudioManager.playSfx(this, 'deal-card', { volume: 1.4, cooldownMs: 50, allowOverlap: true });
    const hand = this.playerHands[this.activeHandIndex];
    const bet = this.handBets[this.activeHandIndex];
    const card1 = hand[0];
    const card2 = hand[1];

    // Draw one new card for each hand
    const draw1 = drawCard(this.deck);
    const draw2 = drawCard(draw1.deck);
    this.deck = draw2.deck;

    const hand1 = [card1, draw1.card];
    const hand2 = [card2, draw2.card];

    this.playerHands = [hand1, hand2];
    this.handBets = [bet, bet];
    this.handFinished = [false, false];
    this.activeHandIndex = 0;

    this.renderHands();
    this.updateActionButtons();
  }

  private advanceHand(): void {
    // Find next unfinished hand
    for (let i = this.activeHandIndex + 1; i < this.playerHands.length; i++) {
      if (!this.handFinished[i]) {
        this.activeHandIndex = i;
        this.renderHands();
        this.updateActionButtons();
        return;
      }
    }
    // All hands done → dealer plays → settle
    this.dealerPlay();
    this.finishRound();
  }

  private dealerPlay(): void {
    // Only draw if at least one player hand didn't bust (otherwise no point)
    const anyAlive = this.playerHands.some((h) => !evaluateHand(h).busted);
    if (!anyAlive) return;
    while (dealerShouldHit(this.dealerHand)) {
      const drawn = drawCard(this.deck);
      this.deck = drawn.deck;
      this.dealerHand = [...this.dealerHand, drawn.card];
    }
  }

  private finishRound(): void {
    this.revealDealer = true;

    // If finished on blackjack-check (before normal advance), dealer hasn't played yet
    const dealerEval = evaluateHand(this.dealerHand);
    const singleHandBlackjackCheck = this.playerHands.length === 1
      && (evaluateHand(this.playerHands[0]).blackjack || dealerEval.blackjack);
    if (!singleHandBlackjackCheck && !this.handFinished.every((f) => f)) {
      // defensive: make sure dealer has drawn
      this.dealerPlay();
    }

    let totalWins = 0;
    let totalLosses = 0;
    let totalPushes = 0;
    let coinDelta = 0;
    const messages: string[] = [];

    this.playerHands.forEach((hand, idx) => {
      const bet = this.handBets[idx];
      const result = settleRound(0, bet, hand, this.dealerHand);
      coinDelta += result.newCoins; // newCoins is relative since we passed 0 coins
      if (result.outcome === 'win') {
        totalWins += 1;
        this.handsWon += 1;
      } else if (result.outcome === 'lose') {
        totalLosses += 1;
      } else {
        totalPushes += 1;
      }
      if (this.playerHands.length > 1) {
        messages.push(`Hand ${idx + 1}: ${result.displayText}`);
      } else {
        messages.push(result.displayText);
      }
    });

    this.currentCoins += coinDelta;
    this.roundActive = false;

    if (totalWins > 0) {
      winBurst(this, 512, 440);
    }

    this.coinsText.setText(`Coins: ${this.currentCoins}`);
    if (this.currentCoins < 120) {
      this.time.delayedCall(3000, () => HouseController.say(this, 'playerActions', 'lowChips'));
    }
    this.handsWonText.setText(`Hands Won: ${this.handsWon}/${HANDS_TO_WIN}`);

    const overallColor = totalWins > totalLosses
      ? COLOR.winGreen
      : totalLosses > totalWins
        ? COLOR.loseRed
        : COLOR.goldText;
    this.resultText
      .setText(messages.join('  •  '))
      .setColor(overallColor);

    const overall = totalWins > totalLosses ? 'win' : totalLosses > totalWins ? 'lose' : 'push';
    AudioManager.playSfx(
      this,
      overall === 'win' ? 'win' : overall === 'lose' ? 'lose' : 'push',
      { volume: 1.35, cooldownMs: 100, allowOverlap: false },
    );

    const anyBust = this.playerHands.some((h) => evaluateHand(h).busted);
    const anyHit21Win = this.playerHands.some((h) => evaluateHand(h).total === 21) && totalWins > 0;
    if (anyBust) {
      AudioManager.playSfx(this, 'blackjack-bust', { volume: 1.4, cooldownMs: 120, allowOverlap: false });
      HouseController.say(this, 'gameSpecific', 'blackjackBusted');
    } else if (anyHit21Win) {
      AudioManager.playSfx(this, 'blackjack-hit21', { volume: 1.45, cooldownMs: 120, allowOverlap: false });
    }
    void totalPushes;

    if (this.currentCoins >= WIN_TARGET || this.handsWon >= HANDS_TO_WIN) {
      this.targetReachedText.setText('Target reached! You may advance.').setVisible(true);
    }

    if (!isValidBet(this.currentCoins, this.getBetCost())) {
      this.selectedBet = 0;
    }

    this.renderHands();
    this.updateBetButtons();
    this.updateActionButtons();
  }

  private renderHands(): void {
    this.dealerCardsContainer.removeAll(true);
    this.playerCardsContainer.removeAll(true);
    this.activeHandMarker.clear();

    // Dealer
    this.renderHand(this.dealerCardsContainer, this.dealerHand, 222, 256, !this.revealDealer);

    // Player hands (1 or 2)
    const handsCount = this.playerHands.length;
    if (handsCount <= 1) {
      this.renderHand(this.playerCardsContainer, this.playerHands[0] ?? [], 222, 474, false);
    } else {
      // Two hands: left side and right side
      this.renderCompactHand(this.playerCardsContainer, this.playerHands[0], 200, 474, 0);
      this.renderCompactHand(this.playerCardsContainer, this.playerHands[1], 560, 474, 1);
    }

    // Active-hand marker when split
    if (handsCount > 1 && this.roundActive && this.activeHandIndex < handsCount) {
      const markerX = this.activeHandIndex === 0 ? 200 : 560;
      this.activeHandMarker.lineStyle(3, 0xffdd88, 1);
      this.activeHandMarker.strokeRect(markerX - 56, 408, 340, 132);
    }

    // Dealer score (show only first card until reveal)
    const dealerCards = this.revealDealer ? this.dealerHand : this.dealerHand.slice(0, 1);
    const dealerValue = dealerCards.length > 0 ? evaluateHand(dealerCards).total : null;
    this.dealerScoreText.setText(`Dealer: ${dealerValue ?? '--'}`);
  }

  private renderHand(
    container: GameObjects.Container,
    cards: Card[],
    startX: number,
    y: number,
    hideHoleCard: boolean,
  ): void {
    const spacing = 96;

    cards.forEach((card, index) => {
      const cardX = startX + index * spacing;
      const hidden = hideHoleCard && index === 1;
      container.add(this.buildCard(cardX, y, hidden ? null : card));
    });

    if (cards.length === 0) {
      const placeholder = this.add.text(startX, y, 'No cards', {
        fontFamily: FONT.mono,
        fontSize: '18px',
        color: COLOR.ivorySoft,
      }).setOrigin(0.5);
      container.add(placeholder);
    }

    // Score label per hand
    const total = cards.length > 0
      ? (hideHoleCard ? evaluateHand(cards.slice(0, 1)).total : evaluateHand(cards).total)
      : null;
    const labelY = y + 72;
    const labelText = this.add.text(startX - 40, labelY, `Player: ${total ?? '--'}`, {
      fontFamily: FONT.mono,
      fontSize: '16px',
      color: COLOR.ivory,
    });
    container.add(labelText);
  }

  private renderCompactHand(
    container: GameObjects.Container,
    cards: Card[],
    startX: number,
    y: number,
    handIndex: number,
  ): void {
    const spacing = 56; // tighter for split (cards slightly overlap like a fan)
    cards.forEach((card, index) => {
      const cardX = startX + index * spacing;
      container.add(this.buildCard(cardX, y, card));
    });

    const busted = evaluateHand(cards).busted;
    const total = evaluateHand(cards).total;
    const label = this.add.text(startX - 40, y + 60, `H${handIndex + 1}: ${total}${busted ? ' BUST' : ''}  Bet ${this.handBets[handIndex]}`, {
      fontFamily: FONT.mono,
      fontSize: '14px',
      color: busted ? COLOR.loseRed : COLOR.ivory,
    });
    container.add(label);
  }

  private buildCard(x: number, y: number, card: Card | null): GameObjects.Container {
    const g = this.add.graphics();

    if (card) {
      g.fillStyle(0xfaf6ed, 1);
      g.fillRoundedRect(x - 40, y - 58, 80, 116, 8);
      g.lineStyle(2, 0xb8944b, 1);
      g.strokeRoundedRect(x - 40, y - 58, 80, 116, 8);
      g.lineStyle(1, 0xd4b06a, 0.35);
      g.strokeRoundedRect(x - 34, y - 52, 68, 104, 5);
    } else {
      g.fillStyle(0x1e1040, 1);
      g.fillRoundedRect(x - 40, y - 58, 80, 116, 8);
      g.lineStyle(2, 0xf8cf72, 1);
      g.strokeRoundedRect(x - 40, y - 58, 80, 116, 8);
      g.fillStyle(0x2e1b5c, 1);
      g.fillRect(x - 26, y - 44, 52, 88);
      g.fillStyle(0xf8cf72, 0.7);
      g.fillRect(x - 5, y - 32, 10, 64);
      g.fillRect(x - 26, y - 5, 52, 10);
    }

    const objects: GameObjects.GameObject[] = [g];

    if (card) {
      const col = SUIT_COLOR[card.suit];
      const rank = this.add.text(x - 31, y - 48, card.rank, {
        fontFamily: FONT.mono,
        fontSize: '22px',
        fontStyle: 'bold',
        color: col,
      });
      const topSuit = this.add.text(x - 28, y - 26, SUIT_TEXT[card.suit], {
        fontFamily: FONT.mono,
        fontSize: '16px',
        color: col,
      });
      const suit = this.add.text(x, y + 4, SUIT_TEXT[card.suit], {
        fontFamily: FONT.mono,
        fontSize: '38px',
        color: col,
      }).setOrigin(0.5);
      const brRank = this.add.text(x + 31, y + 48, card.rank, {
        fontFamily: FONT.mono,
        fontSize: '22px',
        fontStyle: 'bold',
        color: col,
      }).setOrigin(1, 1);
      const brSuit = this.add.text(x + 28, y + 27, SUIT_TEXT[card.suit], {
        fontFamily: FONT.mono,
        fontSize: '16px',
        color: col,
      }).setOrigin(1, 1);
      objects.push(rank, topSuit, suit, brRank, brSuit);
    }

    return this.add.container(0, 0, objects);
  }

  private _showSpeech(text: string): void {
    DialogueBus.say(this, text);
  }

  private leave(): void {
    const won = this.currentCoins >= WIN_TARGET || this.handsWon >= HANDS_TO_WIN;

    try {
      this.scene.get('DungeonScene').events.emit('game-complete', {
        coins: this.currentCoins,
        won,
      });
    } catch (_) {
      // DungeonScene may not exist in isolated testing
    }

    this.scene.stop('BlackjackScene');
  }
}
