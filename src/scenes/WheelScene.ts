import Phaser, { Scene, GameObjects } from 'phaser';
import { WHEEL_SEGMENTS, spinWheel, segmentToEffect, WheelSegment } from '../games/wheel';
import {
  getActiveEffect, setActiveEffect, grantReviveToken,
  hasReviveToken,
} from '../state/coinState';
import { AudioManager } from '../audio/AudioManager';
import { COLOR, FONT, buttonLabelStyle, drawFramedPanel, drawNestedButton, neonTitleStyle } from '../ui/theme';
import { addGameplaySettingsGear } from '../ui/gameplaySettings';
import { registerDeveloperUnlockHotkey } from '../dev/developerHotkeys';
import { HouseController } from '../ui/HouseController';
import { DialogueBus } from '../ui/DialogueBus';

const WHEEL_CX = 512;
const WHEEL_CY = 334;
const WHEEL_R = 202;
const OUTER_RING_INNER = 142;
const HUB_RADIUS = 34;

export class WheelScene extends Scene {
  private currentCoins = 200;
  private wheelContainer!: GameObjects.Container;
  private wheelGlow!: GameObjects.Container;
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

  private spinDurationMs = 5200;
  private spinSound: Phaser.Sound.BaseSound | null = null;

  constructor() {
    super('WheelScene');
  }

  init(data: { coins: number }): void {
    this.currentCoins = data.coins ?? 200;
  }

  create(): void {
    HouseController.disable();
    this.events.once('shutdown', () => HouseController.enable());
    this.cameras.main.setRoundPixels(true);

    const W = 1024;
    const H = 768;

    this.spinDurationMs = this.resolveSpinDurationMs();

    this.drawBackground(W, H);
    this.drawHeader(W);
    this.drawDecorativeWheelStand();
    this.buildWheelGlow();
    this.buildWheel();
    this.buildPointer();

    this.buildResultPanel();
    this.showChoicePhase();

    addGameplaySettingsGear(this, 'WheelScene');
    registerDeveloperUnlockHotkey(this, () => this.unlockForDevelopers());
    this.input.keyboard?.on('keydown-ESC', () => this.leave());

    this.events.once('shutdown', () => {
      this.stopSpinSound();
    });

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private drawBackground(width: number, height: number): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x12070d, 1);
    bg.fillRect(0, 0, width, height);

    bg.fillStyle(0x1a0c13, 1);
    bg.fillRect(0, 0, width, 210);

    bg.fillStyle(0x1f0f18, 1);
    bg.fillRect(0, 210, width, 340);

    // Space-themed floor area.
    bg.fillStyle(0x070b22, 1);
    bg.fillRect(0, 550, width, 218);
    bg.fillStyle(0x0b1334, 0.85);
    bg.fillRect(0, 550, width, 80);
    bg.fillStyle(0x05091a, 0.9);
    bg.fillRect(0, 630, width, 138);

    // Subtle nebula haze.
    bg.fillStyle(0x3d2d7a, 0.18);
    bg.fillEllipse(width * 0.18, 648, 320, 120);
    bg.fillStyle(0x1f6ca8, 0.14);
    bg.fillEllipse(width * 0.52, 610, 420, 140);
    bg.fillStyle(0x5a2d87, 0.13);
    bg.fillEllipse(width * 0.82, 690, 300, 120);

    // Starfield (deterministic placement).
    for (let i = 0; i < 220; i += 1) {
      const fx = (i * 73) % width;
      const fy = 552 + ((i * 131) % 210);
      const twinkle = ((i * 17) % 100) / 100;
      const size = i % 11 === 0 ? 2 : 1;
      const alpha = 0.32 + twinkle * 0.58;
      const color = i % 9 === 0 ? 0xb6d3ff : (i % 7 === 0 ? 0xffe7b3 : 0xeaf2ff);
      bg.fillStyle(color, alpha);
      bg.fillRect(fx, fy, size, size);
    }
  }

  private drawHeader(width: number): void {
    this.add.text(width / 2, 50, 'FLOOR 4 - THE FATE CHAMBER', neonTitleStyle(30)).setOrigin(0.5);

    this.coinsText = this.add.text(width - 40, 48, `Coins: ${this.currentCoins}`, {
      fontSize: '22px',
      color: '#ffffff',
      fontFamily: FONT.mono,
    }).setOrigin(1, 0.5).setResolution(2);

    const effect = getActiveEffect();
    if (effect) {
      const effectLabel = effect.type === 'buff' ? 'GOLDEN HAND active' : 'HEXED active';
      const effectColor = effect.type === 'buff' ? COLOR.goldText : '#ff6666';
      this.add.text(40, 48, effectLabel, {
        fontSize: '14px',
        color: effectColor === COLOR.goldText ? '#ffd54a' : '#ff6b6b',
        fontFamily: FONT.mono,
      }).setOrigin(0, 0.5).setResolution(2);
    }

    if (hasReviveToken()) {
      this.add.text(40, 72, 'REVIVE TOKEN held', {
        fontSize: '14px',
        color: '#6ee7ff',
        fontFamily: FONT.mono,
      }).setOrigin(0, 0.5).setResolution(2);
    }
  }

  private drawDecorativeWheelStand(): void {
    const stand = this.add.graphics();
    stand.fillStyle(0x6f2a14, 1);
    stand.fillRoundedRect(WHEEL_CX - 180, WHEEL_CY + 220, 360, 26, 6);
    stand.fillStyle(0xd0912f, 1);
    stand.fillRoundedRect(WHEEL_CX - 120, WHEEL_CY + 224, 240, 16, 5);
    stand.lineStyle(3, 0xf0ce7a, 0.75);
    stand.strokeRoundedRect(WHEEL_CX - 180, WHEEL_CY + 220, 360, 26, 6);
  }

  private buildWheelGlow(): void {
    this.wheelGlow = this.add.container(WHEEL_CX, WHEEL_CY);

    const outerHalo = this.add.circle(0, 0, WHEEL_R + 36, 0xffd781, 0.1);
    outerHalo.setBlendMode(Phaser.BlendModes.SCREEN);

    const innerHalo = this.add.circle(0, 0, WHEEL_R + 14, 0xffe89a, 0.12);
    innerHalo.setBlendMode(Phaser.BlendModes.SCREEN);

    const jewelRing = this.add.graphics();
    jewelRing.lineStyle(4, 0xf9d66a, 0.65);
    jewelRing.strokeCircle(0, 0, WHEEL_R + 8);
    jewelRing.lineStyle(2, 0x2f1309, 0.85);
    jewelRing.strokeCircle(0, 0, WHEEL_R + 2);

    const bolts: GameObjects.Arc[] = [];
    for (let i = 0; i < 12; i += 1) {
      const a = Phaser.Math.DegToRad(i * 30 - 90);
      const x = Math.cos(a) * (WHEEL_R + 8);
      const y = Math.sin(a) * (WHEEL_R + 8);
      const bolt = this.add.circle(x, y, 6, 0x29d087, 1);
      bolt.setStrokeStyle(3, 0x2b1608, 0.9);
      bolts.push(bolt);
      this.tweens.add({
        targets: bolt,
        alpha: { from: 0.55, to: 1 },
        duration: 900 + i * 25,
        yoyo: true,
        repeat: -1,
      });
    }

    this.wheelGlow.add([outerHalo, innerHalo, jewelRing, ...bolts]);
    this.tweens.add({
      targets: [outerHalo, innerHalo],
      alpha: { from: 0.08, to: 0.2 },
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private buildWheel(): void {
    this.wheelContainer = this.add.container(WHEEL_CX, WHEEL_CY);

    const g = this.add.graphics();
    const labelObjects: GameObjects.Text[] = [];

    for (let i = 0; i < WHEEL_SEGMENTS.length; i += 1) {
      const seg = WHEEL_SEGMENTS[i];
      const startRad = Phaser.Math.DegToRad(seg.startDeg - 90);
      const endRad = Phaser.Math.DegToRad(seg.startDeg + seg.arcDeg - 90);
      const midRad = Phaser.Math.DegToRad(seg.startDeg + seg.arcDeg / 2 - 90);

      const outerColor = i % 2 === 0 ? 0xbd1d5b : 0x8f58c7;
      g.fillStyle(outerColor, 1);
      g.beginPath();
      g.arc(0, 0, WHEEL_R - 4, startRad, endRad, false);
      g.arc(0, 0, OUTER_RING_INNER, endRad, startRad, true);
      g.closePath();
      g.fillPath();

      g.fillStyle(0x3ed082, 1);
      g.beginPath();
      g.arc(0, 0, OUTER_RING_INNER - 5, startRad, endRad, false);
      g.arc(0, 0, HUB_RADIUS + 18, endRad, startRad, true);
      g.closePath();
      g.fillPath();

      g.lineStyle(4, 0xf6c74c, 1);
      g.beginPath();
      g.moveTo(Math.cos(midRad) * (HUB_RADIUS + 18), Math.sin(midRad) * (HUB_RADIUS + 18));
      g.lineTo(Math.cos(midRad) * (WHEEL_R - 8), Math.sin(midRad) * (WHEEL_R - 8));
      g.strokePath();

      const labelRadius = WHEEL_R - 40;
      const lx = Math.cos(midRad) * labelRadius;
      const ly = Math.sin(midRad) * labelRadius;
      const label = this.add.text(lx, ly, seg.label, {
        fontSize: '12px',
        fontFamily: FONT.mono,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
        align: 'center',
        wordWrap: { width: 92 },
      }).setOrigin(0.5);
      label.setResolution(2);
      labelObjects.push(label);
    }

    g.lineStyle(7, 0xf6c74c, 1);
    g.strokeCircle(0, 0, WHEEL_R);
    g.lineStyle(4, 0x6f2a14, 0.95);
    g.strokeCircle(0, 0, WHEEL_R - 8);
    g.lineStyle(4, 0x6f2a14, 0.95);
    g.strokeCircle(0, 0, OUTER_RING_INNER);

    g.fillStyle(0x336fae, 1);
    g.fillCircle(0, 0, HUB_RADIUS + 7);
    g.lineStyle(6, 0xe7f1ff, 1);
    g.strokeCircle(0, 0, HUB_RADIUS + 7);
    g.fillStyle(0xf7cd50, 1);
    g.fillCircle(0, 0, HUB_RADIUS - 2);
    g.lineStyle(3, 0x6f2a14, 0.9);
    g.strokeCircle(0, 0, HUB_RADIUS - 2);
    g.fillStyle(0xf08f34, 1);
    g.fillCircle(0, 0, 8);

    this.wheelContainer.add(g);
    labelObjects.forEach((label) => this.wheelContainer.add(label));
  }

  private buildPointer(): void {
    this.pointerGraphic = this.add.graphics();
    const px = WHEEL_CX;
    const py = WHEEL_CY - WHEEL_R - 14;

    this.pointerGraphic.fillStyle(0xf6c74c, 1);
    this.pointerGraphic.fillTriangle(px - 16, py - 24, px + 16, py - 24, px, py + 10);
    this.pointerGraphic.lineStyle(3, 0xffffff, 0.85);
    this.pointerGraphic.strokeTriangle(px - 16, py - 24, px + 16, py - 24, px, py + 10);
    this.pointerGraphic.setDepth(20);
  }

  private showChoicePhase(): void {
    const W = 1024;

    this.phaseText = this.add.text(W / 2, 590, 'The Wheel of Fate awaits.\nSpin at your own risk.', {
      fontSize: '20px',
      fontFamily: FONT.mono,
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5).setResolution(2);

    const passBtn = this.add.graphics();
    const passBtnText = this.add.text(W / 2 - 140, 660, 'PASS BY', buttonLabelStyle(22)).setOrigin(0.5);
    drawNestedButton(passBtn, W / 2 - 140, 660, 180, 56, false);
    const passZone = this.add.zone(W / 2 - 140, 660, 180, 56).setInteractive({ cursor: 'pointer' });
    passZone.on('pointerover', () => drawNestedButton(passBtn, W / 2 - 140, 660, 180, 56, true));
    passZone.on('pointerout', () => drawNestedButton(passBtn, W / 2 - 140, 660, 180, 56, false));
    passZone.on('pointerdown', () => {
      passZone.disableInteractive();
      this.showSpeech('You walk past the wheel. Wise... or cowardly?');
      this.time.delayedCall(1800, () => this.leave());
    });

    const fateBtn = this.add.graphics();
    const fateBtnText = this.add.text(W / 2 + 140, 660, 'TEMPT FATE', buttonLabelStyle(22)).setOrigin(0.5);
    this.drawFateButton(fateBtn, W / 2 + 140, 660, 200, 56, false);
    const fateZone = this.add.zone(W / 2 + 140, 660, 200, 56).setInteractive({ cursor: 'pointer' });
    fateZone.on('pointerover', () => this.drawFateButton(fateBtn, W / 2 + 140, 660, 200, 56, true));
    fateZone.on('pointerout', () => this.drawFateButton(fateBtn, W / 2 + 140, 660, 200, 56, false));
    fateZone.on('pointerdown', () => {
      fateZone.disableInteractive();
      passZone.disableInteractive();
      passBtn.setVisible(false);
      passBtnText.setVisible(false);
      fateBtn.setVisible(false);
      fateBtnText.setVisible(false);
      this.phaseText.setVisible(false);
      this.doSpin();
    });
  }

  private drawFateButton(g: GameObjects.Graphics, cx: number, cy: number, w: number, h: number, hover: boolean): void {
    g.clear();
    g.fillStyle(hover ? 0x5f1632 : 0x441022, 1);
    g.fillRect(cx - w / 2, cy - h / 2, w, h);
    g.fillStyle(hover ? 0x8f2b54 : 0x6d2340, 1);
    g.fillRect(cx - w / 2 + 5, cy - h / 2 + 5, w - 10, h - 10);
    g.lineStyle(2, 0xf6c74c, 1);
    g.strokeRect(cx - w / 2, cy - h / 2, w, h);
  }

  private doSpin(): void {
    const chosen = spinWheel();
    const chosenMidDeg = chosen.startDeg + chosen.arcDeg / 2;
    const targetAngle = 360 * 6 - chosenMidDeg;

    this.playSpinSound();
    this.showSpeech('The wheel turns...');

    this.tweens.add({
      targets: this.wheelContainer,
      angle: targetAngle,
      duration: this.spinDurationMs,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.stopSpinSound();
        this.time.delayedCall(350, () => this.showResult(chosen));
      },
    });
  }

  private showResult(seg: WheelSegment): void {
    this.currentCoins = Math.max(0, this.currentCoins + seg.coinDelta);

    if (seg.effectType === 'revive') {
      grantReviveToken();
    } else if (seg.effectType === 'buff' || seg.effectType === 'curse') {
      setActiveEffect(segmentToEffect(seg));
    }

    this.coinsText.setText(`Coins: ${this.currentCoins}`);

    this.resultPanel.setVisible(true);
    this.resultTitle.setText(seg.label).setVisible(true);

    let detailLine = '';
    if (seg.coinDelta > 0) detailLine = `+${seg.coinDelta} coins`;
    if (seg.coinDelta < 0) detailLine = `${seg.coinDelta} coins`;
    if (seg.effectType === 'revive') detailLine = 'Revive token granted';
    if (seg.effectType === 'buff') detailLine = '+25% gains next game';
    if (seg.effectType === 'curse' && seg.coinDelta > 0) detailLine = `+${seg.coinDelta} coins - HEXED next game`;
    if (seg.effectType === 'curse' && seg.coinDelta === 0) detailLine = '-25% gains next game';

    this.resultCoins.setText(detailLine).setVisible(true);
    this.resultFlavor.setText(seg.flavor).setVisible(true);
    this.continueBtn.setVisible(true);
    this.continueBtnText.setVisible(true);
    this.continueZone.setInteractive({ cursor: 'pointer' });

    this.showSpeech(seg.flavor);

    if (seg.coinDelta <= -150) {
      HouseController.say(this, 'gameSpecific', 'wheelLoseAll');
    }

    const isGood = seg.coinDelta > 0 || seg.effectType === 'revive' || seg.effectType === 'buff';
    const isBad = seg.coinDelta < 0 || seg.effectType === 'curse';
    this.resultTitle.setColor(isGood ? COLOR.winGreen : isBad ? COLOR.loseRed : COLOR.goldText);
  }

  private buildResultPanel(): void {
    const W = 1024;
    const panelW = 480;
    const panelH = 140;
    const px = (W - panelW) / 2;
    const py = 570;

    this.resultPanel = this.add.graphics().setVisible(false);
    drawFramedPanel(this.resultPanel, px, py, panelW, panelH, { borderWidth: 2, alpha: 0.95 });

    this.resultTitle = this.add.text(W / 2, py + 30, '', {
      fontSize: '28px',
      fontFamily: FONT.mono,
      fontStyle: 'bold',
      color: COLOR.winGreen,
    }).setOrigin(0.5).setVisible(false).setResolution(2);

    this.resultCoins = this.add.text(W / 2, py + 64, '', {
      fontSize: '18px',
      fontFamily: FONT.mono,
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: 430 },
    }).setOrigin(0.5).setVisible(false).setResolution(2);

    this.resultFlavor = this.add.text(W / 2, py + 92, '', {
      fontSize: '15px',
      fontFamily: FONT.mono,
      color: '#e5e7eb',
      align: 'center',
      wordWrap: { width: 430 },
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

  private unlockForDevelopers(): void {
    this.currentCoins = Math.max(this.currentCoins, 999);
    this.coinsText.setText(`Coins: ${this.currentCoins}`);
    this.leave();
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
      } catch (_) {
        // no-op
      }
      this.scene.stop('WheelScene');
    });
  }

  private showSpeech(text: string): void {
    DialogueBus.say(this, text);
  }

  private resolveSpinDurationMs(): number {
    if (!this.cache.audio.exists('wheel-spin')) {
      return 5200;
    }
    try {
      const probe = this.sound.add('wheel-spin', { volume: 0 });
      const probeAny = probe as Phaser.Sound.BaseSound & { totalDuration?: number; duration?: number };
      const durationSec = probeAny.totalDuration ?? probeAny.duration ?? 0;
      probe.destroy();
      if (!Number.isFinite(durationSec) || durationSec <= 0) {
        return 5200;
      }
      return Phaser.Math.Clamp(Math.round(durationSec * 1000), 1500, 20000);
    } catch {
      return 5200;
    }
  }

  private playSpinSound(): void {
    this.stopSpinSound();
    if (!this.cache.audio.exists('wheel-spin')) {
      return;
    }
    const sound = this.sound.add('wheel-spin', {
      volume: AudioManager.getSfxVolume(this),
    });
    this.spinSound = sound;
    try {
      const play = () => sound.play();
      if (this.sound.locked) {
        this.sound.once('unlocked', play);
      } else {
        play();
      }
      sound.once('complete', () => this.stopSpinSound());
    } catch {
      this.stopSpinSound();
    }
  }

  private stopSpinSound(): void {
    if (!this.spinSound) return;
    try {
      this.spinSound.stop();
      this.spinSound.destroy();
    } catch {
      // no-op
    }
    this.spinSound = null;
  }
}
