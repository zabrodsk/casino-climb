import Phaser from 'phaser';
import { drawFramedPanel, FONT, COLOR } from './theme';

const BUBBLE_H = 80;
const BUBBLE_W_MIN = 420;
const BUBBLE_W_MAX = 720;
const DEPTH = 500;

let _cleanup: (() => void) | null = null;

export const DialogueBus = {
  say(scene: Phaser.Scene, text: string): void {
    if (_cleanup) { _cleanup(); _cleanup = null; }

    const sw = scene.scale.width;
    const sh = scene.scale.height;
    const bubbleW = Math.max(BUBBLE_W_MIN, Math.min(sw * 0.65, BUBBLE_W_MAX));
    const bx = (sw - bubbleW) / 2;
    const by = sh - 24 - (BUBBLE_H * 2);

    const bg = scene.add.graphics();
    drawFramedPanel(bg, bx, by, bubbleW, BUBBLE_H, { borderWidth: 3, alpha: 0.92 });
    bg.setScrollFactor(0).setDepth(DEPTH);

    const textObj = scene.add.text(bx + 12, by + 12, '', {
      fontSize: '16px',
      fontFamily: FONT.mono,
      color: COLOR.ivorySoft,
      wordWrap: { width: bubbleW - 24 },
    }).setScrollFactor(0).setDepth(DEPTH + 1);

    let revealTimer: Phaser.Time.TimerEvent | null = null;
    let dismissTimer: Phaser.Time.TimerEvent | null = null;
    let destroyed = false;

    const destroy = (): void => {
      if (destroyed) return;
      destroyed = true;
      if (revealTimer) { revealTimer.remove(false); revealTimer = null; }
      if (dismissTimer) { dismissTimer.remove(false); dismissTimer = null; }
      if (bg.scene) bg.destroy();
      if (textObj.scene) textObj.destroy();
      scene.events.off('shutdown', destroy);
      if (_cleanup === destroy) _cleanup = null;
    };

    _cleanup = destroy;
    scene.events.once('shutdown', destroy);

    let i = 0;
    revealTimer = scene.time.addEvent({
      delay: 28,
      repeat: text.length - 1,
      callback: () => {
        if (destroyed) return;
        i++;
        textObj.setText(text.slice(0, i));
        if (i >= text.length) {
          revealTimer = null;
          dismissTimer = scene.time.delayedCall(3500, () => {
            if (destroyed) return;
            scene.tweens.add({
              targets: [bg, textObj],
              alpha: 0,
              duration: 300,
              onComplete: () => destroy(),
            });
            dismissTimer = null;
          });
        }
      },
    });
  },

  hide(): void {
    if (_cleanup) { _cleanup(); _cleanup = null; }
  },
};
