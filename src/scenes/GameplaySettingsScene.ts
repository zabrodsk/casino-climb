import { Scene, GameObjects, Input, Math as PhaserMath } from 'phaser';
import { COLOR, FONT, drawNestedButton } from '../ui/theme';
import { AudioLevels, AudioManager } from '../audio/AudioManager';
import { resetRun } from '../state/coinState';
import { resetNarrativeRunState } from '../state/narrativeState';

type SoundSliderKey = keyof AudioLevels;

type SliderUi = {
  key: SoundSliderKey;
  track: GameObjects.Rectangle;
  fill: GameObjects.Rectangle;
  knob: GameObjects.Rectangle;
  valueText: GameObjects.Text;
};

export class GameplaySettingsScene extends Scene {
  private targetSceneKey = 'DungeonScene';
  private sliderUis: SliderUi[] = [];
  private draggingSlider?: SoundSliderKey;
  private soundLevels!: AudioLevels;
  private navigatingHome = false;

  constructor() {
    super('GameplaySettingsScene');
  }

  init(data?: { targetSceneKey?: string }): void {
    this.targetSceneKey = data?.targetSceneKey ?? 'DungeonScene';
    this.draggingSlider = undefined;
    this.sliderUis = [];
    this.navigatingHome = false;
    this.soundLevels = AudioManager.getLevels(this.game);
  }

  create(): void {
    if (this.scene.isActive(this.targetSceneKey)) {
      this.scene.pause(this.targetSceneKey);
    }

    const { width, height } = this.scale;
    const panelW = 620;
    const panelH = 420;
    const panelX = (width - panelW) / 2;
    const panelY = (height - panelH) / 2;

    const backdrop = this.add.rectangle(0, 0, width, height, 0x06030f, 0.72).setOrigin(0);
    backdrop.setDepth(3000);
    backdrop.setInteractive({ cursor: 'pointer' });
    backdrop.on('pointerdown', () => this.closeOverlay());

    const panel = this.add.graphics();
    panel.fillStyle(0x45143c, 0.98);
    panel.fillRect(panelX, panelY, panelW, panelH);
    panel.fillStyle(0x9d2b6d, 1);
    panel.fillRect(panelX + 8, panelY + 8, panelW - 16, panelH - 16);
    panel.fillStyle(0x25134d, 1);
    panel.fillRect(panelX + 14, panelY + 14, panelW - 28, panelH - 28);
    panel.fillStyle(0xe6ba57, 1);
    panel.fillRect(panelX + 18, panelY + 18, panelW - 36, 42);
    panel.setDepth(3001);

    this.add.text(panelX + panelW / 2, panelY + 39, 'GAME SETTINGS', {
      fontFamily: 'Courier New',
      fontSize: '28px',
      color: '#3f1702',
      stroke: '#f7d591',
      strokeThickness: 4,
    }).setOrigin(0.5).setResolution(0.5).setDepth(3002);

    const closeButton = this.add.rectangle(panelX + panelW - 30, panelY + 39, 30, 24, 0x8b1b42);
    closeButton.setDepth(3002).setInteractive({ useHandCursor: true });
    closeButton.on('pointerdown', () => this.closeOverlay());
    this.add.text(panelX + panelW - 30, panelY + 39, 'X', {
      fontFamily: 'Courier New',
      fontSize: '18px',
      color: '#ffe9bd',
    }).setOrigin(0.5).setResolution(0.5).setDepth(3003);

    this.createSoundSlider(panelX, 'MASTER', 'master', panelY + 130);
    this.createSoundSlider(panelX, 'MUSIC', 'music', panelY + 200);
    this.createSoundSlider(panelX, 'SFX', 'sfx', panelY + 270);

    const resumeBtn = this.add.graphics().setDepth(3002);
    const resumeX = panelX + 190;
    const actionY = panelY + panelH - 62;
    drawNestedButton(resumeBtn, resumeX, actionY, 180, 50, false);
    this.add.text(resumeX, actionY, 'RESUME', {
      ...this.buttonLabelStyle(),
      fontSize: '22px',
    }).setOrigin(0.5).setDepth(3003);

    const resumeZone = this.add.zone(resumeX, actionY, 180, 50).setDepth(3004);
    resumeZone.setInteractive({ cursor: 'pointer' });
    resumeZone.on('pointerover', () => drawNestedButton(resumeBtn, resumeX, actionY, 180, 50, true));
    resumeZone.on('pointerout', () => drawNestedButton(resumeBtn, resumeX, actionY, 180, 50, false));
    resumeZone.on('pointerdown', () => this.closeOverlay());

    const homeBtn = this.add.graphics().setDepth(3002);
    const homeX = panelX + panelW - 190;
    drawNestedButton(homeBtn, homeX, actionY, 180, 50, false);
    this.add.text(homeX, actionY, 'GO HOME', {
      ...this.buttonLabelStyle(),
      fontSize: '22px',
    }).setOrigin(0.5).setDepth(3003);

    const homeZone = this.add.zone(homeX, actionY, 180, 50).setDepth(3004);
    homeZone.setInteractive({ cursor: 'pointer' });
    homeZone.on('pointerover', () => drawNestedButton(homeBtn, homeX, actionY, 180, 50, true));
    homeZone.on('pointerout', () => drawNestedButton(homeBtn, homeX, actionY, 180, 50, false));
    homeZone.on('pointerdown', () => this.goHome());

    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.events.once('shutdown', () => {
      this.input.off('pointermove', this.onPointerMove, this);
      this.input.off('pointerup', this.onPointerUp, this);
    });
  }

  private buttonLabelStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: FONT.mono,
      color: COLOR.ivory,
      stroke: COLOR.woodDeep,
      strokeThickness: 4,
    };
  }

  private createSoundSlider(
    panelX: number,
    label: string,
    key: SoundSliderKey,
    y: number,
  ): void {
    this.add.text(panelX + 62, y, label, {
      fontFamily: 'Courier New',
      fontSize: '24px',
      color: '#ffd98d',
    }).setOrigin(0, 0.5).setResolution(0.5).setDepth(3002);

    const trackX = panelX + 340;
    const trackW = 250;
    const trackH = 14;

    const track = this.add.rectangle(trackX, y, trackW, trackH, 0x4e2d79).setDepth(3002);
    track.setInteractive({ useHandCursor: true });

    const fill = this.add.rectangle(trackX - trackW / 2, y, trackW, trackH - 4, 0xff6f7a);
    fill.setOrigin(0, 0.5).setDepth(3003);

    const knob = this.add.rectangle(trackX, y, 18, 24, 0xf9d36e).setDepth(3004);
    knob.setInteractive({ useHandCursor: true });

    const valueText = this.add.text(panelX + 560, y, '0%', {
      fontFamily: 'Courier New',
      fontSize: '22px',
      color: '#ffe8be',
    }).setOrigin(1, 0.5).setResolution(0.5).setDepth(3002);

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

  private onPointerMove(pointer: Input.Pointer): void {
    if (!this.draggingSlider) {
      return;
    }
    this.updateSliderFromPointer(this.draggingSlider, pointer.x);
  }

  private onPointerUp(): void {
    this.draggingSlider = undefined;
  }

  private updateSliderFromPointer(key: SoundSliderKey, pointerX: number): void {
    const slider = this.sliderUis.find((entry) => entry.key === key);
    if (!slider) {
      return;
    }

    const bounds = slider.track.getBounds();
    const ratio = PhaserMath.Clamp((pointerX - bounds.left) / bounds.width, 0, 1);
    const value = Math.round(ratio * 100);

    this.soundLevels = { ...this.soundLevels, [key]: value };
    this.soundLevels = AudioManager.setLevels(this.game, this.soundLevels);
    this.updateSliderVisual(slider, value);
  }

  private updateSliderVisual(slider: SliderUi, value: number): void {
    const ratio = value / 100;
    const bounds = slider.track.getBounds();
    const fillWidth = Math.max(4, bounds.width * ratio);

    slider.fill.setSize(fillWidth, slider.fill.height);
    slider.knob.x = bounds.left + (bounds.width * ratio);
    slider.valueText.setText(`${value}%`);
  }

  private closeOverlay(): void {
    this.draggingSlider = undefined;
    if (!this.navigatingHome && this.scene.isPaused(this.targetSceneKey)) {
      this.scene.resume(this.targetSceneKey);
    }
    this.scene.stop('GameplaySettingsScene');
  }

  private goHome(): void {
    this.navigatingHome = true;
    this.draggingSlider = undefined;

    const music = this.game.registry.get('music') as Phaser.Sound.BaseSound | undefined;
    if (music) {
      music.stop();
      music.destroy();
      this.game.registry.set('music', null);
    }

    const gameplaySceneKeys = [
      'DungeonScene',
      'CoinFlipScene',
      'CrashScene',
      'BlackjackScene',
      'WheelScene',
      'VaultScene',
      'TransitionScene',
    ];
    gameplaySceneKeys.forEach((key) => this.scene.stop(key));

    resetNarrativeRunState();
    resetRun();
    this.scene.start('MenuScene');
  }
}
