import houseLines from '../data/houseLines.json';
import { DialogueBus } from './DialogueBus';

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
  return Object.values(section).flat();
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
    DialogueBus.say(scene, pickRandom(lines));
  },
};
