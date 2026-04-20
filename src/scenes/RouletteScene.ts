import Phaser, { Scene, GameObjects } from 'phaser';
import {
  ROULETTE_POCKETS,
  Bet,
  BetKind,
  indexForNumber,
  pocketForNumber,
  settleBets,
  spinRoulette,
} from '../games/roulette';
import { AudioManager } from '../audio/AudioManager';
import {
  COLOR,
  FONT,
  buttonLabelStyle,
  drawFramedPanel,
  drawNestedButton,
  neonTitleStyle,
} from '../ui/theme';
import { addGameplaySettingsGear } from '../ui/gameplaySettings';
import { registerDeveloperUnlockHotkey } from '../dev/developerHotkeys';
import { HouseController } from '../ui/HouseController';
import { DialogueBus } from '../ui/DialogueBus';

const WHEEL_CX = 208;
const WHEEL_CY = 340;
const WHEEL_R = 172;
const POCKET_INNER = 126;
const BALL_TRACK_R = WHEEL_R + 6; // = 166
const BALL_R = 6;

const CHIP_VALUES = [10, 25, 50, 100] as const;

interface BetSpot {
  kind: BetKind;
  number?: number;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
  total: number;
  chipText?: GameObjects.Text;
}

export class RouletteScene extends Scene {
  private currentCoins = 200;
  private spinDurationMs = 5200;
  private spinSound: Phaser.Sound.BaseSound | null = null;

  private coinsText!: GameObjects.Text;
  private statusText!: GameObjects.Text;
  private chipSelector: Array<{ bg: GameObjects.Graphics; label: GameObjects.Text; value: number; zone: GameObjects.Zone }> = [];
  private selectedChip = 25;
  private allInChipButton!: { bg: GameObjects.Graphics; label: GameObjects.Text; zone: GameObjects.Zone };

  private wheelContainer!: GameObjects.Container;
  private ball!: GameObjects.Arc;
  private ballAngle = -Math.PI / 2;

  private betSpots: BetSpot[] = [];
  private bets: Bet[] = [];

  private spinBtn!: GameObjects.Graphics;
  private spinZone!: GameObjects.Zone;
  private clearBtn!: GameObjects.Graphics;
  private clearZone!: GameObjects.Zone;

  private resultPanel!: GameObjects.Graphics;
  private resultTitle!: GameObjects.Text;
  private resultDetail!: GameObjects.Text;
  private resultGlow!: GameObjects.Graphics;
  private continueBtn!: GameObjects.Graphics;
  private continueBtnText!: GameObjects.Text;
  private continueZone!: GameObjects.Zone;

  private totalBetText!: GameObjects.Text;

  private spinning = false;
  private exitRequested = false;
  private readonly handleEsc = () => this.leave();

  constructor() {
    super('RouletteScene');
  }

  init(data: { coins: number }): void {
    this.currentCoins = data.coins ?? 200;
    this.chipSelector = [];
    this.betSpots = [];
    this.bets = [];
    this.spinning = false;
    this.exitRequested = false;
  }

  create(): void {
    HouseController.disable();
    this.events.once('shutdown', () => {
      HouseController.enable();
      this.stopSpinSound();
      this.input.keyboard?.off('keydown-ESC', this.handleEsc);
      this.chipSelector = [];
      this.betSpots = [];
    });
    this.cameras.main.setRoundPixels(true);

    const W = 1024;
    const H = 768;

    this.spinDurationMs = this.resolveSpinDurationMs();

    this.drawBackground(W, H);
    this.drawHeader(W);
    this.buildWheel();
    this.buildBall();
    this.buildBettingBoard();
    this.buildChipSelector();
    this.buildActionButtons();
    this.buildTotalBetDisplay();
    this.buildResultPanel();

    this.statusText = this.add.text(512, H - 20, 'Place chips, then SPIN.', {
      fontSize: '16px',
      fontFamily: FONT.mono,
      color: '#c0c0c0',
    }).setOrigin(0.5).setResolution(2);

    addGameplaySettingsGear(this, 'RouletteScene');
    registerDeveloperUnlockHotkey(this, () => this.leave());
    this.input.keyboard?.off('keydown-ESC', this.handleEsc);
    this.input.keyboard?.on('keydown-ESC', this.handleEsc);

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // ── Background ────────────────────────────────────────────────────────
  private drawBackground(w: number, h: number): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x12070d, 1);
    bg.fillRect(0, 0, w, h);
    bg.fillStyle(0x1a0c13, 1);
    bg.fillRect(0, 0, w, 100);

    // Left felt — wheel zone
    const felt = this.add.graphics();
    felt.fillStyle(0x0d5a2e, 1);
    felt.fillRoundedRect(10, 105, 415, 555, 20);
    felt.lineStyle(6, 0x5a2510, 1);
    felt.strokeRoundedRect(10, 105, 415, 555, 20);
    felt.lineStyle(2, 0xe0a242, 0.8);
    felt.strokeRoundedRect(20, 115, 395, 535, 16);

    // Right felt — board zone
    const rightFelt = this.add.graphics();
    rightFelt.fillStyle(0x0a4a26, 1);
    rightFelt.fillRoundedRect(432, 105, 582, 555, 20);
    rightFelt.lineStyle(6, 0x5a2510, 1);
    rightFelt.strokeRoundedRect(432, 105, 582, 555, 20);
    rightFelt.lineStyle(2, 0xe0a242, 0.8);
    rightFelt.strokeRoundedRect(442, 115, 562, 535, 16);

    // Thin vertical gold rail/divider between the two panels
    const rail = this.add.graphics();
    rail.fillStyle(0x5a2510, 1);
    rail.fillRect(425, 105, 8, 555);
    rail.lineStyle(1, 0xe0a242, 0.6);
    rail.lineBetween(426, 108, 426, 657);
    rail.lineBetween(432, 108, 432, 657);

    this.add.text(723, 118, 'BETTING TABLE', {
      fontSize: '13px', fontFamily: FONT.mono, color: '#e0a242', fontStyle: 'bold',
    }).setOrigin(0.5).setResolution(2);
  }

  private drawHeader(w: number): void {
    this.add.text(w / 2, 48, 'ROULETTE', neonTitleStyle(30)).setOrigin(0.5);
    this.coinsText = this.add.text(w - 40, 48, `Coins: ${this.currentCoins}`, {
      fontSize: '22px', color: '#ffffff', fontFamily: FONT.mono,
    }).setOrigin(1, 0.5).setResolution(2);
  }

  // ── Wheel ─────────────────────────────────────────────────────────────
  private buildWheel(): void {
    this.wheelContainer = this.add.container(WHEEL_CX, WHEEL_CY);

    const g = this.add.graphics();
    const labelObjects: GameObjects.Text[] = [];
    const n = ROULETTE_POCKETS.length;
    const arc = (Math.PI * 2) / n;

    // Outer mahogany rim
    g.fillStyle(0x5a2510, 1);
    g.fillCircle(0, 0, WHEEL_R + 14);
    g.fillStyle(0x6a4a28, 1);
    g.fillCircle(0, 0, WHEEL_R + 8);
    g.lineStyle(2, 0xe0a242, 1);
    g.strokeCircle(0, 0, WHEEL_R + 8);

    // Pockets
    for (let i = 0; i < n; i += 1) {
      const p = ROULETTE_POCKETS[i];
      const start = i * arc - Math.PI / 2 - arc / 2;
      const end = start + arc;
      const color = p.color === 'green' ? 0x1d8a3a : p.color === 'red' ? 0xbf1d1d : 0x111111;

      g.fillStyle(color, 1);
      g.beginPath();
      g.arc(0, 0, WHEEL_R, start, end, false);
      g.arc(0, 0, POCKET_INNER, end, start, true);
      g.closePath();
      g.fillPath();

      // Pocket separator (gold fret)
      g.lineStyle(1, 0xe0a242, 0.9);
      g.beginPath();
      g.moveTo(Math.cos(start) * POCKET_INNER, Math.sin(start) * POCKET_INNER);
      g.lineTo(Math.cos(start) * WHEEL_R, Math.sin(start) * WHEEL_R);
      g.strokePath();

      // Pocket number
      const midAngle = start + arc / 2;
      const labelR = (WHEEL_R + POCKET_INNER) / 2;
      const lx = Math.cos(midAngle) * labelR;
      const ly = Math.sin(midAngle) * labelR;
      const label = this.add.text(lx, ly, String(p.number), {
        fontSize: '13px',
        fontFamily: FONT.mono,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);
      label.setResolution(2);
      label.setRotation(midAngle + Math.PI / 2);
      labelObjects.push(label);
    }

    // Inner hub (stationary-looking but rotates with wheel — classic roulette style)
    g.fillStyle(0x5a2510, 1);
    g.fillCircle(0, 0, POCKET_INNER);
    g.fillStyle(0x8a5a2a, 1);
    g.fillCircle(0, 0, POCKET_INNER - 10);
    g.fillStyle(0x6a4a28, 1);
    g.fillCircle(0, 0, POCKET_INNER - 28);

    // Silver crossbar / turret
    g.fillStyle(0xd0d4d8, 1);
    g.fillRect(-POCKET_INNER + 20, -2, 2 * (POCKET_INNER - 20), 4);
    g.fillRect(-2, -POCKET_INNER + 20, 4, 2 * (POCKET_INNER - 20));
    g.fillStyle(0xe0a242, 1);
    g.fillCircle(0, 0, 14);
    g.fillStyle(0x5a2510, 1);
    g.fillCircle(0, 0, 8);
    g.fillStyle(0xe0a242, 1);
    g.fillCircle(0, 0, 4);

    // Outer ball track
    g.lineStyle(3, 0x2a1808, 1);
    g.strokeCircle(0, 0, WHEEL_R + 2);
    g.lineStyle(1, 0xe0a242, 0.6);
    g.strokeCircle(0, 0, WHEEL_R + 10);

    this.wheelContainer.add(g);
    labelObjects.forEach((l) => this.wheelContainer.add(l));
  }

  private buildBall(): void {
    this.ball = this.add.circle(
      WHEEL_CX + Math.cos(this.ballAngle) * BALL_TRACK_R,
      WHEEL_CY + Math.sin(this.ballAngle) * BALL_TRACK_R,
      BALL_R,
      0xfefcf4,
    );
    this.ball.setStrokeStyle(1, 0x6a4a28, 0.9);
    this.ball.setDepth(10);
  }

  // ── Betting board ─────────────────────────────────────────────────────
  private buildBettingBoard(): void {
    const boardX = 438;
    const boardY = 132;
    const cellW = 41;
    const cellH = 48;
    const gap = 2;
    const zeroW = 46;
    const gridLeft = boardX + zeroW + 6;  // = 490
    const gridWidth = 12 * (cellW + gap) - gap;  // = 514

    // ── 0 cell ──
    const zeroH = 3 * (cellH + gap) - gap;  // = 148
    this.addSpot({ kind: 'straight', number: 0, label: '0',
      x: boardX, y: boardY, w: zeroW, h: zeroH, color: 0x1d8a3a });

    // ── Number grid: 12 cols × 3 rows ──
    for (let col = 0; col < 12; col++) {
      for (let row = 0; row < 3; row++) {
        const number = col * 3 + (3 - row);
        const pocket = pocketForNumber(number);
        const color = pocket.color === 'red' ? 0x8f1818 : 0x141414;
        this.addSpot({ kind: 'straight', number,
          label: String(number),
          x: gridLeft + col * (cellW + gap),
          y: boardY + row * (cellH + gap),
          w: cellW, h: cellH, color });
      }
    }

    const gridBottom = boardY + 3 * (cellH + gap) - gap;  // = 280

    // ── Gold divider + DOZENS ──
    const div1 = this.add.graphics();
    div1.lineStyle(1, 0xe0a242, 0.45);
    div1.lineBetween(gridLeft - 2, gridBottom + 6, gridLeft + gridWidth + 2, gridBottom + 6);
    this.add.text(gridLeft, gridBottom + 10, 'DOZENS', {
      fontSize: '10px', fontFamily: FONT.mono, color: '#e0a242', fontStyle: 'bold',
    }).setResolution(2);

    const dozenY = gridBottom + 24;
    const dozenW = Math.floor(gridWidth / 3) - 1;  // ≈ 170
    const dozenH = 42;
    const dozenLabels: [BetKind, string][] = [['dozen1', '1st 12'], ['dozen2', '2nd 12'], ['dozen3', '3rd 12']];
    for (let i = 0; i < 3; i++) {
      this.addSpot({ kind: dozenLabels[i][0], label: dozenLabels[i][1],
        x: gridLeft + i * (dozenW + 2),
        y: dozenY, w: dozenW, h: dozenH, color: 0x2e5c3a });
    }

    const dozenBottom = dozenY + dozenH;  // ≈ 346

    // ── Gold divider + COLUMN BETS ──
    const div2 = this.add.graphics();
    div2.lineStyle(1, 0xe0a242, 0.45);
    div2.lineBetween(gridLeft - 2, dozenBottom + 6, gridLeft + gridWidth + 2, dozenBottom + 6);
    this.add.text(gridLeft, dozenBottom + 10, 'COLUMN BETS', {
      fontSize: '10px', fontFamily: FONT.mono, color: '#e0a242', fontStyle: 'bold',
    }).setResolution(2);

    const colY = dozenBottom + 24;
    const colW = dozenW;
    const colH = 40;
    const colLabels: [BetKind, string][] = [['col1', 'COL 1  2:1'], ['col2', 'COL 2  2:1'], ['col3', 'COL 3  2:1']];
    for (let i = 0; i < 3; i++) {
      this.addSpot({ kind: colLabels[i][0], label: colLabels[i][1],
        x: gridLeft + i * (colW + 2),
        y: colY, w: colW, h: colH, color: 0x1a4a2a });
    }

    const colBottom = colY + colH;  // ≈ 410

    // ── Gold divider + OUTSIDE BETS ──
    const div3 = this.add.graphics();
    div3.lineStyle(1, 0xe0a242, 0.45);
    div3.lineBetween(gridLeft - 2, colBottom + 6, gridLeft + gridWidth + 2, colBottom + 6);
    this.add.text(gridLeft, colBottom + 10, 'OUTSIDE BETS', {
      fontSize: '10px', fontFamily: FONT.mono, color: '#e0a242', fontStyle: 'bold',
    }).setResolution(2);

    const outsideY = colBottom + 24;
    const outsideW = Math.floor(gridWidth / 6) - 1;  // ≈ 84
    const outsideH = 40;
    const outsides: Array<{ kind: BetKind; label: string; color: number }> = [
      { kind: 'low',   label: '1–18',  color: 0x2e5c3a },
      { kind: 'even',  label: 'EVEN',  color: 0x2e5c3a },
      { kind: 'red',   label: 'RED',   color: 0x8f1818 },
      { kind: 'black', label: 'BLACK', color: 0x141414 },
      { kind: 'odd',   label: 'ODD',   color: 0x2e5c3a },
      { kind: 'high',  label: '19–36', color: 0x2e5c3a },
    ];
    for (let i = 0; i < outsides.length; i++) {
      this.addSpot({ kind: outsides[i].kind, label: outsides[i].label,
        x: gridLeft + i * (outsideW + 2),
        y: outsideY, w: outsideW, h: outsideH, color: outsides[i].color });
    }

    const outsideBottom = outsideY + outsideH;  // ≈ 474

    // ── Payout reference ──
    const div4 = this.add.graphics();
    div4.lineStyle(1, 0xe0a242, 0.3);
    div4.lineBetween(gridLeft - 2, outsideBottom + 8, gridLeft + gridWidth + 2, outsideBottom + 8);
    this.add.text(gridLeft, outsideBottom + 14, 'PAYOUTS', {
      fontSize: '10px', fontFamily: FONT.mono, color: '#e0a242', fontStyle: 'bold',
    }).setResolution(2);
    const payoutLines = ['Straight  35:1', 'Dozen / Column  2:1', 'Even money  1:1'];
    payoutLines.forEach((line, i) => {
      this.add.text(gridLeft, outsideBottom + 28 + i * 15, line, {
        fontSize: '10px', fontFamily: FONT.mono, color: '#909090',
      }).setResolution(2);
    });
  }

  private addSpot(spot: Omit<BetSpot, 'total' | 'chipText'>): void {
    const fullSpot: BetSpot = { ...spot, total: 0 };
    const g = this.add.graphics();
    this.drawSpot(g, fullSpot, false);

    const zone = this.add.zone(fullSpot.x + fullSpot.w / 2, fullSpot.y + fullSpot.h / 2, fullSpot.w, fullSpot.h)
      .setInteractive({ cursor: 'pointer' });
    zone.on('pointerover', () => this.drawSpot(g, fullSpot, true));
    zone.on('pointerout', () => this.drawSpot(g, fullSpot, false));
    zone.on('pointerdown', () => this.placeChip(fullSpot));

    const label = this.add.text(
      fullSpot.x + fullSpot.w / 2,
      fullSpot.y + fullSpot.h / 2,
      fullSpot.label,
      {
        fontSize: fullSpot.w < 30 ? '11px' : '12px',
        fontFamily: FONT.mono,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      },
    ).setOrigin(0.5).setResolution(2);
    void label;

    const chipText = this.add.text(
      fullSpot.x + fullSpot.w - 4,
      fullSpot.y + fullSpot.h - 4,
      '',
      {
        fontSize: '11px',
        fontFamily: FONT.mono,
        fontStyle: 'bold',
        color: '#ffdf6a',
        stroke: '#000000',
        strokeThickness: 2,
      },
    ).setOrigin(1, 1).setResolution(2);
    fullSpot.chipText = chipText;

    this.betSpots.push(fullSpot);
  }

  private drawSpot(g: GameObjects.Graphics, spot: BetSpot, hover: boolean): void {
    g.clear();
    g.fillStyle(spot.color, 1);
    g.fillRect(spot.x, spot.y, spot.w, spot.h);
    g.lineStyle(1, hover ? 0xffdf6a : 0xe0a242, hover ? 1 : 0.7);
    g.strokeRect(spot.x + 0.5, spot.y + 0.5, spot.w - 1, spot.h - 1);
  }

  private placeChip(spot: BetSpot): void {
    if (this.spinning) return;
    if (this.selectedChip > this.remainingCoins()) {
      this.statusText.setText('Not enough coins.');
      return;
    }
    spot.total += this.selectedChip;
    this.bets.push({ kind: spot.kind, number: spot.number, amount: this.selectedChip });
    spot.chipText?.setText(String(spot.total));
    this.statusText.setText(`Staked ${this.selectedChip} on ${spot.label}.`);
    AudioManager.playSfx(this, 'ui-click', { volume: 0.7, cooldownMs: 40, allowOverlap: true });

    // Tactile feedback: briefly scale chip text up then back
    if (spot.chipText) {
      this.tweens.killTweensOf(spot.chipText);
      spot.chipText.setScale(1.4);
      this.tweens.add({
        targets: spot.chipText,
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 220,
        ease: 'Back.easeOut',
      });
    }

    this.updateTotalBetDisplay();
  }

  private remainingCoins(): number {
    const staked = this.bets.reduce((s, b) => s + b.amount, 0);
    return this.currentCoins - staked;
  }

  // ── Chip selector + action buttons ────────────────────────────────────
  private buildChipSelector(): void {
    const y = 562;
    // Label
    this.add.text(490, y - 20, 'CHIP VALUE', {
      fontSize: '10px', fontFamily: FONT.mono, color: '#e0a242', fontStyle: 'bold',
    }).setResolution(2);
    const startX = 508;
    const spacing = 84;
    for (let i = 0; i < CHIP_VALUES.length; i += 1) {
      const value = CHIP_VALUES[i];
      const x = startX + i * spacing;
      const bg = this.add.graphics();
      this.drawChipButton(bg, x, y, value, value === this.selectedChip);
      const label = this.add.text(x, y, String(value), {
        fontSize: '16px',
        fontFamily: FONT.mono,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setResolution(2);
      const zone = this.add.zone(x, y, 80, 52).setInteractive({ cursor: 'pointer' });
      zone.on('pointerdown', () => {
        if (this.isLowCoinChipMode()) return;
        this.selectedChip = value;
        this.refreshChipSelector();
      });
      this.chipSelector.push({ bg, label, value, zone });
    }

    const allInBg = this.add.graphics().setVisible(false);
    const allInLabel = this.add.text(634, y, '', {
      fontSize: '16px',
      fontFamily: FONT.mono,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setResolution(2).setVisible(false);
    const allInZone = this.add.zone(634, y, 90, 52).setVisible(false);
    allInZone.on('pointerdown', () => {
      if (!this.isLowCoinChipMode()) return;
      this.selectedChip = this.currentCoins;
      this.refreshChipSelector();
      AudioManager.playSfx(this, 'bet-select', { volume: 1.0, cooldownMs: 50, allowOverlap: false });
    });
    this.allInChipButton = { bg: allInBg, label: allInLabel, zone: allInZone };
    this.refreshChipSelector();
  }

  private drawChipButton(
    g: GameObjects.Graphics,
    cx: number,
    cy: number,
    value: number,
    selected: boolean,
    existingLabel?: GameObjects.Text,
  ): void {
    const useX = existingLabel ? existingLabel.x : cx;
    const useY = existingLabel ? existingLabel.y : cy;
    g.clear();
    const fill = value === 10 ? 0x2a7ac9 : value === 25 ? 0x1d8a3a : value === 50 ? 0xb0a040 : 0x8f1818;
    g.fillStyle(0x0a0a0a, 1);
    g.fillCircle(useX, useY, 28);
    g.fillStyle(fill, 1);
    g.fillCircle(useX, useY, 26);
    g.fillStyle(0xffffff, 0.12);
    g.fillCircle(useX, useY, 26);
    g.lineStyle(2, selected ? 0xffdf6a : 0xefe5cf, 1);
    g.strokeCircle(useX, useY, 26);
    if (selected) {
      g.lineStyle(1, 0xffdf6a, 1);
      g.strokeCircle(useX, useY, 30);
    }
  }

  private buildActionButtons(): void {
    // SPIN button
    this.spinBtn = this.add.graphics();
    drawNestedButton(this.spinBtn, 938, 622, 130, 46, false);
    this.add.text(938, 622, 'SPIN', buttonLabelStyle(20)).setOrigin(0.5);
    this.spinZone = this.add.zone(938, 622, 130, 46).setInteractive({ cursor: 'pointer' });
    this.spinZone.on('pointerover', () => drawNestedButton(this.spinBtn, 938, 622, 130, 46, true));
    this.spinZone.on('pointerout', () => drawNestedButton(this.spinBtn, 938, 622, 130, 46, false));
    this.spinZone.on('pointerdown', () => this.doSpin());

    // CLEAR button
    this.clearBtn = this.add.graphics();
    drawNestedButton(this.clearBtn, 820, 622, 110, 40, false);
    this.add.text(820, 622, 'CLEAR', buttonLabelStyle(16)).setOrigin(0.5);
    this.clearZone = this.add.zone(820, 622, 110, 40).setInteractive({ cursor: 'pointer' });
    this.clearZone.on('pointerover', () => drawNestedButton(this.clearBtn, 820, 622, 110, 40, true));
    this.clearZone.on('pointerout', () => drawNestedButton(this.clearBtn, 820, 622, 110, 40, false));
    this.clearZone.on('pointerdown', () => this.clearBets());
  }

  private clearBets(): void {
    if (this.spinning) return;
    this.bets = [];
    this.betSpots.forEach((s) => { s.total = 0; s.chipText?.setText(''); });
    this.statusText.setText('Bets cleared.');
    this.updateTotalBetDisplay();
  }

  // ── Spin ──────────────────────────────────────────────────────────────
  private doSpin(): void {
    if (this.spinning) return;
    if (this.bets.length === 0) {
      this.statusText.setText('Place a bet first.');
      return;
    }

    this.spinning = true;
    this.spinZone.disableInteractive();
    this.clearZone.disableInteractive();

    const result = spinRoulette();
    const resultIdx = indexForNumber(result);
    const arc = (Math.PI * 2) / ROULETTE_POCKETS.length;
    // Current wheel starts aligned so pocket 0 is at top. Spin wheel backwards while ball
    // travels forward several laps, landing ball at the result pocket angle.
    const pocketAngle = resultIdx * arc - Math.PI / 2;

    this.playSpinSound();
    this.showSpeech('Rien ne va plus...');

    // Wheel tween: rotate container (randomised so each spin looks different)
    const randomSpins = 4 + Math.floor(Math.random() * 5); // 4–8 full rotations
    const randomExtra = Math.floor(Math.random() * 360);   // 0–359° additional
    this.tweens.add({
      targets: this.wheelContainer,
      angle: '-=' + (360 * randomSpins + randomExtra),
      duration: this.spinDurationMs,
      ease: 'Cubic.easeOut',
    });

    // Ball tween: animate ball angle around center
    const startAngle = this.ballAngle;
    const ballLaps = Math.PI * 2 * 8; // 8 laps forward
    const targetAngle = pocketAngle;
    const obj = { a: startAngle };
    this.tweens.add({
      targets: obj,
      a: startAngle + ballLaps + (targetAngle - startAngle),
      duration: this.spinDurationMs,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.ballAngle = obj.a;
        // Ball spirals inward as it slows
        const t = this.tweens.getTweensOf(obj)[0]?.progress ?? 1;
        const trackR = BALL_TRACK_R - t * 16;
        this.ball.x = WHEEL_CX + Math.cos(obj.a) * trackR;
        this.ball.y = WHEEL_CY + Math.sin(obj.a) * trackR;
      },
      onComplete: () => {
        this.stopSpinSound();
        this.ballAngle = targetAngle;
        this.time.delayedCall(350, () => this.showResult(result));
      },
    });
  }

  private showResult(result: number): void {
    const settlement = settleBets(this.bets, result);
    this.currentCoins = Math.max(0, this.currentCoins + settlement.totalReturn);
    this.coinsText.setText(`Coins: ${this.currentCoins}`);
    this.refreshChipSelector();
    if (this.currentCoins <= 0) {
      this.statusText.setText('Out of coins.');
      this.time.delayedCall(700, () => this.leave());
      return;
    }

    const pocket = pocketForNumber(result);
    const colorLabel = pocket.color.toUpperCase();
    const titleColor = settlement.totalReturn > 0 ? COLOR.winGreen : settlement.totalReturn < 0 ? COLOR.loseRed : COLOR.goldText;
    const heading = settlement.totalReturn > 0
      ? `WIN +${settlement.totalReturn}`
      : settlement.totalReturn < 0
        ? `LOSS ${settlement.totalReturn}`
        : 'PUSH';

    const detail = `${result} ${colorLabel}\nStake ${settlement.totalStake} · Net ${settlement.totalReturn >= 0 ? '+' : ''}${settlement.totalReturn}`;

    this.resultPanel.setVisible(true);
    this.resultTitle.setText(heading).setColor(titleColor).setVisible(true);
    this.resultDetail.setText(detail).setVisible(true);
    this.continueBtn.setVisible(true);
    this.continueBtnText.setVisible(true);
    this.continueZone.setInteractive({ cursor: 'pointer' });

    // Win glow: green tint rectangle that fades out behind the panel
    if (settlement.totalReturn > 0) {
      const W = 1024;
      const glowW = 520;
      const glowH = 200;
      this.resultGlow.clear();
      this.resultGlow.fillStyle(0x00ff66, 0.22);
      this.resultGlow.fillRoundedRect((W - glowW) / 2, 388, glowW, glowH, 28);
      this.resultGlow.setAlpha(1).setVisible(true);
      this.tweens.add({
        targets: this.resultGlow,
        alpha: 0,
        duration: 900,
        ease: 'Quad.easeOut',
        onComplete: () => this.resultGlow.setVisible(false),
      });
    }

    // Clear bet chips from board
    this.betSpots.forEach((s) => { s.total = 0; s.chipText?.setText(''); });
    this.bets = [];
    this.updateTotalBetDisplay();
    this.showSpeech(heading === 'PUSH' ? 'Even hands.' : heading.startsWith('WIN') ? 'The felt pays.' : 'The house collects.');
  }

  private buildResultPanel(): void {
    const W = 1024;
    const panelW = 460;
    const panelH = 160;
    const px = (W - panelW) / 2;
    const py = 400;

    // Win glow — rendered behind the panel
    this.resultGlow = this.add.graphics().setVisible(false);

    this.resultPanel = this.add.graphics().setVisible(false);
    drawFramedPanel(this.resultPanel, px, py, panelW, panelH, { borderWidth: 2, alpha: 0.95 });

    this.resultTitle = this.add.text(W / 2, py + 38, '', {
      fontSize: '38px', fontFamily: FONT.mono, fontStyle: 'bold', color: COLOR.winGreen,
    }).setOrigin(0.5).setVisible(false).setResolution(2);

    this.resultDetail = this.add.text(W / 2, py + 106, '', {
      fontSize: '19px', fontFamily: FONT.mono, color: '#e5e7eb', align: 'center',
    }).setOrigin(0.5).setVisible(false).setResolution(2);

    const contY = py + panelH + 34;
    this.continueBtn = this.add.graphics().setVisible(false);
    this.continueBtnText = this.add.text(W / 2, contY, 'CONTINUE', buttonLabelStyle(22)).setOrigin(0.5).setVisible(false);
    drawNestedButton(this.continueBtn, W / 2, contY, 200, 52, false);
    this.continueZone = this.add.zone(W / 2, contY, 200, 52);
    this.continueZone.on('pointerover', () => drawNestedButton(this.continueBtn, W / 2, contY, 200, 52, true));
    this.continueZone.on('pointerout', () => drawNestedButton(this.continueBtn, W / 2, contY, 200, 52, false));
    this.continueZone.on('pointerdown', () => {
      this.continueZone.disableInteractive();
      this.leave();
    });
  }

  private buildTotalBetDisplay(): void {
    this.totalBetText = this.add.text(490, 593, 'Total Bet: 0', {
      fontSize: '14px',
      fontFamily: FONT.mono,
      color: '#ffdf6a',
    }).setResolution(2);
  }

  private updateTotalBetDisplay(): void {
    const total = this.bets.reduce((s, b) => s + b.amount, 0);
    this.totalBetText.setText(`Total Bet: ${total}`);
  }

  private isLowCoinChipMode(): boolean {
    return this.currentCoins > 0 && this.currentCoins < 10;
  }

  private refreshChipSelector(): void {
    const lowCoinMode = this.isLowCoinChipMode();
    if (lowCoinMode) {
      this.selectedChip = this.currentCoins;
      this.chipSelector.forEach(({ bg, label, zone }) => {
        bg.setVisible(false);
        label.setVisible(false);
        zone.disableInteractive();
      });
      this.drawChipButton(this.allInChipButton.bg, 634, 562, this.currentCoins, true);
      this.allInChipButton.bg.setVisible(true);
      this.allInChipButton.label.setText(String(this.currentCoins)).setVisible(true);
      this.allInChipButton.zone.setVisible(true).setInteractive({ cursor: 'pointer' });
      return;
    }

    if (!CHIP_VALUES.includes(this.selectedChip as (typeof CHIP_VALUES)[number])) {
      this.selectedChip = 25;
    }
    this.chipSelector.forEach((c) => {
      c.bg.setVisible(true);
      c.label.setVisible(true);
      c.zone.setInteractive({ cursor: 'pointer' });
      this.drawChipButton(c.bg, 0, 0, c.value, c.value === this.selectedChip, c.label);
    });
    this.allInChipButton.bg.setVisible(false);
    this.allInChipButton.label.setVisible(false);
    this.allInChipButton.zone.disableInteractive().setVisible(false);
  }

  // ── Audio (mirrors WheelScene pattern) ────────────────────────────────
  private resolveSpinDurationMs(): number {
    if (!this.cache.audio.exists('wheel-spin')) return 5200;
    try {
      const probe = this.sound.add('wheel-spin', { volume: 0 });
      const probeAny = probe as Phaser.Sound.BaseSound & { totalDuration?: number; duration?: number };
      const durationSec = probeAny.totalDuration ?? probeAny.duration ?? 0;
      probe.destroy();
      if (!Number.isFinite(durationSec) || durationSec <= 0) return 5200;
      return Phaser.Math.Clamp(Math.round(durationSec * 1000), 1500, 20000);
    } catch {
      return 5200;
    }
  }

  private playSpinSound(): void {
    this.stopSpinSound();
    if (!this.cache.audio.exists('wheel-spin')) return;
    const sound = this.sound.add('wheel-spin', { volume: AudioManager.getSfxVolume(this) });
    this.spinSound = sound;
    try {
      const play = () => sound.play();
      if (this.sound.locked) this.sound.once('unlocked', play); else play();
      sound.once('complete', () => this.stopSpinSound());
    } catch {
      this.stopSpinSound();
    }
  }

  private stopSpinSound(): void {
    try { this.sound.stopByKey('wheel-spin'); } catch { /* no-op */ }
    if (!this.spinSound) return;
    try { this.spinSound.stop(); this.spinSound.destroy(); } catch { /* no-op */ }
    this.spinSound = null;
  }

  private showSpeech(text: string): void {
    DialogueBus.say(this, text);
  }

  private leave(): void {
    if (this.exitRequested) return;
    this.exitRequested = true;
    this.stopSpinSound();
    const dungeon = this.scene.manager.getScene('DungeonScene');
    try {
      if (dungeon) {
        dungeon.events.emit('game-complete', {
          coins: this.currentCoins,
          won: this.currentCoins > 0,
        });
      }
    } catch (_) {
      if (dungeon) {
        dungeon.cameras.main.resetFX();
        dungeon.cameras.main.setAlpha(1);
      }
      if (this.scene.isPaused('DungeonScene')) this.scene.resume('DungeonScene');
    }
    this.scene.stop('RouletteScene');
  }
}
