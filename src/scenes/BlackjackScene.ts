import { Scene, GameObjects } from 'phaser';
import {
  Card,
  dealerShouldHit,
  drawCard,
  evaluateHand,
  isValidBet,
  settleRound,
  startRound,
} from '../games/blackjack';
import { THEME, COLOR, FONT, drawNestedButton, neonTitleStyle, buttonLabelStyle } from '../ui/theme';
import { SfxManager } from '../managers/SfxManager';

const WIN_TARGET = 400;
const HANDS_TO_WIN = 3;
const BET_OPTIONS = [10, 25, 50];

const SUIT_TEXT: Record<Card['suit'], string> = {
  spades: 'S',
  hearts: 'H',
  diamonds: 'D',
  clubs: 'C',
};

const SUIT_COLOR: Record<Card['suit'], string> = {
  spades: COLOR.ivory,
  hearts: '#ff8aa1',
  diamonds: '#ffb57b',
  clubs: '#9ce28d',
};

export class BlackjackScene extends Scene {
  private currentCoins = 200;
  private selectedBet = 0;
  private currentBet = 0;
  private handsWon = 0;
  private roundActive = false;
  private sfx!: SfxManager;

  private deck: Card[] = [];
  private playerHand: Card[] = [];
  private dealerHand: Card[] = [];
  private revealDealer = false;

  private coinsText!: GameObjects.Text;
  private handsWonText!: GameObjects.Text;
  private dealerScoreText!: GameObjects.Text;
  private playerScoreText!: GameObjects.Text;
  private resultText!: GameObjects.Text;
  private targetReachedText!: GameObjects.Text;
  private dealerCardsContainer!: GameObjects.Container;
  private playerCardsContainer!: GameObjects.Container;

  private dealBtn!: GameObjects.Graphics;
  private dealBtnText!: GameObjects.Text;
  private hitBtn!: GameObjects.Graphics;
  private hitBtnText!: GameObjects.Text;
  private standBtn!: GameObjects.Graphics;
  private standBtnText!: GameObjects.Text;
  private leaveBtn!: GameObjects.Graphics;

  private dealZone!: GameObjects.Zone;
  private hitZone!: GameObjects.Zone;
  private standZone!: GameObjects.Zone;

  private betButtons!: Array<{ bg: GameObjects.Graphics; label: GameObjects.Text; bet: number }>;

  constructor() {
    super('BlackjackScene');
  }

  init(data: { coins: number; floor?: number }) {
    this.currentCoins = data.coins ?? 200;
    this.selectedBet = 0;
    this.currentBet = 0;
    this.handsWon = 0;
    this.roundActive = false;
    this.deck = [];
    this.playerHand = [];
    this.dealerHand = [];
    this.revealDealer = false;
  }

  create() {
    this.sfx = new SfxManager(this);
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

    this.add.text(40, 78, 'Reach 400 coins or win 3 hands.', {
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

    this.resultText = this.add.text(W / 2, 560, '', {
      fontSize: '22px',
      color: COLOR.winGreen,
      fontFamily: FONT.mono,
      align: 'center',
    }).setOrigin(0.5);

    this.targetReachedText = this.add.text(W / 2, 598, '', {
      fontSize: '18px',
      color: COLOR.pink,
      fontFamily: FONT.mono,
    }).setOrigin(0.5).setVisible(false);

    this.updateBetButtons();
    this.updateActionButtons();
    this.renderHands();

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
    const btnH = 48;
    const spacing = 140;
    const startX = W / 2 - spacing;

    this.add.text(W / 2, 612, 'SELECT BET', {
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
        if (!this.roundActive && this.selectedBet !== bet && bet <= this.currentCoins) {
          drawNestedButton(bg, x, betY, btnW, btnH, true);
        }
      });
      zone.on('pointerout', () => {
        if (!this.roundActive && this.selectedBet !== bet && bet <= this.currentCoins) {
          drawNestedButton(bg, x, betY, btnW, btnH, false);
        }
      });
      zone.on('pointerdown', () => {
        if (!this.roundActive) {
          this.sfx.play('sfx-btn-click');
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

    this.dealerScoreText = this.add.text(160, 226, 'Dealer: --', {
      fontFamily: FONT.mono,
      fontSize: '18px',
      color: COLOR.ivory,
    });

    this.playerScoreText = this.add.text(160, 444, 'Player: --', {
      fontFamily: FONT.mono,
      fontSize: '18px',
      color: COLOR.ivory,
    });
  }

  private _createActions(): void {
    const dealY = 704;

    this.dealBtn = this.add.graphics();
    this.dealBtnText = this.add.text(292, dealY, 'DEAL', buttonLabelStyle(24)).setOrigin(0.5);
    this.dealZone = this.add.zone(292, dealY, 170, 54).setInteractive({ cursor: 'pointer' });
    this.dealZone.on('pointerdown', () => {
      if (this.canDeal()) {
        this.sfx.play('sfx-btn-click');
        this.startHand();
      }
    });

    this.hitBtn = this.add.graphics();
    this.hitBtnText = this.add.text(512, dealY, 'HIT', buttonLabelStyle(24)).setOrigin(0.5);
    this.hitZone = this.add.zone(512, dealY, 170, 54).setInteractive({ cursor: 'pointer' });
    this.hitZone.on('pointerdown', () => {
      if (this.roundActive) {
        this.sfx.play('sfx-btn-click');
        this.hit();
      }
    });

    this.standBtn = this.add.graphics();
    this.standBtnText = this.add.text(732, dealY, 'STAND', buttonLabelStyle(24)).setOrigin(0.5);
    this.standZone = this.add.zone(732, dealY, 170, 54).setInteractive({ cursor: 'pointer' });
    this.standZone.on('pointerdown', () => {
      if (this.roundActive) {
        this.sfx.play('sfx-btn-click');
        this.stand();
      }
    });

    const leaveY = 84 + 620;
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
        this.sfx.play('sfx-btn-click');
        this.leave();
      }
    });
  }

  private canDeal(): boolean {
    return !this.roundActive && isValidBet(this.currentCoins, this.selectedBet);
  }

  private updateBetButtons(): void {
    const W = 1024;
    const betY = 640;
    const btnW = 110;
    const btnH = 48;
    const spacing = 140;
    const startX = W / 2 - spacing;

    this.betButtons.forEach(({ bg, label, bet }, index) => {
      const x = startX + index * spacing;
      const disabled = this.roundActive || bet > this.currentCoins;
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
    this.updatePrimaryButton(this.dealBtn, this.dealBtnText, 292, 704, 170, 54, this.canDeal());
    this.updatePrimaryButton(this.hitBtn, this.hitBtnText, 512, 704, 170, 54, this.roundActive);
    this.updatePrimaryButton(this.standBtn, this.standBtnText, 732, 704, 170, 54, this.roundActive);
  }

  private updatePrimaryButton(
    bg: GameObjects.Graphics,
    label: GameObjects.Text,
    cx: number,
    cy: number,
    w: number,
    h: number,
    enabled: boolean,
  ): void {
    if (enabled) {
      drawNestedButton(bg, cx, cy, w, h, false);
      label.setColor(COLOR.ivory).setStroke(COLOR.woodDeep, 5);
    } else {
      this.drawDisabledButton(bg, cx, cy, w, h);
      this.setDisabledLabel(label);
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
    const round = startRound();
    this.deck = round.deck;
    this.playerHand = round.player;
    this.dealerHand = round.dealer;
    this.currentBet = this.selectedBet;
    this.roundActive = true;
    this.revealDealer = false;

    // Staggered card deal sounds (4 cards total)
    [0, 120, 240, 360].forEach((delay) => {
      this.time.delayedCall(delay, () => this.sfx.play('sfx-card-deal'));
    });
    this.resultText.setText('');
    this.targetReachedText.setVisible(false);

    this.renderHands();
    this.updateBetButtons();
    this.updateActionButtons();

    const playerValue = evaluateHand(this.playerHand);
    const dealerValue = evaluateHand(this.dealerHand);
    if (playerValue.blackjack || dealerValue.blackjack) {
      this.finishRound();
    }
  }

  private hit(): void {
    this.sfx.play('sfx-card-deal');
    const drawn = drawCard(this.deck);
    this.deck = drawn.deck;
    this.playerHand = [...this.playerHand, drawn.card];
    this.renderHands();

    if (evaluateHand(this.playerHand).busted) {
      this.finishRound();
    }
  }

  private stand(): void {
    while (dealerShouldHit(this.dealerHand)) {
      const drawn = drawCard(this.deck);
      this.deck = drawn.deck;
      this.dealerHand = [...this.dealerHand, drawn.card];
    }

    this.finishRound();
  }

  private finishRound(): void {
    this.revealDealer = true;
    this.sfx.play('sfx-card-flip');

    const result = settleRound(this.currentCoins, this.currentBet, this.playerHand, this.dealerHand);
    this.currentCoins = result.newCoins;
    this.roundActive = false;

    if (result.outcome === 'win') {
      const isBlackjack = evaluateHand(this.playerHand).blackjack;
      this.sfx.play(isBlackjack ? 'sfx-bj-blackjack' : 'sfx-bj-win');
    } else if (result.outcome === 'lose') {
      this.sfx.play('sfx-bj-lose');
    } else {
      this.sfx.play('sfx-bj-push');
    }

    if (result.outcome === 'win') {
      this.handsWon += 1;
    }

    this.coinsText.setText(`Coins: ${this.currentCoins}`);
    this.handsWonText.setText(`Hands Won: ${this.handsWon}/${HANDS_TO_WIN}`);
    this.resultText
      .setText(result.displayText)
      .setColor(
        result.outcome === 'win'
          ? COLOR.winGreen
          : result.outcome === 'lose'
            ? COLOR.loseRed
            : COLOR.goldText
      );

    if (this.currentCoins >= WIN_TARGET || this.handsWon >= HANDS_TO_WIN) {
      this.targetReachedText.setText('Target reached! You may advance.').setVisible(true);
    }

    if (!isValidBet(this.currentCoins, this.selectedBet)) {
      this.selectedBet = 0;
    }

    this.renderHands();
    this.updateBetButtons();
    this.updateActionButtons();
  }

  private renderHands(): void {
    this.dealerCardsContainer.removeAll(true);
    this.playerCardsContainer.removeAll(true);

    this.renderHand(this.dealerCardsContainer, this.dealerHand, 222, 256, !this.revealDealer);
    this.renderHand(this.playerCardsContainer, this.playerHand, 222, 474, false);

    const playerValue = this.playerHand.length > 0 ? evaluateHand(this.playerHand).total : null;
    const dealerCards = this.revealDealer ? this.dealerHand : this.dealerHand.slice(0, 1);
    const dealerValue = dealerCards.length > 0 ? evaluateHand(dealerCards).total : null;

    this.playerScoreText.setText(`Player: ${playerValue ?? '--'}`);
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
  }

  private buildCard(x: number, y: number, card: Card | null): GameObjects.Container {
    const g = this.add.graphics();

    if (card) {
      g.fillStyle(0xf7eed3, 1);
      g.fillRoundedRect(x - 38, y - 54, 76, 108, 8);
      g.lineStyle(2, 0xb8944b, 1);
      g.strokeRoundedRect(x - 38, y - 54, 76, 108, 8);
    } else {
      g.fillStyle(0x412154, 1);
      g.fillRoundedRect(x - 38, y - 54, 76, 108, 8);
      g.lineStyle(2, 0xf8cf72, 1);
      g.strokeRoundedRect(x - 38, y - 54, 76, 108, 8);
      g.fillStyle(0x6f2e75, 1);
      g.fillRect(x - 24, y - 40, 48, 80);
      g.fillStyle(0xf8cf72, 1);
      g.fillRect(x - 6, y - 26, 12, 52);
      g.fillRect(x - 24, y - 6, 48, 12);
    }

    const objects: GameObjects.GameObject[] = [g];

    if (card) {
      const rank = this.add.text(x - 24, y - 36, card.rank, {
        fontFamily: FONT.mono,
        fontSize: '18px',
        color: SUIT_COLOR[card.suit],
      });
      const suit = this.add.text(x, y, SUIT_TEXT[card.suit], {
        fontFamily: FONT.mono,
        fontSize: '32px',
        color: SUIT_COLOR[card.suit],
      }).setOrigin(0.5);
      const miniSuit = this.add.text(x + 22, y + 28, SUIT_TEXT[card.suit], {
        fontFamily: FONT.mono,
        fontSize: '14px',
        color: SUIT_COLOR[card.suit],
      }).setOrigin(0.5);
      objects.push(rank, suit, miniSuit);
    }

    return this.add.container(0, 0, objects);
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
