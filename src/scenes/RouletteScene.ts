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

const WHEEL_CX = 320;
const WHEEL_CY = 320;
const WHEEL_R = 178;
const POCKET_INNER = 132;
const BALL_TRACK_R = WHEEL_R + 6;
const BALL_R = 6;

const CHIP_VALUES = [10, 25, 50, 100] as const;
type ChipValue = typeof CHIP_VALUES[number];

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
  private chipSelector: Array<{ bg: GameObjects.Graphics; label: GameObjects.Text; value: ChipValue }> = [];
  private selectedChip: ChipValue = 25;

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
  private continueBtn!: GameObjects.Graphics;
  private continueBtnText!: GameObjects.Text;
  private continueZone!: GameObjects.Zone;

  private spinning = false;

  constructor() {
    super('RouletteScene');
  }

  init(data: { coins: number }): void {
    this.currentCoins = data.coins ?? 200;
    this.bets = [];
    this.spinning = false;
  }

  create(): void {
    HouseController.disable();
    this.events.once('shutdown', () => {
      HouseController.enable();
      this.stopSpinSound();
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
    this.buildResultPanel();

    this.statusText = this.add.text(W / 2, H - 28, 'Place chips, then SPIN.', {
      fontSize: '18px',
      fontFamily: FONT.mono,
      color: '#e6e6e6',
    }).setOrigin(0.5).setResolution(2);

    addGameplaySettingsGear(this, 'RouletteScene');
    registerDeveloperUnlockHotkey(this, () => this.leave());
    this.input.keyboard?.on('keydown-ESC', () => this.leave());

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // ── Background ────────────────────────────────────────────────────────
  private drawBackground(w: number, h: number): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x12070d, 1);
    bg.fillRect(0, 0, w, h);
    bg.fillStyle(0x1a0c13, 1);
    bg.fillRect(0, 0, w, 100);

    // Felt background behind the wheel
    const felt = this.add.graphics();
    felt.fillStyle(0x0d5a2e, 1);
    felt.fillRoundedRect(30, 120, 600, 520, 24);
    felt.lineStyle(6, 0x5a2510, 1);
    felt.strokeRoundedRect(30, 120, 600, 520, 24);
    felt.lineStyle(2, 0xe0a242, 0.8);
    felt.strokeRoundedRect(40, 130, 580, 500, 20);

    // Right-side betting felt
    const rightFelt = this.add.graphics();
    rightFelt.fillStyle(0x0a4a26, 1);
    rightFelt.fillRoundedRect(660, 120, 334, 520, 20);
    rightFelt.lineStyle(6, 0x5a2510, 1);
    rightFelt.strokeRoundedRect(660, 120, 334, 520, 20);
    rightFelt.lineStyle(2, 0xe0a242, 0.8);
    rightFelt.strokeRoundedRect(670, 130, 314, 500, 16);
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
    const boardX = 680;
    const boardY = 150;
    const cellW = 48;
    const cellH = 32;

    // Header: "0"
    this.addSpot({
      kind: 'straight',
      number: 0,
      label: '0',
      x: boardX,
      y: boardY,
      w: cellW,
      h: cellH * 3 + 4,
      color: 0x1d8a3a,
    });

    // 1-36 grid (3 rows x 12 cols), laid out in two stacks of 6 cols each for space
    // We'll use 3 rows x 12 cols but scaled smaller to fit
    const gridLeft = boardX + cellW + 6;
    const smallW = 24;
    const smallH = 28;
    for (let col = 0; col < 12; col += 1) {
      for (let row = 0; row < 3; row += 1) {
        const number = col * 3 + (3 - row);
        const pocket = pocketForNumber(number);
        const color = pocket.color === 'red' ? 0x8f1818 : 0x1a1a1a;
        this.addSpot({
          kind: 'straight',
          number,
          label: String(number),
          x: gridLeft + col * (smallW + 2),
          y: boardY + row * (smallH + 2),
          w: smallW,
          h: smallH,
          color,
        });
      }
    }

    // Dozens row under the grid
    const dozenY = boardY + 3 * (smallH + 2) + 8;
    const dozenW = 12 * (smallW + 2) / 3 - 2;
    for (let i = 0; i < 3; i += 1) {
      const kind = (['dozen1', 'dozen2', 'dozen3'] as const)[i];
      const labels = ['1-12', '13-24', '25-36'];
      this.addSpot({
        kind,
        label: labels[i],
        x: gridLeft + i * (dozenW + 2),
        y: dozenY,
        w: dozenW,
        h: 28,
        color: 0x3f6144,
      });
    }

    // Outside bets row
    const outsideY = dozenY + 36;
    const outsideW = 48;
    const outsides: Array<{ kind: BetKind; label: string; color: number }> = [
      { kind: 'low', label: '1-18', color: 0x3f6144 },
      { kind: 'even', label: 'EVEN', color: 0x3f6144 },
      { kind: 'red', label: 'RED', color: 0x8f1818 },
      { kind: 'black', label: 'BLACK', color: 0x1a1a1a },
      { kind: 'odd', label: 'ODD', color: 0x3f6144 },
      { kind: 'high', label: '19-36', color: 0x3f6144 },
    ];
    for (let i = 0; i < outsides.length; i += 1) {
      this.addSpot({
        kind: outsides[i].kind,
        label: outsides[i].label,
        x: gridLeft + i * (outsideW + 2),
        y: outsideY,
        w: outsideW,
        h: 34,
        color: outsides[i].color,
      });
    }

    // Column bets on the right of the number grid
    const colsX = gridLeft + 12 * (smallW + 2) + 4;
    for (let i = 0; i < 3; i += 1) {
      const kind = (['col1', 'col2', 'col3'] as const)[2 - i]; // top=col3, mid=col2, bot=col1 (row 0 top = col3)
      this.addSpot({
        kind,
        label: '2:1',
        x: colsX,
        y: boardY + i * (smallH + 2),
        w: 36,
        h: smallH,
        color: 0x3f6144,
      });
    }
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
  }

  private remainingCoins(): number {
    const staked = this.bets.reduce((s, b) => s + b.amount, 0);
    return this.currentCoins - staked;
  }

  // ── Chip selector + action buttons ────────────────────────────────────
  private buildChipSelector(): void {
    const y = 700;
    const startX = 80;
    for (let i = 0; i < CHIP_VALUES.length; i += 1) {
      const value = CHIP_VALUES[i];
      const x = startX + i * 110;
      const bg = this.add.graphics();
      this.drawChipButton(bg, x, y, value, value === this.selectedChip);
      const label = this.add.text(x, y, String(value), {
        fontSize: '18px',
        fontFamily: FONT.mono,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setResolution(2);
      const zone = this.add.zone(x, y, 90, 54).setInteractive({ cursor: 'pointer' });
      zone.on('pointerdown', () => {
        this.selectedChip = value;
        this.chipSelector.forEach((c) => this.drawChipButton(c.bg, 0, 0, c.value, c.value === this.selectedChip, c.label));
      });
      this.chipSelector.push({ bg, label, value });
    }
  }

  private drawChipButton(
    g: GameObjects.Graphics,
    cx: number,
    cy: number,
    value: ChipValue,
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
    const W = 1024;
    this.spinBtn = this.add.graphics();
    this.add.text(W - 150, 700, 'SPIN', buttonLabelStyle(22)).setOrigin(0.5);
    drawNestedButton(this.spinBtn, W - 150, 700, 200, 60, false);
    this.spinZone = this.add.zone(W - 150, 700, 200, 60).setInteractive({ cursor: 'pointer' });
    this.spinZone.on('pointerover', () => drawNestedButton(this.spinBtn, W - 150, 700, 200, 60, true));
    this.spinZone.on('pointerout', () => drawNestedButton(this.spinBtn, W - 150, 700, 200, 60, false));
    this.spinZone.on('pointerdown', () => this.doSpin());

    this.clearBtn = this.add.graphics();
    this.add.text(W - 340, 700, 'CLEAR', buttonLabelStyle(18)).setOrigin(0.5);
    drawNestedButton(this.clearBtn, W - 340, 700, 140, 50, false);
    this.clearZone = this.add.zone(W - 340, 700, 140, 50).setInteractive({ cursor: 'pointer' });
    this.clearZone.on('pointerover', () => drawNestedButton(this.clearBtn, W - 340, 700, 140, 50, true));
    this.clearZone.on('pointerout', () => drawNestedButton(this.clearBtn, W - 340, 700, 140, 50, false));
    this.clearZone.on('pointerdown', () => this.clearBets());
  }

  private clearBets(): void {
    if (this.spinning) return;
    this.bets = [];
    this.betSpots.forEach((s) => { s.total = 0; s.chipText?.setText(''); });
    this.statusText.setText('Bets cleared.');
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

    // Wheel tween: rotate container
    this.tweens.add({
      targets: this.wheelContainer,
      angle: '-=' + (360 * 5),
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

    // Clear bet chips from board
    this.betSpots.forEach((s) => { s.total = 0; s.chipText?.setText(''); });
    this.bets = [];
    this.showSpeech(heading === 'PUSH' ? 'Even hands.' : heading.startsWith('WIN') ? 'The felt pays.' : 'The house collects.');
  }

  private buildResultPanel(): void {
    const W = 1024;
    const panelW = 440;
    const panelH = 140;
    const px = (W - panelW) / 2;
    const py = 480;

    this.resultPanel = this.add.graphics().setVisible(false);
    drawFramedPanel(this.resultPanel, px, py, panelW, panelH, { borderWidth: 2, alpha: 0.95 });

    this.resultTitle = this.add.text(W / 2, py + 32, '', {
      fontSize: '28px', fontFamily: FONT.mono, fontStyle: 'bold', color: COLOR.winGreen,
    }).setOrigin(0.5).setVisible(false).setResolution(2);

    this.resultDetail = this.add.text(W / 2, py + 88, '', {
      fontSize: '16px', fontFamily: FONT.mono, color: '#e5e7eb', align: 'center',
    }).setOrigin(0.5).setVisible(false).setResolution(2);

    const contY = py + panelH + 30;
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
    if (!this.spinSound) return;
    try { this.spinSound.stop(); this.spinSound.destroy(); } catch { /* no-op */ }
    this.spinSound = null;
  }

  private showSpeech(text: string): void {
    DialogueBus.say(this, text);
  }

  private leave(): void {
    this.stopSpinSound();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      try {
        this.scene.get('DungeonScene').events.emit('game-complete', {
          coins: this.currentCoins,
          won: true,
        });
      } catch (_) { /* no-op */ }
      this.scene.stop('RouletteScene');
    });
  }
}
