import houseLines from '../data/houseLines.json';

let _enabled = true;
let _winStreak = 0;

function pickRandom(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

function getLines(trigger: string, subKey?: string): string[] | null {
  const data = houseLines as Record<string, Record<string, string[]>>;
  const section = data[trigger];
  if (!section) return null;
  if (subKey) {
    return section[subKey] ?? null;
  }
  // If no subKey, flatten all lines in section
  return Object.values(section).flat();
}

function showInScene(scene: Phaser.Scene, text: string): void {
  const sw = scene.scale.width;
  const sh = scene.scale.height;

  const bubbleW = 680;
  const bubbleH = 72;
  const bx = (sw - bubbleW) / 2;
  const by = sh - 76 - bubbleH / 2;

  const bg = scene.add.graphics();
  bg.fillStyle(0x06030f, 0.92);
  bg.fillRect(bx, by - bubbleH / 2, bubbleW, bubbleH);
  bg.lineStyle(2, 0x9d2b6d, 1);
  bg.strokeRect(bx, by - bubbleH / 2, bubbleW, bubbleH);
  bg.setScrollFactor(0);
  bg.setDepth(500);

  const textObj = scene.add.text(bx + 14, by - bubbleH / 2 + 12, '', {
    fontSize: '15px',
    fontFamily: 'Courier New',
    color: '#ffd98d',
    wordWrap: { width: bubbleW - 28 },
  });
  textObj.setScrollFactor(0);
  textObj.setDepth(501);

  let revealTimer: Phaser.Time.TimerEvent | null = null;
  let dismissTimer: Phaser.Time.TimerEvent | null = null;

  const cleanup = (): void => {
    if (revealTimer) { revealTimer.remove(false); revealTimer = null; }
    if (dismissTimer) { dismissTimer.remove(false); dismissTimer = null; }
    bg.destroy();
    textObj.destroy();
  };

  scene.events.once('shutdown', cleanup);

  let i = 0;
  revealTimer = scene.time.addEvent({
    delay: 28,
    repeat: text.length - 1,
    callback: () => {
      i++;
      textObj.setText(text.slice(0, i));
      if (i >= text.length) {
        revealTimer = null;
        dismissTimer = scene.time.delayedCall(3500, () => {
          scene.tweens.add({
            targets: [bg, textObj],
            alpha: 0,
            duration: 300,
            onComplete: () => {
              scene.events.off('shutdown', cleanup);
              bg.destroy();
              textObj.destroy();
            },
          });
          dismissTimer = null;
        });
      }
    },
  });
}

export const HouseController = {
  enable(): void {
    _enabled = true;
  },

  disable(): void {
    _enabled = false;
  },

  incrementWinStreak(): number {
    _winStreak++;
    return _winStreak;
  },

  resetWinStreak(): void {
    _winStreak = 0;
  },

  getWinStreak(): number {
    return _winStreak;
  },

  say(scene: Phaser.Scene, trigger: string, subKey?: string): void {
    if (!_enabled) return;
    const lines = getLines(trigger, subKey);
    if (!lines || lines.length === 0) return;
    const line = pickRandom(lines);
    showInScene(scene, line);
  },
};
