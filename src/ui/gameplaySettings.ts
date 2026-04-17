import Phaser from 'phaser';
import { THEME } from './theme';

const GEAR_DEPTH = 1000;

function drawGearIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number): void {
  g.clear();
  g.fillStyle(color, 1);
  g.fillRect(x - 2, y - 10, 4, 20);
  g.fillRect(x - 10, y - 2, 20, 4);
  g.fillRect(x - 8, y - 8, 16, 4);
  g.fillRect(x - 8, y + 4, 16, 4);
  g.fillRect(x - 8, y - 8, 4, 16);
  g.fillRect(x + 4, y - 8, 4, 16);
  g.fillStyle(THEME.bgDeep, 1);
  g.fillCircle(x, y, 5);
}

export function addGameplaySettingsGear(
  scene: Phaser.Scene,
  targetSceneKey: string = scene.scene.key,
): Phaser.GameObjects.GameObject[] {
  const x = 34;
  const y = scene.scale.height - 34;
  const w = 44;
  const h = 44;

  const buttonBg = scene.add.graphics().setScrollFactor(0).setDepth(GEAR_DEPTH);
  const icon = scene.add.graphics().setScrollFactor(0).setDepth(GEAR_DEPTH + 1);
  const hitArea = scene.add.zone(x, y, w, h).setScrollFactor(0).setDepth(GEAR_DEPTH + 2);

  const redraw = (hovered: boolean): void => {
    buttonBg.clear();
    buttonBg.fillStyle(hovered ? THEME.goldBright : THEME.goldDim, 1);
    buttonBg.fillRect(x - w / 2, y - h / 2, w, h);
    buttonBg.fillStyle(THEME.woodDark, 1);
    buttonBg.fillRect(x - w / 2 + 4, y - h / 2 + 4, w - 8, h - 8);
    buttonBg.fillStyle(hovered ? THEME.pink : THEME.pinkDeep, 0.9);
    buttonBg.fillRect(x - w / 2 + 8, y - h / 2 + 8, w - 16, h - 16);
    drawGearIcon(icon, x, y, hovered ? THEME.ivory : THEME.goldLamp);
  };

  redraw(false);

  hitArea.setInteractive({ cursor: 'pointer' });
  hitArea.on('pointerover', () => redraw(true));
  hitArea.on('pointerout', () => redraw(false));
  hitArea.on('pointerdown', () => {
    if (scene.scene.isActive('GameplaySettingsScene')) {
      return;
    }
    scene.scene.launch('GameplaySettingsScene', { targetSceneKey });
    scene.scene.bringToTop('GameplaySettingsScene');
  });

  return [buttonBg, icon, hitArea];
}
