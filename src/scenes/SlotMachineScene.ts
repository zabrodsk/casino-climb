import Phaser, { Scene, GameObjects } from 'phaser';
import {
  SLOT_SYMBOLS,
  SlotSymbol,
  SYMBOL_PAYOUT,
  evaluatePayline,
  spinReels,
} from '../games/slotMachine';
import {
  createSlotMachineRoundState,
  dismissSlotMachineResult,
  getSlotMachineStatusText,
  settleSlotMachineRound,
  startSlotMachineSpin,
  type SlotMachineRoundState,
} from '../games/slotMachineRoundState';
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

const WAGERS = [10, 25, 50, 100] as const;

const REEL_W = 110;
const REEL_H = 140;
const REEL_GAP = 18;
const SYMBOL_H = REEL_H;
const CENTER_X = 512;
const CENTER_Y = 340;

// Distinct colors per symbol for procedural rendering.
const SYMBOL_COLORS: Record<SlotSymbol, { fill: number; accent: number }> = {
  cherry: { fill: 0xc22657, accent: 0x7a1838 },
  bell:   { fill: 0xe0a242, accent: 0x8a5a2a },
  bar:    { fill: 0x1a1a1a, accent: 0xffdf6a },
  seven:  { fill: 0xbf1d1d, accent: 0xffdf6a },
  wheel:  { fill: 0x8f58c7, accent: 0xffdf6a },
  crown:  { fill: 0xffdf6a, accent: 0x8a5a2a },
};

export class SlotMachineScene extends Scene {
  private currentCoins = 200;

  private coinsText!: GameObjects.Text;
  private statusText!: GameObjects.Text;
  private selectedWager = 25;

  private reelContainers: GameObjects.Container[] = [];
  private reelStrips: Array<{ symbols: SlotSymbol[]; height: number }> = [];
  private reelStartY = 0;
  private paylineGraphics!: GameObjects.Graphics;

  private pullBtn!: GameObjects.Graphics;
  private pullBtnText!: GameObjects.Text;
  private pullZone!: GameObjects.Zone;
  private wagerButtons: Array<{ bg: GameObjects.Graphics; label: GameObjects.Text; value: number; zone: GameObjects.Zone }> = [];
  private wagerLabel!: GameObjects.Text;
  private allInWagerButton!: { bg: GameObjects.Graphics; label: GameObjects.Text; zone: GameObjects.Zone };

  private leverArm!: GameObjects.Graphics;
  private leverKnob!: GameObjects.Arc;
  private leverZone!: GameObjects.Zone;

  private resultPanel!: GameObjects.Graphics;
  private resultTitle!: GameObjects.Text;
  private resultDetail!: GameObjects.Text;
  private resultPrimaryBtn!: GameObjects.Graphics;
  private resultPrimaryBtnText!: GameObjects.Text;
  private resultPrimaryZone!: GameObjects.Zone;
  private resultLeaveBtn!: GameObjects.Graphics;
  private resultLeaveBtnText!: GameObjects.Text;
  private resultLeaveZone!: GameObjects.Zone;

  private spinDurationMs = 5200;
  private spinSound: Phaser.Sound.BaseSound | null = null;
  private roundState: SlotMachineRoundState = createSlotMachineRoundState();
  private pendingResultTimer: Phaser.Time.TimerEvent | null = null;
  private transientEffects: GameObjects.GameObject[] = [];
  private exitRequested = false;
  private readonly handleEsc = () => {
    if (!this.roundState.canLeave || this.exitRequested) return;
    this.leave();
  };

  constructor() {
    super('SlotMachineScene');
  }

  init(data: { coins: number }): void {
    this.currentCoins = data.coins ?? 200;
    this.reelContainers = [];
    this.reelStrips = [];
    this.wagerButtons = [];
    this.roundState = createSlotMachineRoundState();
    this.pendingResultTimer = null;
    this.transientEffects = [];
    this.exitRequested = false;
  }

  create(): void {
    HouseController.disable();
    this.events.once('shutdown', () => {
      this.cleanupSceneState();
      HouseController.enable();
    });
    this.cameras.main.setRoundPixels(true);

    const W = 1024;
    const H = 768;

    this.spinDurationMs = this.resolveSpinDurationMs();

    this.drawBackground(W, H);
    this.drawHeader(W);
    this.buildCabinet();
    this.buildReels();
    this.buildLever();
    this.buildWagerButtons();
    this.buildActionButton();
    this.buildPayoutLegend();
    this.buildResultPanel();

    this.statusText = this.add.text(W / 2, H - 28, '', {
      fontSize: '18px',
      fontFamily: FONT.mono,
      color: '#e6e6e6',
    }).setOrigin(0.5).setResolution(2);
    this.syncUiToRoundState();

    addGameplaySettingsGear(this, 'SlotMachineScene');
    registerDeveloperUnlockHotkey(this, () => this.leave());
    this.input.keyboard?.off('keydown-ESC', this.handleEsc);
    this.input.keyboard?.on('keydown-ESC', this.handleEsc);

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private drawBackground(w: number, h: number): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x12070d, 1);
    bg.fillRect(0, 0, w, h);
    bg.fillStyle(0x1a0c13, 1);
    bg.fillRect(0, 0, w, 100);

    // Carpet floor suggestion
    bg.fillStyle(0x2a1814, 1);
    bg.fillRect(0, 560, w, h - 560);
    bg.fillStyle(0xc94a3a, 0.12);
    for (let x = 0; x < w; x += 40) {
      bg.fillRect(x, 560, 2, h - 560);
    }
  }

  private drawHeader(w: number): void {
    this.add.text(w / 2, 48, 'SLOT MACHINE', neonTitleStyle(28)).setOrigin(0.5);
    this.coinsText = this.add.text(w - 40, 48, `Coins: ${this.currentCoins}`, {
      fontSize: '22px', color: '#ffffff', fontFamily: FONT.mono,
    }).setOrigin(1, 0.5).setResolution(2);
  }

  private buildCabinet(): void {
    const cabW = 3 * REEL_W + 2 * REEL_GAP + 120;
    const cabH = REEL_H + 260;
    const cabX = CENTER_X - cabW / 2;
    const cabY = CENTER_Y - REEL_H / 2 - 110;

    const g = this.add.graphics();
    // Outer cabinet
    g.fillStyle(0x5a2510, 1);
    g.fillRoundedRect(cabX - 6, cabY - 6, cabW + 12, cabH + 12, 12);
    g.fillStyle(0x2a1008, 1);
    g.fillRoundedRect(cabX, cabY, cabW, cabH, 10);
    // Brass trim
    g.lineStyle(3, 0xe0a242, 1);
    g.strokeRoundedRect(cabX + 4, cabY + 4, cabW - 8, cabH - 8, 8);

    // Marquee header
    g.fillStyle(0xe0a242, 1);
    g.fillRoundedRect(cabX + 20, cabY + 16, cabW - 40, 44, 6);
    g.fillStyle(0x8a5a2a, 1);
    g.fillRoundedRect(cabX + 24, cabY + 20, cabW - 48, 36, 5);
    this.add.text(CENTER_X, cabY + 38, 'FATE SLOT', {
      fontSize: '24px',
      fontFamily: FONT.mono,
      fontStyle: 'bold',
      color: '#ffe29a',
      stroke: '#2a1008',
      strokeThickness: 3,
    }).setOrigin(0.5).setResolution(2);

    // Reel window frame
    const windowY = CENTER_Y - REEL_H / 2;
    const windowX = CENTER_X - (3 * REEL_W + 2 * REEL_GAP) / 2 - 10;
    g.fillStyle(0x1a0a0a, 1);
    g.fillRoundedRect(windowX, windowY - 10, 3 * REEL_W + 2 * REEL_GAP + 20, REEL_H + 20, 6);
    g.fillStyle(0x0a0a0a, 1);
    g.fillRoundedRect(windowX + 4, windowY - 6, 3 * REEL_W + 2 * REEL_GAP + 12, REEL_H + 12, 4);

    // Payline (separate graphics object so we can tween its alpha on wins)
    this.paylineGraphics = this.add.graphics();
    this.paylineGraphics.lineStyle(3, 0xc94a3a, 0.9);
    this.paylineGraphics.lineBetween(windowX + 10, CENTER_Y, windowX + 10 + 3 * REEL_W + 2 * REEL_GAP, CENTER_Y);
    this.paylineGraphics.setDepth(4);
    this.add.text(CENTER_X, windowY + REEL_H + 26, 'CENTER PAYLINE', {
      fontSize: '13px',
      fontFamily: FONT.mono,
      color: '#ffdf6a',
      stroke: '#2a1008',
      strokeThickness: 3,
    }).setOrigin(0.5).setResolution(2);

    // Coin tray at bottom
    g.fillStyle(0x3a2010, 1);
    g.fillRoundedRect(cabX + 30, cabY + cabH - 70, cabW - 60, 48, 6);
    g.fillStyle(0x6a4a28, 1);
    g.fillRoundedRect(cabX + 36, cabY + cabH - 64, cabW - 72, 36, 5);
    g.fillStyle(0xe0a242, 0.7);
    for (let i = 0; i < 6; i += 1) {
      g.fillCircle(cabX + 54 + i * 32, cabY + cabH - 44, 4);
    }
  }

  private buildReels(): void {
    const startX = CENTER_X - (3 * REEL_W + 2 * REEL_GAP) / 2;
    const topY = CENTER_Y - REEL_H / 2;
    this.reelStartY = topY;

    for (let i = 0; i < 3; i += 1) {
      const rx = startX + i * (REEL_W + REEL_GAP);
      const container = this.add.container(rx + REEL_W / 2, topY);
      container.setDepth(5);

      const strip: SlotSymbol[] = [];
      // Build a strip of ~16 random symbols; visible symbol is at y=REEL_H/2 relative to container.
      for (let j = 0; j < 16; j += 1) {
        strip.push(SLOT_SYMBOLS[j % SLOT_SYMBOLS.length]);
      }
      // Shuffle lightly for visual variety
      for (let j = 0; j < strip.length; j += 1) {
        const k = Math.floor(Math.random() * strip.length);
        [strip[j], strip[k]] = [strip[k], strip[j]];
      }

      for (let j = 0; j < strip.length; j += 1) {
        const symbol = strip[j];
        const y = j * SYMBOL_H;
        this.drawSymbol(container, symbol, 0, y - SYMBOL_H * 8 + REEL_H / 2);
      }

      // Mask to clip to reel window
      const maskShape = this.add.graphics();
      maskShape.fillStyle(0xffffff);
      maskShape.fillRect(rx, topY, REEL_W, REEL_H);
      const mask = maskShape.createGeometryMask();
      container.setMask(mask);
      maskShape.setVisible(false);

      this.reelContainers.push(container);
      this.reelStrips.push({ symbols: strip, height: strip.length * SYMBOL_H });
    }
  }

  private drawSymbol(parent: GameObjects.Container, symbol: SlotSymbol, x: number, y: number): void {
    const g = this.add.graphics();
    const colors = SYMBOL_COLORS[symbol];
    // Card-ish background
    g.fillStyle(0xfaf3df, 1);
    g.fillRoundedRect(x - REEL_W / 2 + 6, y - SYMBOL_H / 2 + 6, REEL_W - 12, SYMBOL_H - 12, 8);
    g.lineStyle(2, 0xb99a68, 1);
    g.strokeRoundedRect(x - REEL_W / 2 + 6, y - SYMBOL_H / 2 + 6, REEL_W - 12, SYMBOL_H - 12, 8);

    const cx = x;
    const cy = y;
    g.fillStyle(colors.fill, 1);
    let overlayText: GameObjects.Text | null = null;
    switch (symbol) {
      case 'cherry':
        g.fillCircle(cx - 14, cy + 14, 18);
        g.fillCircle(cx + 14, cy + 8, 18);
        g.lineStyle(3, 0x3a6f2a, 1);
        g.beginPath();
        g.moveTo(cx - 14, cy - 14);
        g.lineTo(cx - 10, cy - 30);
        g.moveTo(cx + 14, cy - 18);
        g.lineTo(cx + 4, cy - 30);
        g.strokePath();
        g.fillStyle(0xffffff, 0.4);
        g.fillCircle(cx - 18, cy + 10, 4);
        break;
      case 'bell':
        g.fillTriangle(cx - 22, cy + 20, cx + 22, cy + 20, cx, cy - 26);
        g.fillCircle(cx, cy + 26, 6);
        g.fillStyle(colors.accent, 1);
        g.fillRect(cx - 24, cy + 16, 48, 6);
        break;
      case 'bar':
        g.fillRoundedRect(cx - 36, cy - 10, 72, 20, 4);
        overlayText = this.add.text(cx, cy, 'BAR', {
          fontSize: '18px', fontFamily: FONT.mono, fontStyle: 'bold',
          color: '#ffdf6a', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setResolution(2);
        break;
      case 'seven':
        overlayText = this.add.text(cx, cy, '7', {
          fontSize: '56px', fontFamily: FONT.mono, fontStyle: 'bold',
          color: '#bf1d1d', stroke: '#ffdf6a', strokeThickness: 4,
        }).setOrigin(0.5).setResolution(2);
        break;
      case 'wheel':
        g.fillCircle(cx, cy, 24);
        g.fillStyle(0x30c975, 1);
        g.fillCircle(cx, cy, 12);
        g.lineStyle(2, 0xffdf6a, 1);
        for (let k = 0; k < 6; k += 1) {
          const a = (k / 6) * Math.PI * 2;
          g.beginPath();
          g.moveTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12);
          g.lineTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24);
          g.strokePath();
        }
        g.fillStyle(0xffdf6a, 1);
        g.fillCircle(cx, cy, 4);
        break;
      case 'crown':
        g.fillTriangle(cx - 26, cy + 10, cx - 12, cy - 16, cx - 18, cy + 10);
        g.fillTriangle(cx - 8, cy + 10, cx, cy - 22, cx + 8, cy + 10);
        g.fillTriangle(cx + 26, cy + 10, cx + 12, cy - 16, cx + 18, cy + 10);
        g.fillRect(cx - 28, cy + 8, 56, 10);
        g.fillStyle(0xbf1d1d, 1);
        g.fillCircle(cx, cy - 22, 3);
        g.fillCircle(cx - 12, cy - 16, 3);
        g.fillCircle(cx + 12, cy - 16, 3);
        break;
    }

    parent.add(g);
    if (overlayText) parent.add(overlayText);
  }

  private buildLever(): void {
    const cabRight = CENTER_X + (3 * REEL_W + 2 * REEL_GAP) / 2 + 70;
    this.leverArm = this.add.graphics();
    this.leverArm.fillStyle(0x8a6a38, 1);
    this.leverArm.fillRect(cabRight - 5, CENTER_Y - 18, 10, 132);
    this.leverKnob = this.add.circle(cabRight, CENTER_Y - 24, 22, 0xc22657);
    this.leverKnob.setStrokeStyle(3, 0x6a1a2a, 1);
    this.leverKnob.setDepth(6);
    this.leverZone = this.add.zone(cabRight, CENTER_Y + 28, 96, 188).setInteractive({ cursor: 'pointer' });
    this.leverZone.on('pointerover', () => {
      if (!this.roundState.canSpin) return;
      this.leverKnob.setScale(1.08);
      this.leverKnob.setFillStyle(0xdf3969, 1);
    });
    this.leverZone.on('pointerout', () => {
      this.leverKnob.setScale(1);
      this.leverKnob.setFillStyle(0xc22657, 1);
    });
    this.leverZone.on('pointerdown', () => this.doSpin());
  }

  private buildWagerButtons(): void {
    const y = 620;
    const startX = CENTER_X - (WAGERS.length * 110) / 2 + 55;
    for (let i = 0; i < WAGERS.length; i += 1) {
      const value = WAGERS[i];
      const x = startX + i * 110;
      const bg = this.add.graphics();
      this.drawWagerButton(bg, x, y, value, value === this.selectedWager);
      const label = this.add.text(x, y, String(value), {
        fontSize: '20px', fontFamily: FONT.mono, fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setResolution(2);
      const zone = this.add.zone(x, y, 90, 54).setInteractive({ cursor: 'pointer' });
      const btn = { bg, label, value, zone };
      zone.on('pointerdown', () => {
        if (!this.roundState.canSpin) return;
        if (this.isLowCoinWagerMode()) return;
        this.selectedWager = value;
        this.refreshWagerControls();
      });
      this.wagerButtons.push(btn);
    }

    this.wagerLabel = this.add.text(CENTER_X, y - 44, `Wager: ${this.selectedWager}`, {
      fontSize: '18px', fontFamily: FONT.mono, color: '#ffdf6a',
    }).setOrigin(0.5).setResolution(2);

    const allInBg = this.add.graphics().setVisible(false);
    const allInLabel = this.add.text(CENTER_X, y, '', {
      fontSize: '20px', fontFamily: FONT.mono, fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setResolution(2).setVisible(false);
    const allInZone = this.add.zone(CENTER_X, y, 140, 54).setVisible(false);
    allInZone.on('pointerdown', () => {
      if (!this.roundState.canSpin || !this.isLowCoinWagerMode()) return;
      this.selectedWager = this.currentCoins;
      this.refreshWagerControls();
      AudioManager.playSfx(this, 'bet-select', { volume: 1.0, cooldownMs: 50, allowOverlap: false });
    });
    this.allInWagerButton = { bg: allInBg, label: allInLabel, zone: allInZone };
    this.refreshWagerControls();
  }

  private drawWagerButton(g: GameObjects.Graphics, cx: number, cy: number, value: number, selected: boolean): void {
    g.clear();
    const fill = value === 10 ? 0x2a7ac9 : value === 25 ? 0x1d8a3a : value === 50 ? 0xb0a040 : 0x8f1818;
    g.fillStyle(0x0a0a0a, 1);
    g.fillCircle(cx, cy, 28);
    g.fillStyle(fill, 1);
    g.fillCircle(cx, cy, 26);
    g.lineStyle(2, selected ? 0xffdf6a : 0xefe5cf, 1);
    g.strokeCircle(cx, cy, 26);
    if (selected) {
      g.lineStyle(1, 0xffdf6a, 1);
      g.strokeCircle(cx, cy, 30);
    }
  }

  private buildActionButton(): void {
    const y = 700;
    this.add.text(CENTER_X, y - 42, 'ACTION', {
      fontSize: '15px',
      fontFamily: FONT.mono,
      color: '#ffdf6a',
    }).setOrigin(0.5).setResolution(2);
    this.pullBtn = this.add.graphics();
    this.pullBtnText = this.add.text(CENTER_X, y, 'SPIN', buttonLabelStyle(24)).setOrigin(0.5);
    drawNestedButton(this.pullBtn, CENTER_X, y, 240, 60, false);
    this.pullZone = this.add.zone(CENTER_X, y, 240, 60).setInteractive({ cursor: 'pointer' });
    this.pullZone.on('pointerover', () => {
      if (!this.roundState.canSpin) return;
      drawNestedButton(this.pullBtn, CENTER_X, y, 240, 60, true);
    });
    this.pullZone.on('pointerout', () => {
      if (!this.roundState.canSpin) return;
      drawNestedButton(this.pullBtn, CENTER_X, y, 240, 60, false);
    });
    this.pullZone.on('pointerdown', () => this.doSpin());
  }

  private buildPayoutLegend(): void {
    const x = 20;
    const legendW = 160;
    let y = 140;
    this.add.text(x, y, 'PAYOUTS (3x / 2x)', {
      fontSize: '14px', fontFamily: FONT.mono, color: '#ffdf6a', fontStyle: 'bold',
    }).setResolution(2);
    y += 22;

    // Divider under header
    const divG = this.add.graphics();
    divG.lineStyle(1, 0xffdf6a, 0.5);
    divG.lineBetween(x, y, x + legendW, y);
    y += 8;

    for (let idx = 0; idx < SLOT_SYMBOLS.length; idx += 1) {
      const sym = SLOT_SYMBOLS[idx];
      const p = SYMBOL_PAYOUT[sym];
      this.add.text(x, y, `${sym.toUpperCase().padEnd(7, ' ')}  ${p.three}x/${p.two}x`, {
        fontSize: '15px', fontFamily: FONT.mono, color: '#e6e6e6',
      }).setResolution(2);
      y += 22;

      // Divider between entries (skip after last)
      if (idx < SLOT_SYMBOLS.length - 1) {
        divG.lineStyle(1, 0x5a3a28, 0.7);
        divG.lineBetween(x, y - 2, x + legendW, y - 2);
      }
    }
  }

  // ── Spin ──────────────────────────────────────────────────────────────
  private doSpin(): void {
    if (!this.roundState.canSpin) return;
    if (this.currentCoins < this.selectedWager) {
      this.statusText.setText('Not enough coins.');
      return;
    }

    this.roundState = startSlotMachineSpin(this.roundState);
    this.currentCoins -= this.selectedWager;
    this.coinsText.setText(`Coins: ${this.currentCoins}`);
    this.refreshWagerControls();
    this.hideResultPanel();
    this.clearTransientEffects();
    this.syncUiToRoundState();

    // Pulse the status text while spinning
    this.tweens.add({
      targets: this.statusText,
      alpha: 0.4,
      duration: 300,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => { this.statusText.setAlpha(1); },
    });

    // Lever pull animation
    this.tweens.add({
      targets: this.leverKnob,
      y: CENTER_Y + 80,
      duration: 180,
      yoyo: true,
      ease: 'Cubic.easeIn',
    });

    const result = spinReels();
    this.playSpinSound();

    // Build a 32-symbol strip per reel. Result at index 2.
    // Container starts PRE_SCROLL symbols above normal so 22 symbols blur past before result lands.
    const RESULT_IDX = 2;
    const PRE_SCROLL = 16;
    const SCROLL_SYMBOLS = 8 - RESULT_IDX; // 6 — distance from initial center (8) to result (2)
    const STRIP_LEN = 32;

    for (let i = 0; i < 3; i += 1) {
      const container = this.reelContainers[i];
      const strip = this.reelStrips[i];

      const fresh: SlotSymbol[] = [];
      for (let j = 0; j < STRIP_LEN; j += 1) {
        fresh.push(SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
      }
      fresh[RESULT_IDX] = result[i];
      strip.symbols = fresh;
      strip.height = STRIP_LEN * SYMBOL_H;

      container.removeAll(true);
      for (let j = 0; j < strip.symbols.length; j += 1) {
        const y = j * SYMBOL_H - SYMBOL_H * 8 + REEL_H / 2;
        this.drawSymbol(container, strip.symbols[j], 0, y);
      }

      // Start container shifted UP so symbol (8 + PRE_SCROLL = 24) is at center.
      // The tween scrolls DOWN to bring symbol 2 (result) to center — 22 symbols fly past.
      container.y = this.reelStartY - PRE_SCROLL * SYMBOL_H;
    }

    const durations = [
      Math.max(1800, this.spinDurationMs * 0.5),
      Math.max(2400, this.spinDurationMs * 0.72),
      Math.max(3000, this.spinDurationMs * 0.95),
    ];
    let completed = 0;

    for (let i = 0; i < 3; i += 1) {
      const container = this.reelContainers[i];

      this.tweens.add({
        targets: container,
        y: this.reelStartY + SCROLL_SYMBOLS * SYMBOL_H, // from (reelStartY - PRE_SCROLL*SYMBOL_H) → result lands at center
        duration: durations[i],
        ease: 'Cubic.easeOut',
        onComplete: () => {
          completed += 1;
          if (completed === 3) {
            this.stopSpinSound();
            this.pendingResultTimer?.remove(false);
            this.pendingResultTimer = this.time.delayedCall(400, () => {
              this.pendingResultTimer = null;
              this.showResult(result);
            });
          }
        },
      });
    }
  }

  private showResult(reels: [SlotSymbol, SlotSymbol, SlotSymbol]): void {
    // At this point we've already deducted the wager. evaluatePayline returns delta assuming
    // the wager is still in play; adjust accordingly. We'll interpret:
    //   kind === 'three'     -> payout = wager * three  (profit relative to pre-deduction = payout - wager)
    //   kind === 'two-left'  -> payout = wager * two    (returned to player)
    //   kind === 'two-right' -> payout = wager * two
    //   kind === 'lose'      -> payout = 0
    const out = evaluatePayline(reels, this.selectedWager);
    let payout = 0;
    if (out.kind === 'three' && out.matchedSymbol) {
      payout = this.selectedWager * SYMBOL_PAYOUT[out.matchedSymbol].three;
    } else if ((out.kind === 'two-left' || out.kind === 'two-right') && out.matchedSymbol) {
      payout = this.selectedWager * SYMBOL_PAYOUT[out.matchedSymbol].two;
    }
    this.currentCoins += payout;
    this.coinsText.setText(`Coins: ${this.currentCoins}`);
    this.roundState = settleSlotMachineRound(this.roundState, { currentCoins: this.currentCoins, net: payout - this.selectedWager });
    this.refreshWagerControls();

    const net = payout - this.selectedWager;
    const heading = net > 0 ? `WIN +${net}` : net < 0 ? `LOSS ${net}` : 'PUSH';
    const titleColor = net > 0 ? COLOR.winGreen : net < 0 ? COLOR.loseRed : COLOR.goldText;
    const detail = out.kind === 'three'
      ? `${reels.map((s) => s.toUpperCase()).join(' · ')}\nTriple ${out.matchedSymbol}. Stake ${this.selectedWager} · Payout ${payout}.`
      : out.kind === 'two-left' || out.kind === 'two-right'
        ? `${reels.map((s) => s.toUpperCase()).join(' · ')}\nPair ${out.matchedSymbol}. Stake ${this.selectedWager} · Payout ${payout}.`
        : `${reels.map((s) => s.toUpperCase()).join(' · ')}\nNo match. Stake ${this.selectedWager} lost.`;

    // ── Win animations ────────────────────────────────────────────────────
    if (payout > 0) {
      // Flash the red payline
      this.tweens.add({
        targets: this.paylineGraphics,
        alpha: 0,
        duration: 120,
        yoyo: true,
        repeat: 4,
        ease: 'Sine.easeInOut',
        onComplete: () => { this.paylineGraphics.setAlpha(1); },
      });

      // Floating payout text that rises and fades
      const floatText = this.add.text(CENTER_X, CENTER_Y - 20, `+${payout}`, {
        fontSize: '42px',
        fontFamily: FONT.mono,
        fontStyle: 'bold',
        color: '#00ff88',
        stroke: '#004422',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(20).setResolution(2);
      this.tweens.add({
        targets: floatText,
        y: CENTER_Y - 60,
        alpha: 0,
        duration: 1200,
        ease: 'Cubic.easeOut',
        onComplete: () => { floatText.destroy(); },
      });
      this.transientEffects.push(floatText);

      if (out.kind === 'three') {
        // Pop effect on each reel container
        for (const container of this.reelContainers) {
          this.tweens.add({
            targets: container,
            scaleX: 1.08,
            scaleY: 1.08,
            duration: 160,
            yoyo: true,
            ease: 'Cubic.easeOut',
          });
        }

        // Golden glow around the reel window
        const windowY = CENTER_Y - REEL_H / 2;
        const windowX = CENTER_X - (3 * REEL_W + 2 * REEL_GAP) / 2 - 10;
        const glow = this.add.graphics().setDepth(6).setAlpha(0.8);
        glow.lineStyle(4, 0xffdf6a, 0.8);
        glow.strokeRoundedRect(windowX, windowY - 10, 3 * REEL_W + 2 * REEL_GAP + 20, REEL_H + 20, 6);
        this.tweens.add({
          targets: glow,
          alpha: 0,
          duration: 1000,
          ease: 'Cubic.easeIn',
          onComplete: () => { glow.destroy(); },
        });
        this.transientEffects.push(glow);
      }
    }

    this.resultPanel.setVisible(true);
    this.resultTitle.setText(heading).setColor(titleColor).setVisible(true);
    this.resultDetail.setText(detail).setVisible(true);
    this.resultPrimaryBtn.setVisible(this.roundState.phase !== 'bust');
    this.resultPrimaryBtnText.setText(this.roundState.primaryAction === 'spin-again' ? 'SPIN AGAIN' : 'LEAVE').setVisible(this.roundState.phase !== 'bust');
    if (this.roundState.phase !== 'bust') {
      this.resultPrimaryZone.setInteractive({ cursor: 'pointer' });
    } else {
      this.resultPrimaryZone.disableInteractive();
    }
    this.resultLeaveBtn.setVisible(true);
    this.resultLeaveBtnText.setVisible(true);
    this.resultLeaveZone.setInteractive({ cursor: 'pointer' });

    this.syncUiToRoundState();
  }

  private buildResultPanel(): void {
    const W = 1024;
    const panelW = 460;
    const panelH = 196;
    const px = (W - panelW) / 2;
    const py = 430;

    this.resultPanel = this.add.graphics().setVisible(false);
    drawFramedPanel(this.resultPanel, px, py, panelW, panelH, { borderWidth: 2, alpha: 0.95 });

    this.resultTitle = this.add.text(W / 2, py + 28, '', {
      fontSize: '28px', fontFamily: FONT.mono, fontStyle: 'bold', color: COLOR.winGreen,
    }).setOrigin(0.5).setVisible(false).setResolution(2);

    this.resultDetail = this.add.text(W / 2, py + 84, '', {
      fontSize: '17px', fontFamily: FONT.mono, color: '#e5e7eb', align: 'center', wordWrap: { width: 400 },
    }).setOrigin(0.5).setVisible(false).setResolution(2);

    const actionY = py + 156;
    this.resultPrimaryBtn = this.add.graphics().setVisible(false);
    this.resultPrimaryBtnText = this.add.text(W / 2 - 110, actionY, 'SPIN AGAIN', buttonLabelStyle(18)).setOrigin(0.5).setVisible(false);
    drawNestedButton(this.resultPrimaryBtn, W / 2 - 110, actionY, 190, 46, false);
    this.resultPrimaryZone = this.add.zone(W / 2 - 110, actionY, 190, 46);
    this.resultPrimaryZone.on('pointerover', () => drawNestedButton(this.resultPrimaryBtn, W / 2 - 110, actionY, 190, 46, true));
    this.resultPrimaryZone.on('pointerout', () => drawNestedButton(this.resultPrimaryBtn, W / 2 - 110, actionY, 190, 46, false));
    this.resultPrimaryZone.on('pointerdown', () => this.handlePrimaryResultAction());

    this.resultLeaveBtn = this.add.graphics().setVisible(false);
    this.resultLeaveBtnText = this.add.text(W / 2 + 110, actionY, 'LEAVE', buttonLabelStyle(18)).setOrigin(0.5).setVisible(false);
    drawNestedButton(this.resultLeaveBtn, W / 2 + 110, actionY, 160, 46, false);
    this.resultLeaveZone = this.add.zone(W / 2 + 110, actionY, 160, 46);
    this.resultLeaveZone.on('pointerover', () => drawNestedButton(this.resultLeaveBtn, W / 2 + 110, actionY, 160, 46, true));
    this.resultLeaveZone.on('pointerout', () => drawNestedButton(this.resultLeaveBtn, W / 2 + 110, actionY, 160, 46, false));
    this.resultLeaveZone.on('pointerdown', () => this.leave());
  }

  private handlePrimaryResultAction(): void {
    if (this.roundState.primaryAction === 'leave') {
      this.leave();
      return;
    }

    this.roundState = dismissSlotMachineResult(this.roundState, this.currentCoins);
    this.hideResultPanel();
    this.clearTransientEffects();
    this.resetReelPresentation();
    this.syncUiToRoundState();
    // Re-enable wager controls after a completed round when spinning again.
    this.refreshWagerControls();
  }

  private syncUiToRoundState(): void {
    this.statusText.setText(getSlotMachineStatusText(this.roundState));
    this.pullBtnText.setText(this.roundState.phase === 'spinning' ? 'SPINNING' : 'SPIN');
    this.setPullButtonEnabled(this.roundState.canSpin);
  }

  private setPullButtonEnabled(enabled: boolean): void {
    drawNestedButton(this.pullBtn, CENTER_X, 700, 240, 60, false);
    this.pullBtn.setAlpha(enabled ? 1 : 0.5);
    this.pullBtnText.setAlpha(enabled ? 1 : 0.65);
    this.leverArm.setAlpha(enabled ? 1 : 0.55);
    this.leverKnob.setAlpha(enabled ? 1 : 0.65);
    if (enabled) {
      this.pullZone.setInteractive({ cursor: 'pointer' });
      this.leverZone.setInteractive({ cursor: 'pointer' });
    } else {
      this.pullZone.disableInteractive();
      this.leverZone.disableInteractive();
      this.leverKnob.setScale(1);
      this.leverKnob.setFillStyle(0xc22657, 1);
    }
  }

  private hideResultPanel(): void {
    this.resultPanel.setVisible(false);
    this.resultTitle.setVisible(false);
    this.resultDetail.setVisible(false);
    this.resultPrimaryBtn.setVisible(false);
    this.resultPrimaryBtnText.setVisible(false);
    this.resultPrimaryZone.disableInteractive();
    this.resultLeaveBtn.setVisible(false);
    this.resultLeaveBtnText.setVisible(false);
    this.resultLeaveZone.disableInteractive();
  }

  private resetReelPresentation(): void {
    this.paylineGraphics.setAlpha(1);
    this.leverKnob.setY(CENTER_Y - 24);
    this.leverKnob.setScale(1);
    this.leverKnob.setFillStyle(0xc22657, 1);
    this.reelContainers.forEach((container) => {
      container.setY(this.reelStartY);
      container.setScale(1);
      container.setAlpha(1);
    });
  }

  private clearTransientEffects(): void {
    this.transientEffects.forEach((effect) => {
      if (!effect.active) return;
      effect.destroy();
    });
    this.transientEffects = [];
  }

  private cleanupSceneState(): void {
    this.pendingResultTimer?.remove(false);
    this.pendingResultTimer = null;
    try {
      this.tweens.killTweensOf([
        this.statusText,
        this.leverKnob,
        this.paylineGraphics,
        ...this.reelContainers,
        ...this.transientEffects,
      ]);
    } catch {
      // Best-effort cleanup only; avoid shutdown-time crashes.
    }
    try { this.clearTransientEffects(); } catch { /* no-op */ }
    try { this.stopSpinSound(); } catch { /* no-op */ }
    // Avoid forcing extra UI mutations during shutdown; scene stop handles teardown.
    this.input.keyboard?.off('keydown-ESC', this.handleEsc);
    this.reelContainers = [];
    this.reelStrips = [];
    this.wagerButtons = [];
  }

  // ── Audio ────────────────────────────────────────────────────────────
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
    } catch { this.stopSpinSound(); }
  }

  private stopSpinSound(): void {
    // Force-stop any orphaned spin SFX instances by key.
    try { this.sound.stopByKey('wheel-spin'); } catch { /* no-op */ }
    if (!this.spinSound) return;
    try { this.spinSound.stop(); this.spinSound.destroy(); } catch { /* no-op */ }
    this.spinSound = null;
  }

  private isLowCoinWagerMode(): boolean {
    return this.currentCoins > 0 && this.currentCoins < 10;
  }

  private refreshWagerControls(): void {
    const lowCoinMode = this.isLowCoinWagerMode();
    const canAdjustWager = this.roundState.canSpin;
    if (lowCoinMode) {
      this.selectedWager = this.currentCoins;
      this.wagerButtons.forEach(({ bg, label, zone }) => {
        bg.setVisible(false);
        label.setVisible(false);
        zone.disableInteractive();
      });
      this.drawWagerButton(this.allInWagerButton.bg, CENTER_X, this.allInWagerButton.label.y, this.currentCoins, true);
      this.allInWagerButton.bg.setVisible(true);
      this.allInWagerButton.label.setText(String(this.currentCoins)).setVisible(true);
      this.allInWagerButton.zone.setVisible(true);
      if (canAdjustWager) {
        this.allInWagerButton.zone.setInteractive({ cursor: 'pointer' });
      } else {
        this.allInWagerButton.zone.disableInteractive();
      }
      this.wagerLabel.setText(`Wager: ${this.currentCoins}`);
      return;
    }

    if (!WAGERS.includes(this.selectedWager as (typeof WAGERS)[number])) {
      this.selectedWager = 25;
    }
    this.wagerButtons.forEach((w) => {
      w.bg.setVisible(true);
      w.label.setVisible(true);
      if (canAdjustWager) {
        w.zone.setInteractive({ cursor: 'pointer' });
      } else {
        w.zone.disableInteractive();
      }
      this.drawWagerButton(w.bg, w.label.x, w.label.y, w.value, w.value === this.selectedWager);
    });
    this.allInWagerButton.bg.setVisible(false);
    this.allInWagerButton.label.setVisible(false);
    this.allInWagerButton.zone.disableInteractive().setVisible(false);
    this.wagerLabel.setText(`Wager: ${this.selectedWager}`);
  }

  private leave(): void {
    if (this.exitRequested) return;
    this.exitRequested = true;
    this.pendingResultTimer?.remove(false);
    this.pendingResultTimer = null;
    this.stopSpinSound();
    this.input.keyboard?.off('keydown-ESC', this.handleEsc);
    this.pullZone.disableInteractive();
    this.leverZone.disableInteractive();
    this.resultPrimaryZone.disableInteractive();
    this.resultLeaveZone.disableInteractive();
    this.wagerButtons.forEach(({ zone }) => zone.disableInteractive());
    this.allInWagerButton.zone.disableInteractive();
    const dungeon = this.scene.manager.getScene('DungeonScene');
    // No fade-out on exit. Let DungeonScene own the transition via game-complete.
    try {
      if (dungeon) {
        dungeon.events.emit('game-complete', {
          coins: this.currentCoins,
          won: this.currentCoins > 0,
        });
      }
    } catch (_) {
      // Fallback path if event delivery fails.
      if (dungeon) {
        dungeon.cameras.main.resetFX();
        dungeon.cameras.main.setAlpha(1);
      }
      if (this.scene.isPaused('DungeonScene')) this.scene.resume('DungeonScene');
    }
    this.scene.stop('SlotMachineScene');
  }
}
