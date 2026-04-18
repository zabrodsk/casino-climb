import Phaser, { Scene, GameObjects, Input, Math as PhaserMath } from 'phaser';
import { AudioLevels, AudioManager } from '../audio/AudioManager';

const INTRO_LINES = [
  'You wake up.',
  'Bright lights. The smell of money.',
  "You don't remember how you got here.",
];

type MenuButtonId = 'play' | 'settings';
type SoundSliderKey = keyof AudioLevels;

type SliderUi = {
  key: SoundSliderKey;
  trackX: number;
  trackWidth: number;
  track: GameObjects.Rectangle;
  fill: GameObjects.Rectangle;
  knob: GameObjects.Rectangle;
  valueText: GameObjects.Text;
};

export class MenuScene extends Scene {
  private readonly baseWidth = 1024;
  private readonly baseHeight = 768;

  private settingsVisible = false;
  private settingsBackdrop?: GameObjects.Rectangle;
  private settingsPanel?: GameObjects.Container;
  private settingsCloseButton?: GameObjects.Rectangle;
  private sliderUis: SliderUi[] = [];
  private draggingSlider?: SoundSliderKey;
  private lastSliderSfxAt = 0;

  private introTargets: GameObjects.GameObject[] = [];
  private ambientDriftTweens: Phaser.Tweens.Tween[] = [];
  private menuHitAreas: GameObjects.Rectangle[] = [];

  private introOverlay?: GameObjects.Container;
  private introBackdrop?: GameObjects.Rectangle;
  private introPrompt?: GameObjects.Text;
  private introLineTexts: GameObjects.Text[] = [];
  private introTimers: Phaser.Time.TimerEvent[] = [];
  private introPlaying = false;
  private introContinueReady = false;
  private transitioningToRun = false;

  private soundLevels: AudioLevels = {
    master: 100,
    music: 100,
    sfx: 100,
  };

  private readonly keyboardHandler = () => this.handleGlobalContinue();
  private readonly pointerHandler = () => this.handleGlobalContinue();

  constructor() {
    super('MenuScene');
  }

  create(): void {
    const levels = AudioManager.init(this);
    this.settingsVisible = false;
    this.settingsBackdrop = undefined;
    this.settingsPanel = undefined;
    this.settingsCloseButton = undefined;
    this.sliderUis = [];
    this.draggingSlider = undefined;
    this.lastSliderSfxAt = 0;
    this.introTargets = [];
    this.ambientDriftTweens = [];
    this.menuHitAreas = [];
    this.introOverlay = undefined;
    this.introBackdrop = undefined;
    this.introPrompt = undefined;
    this.introLineTexts = [];
    this.introTimers = [];
    this.introPlaying = false;
    this.introContinueReady = false;
    this.transitioningToRun = false;
    this.soundLevels = {
      master: levels.master,
      music: levels.music,
      sfx: levels.sfx,
    };

    this.cameras.main.setRoundPixels(true);

    this.drawBackground();
    this.createAtmosphere();
    this.createHeroTitle();
    this.createPokerTableDecor();
    this.createButtons();
    this.createSettingsPanel();
    this.createIntroOverlay();

    this.input.on('pointermove', (pointer: Input.Pointer) => {
      if (!this.draggingSlider || this.introPlaying) return;
      this.updateSliderFromPointer(this.draggingSlider, pointer.x);
    });

    this.input.on('pointerup', () => {
      this.draggingSlider = undefined;
    });

    this.input.keyboard?.on('keydown', this.keyboardHandler);
    this.input.on('pointerdown', this.pointerHandler);

    this.scale.on('resize', () => {
      this.scene.restart();
    });

    this.events.once('shutdown', () => {
      this.ambientDriftTweens.forEach((tween) => tween.stop());
      this.ambientDriftTweens = [];
      this.introTimers.forEach((timer) => timer.remove(false));
      this.introTimers = [];
      this.input.keyboard?.off('keydown', this.keyboardHandler);
      this.input.off('pointerdown', this.pointerHandler);
    });

    this.startMenuMusic();
    this.finalizeMenuLayout();
  }

  private startMenuMusic(): void {
    const existing = AudioManager.getMusic(this);
    if (existing?.key === 'menu-music' && existing.isPlaying) {
      AudioManager.applyMusicVolume(this);
      return;
    }
    AudioManager.playMusic(this, 'menu-music', { loop: true });
  }

  private drawBackground(): void {
    const g = this.add.graphics();
    const w = this.baseWidth;
    const h = this.baseHeight;

    g.fillStyle(0x090707, 1);
    g.fillRect(0, 0, w, h);

    g.fillStyle(0x140b0f, 1);
    g.fillRect(0, 0, w, h * 0.36);

    g.fillStyle(0x1c0d13, 1);
    g.fillRect(0, h * 0.36, w, h * 0.34);

    g.fillStyle(0x10080c, 1);
    g.fillRect(0, h * 0.7, w, h * 0.3);

    g.lineStyle(1, 0x5b3b2a, 0.25);
    for (let y = h * 0.72; y < h; y += 18) {
      g.lineBetween(0, y, w, y);
    }
    for (let x = 0; x < w; x += 28) {
      g.lineBetween(x, h * 0.72, x + 24, h);
    }

    g.fillStyle(0x000000, 0.35);
    g.fillRect(0, 0, w, 64);
    g.fillRect(0, 0, 80, h);
    g.fillRect(w - 80, 0, 80, h);
  }

  private createAtmosphere(): void {
    const spotlight = this.add.ellipse(this.baseWidth / 2, 220, 760, 280, 0xc29a58, 0.08);
    spotlight.setBlendMode(Phaser.BlendModes.SCREEN);

    const curtainLeft = this.add.rectangle(90, 350, 140, 520, 0x2b1016, 0.75).setOrigin(0.5);
    const curtainRight = this.add.rectangle(934, 350, 140, 520, 0x2b1016, 0.75).setOrigin(0.5);

    const lampPositions: Array<[number, number]> = [
      [172, 112],
      [252, 120],
      [332, 108],
      [692, 108],
      [772, 120],
      [852, 112],
    ];

    lampPositions.forEach(([x, y], idx) => {
      const glow = this.add.circle(x, y, 7, 0xffd18a, 0.85);
      const halo = this.add.circle(x, y + 8, 26, 0xffbf73, 0.08);
      halo.setBlendMode(Phaser.BlendModes.SCREEN);

      const tw = this.tweens.add({
        targets: [glow, halo],
        alpha: { from: 0.45, to: 1 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        delay: idx * 120,
      });
      this.ambientDriftTweens.push(tw);
    });

    const depthOrbs = [
      this.add.circle(200, 620, 36, 0x8a5a3b, 0.08),
      this.add.circle(780, 605, 42, 0xa16b45, 0.07),
      this.add.circle(500, 640, 32, 0x71472f, 0.06),
    ];

    depthOrbs.forEach((orb, i) => {
      const drift = this.tweens.add({
        targets: orb,
        x: orb.x + (i % 2 === 0 ? 8 : -8),
        y: orb.y + (i % 2 === 0 ? -5 : 5),
        duration: 3800 + i * 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.ambientDriftTweens.push(drift);
      this.introTargets.push(orb);
    });

    this.introTargets.push(spotlight, curtainLeft, curtainRight);
  }

  private createHeroTitle(): void {
    const crest = this.add.graphics();
    crest.fillStyle(0x3a1c12, 0.9);
    crest.fillRoundedRect(250, 90, 524, 128, 12);
    crest.lineStyle(3, 0xc9a66b, 0.9);
    crest.strokeRoundedRect(250, 90, 524, 128, 12);

    const title = this.add.text(this.baseWidth / 2, 154, 'CASINO CLIMB', {
      fontFamily: 'Georgia',
      fontSize: '64px',
      color: '#ffd8a2',
      stroke: '#8c4d2a',
      strokeThickness: 6,
      letterSpacing: 1,
    }).setOrigin(0.5);
    title.setShadow(0, 0, '#ffb874', 22, false, true);

    const tw = this.tweens.add({
      targets: title,
      alpha: { from: 0.82, to: 1 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.ambientDriftTweens.push(tw);

    this.introTargets.push(crest, title);
  }

  private createPokerTableDecor(): void {
    const tableX = this.baseWidth / 2;
    const tableY = 792;

    const table = this.add.graphics();
    table.fillStyle(0x1e1009, 0.92);
    table.fillEllipse(tableX, tableY, 1780, 470);

    table.fillStyle(0x4d2d1c, 0.95);
    table.fillEllipse(tableX, tableY, 1700, 418);

    table.fillStyle(0x0f5a32, 0.92);
    table.fillEllipse(tableX, tableY, 1580, 360);

    table.lineStyle(3, 0xd2b06e, 0.65);
    table.strokeEllipse(tableX, tableY, 1580, 360);

    table.fillStyle(0xffffff, 0.08);
    table.fillEllipse(tableX, tableY - 54, 1120, 96);

    const cardY = 706;
    const cardStartX = 258;
    const cardStep = 62;
    const cards = ['A♠', 'K♦', 'Q♣', 'J♥', '10♠', '9♦', '8♣'];

    cards.forEach((card, index) => {
      const x = cardStartX + index * cardStep;
      const cardRect = this.add.rectangle(x, cardY, 52, 72, 0xf8efdc, 0.92);
      cardRect.setStrokeStyle(2, 0xb28a5a, 0.68);
      cardRect.setAngle((index - 3) * 1.2);

      const isRed = card.includes('♦') || card.includes('♥');
      const cardText = this.add.text(x, cardY - 2, card, {
        fontFamily: 'Georgia',
        fontSize: '19px',
        color: isRed ? '#b2303b' : '#222226',
      }).setOrigin(0.5);
      cardText.setAngle((index - 3) * 1.2);

      this.introTargets.push(cardRect, cardText);
    });

    const stackCenterX = cardStartX + cards.length * cardStep + 78;
    const stackBaseY = cardY + 58;
    const palette = [0xe3b74b, 0xbe2138, 0x1f56ab, 0x1f8a4b];

    const stackSpecs = [
      { x: stackCenterX - 72, chips: 9, radius: 18 },
      { x: stackCenterX - 36, chips: 15, radius: 19 },
      { x: stackCenterX, chips: 12, radius: 19 },
      { x: stackCenterX + 36, chips: 10, radius: 18 },
      { x: stackCenterX + 72, chips: 6, radius: 17 },
    ];

    stackSpecs.forEach((stack, stackIndex) => {
      for (let i = 0; i < stack.chips; i += 1) {
        const chip = this.add.circle(
          stack.x,
          stackBaseY - i * 9,
          stack.radius,
          palette[(i + stackIndex) % palette.length],
          0.95,
        );
        chip.setStrokeStyle(3, 0xf6e6c6, 0.78);

        const centerDot = this.add.circle(
          stack.x,
          stackBaseY - i * 9,
          Math.max(4, stack.radius * 0.28),
          0xf3dcaf,
          0.72,
        );

        this.introTargets.push(chip, centerDot);
      }
    });

    this.introTargets.push(table);
  }

  private createButtons(): void {
    this.createButton(this.baseWidth / 2, 340, 380, 98, 'PLAY', 'play', true);
    this.createButton(this.baseWidth / 2, 454, 300, 74, 'SETTINGS', 'settings', false);
  }

  private createSettingsPanel(): void {
    const panelW = 628;
    const panelH = 338;
    const panelX = (this.baseWidth - panelW) / 2;
    const panelY = 212;

    this.settingsBackdrop = this.add.rectangle(0, 0, this.baseWidth, this.baseHeight, 0x050303, 0.68);
    this.settingsBackdrop.setOrigin(0);
    this.settingsBackdrop.setDepth(60);
    this.settingsBackdrop.setInteractive();
    this.settingsBackdrop.on('pointerdown', () => this.toggleSettings(false));
    this.settingsBackdrop.setVisible(false).setAlpha(0);
    this.settingsBackdrop.disableInteractive();

    const panel = this.add.container(0, 0);
    panel.setDepth(61);
    panel.setVisible(false).setAlpha(0).setScale(0.96);

    const frame = this.add.graphics();
    frame.fillStyle(0x1a0c11, 0.98);
    frame.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
    frame.lineStyle(3, 0xc8a364, 1);
    frame.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);
    frame.lineStyle(1, 0x6c4832, 0.65);
    frame.strokeRoundedRect(panelX + 10, panelY + 10, panelW - 20, panelH - 20, 10);

    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x4d1f2f, 0.92);
    ribbon.fillRoundedRect(panelX + 18, panelY + 18, panelW - 36, 46, 6);
    ribbon.lineStyle(2, 0xd4b27b, 1);
    ribbon.strokeRoundedRect(panelX + 18, panelY + 18, panelW - 36, 46, 6);

    const title = this.add.text(panelX + panelW / 2, panelY + 41, 'SOUND SETTINGS', {
      fontFamily: 'Georgia',
      fontSize: '30px',
      color: '#f7ddb0',
      stroke: '#35150f',
      strokeThickness: 3,
      letterSpacing: 1,
    }).setOrigin(0.5);

    const closeButton = this.add.rectangle(panelX + panelW - 34, panelY + 42, 30, 24, 0x5d2237, 1);
    closeButton.setInteractive({ useHandCursor: true });
    closeButton.on('pointerover', () => this.playUiHover());
    closeButton.on('pointerdown', () => {
      if (this.introPlaying) return;
      this.toggleSettings(false);
    });

    const closeText = this.add.text(panelX + panelW - 34, panelY + 42, 'X', {
      fontFamily: 'Courier New',
      fontSize: '16px',
      color: '#ffe8be',
    }).setOrigin(0.5);

    panel.add([frame, ribbon, title, closeButton, closeText]);

    this.settingsPanel = panel;
    this.settingsCloseButton = closeButton;

    this.createSoundSlider('MASTER', 'master', panelY + 126, panelX, panel);
    this.createSoundSlider('MUSIC', 'music', panelY + 198, panelX, panel);
    this.createSoundSlider('SFX', 'sfx', panelY + 270, panelX, panel);
  }

  private createSoundSlider(
    label: string,
    key: SoundSliderKey,
    y: number,
    panelX: number,
    panel: GameObjects.Container,
  ): void {
    const labelText = this.add.text(panelX + 58, y, label, {
      fontFamily: 'Courier New',
      fontSize: '24px',
      color: '#f0cf98',
    }).setOrigin(0, 0.5);

    const trackX = panelX + 338;
    const trackW = 255;

    const track = this.add.rectangle(trackX, y, trackW, 14, 0x3f2533, 1);
    track.setInteractive({ useHandCursor: true });

    const fill = this.add.rectangle(trackX - trackW / 2, y, trackW, 10, 0xca8b58, 1);
    fill.setOrigin(0, 0.5);

    const knob = this.add.rectangle(trackX, y, 20, 26, 0xf0c476, 1);
    knob.setStrokeStyle(2, 0x6a4126, 1);
    knob.setInteractive({ useHandCursor: true });

    const valueText = this.add.text(panelX + 560, y, '0%', {
      fontFamily: 'Courier New',
      fontSize: '22px',
      color: '#ffe4b9',
    }).setOrigin(1, 0.5);

    panel.add([labelText, track, fill, knob, valueText]);

    const sliderUi: SliderUi = { key, trackX, trackWidth: trackW, track, fill, knob, valueText };
    this.sliderUis.push(sliderUi);
    this.updateSliderVisual(sliderUi, this.soundLevels[key]);

    const beginDrag = (pointerX: number): void => {
      if (this.introPlaying) return;
      this.draggingSlider = key;
      this.playUiClick();
      this.updateSliderFromPointer(key, pointerX);
    };

    track.on('pointerdown', (pointer: Input.Pointer) => beginDrag(pointer.x));
    knob.on('pointerdown', (pointer: Input.Pointer) => beginDrag(pointer.x));
  }

  private createIntroOverlay(): void {
    const overlay = this.add.container(0, 0);
    overlay.setDepth(120);
    overlay.setVisible(false);
    overlay.setAlpha(0);

    const backdrop = this.add.rectangle(0, 0, this.baseWidth, this.baseHeight, 0x020101, 0.94);
    backdrop.setOrigin(0, 0);
    backdrop.setInteractive();
    backdrop.disableInteractive();

    const frame = this.add.graphics();
    frame.fillStyle(0x12090c, 0.96);
    frame.fillRoundedRect(132, 126, 760, 500, 16);
    frame.lineStyle(3, 0xb9905d, 0.95);
    frame.strokeRoundedRect(132, 126, 760, 500, 16);
    frame.lineStyle(1, 0x6f4c34, 0.75);
    frame.strokeRoundedRect(146, 140, 732, 472, 14);

    const heading = this.add.text(this.baseWidth / 2, 188, 'A MEMORY STIRS', {
      fontFamily: 'Georgia',
      fontSize: '34px',
      color: '#f3d6ab',
      stroke: '#32160f',
      strokeThickness: 4,
      letterSpacing: 1,
    }).setOrigin(0.5);

    const divider = this.add.rectangle(this.baseWidth / 2, 226, 360, 2, 0xb9905d, 0.8);

    this.introLineTexts = INTRO_LINES.map((_, index) =>
      this.add.text(this.baseWidth / 2, 304 + index * 82, '', {
        fontFamily: 'Georgia',
        fontSize: '28px',
        color: '#f8ecd4',
        align: 'center',
        wordWrap: { width: 560, useAdvancedWrap: true },
      }).setOrigin(0.5),
    );

    this.introPrompt = this.add.text(this.baseWidth / 2, 560, 'PRESS ANY KEY TO CONTINUE', {
      fontFamily: 'Courier New',
      fontSize: '18px',
      color: '#d9b47b',
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.introPrompt.setAlpha(0);

    overlay.add([backdrop, frame, heading, divider, ...this.introLineTexts, this.introPrompt]);
    this.introOverlay = overlay;
    this.introBackdrop = backdrop;
  }

  private updateSliderFromPointer(key: SoundSliderKey, pointerX: number): void {
    const slider = this.sliderUis.find((entry) => entry.key === key);
    if (!slider) return;

    const bounds = slider.track.getBounds();
    const ratio = PhaserMath.Clamp((pointerX - bounds.left) / bounds.width, 0, 1);
    const value = Math.round(ratio * 100);

    this.soundLevels[key] = value;
    this.updateSliderVisual(slider, value);
    this.applySoundLevels();
    this.playSliderMoveSfx();
  }

  private updateSliderVisual(slider: SliderUi, value: number): void {
    const ratio = value / 100;
    const fillWidth = Math.max(4, slider.trackWidth * ratio);

    slider.fill.setSize(fillWidth, slider.fill.height);
    slider.knob.x = slider.trackX - slider.trackWidth / 2 + slider.trackWidth * ratio;
    slider.valueText.setText(`${value}%`);
  }

  private applySoundLevels(): void {
    AudioManager.setLevels(this, this.soundLevels);
  }

  private toggleSettings(visible: boolean): void {
    if (!this.settingsBackdrop || !this.settingsPanel || this.introPlaying) return;

    if (this.settingsVisible !== visible) {
      this.playUiClick();
    }
    this.settingsVisible = visible;
    this.draggingSlider = undefined;

    this.tweens.killTweensOf([this.settingsBackdrop, this.settingsPanel]);

    if (visible) {
      this.settingsBackdrop.setVisible(true).setAlpha(0);
      this.settingsPanel.setVisible(true).setAlpha(0).setScale(0.96);
      this.settingsBackdrop.setInteractive();

      this.tweens.add({
        targets: this.settingsBackdrop,
        alpha: 0.68,
        duration: 180,
        ease: 'Quad.easeOut',
      });

      this.tweens.add({
        targets: this.settingsPanel,
        alpha: 1,
        scale: 1,
        duration: 220,
        ease: 'Back.easeOut',
      });
      return;
    }

    this.settingsBackdrop.disableInteractive();
    this.tweens.add({
      targets: this.settingsBackdrop,
      alpha: 0,
      duration: 140,
      ease: 'Quad.easeIn',
      onComplete: () => this.settingsBackdrop?.setVisible(false),
    });

    this.tweens.add({
      targets: this.settingsPanel,
      alpha: 0,
      scale: 0.96,
      duration: 140,
      ease: 'Quad.easeIn',
      onComplete: () => this.settingsPanel?.setVisible(false),
    });
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    id: MenuButtonId,
    primary: boolean,
  ): void {
    const container = this.add.container(x, y);
    const frame = this.add.graphics();
    const baseY = y;

    const redraw = (hovered: boolean): void => {
      frame.clear();
      frame.fillStyle(primary ? (hovered ? 0xe3bb75 : 0xcda062) : (hovered ? 0xbe8a54 : 0xa37245), 1);
      frame.fillRoundedRect(-width / 2, -height / 2, width, height, 8);

      frame.fillStyle(0x3b2316, 1);
      frame.fillRoundedRect(-width / 2 + 6, -height / 2 + 6, width - 12, height - 12, 7);

      frame.fillStyle(primary ? (hovered ? 0x612834 : 0x4b1e28) : (hovered ? 0x4b1f2a : 0x3f1a24), 1);
      frame.fillRoundedRect(-width / 2 + 10, -height / 2 + 10, width - 20, height - 20, 6);

      if (primary) {
        frame.lineStyle(2, hovered ? 0xffdfa2 : 0xd8b279, 0.85);
        frame.strokeRoundedRect(-width / 2 + 10, -height / 2 + 10, width - 20, height - 20, 6);
      }
    };

    redraw(false);

    const text = this.add.text(0, 0, label, {
      fontFamily: primary ? 'Georgia' : 'Courier New',
      fontSize: primary ? '46px' : '34px',
      color: '#fff1d3',
      stroke: '#2a160f',
      strokeThickness: primary ? 6 : 5,
      letterSpacing: primary ? 2 : 1,
    }).setOrigin(0.5);

    const hitArea = this.add.rectangle(0, 0, width, height, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });

    let hoverTween: Phaser.Tweens.Tween | null = null;

    hitArea.on('pointerover', () => {
      if (this.introPlaying) return;
      this.playUiHover();
      redraw(true);
      hoverTween?.stop();
      hoverTween = this.tweens.add({
        targets: container,
        y: baseY - 6,
        duration: 140,
        ease: 'Quad.easeOut',
      });
    });

    hitArea.on('pointerout', () => {
      redraw(false);
      hoverTween?.stop();
      hoverTween = this.tweens.add({
        targets: container,
        y: baseY,
        duration: 140,
        ease: 'Quad.easeOut',
      });
    });

    hitArea.on('pointerdown', () => this.onButtonClick(id));

    container.add([frame, text, hitArea]);
    this.menuHitAreas.push(hitArea);
    this.introTargets.push(container);
  }

  private onButtonClick(id: MenuButtonId): void {
    if (this.introPlaying || this.transitioningToRun) return;

    this.playUiClick();
    if (id === 'play') {
      this.startWakeIntro();
      return;
    }

    this.toggleSettings(!this.settingsVisible);
  }

  private startWakeIntro(): void {
    if (!this.introOverlay || !this.introPrompt || this.introPlaying) return;

    this.introPlaying = true;
    this.introContinueReady = false;
    this.draggingSlider = undefined;

    // Swap from lobby music to dark ambient as the memory scene fades in
    AudioManager.playMusic(this, 'casino-music', { loop: true, restart: false });

    if (this.settingsVisible) {
      this.toggleSettings(false);
    }

    this.menuHitAreas.forEach((hitArea) => hitArea.disableInteractive());
    this.settingsCloseButton?.disableInteractive();
    this.introBackdrop?.setInteractive();

    this.introLineTexts.forEach((text) => text.setText('').setAlpha(1));
    this.introPrompt.setAlpha(0);
    this.introPrompt.setText('PRESS ANY KEY TO CONTINUE');

    this.introOverlay.setVisible(true);
    this.tweens.add({
      targets: this.introOverlay,
      alpha: 1,
      duration: 220,
      ease: 'Quad.easeOut',
    });

    this.introTimers.forEach((timer) => timer.remove(false));
    this.introTimers = [];

    INTRO_LINES.forEach((line, index) => {
      const timer = this.time.delayedCall(index * 1150, () => {
        this.typeLine(this.introLineTexts[index], line);
      });
      this.introTimers.push(timer);
    });

    const promptTimer = this.time.delayedCall(INTRO_LINES.length * 1150 + 360, () => {
      this.introContinueReady = true;
      this.tweens.add({
        targets: this.introPrompt,
        alpha: { from: 0.35, to: 1 },
        duration: 760,
        yoyo: true,
        repeat: -1,
      });
    });
    this.introTimers.push(promptTimer);
  }

  private typeLine(target: GameObjects.Text, text: string): void {
    target.setText('');
    let index = 0;
    const timer = this.time.addEvent({
      delay: 28,
      repeat: Math.max(text.length - 1, 0),
      callback: () => {
        index += 1;
        target.setText(text.slice(0, index));
      },
    });
    this.introTimers.push(timer);
  }

  private handleGlobalContinue(): void {
    if (!this.introPlaying || !this.introContinueReady || this.transitioningToRun) return;
    this.beginRun();
  }

  private beginRun(): void {
    if (this.transitioningToRun) return;

    this.transitioningToRun = true;
    this.introPlaying = false;
    this.introContinueReady = false;
    if (this.introPrompt) {
      this.tweens.killTweensOf(this.introPrompt);
    }
    this.introBackdrop?.disableInteractive();

    AudioManager.playSfx(this, 'ui-click', { volume: 0.9, cooldownMs: 50, allowOverlap: false });

    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('DungeonScene', { floor: 1 });
    });
  }

  private finalizeMenuLayout(): void {
    this.introTargets.forEach((obj) => {
      (obj as GameObjects.GameObject & { setAlpha(value: number): unknown }).setAlpha(1);
    });
  }

  private playUiHover(): void {
    AudioManager.playSfx(this, 'ui-hover', { volume: 0.85, cooldownMs: 45, allowOverlap: false });
  }

  private playUiClick(): void {
    AudioManager.playSfx(this, 'ui-click', { volume: 0.95, cooldownMs: 25, allowOverlap: false });
  }

  private playSliderMoveSfx(): void {
    const now = Date.now();
    if (now - this.lastSliderSfxAt < 90) return;
    this.lastSliderSfxAt = now;
    AudioManager.playSfx(this, 'ui-hover', { volume: 0.5, cooldownMs: 50, allowOverlap: false });
  }
}
