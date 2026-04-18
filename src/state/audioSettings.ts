import Phaser from 'phaser';

export type SoundSliderKey = 'master' | 'music' | 'sfx';
export type SoundLevels = Record<SoundSliderKey, number>;

const SOUND_LEVELS_REGISTRY_KEY = 'sound-levels';

const DEFAULT_SOUND_LEVELS: SoundLevels = {
  master: 80,
  music: 70,
  sfx: 85,
};

function clampToPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function sanitizeLevels(levels: Partial<SoundLevels> | null | undefined): SoundLevels {
  return {
    master: clampToPercent(levels?.master ?? DEFAULT_SOUND_LEVELS.master),
    music: clampToPercent(levels?.music ?? DEFAULT_SOUND_LEVELS.music),
    sfx: clampToPercent(levels?.sfx ?? DEFAULT_SOUND_LEVELS.sfx),
  };
}

export function getSoundLevels(game: Phaser.Game): SoundLevels {
  const existing = game.registry.get(SOUND_LEVELS_REGISTRY_KEY) as Partial<SoundLevels> | undefined;
  const normalized = sanitizeLevels(existing);
  game.registry.set(SOUND_LEVELS_REGISTRY_KEY, normalized);
  return normalized;
}

export function setSoundLevels(game: Phaser.Game, levels: Partial<SoundLevels>): SoundLevels {
  const next = sanitizeLevels(levels);
  game.registry.set(SOUND_LEVELS_REGISTRY_KEY, next);
  return next;
}

export function updateSoundLevel(game: Phaser.Game, key: SoundSliderKey, value: number): SoundLevels {
  const current = getSoundLevels(game);
  const next = { ...current, [key]: clampToPercent(value) };
  game.registry.set(SOUND_LEVELS_REGISTRY_KEY, next);
  return next;
}

export function getMusicVolume(levels: SoundLevels): number {
  return (levels.master / 100) * (levels.music / 100);
}

export function applySoundLevels(scene: Phaser.Scene): void {
  const levels = getSoundLevels(scene.game);
  scene.sound.setVolume(levels.master / 100);

  const music = scene.game.registry.get('music') as Phaser.Sound.BaseSound | undefined;
  if (music) {
    (music as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).setVolume(
      getMusicVolume(levels),
    );
  }
}
