import { Scene, GameObjects, Input, Math as PhaserMath } from 'phaser';
import { SfxManager } from '../managers/SfxManager';

type MenuButtonId = 'play' | 'settings';
type SoundSliderKey = 'master' | 'music' | 'sfx';

type SliderUi = {
  key: SoundSliderKey;
  track: GameObjects.Rectangle;
  fill: GameObjects.Rectangle;
  knob: GameObjects.Rectangle;
  valueText: GameObjects.Text;
};

export class MenuScene extends Scene {
  private readonly baseWidth = 1024;
  private readonly baseHeight = 768;
  private readonly pixel = 4;
  private readonly panelX = 212;
  private readonly panelY = 206;
  private readonly panelWidth = 600;
  private readonly panelHeight = 320;

  private settingsVisible = false;
  private settingsBackdrop?: GameObjects.Rectangle;
  private settingsObjects: GameObjects.GameObject[] = [];
  private sliderUis: SliderUi[] = [];
  private draggingSlider?: SoundSliderKey;
  private soundLevels: Record<SoundSliderKey, number> = {
    master: 80,
    music: 70,
    sfx: 85,
  };
  private sfx!: SfxManager;
  private _lastSliderSfx = 0;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.sfx = new SfxManager(this);
    this.game.registry.set('soundLevels', this.soundLevels);

    this.cameras.main.setRoundPixels(true);
    this.drawBackground();
    this.drawDecor();
    this.createNeonSign();
    this.createButtons();
    this.createSettingsPanel();

    this.input.on('pointermove', (pointer: Input.Pointer) => {
      if (!this.draggingSlider) {
        return;
      }

      this.updateSliderFromPointer(this.draggingSlider, pointer.x);
    });

    this.input.on('pointerup', () => {
      this.draggingSlider = undefined;
    });

    this.scale.on('resize', () => {
      this.scene.restart();
    });

    this.startMenuMusic();
  }

  private startMenuMusic(): void {
    // Avoid double-starting if scene restarts (e.g. on resize)
    const existing = this.game.registry.get('music') as Phaser.Sound.BaseSound | null;
    if (existing?.isPlaying) return;
    if (existing) {
      existing.destroy();
    }

    const music = this.sound.add('menu-music', { loop: true, volume: 0.7 }) as
      | Phaser.Sound.WebAudioSound
      | Phaser.Sound.HTML5AudioSound;
    this.game.registry.set('music', music);

    const play = () => music.play();
    if (this.sound.locked) {
      this.sound.once('unlocked', play);
    } else {
      play();
    }
  }

  private drawBackground(): void {
    const g = this.add.graphics();
    const w = this.baseWidth;
    const h = this.baseHeight;

    g.fillStyle(0x182b8b);
    g.fillRect(0, 0, w, h);

    g.fillStyle(0x1d37a4);
    g.fillRect(0, 0, w, h * 0.52);

    g.fillStyle(0x2f1328);
    g.fillRect(0, h * 0.52, w, h * 0.48);

    for (let y = h * 0.55; y < h; y += this.pixel * 3) {
      for (let x = 0; x < w; x += this.pixel * 4) {
        const alt = (Math.floor(x / (this.pixel * 4)) + Math.floor(y / (this.pixel * 3))) % 2;
        g.fillStyle(alt === 0 ? 0xbc2f35 : 0x9d1f2d);
        g.fillRect(x, y, this.pixel * 4, this.pixel * 3);

        if ((x + y) % 48 === 0) {
          g.fillStyle(0xf5b85b);
          g.fillRect(x + this.pixel, y + this.pixel, this.pixel, this.pixel);
        }
      }
    }
  }

  private drawDecor(): void {
    const g = this.add.graphics();
    const w = this.baseWidth;
    const h = this.baseHeight;

    this.drawCeilingBeams(g);
    this.drawBackWall(g);
    this.drawMachineRow(g, 72, 272, 6, 0.8);
    this.drawMachineRow(g, 54, 352, 7, 1.1);
    this.drawMachineRow(g, 726, 302, 3, 1);

    g.fillStyle(0xff9b50, 0.15);
    g.fillRect(150, h - 148, 240, 24);
    g.fillRect(560, h - 178, 280, 22);
    g.fillStyle(0xffd990, 0.16);
    g.fillRect(300, h - 98, 330, 18);

    g.fillStyle(0x2a0d1c);
    g.fillRect(0, h - 32, w, 32);

    this.createLightSprites();
  }

  private drawCeilingBeams(g: GameObjects.Graphics): void {
    const w = this.baseWidth;
    g.fillStyle(0x5336d2);
    g.fillRect(0, 0, w, 38);

    for (let x = -10; x < w; x += 112) {
      g.fillStyle(0xe95063);
      g.fillRect(x, 36, 76, 24);
      g.fillStyle(0x7036d6);
      g.fillRect(x + 18, 60, 76, 14);
    }
  }

  private drawBackWall(g: GameObjects.Graphics): void {
    const w = this.baseWidth;

    g.fillStyle(0x2648cd);
    g.fillRect(0, 118, w, 210);
    g.fillStyle(0x3b66ee);
    g.fillRect(0, 118, w, 12);

    g.fillStyle(0x1c328d);
    g.fillRect(424, 156, 176, 142);
    g.fillStyle(0xff6f6b);
    g.fillRect(448, 184, 128, 26);
    g.fillStyle(0x2c57d6);
    g.fillRect(454, 216, 116, 56);

    for (let i = 0; i < 5; i++) {
      g.fillStyle(0xfff284, 0.9);
      g.fillRect(462 + i * 22, 224, 10, 10);
    }
  }

  private drawMachineRow(
    g: GameObjects.Graphics,
    startX: number,
    y: number,
    count: number,
    scale = 1,
  ): void {
    const width = Math.floor(78 * scale);
    const height = Math.floor(116 * scale);
    const spacing = Math.floor(92 * scale);
    const screenW = Math.floor(42 * scale);
    const screenH = Math.floor(42 * scale);

    for (let i = 0; i < count; i++) {
      const x = startX + i * spacing;
      g.fillStyle(0x2a3f9f);
      g.fillRect(x, y, width, height);
      g.fillStyle(0x506de5);
      g.fillRect(x + 6, y + 6, width - 12, 12);

      g.fillStyle(0x111f61);
      g.fillRect(x + 10, y + 24, screenW, screenH);
      g.fillStyle(0xf86f65);
      g.fillRect(x + 13, y + 27, screenW - 6, 8);
      g.fillStyle(0xf7d760);
      g.fillRect(x + 13, y + 37, 12, 8);
      g.fillRect(x + 29, y + 37, 12, 8);

      g.fillStyle(0x20327f);
      g.fillRect(x + 14, y + height - 28, width - 28, 16);
      g.fillStyle(0xffd47c);
      g.fillRect(x + width - 14, y + 42, 6, 18);
    }
  }

  private createLightSprites(): void {
    const lightPositions: Array<[number, number]> = [
      [150, 132],
      [210, 132],
      [270, 132],
      [330, 132],
      [684, 132],
      [744, 132],
      [804, 132],
      [864, 132],
    ];

    lightPositions.forEach(([x, y], idx) => {
      const orb = this.add.rectangle(x, y, 10, 10, 0xffe17d).setOrigin(0.5);
      this.tweens.add({
        targets: orb,
        alpha: { from: 0.35, to: 1 },
        duration: 360,
        yoyo: true,
        repeat: -1,
        delay: idx * 70,
      });
    });
  }

  private createNeonSign(): void {
    const signBack = this.add.graphics();
    signBack.fillStyle(0x1c2f87, 0.9);
    signBack.fillRect(284, 136, 456, 92);
    signBack.fillStyle(0x3958d8, 0.95);
    signBack.fillRect(294, 146, 436, 72);

    const neon = this.add.text(this.baseWidth / 2, 182, 'CASINO CLIMB', {
      fontFamily: 'Courier New',
      fontSize: '58px',
      color: '#ff9cdc',
      stroke: '#ff3b96',
      strokeThickness: 10,
      letterSpacing: 3,
    });
    neon.setOrigin(0.5);
    neon.setResolution(0.5);
    neon.setShadow(0, 0, '#ff3b96', 26, false, true);

    this.tweens.add({
      targets: neon,
      alpha: { from: 0.72, to: 1 },
      duration: 650,
      yoyo: true,
      repeat: -1,
    });
  }

  private createButtons(): void {
    this.createButton(this.baseWidth / 2, 560, 230, 56, 'PLAY', 'play');
    this.createButton(this.baseWidth / 2, 632, 230, 56, 'SETTINGS', 'settings');
  }

  private createSettingsPanel(): void {
    const panelX = this.panelX;
    const panelY = this.panelY;
    const panelW = this.panelWidth;
    const panelH = this.panelHeight;

    const backdrop = this.add.rectangle(0, 0, this.baseWidth, this.baseHeight, 0x06030f, 0.65);
    backdrop.setOrigin(0);
    backdrop.setDepth(40);
    backdrop.setInteractive();
    backdrop.on('pointerdown', () => this.toggleSettings(false));
    this.settingsBackdrop = backdrop;
    this.settingsObjects.push(backdrop);

    const panel = this.add.graphics();
    panel.fillStyle(0x45143c, 0.98);
    panel.fillRect(panelX, panelY, panelW, panelH);
    panel.fillStyle(0x9d2b6d, 1);
    panel.fillRect(panelX + 8, panelY + 8, panelW - 16, panelH - 16);
    panel.fillStyle(0x25134d, 1);
    panel.fillRect(panelX + 14, panelY + 14, panelW - 28, panelH - 28);
    panel.fillStyle(0xe6ba57, 1);
    panel.fillRect(panelX + 18, panelY + 18, panelW - 36, 42);
    panel.setDepth(41);
    this.settingsObjects.push(panel);

    const title = this.add.text(panelX + panelW / 2, panelY + 39, 'SOUND SETTINGS', {
      fontFamily: 'Courier New',
      fontSize: '28px',
      color: '#3f1702',
      stroke: '#f7d591',
      strokeThickness: 4,
    });
    title.setOrigin(0.5);
    title.setResolution(0.5);
    title.setDepth(42);
    this.settingsObjects.push(title);

    const closeButton = this.add.rectangle(panelX + panelW - 30, panelY + 39, 30, 24, 0x8b1b42);
    closeButton.setDepth(42);
    closeButton.setInteractive({ useHandCursor: true });
    closeButton.on('pointerdown', () => this.toggleSettings(false));
    this.settingsObjects.push(closeButton);

    const closeText = this.add.text(panelX + panelW - 30, panelY + 39, 'X', {
      fontFamily: 'Courier New',
      fontSize: '18px',
      color: '#ffe9bd',
    });
    closeText.setOrigin(0.5);
    closeText.setResolution(0.5);
    closeText.setDepth(43);
    this.settingsObjects.push(closeText);

    this.createSoundSlider('MASTER', 'master', panelY + 118);
    this.createSoundSlider('MUSIC', 'music', panelY + 184);
    this.createSoundSlider('SFX', 'sfx', panelY + 250);

    this.toggleSettings(false);
  }

  private createSoundSlider(label: string, key: SoundSliderKey, y: number): void {
    const labelText = this.add.text(this.panelX + 62, y, label, {
      fontFamily: 'Courier New',
      fontSize: '24px',
      color: '#ffd98d',
    });
    labelText.setOrigin(0, 0.5);
    labelText.setResolution(0.5);
    labelText.setDepth(42);
    this.settingsObjects.push(labelText);

    const trackX = this.panelX + 318;
    const trackW = 250;
    const trackH = 14;

    const track = this.add.rectangle(trackX, y, trackW, trackH, 0x4e2d79);
    track.setDepth(42);
    track.setInteractive({ useHandCursor: true });
    this.settingsObjects.push(track);

    const fill = this.add.rectangle(trackX - trackW / 2, y, trackW, trackH - 4, 0xff6f7a);
    fill.setOrigin(0, 0.5);
    fill.setDepth(43);
    this.settingsObjects.push(fill);

    const knob = this.add.rectangle(trackX, y, 18, 24, 0xf9d36e);
    knob.setDepth(44);
    knob.setInteractive({ useHandCursor: true });
    this.settingsObjects.push(knob);

    const valueText = this.add.text(this.panelX + 532, y, '0%', {
      fontFamily: 'Courier New',
      fontSize: '22px',
      color: '#ffe8be',
    });
    valueText.setOrigin(1, 0.5);
    valueText.setResolution(0.5);
    valueText.setDepth(42);
    this.settingsObjects.push(valueText);

    const sliderUi: SliderUi = { key, track, fill, knob, valueText };
    this.sliderUis.push(sliderUi);
    this.updateSliderVisual(sliderUi, this.soundLevels[key]);

    const beginDrag = (pointerX: number): void => {
      this.draggingSlider = key;
      this.updateSliderFromPointer(key, pointerX);
    };

    track.on('pointerdown', (pointer: Input.Pointer) => beginDrag(pointer.x));
    knob.on('pointerdown', (pointer: Input.Pointer) => beginDrag(pointer.x));
  }

  private updateSliderFromPointer(key: SoundSliderKey, pointerX: number): void {
    const slider = this.sliderUis.find((entry) => entry.key === key);
    if (!slider) {
      return;
    }

    const bounds = slider.track.getBounds();
    const ratio = PhaserMath.Clamp((pointerX - bounds.left) / bounds.width, 0, 1);
    const value = Math.round(ratio * 100);

    this.soundLevels[key] = value;
    this.updateSliderVisual(slider, value);
    this.applySoundLevels();

    const now = Date.now();
    if (now - this._lastSliderSfx > 80) {
      this._lastSliderSfx = now;
      this.sfx.play('sfx-slider-drag');
    }
  }

  private updateSliderVisual(slider: SliderUi, value: number): void {
    const ratio = value / 100;
    const bounds = slider.track.getBounds();
    const fillWidth = Math.max(4, bounds.width * ratio);

    slider.fill.setSize(fillWidth, slider.fill.height);
    slider.knob.x = bounds.left + (bounds.width * ratio);
    slider.valueText.setText(`${value}%`);
  }

  private applySoundLevels(): void {
    const master = this.soundLevels.master / 100;
    const musicVol = this.soundLevels.music / 100;

    const music = this.game.registry.get('music') as
      | Phaser.Sound.WebAudioSound
      | Phaser.Sound.HTML5AudioSound
      | undefined;
    if (music) {
      music.setVolume(master * musicVol);
    }

    // Keep registry in sync so SfxManager reads the latest values
    this.game.registry.set('soundLevels', this.soundLevels);
  }

  private toggleSettings(visible: boolean): void {
    this.settingsVisible = visible;
    this.draggingSlider = undefined;

    this.settingsObjects.forEach((obj) => (obj as Phaser.GameObjects.GameObject & { setVisible: (v: boolean) => void }).setVisible(visible));

    if (this.settingsBackdrop) {
      this.settingsBackdrop.disableInteractive();
      if (visible) {
        this.settingsBackdrop.setInteractive();
      }
    }
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    id: MenuButtonId,
  ): void {
    const frame = this.add.graphics();

    const redraw = (hovered: boolean): void => {
      frame.clear();
      frame.fillStyle(hovered ? 0xfed36f : 0xe1b85a);
      frame.fillRect(x - width / 2, y - height / 2, width, height);
      frame.fillStyle(0x4d2d10);
      frame.fillRect(x - width / 2 + 6, y - height / 2 + 6, width - 12, height - 12);
      frame.fillStyle(hovered ? 0x7f163d : 0x651232);
      frame.fillRect(x - width / 2 + 10, y - height / 2 + 10, width - 20, height - 20);
    };

    redraw(false);

    const text = this.add.text(x, y, label, {
      fontFamily: 'Courier New',
      fontSize: '28px',
      color: '#fff4d2',
      stroke: '#2e1b00',
      strokeThickness: 5,
    });
    text.setOrigin(0.5);
    text.setResolution(0.5);

    const hitArea = this.add.rectangle(x, y, width, height, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on('pointerover', () => redraw(true));
    hitArea.on('pointerout', () => redraw(false));
    hitArea.on('pointerdown', () => this.onButtonClick(id));
  }

  private onButtonClick(id: MenuButtonId): void {
    this.sfx.play('sfx-btn-click');

    if (id === 'play') {
      // Stop menu music and switch to ambient track
      const menuMusic = this.game.registry.get('music') as
        | Phaser.Sound.WebAudioSound
        | Phaser.Sound.HTML5AudioSound
        | undefined;
      if (menuMusic) {
        menuMusic.stop();
      }
      const ambientMusic = this.sound.add('casino-music', { loop: true, volume: 1.0 });
      this.game.registry.set('music', ambientMusic);
      ambientMusic.play();

      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('DungeonScene', { floor: 1 });
      });
      return;
    }

    this.toggleSettings(!this.settingsVisible);
  }
}
