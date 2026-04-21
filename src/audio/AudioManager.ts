import Phaser from 'phaser';

export type MusicKey =
  | 'menu-music'
  | 'casino-music'
  | 'crash-game'
  | 'wheel-choir'
  | 'dice-game'
  | 'blackjack-jazz'
  | 'chip-cross';

export type SfxKey =
  | 'ui-click'
  | 'ui-hover'
  | 'bet-select'
  | 'deal-card'
  | 'coin-flip'
  | 'dice-roll'
  | 'wheel-spin'
  | 'coin-settle'
  | 'dice-land'
  | 'cashout'
  | 'crash'
  | 'crash-warning'
  | 'win'
  | 'lose'
  | 'game-over'
  | 'push'
  | 'goal-victory'
  | 'door-open'
  | 'transition-enter'
  | 'transition-exit'
  | 'blackjack-hit21'
  | 'blackjack-bust'
  | 'env-wind'
  | 'env-torch'
  | 'env-casino-murmur'
  | 'stairs-unlock'
  | 'floor-transition'
  | 'step'
  | 'vault-enter'
  | 'dev-mode-on'
  | 'dev-mode-off'
  | 'card-woosh'
  | 'chip-cross-bank'
  | 'wardrobe-buy';

export type AudioLevels = {
  master: number;
  music: number;
  sfx: number;
};

type PlaySfxOptions = {
  volume?: number;
  rate?: number;
  detune?: number;
  cooldownMs?: number;
  allowOverlap?: boolean;
};

type PlayMusicOptions = {
  loop?: boolean;
  volume?: number;
  restart?: boolean;
};

const STORAGE_KEY = 'casino.audio.levels';
const REGISTRY_LEVELS_KEY = 'audio-levels';
const REGISTRY_MUSIC_KEY = 'music';
const DEFAULT_LEVELS: AudioLevels = {
  master: 100,
  music: 100,
  sfx: 100,
};

const MUSIC_ASSETS: Record<MusicKey, string> = {
  'menu-music': 'assets/audio/menu-music.mp3',
  'casino-music': 'assets/audio/casino-music.mp3',
  'crash-game': 'assets/audio/crash-game.mp3',
  'wheel-choir': 'assets/audio/wheel-choir.mp3',
  'dice-game': 'assets/audio/dice-game.mp3',
  'blackjack-jazz': 'assets/audio/blackjack-jazz.mp3',
  'chip-cross': 'assets/audio/chip-cross.mp3',
};

const SFX_ASSETS: Record<SfxKey, string> = {
  'ui-click': 'assets/audio/sfx/ui-click.wav',
  'ui-hover': 'assets/audio/sfx/ui-hover.wav',
  'bet-select': 'assets/audio/sfx/bet-select.wav',
  'deal-card': 'assets/audio/sfx/card-sound.mp3',
  'coin-flip': 'assets/audio/sfx/coin-flip.wav',
  'dice-roll': 'assets/audio/sfx/dice-roll.mp3',
  'wheel-spin': 'assets/audio/sfx/spinning-wheel.mp3',
  'coin-settle': 'assets/audio/sfx/coin-settle.wav',
  'dice-land': 'assets/audio/sfx/dice-land.wav',
  'cashout': 'assets/audio/sfx/cashout.wav',
  'crash': 'assets/audio/sfx/crash.wav',
  'crash-warning': 'assets/audio/sfx/crash-warning.wav',
  'win': 'assets/audio/sfx/win.wav',
  'lose': 'assets/audio/sfx/lose.wav',
  'game-over': 'assets/audio/sfx/game-over.mp3',
  'push': 'assets/audio/sfx/push.wav',
  'goal-victory': 'assets/audio/sfx/victory-sound-2.mp3',
  'door-open': 'assets/audio/sfx/door-opening.mp3',
  'transition-enter': 'assets/audio/sfx/level-transition-screen.mp3',
  'transition-exit': 'assets/audio/sfx/enter-door.mp3',
  'blackjack-hit21': 'assets/audio/sfx/blackjack-hit21.wav',
  'blackjack-bust': 'assets/audio/sfx/blackjack-bust.wav',
  'env-wind': 'assets/audio/sfx/env-wind.wav',
  'env-torch': 'assets/audio/sfx/env-torch.wav',
  'env-casino-murmur': 'assets/audio/sfx/env-casino-murmur.wav',
  'stairs-unlock': 'assets/audio/sfx/stairs-unlock.wav',
  'floor-transition': 'assets/audio/sfx/floor-transition.wav',
  step: 'assets/audio/sfx/step.wav',
  'vault-enter': 'assets/audio/sfx/vault-sfx.mp3',
  'dev-mode-on': 'assets/audio/sfx/devMode-On.mp3',
  'dev-mode-off': 'assets/audio/sfx/devMode-Off.mp3',
  'card-woosh': 'assets/audio/sfx/card-woosh.mp3',
  'chip-cross-bank': 'assets/audio/sfx/chip-cross-bank.mp3',
  'wardrobe-buy': 'assets/audio/sfx/wardrobe-buy-sound.mp3',
};

class AudioManagerImpl {
  private readonly sfxCooldownByKey = new Map<SfxKey, number>();
  private readonly musicUnlockHandlerBySound = new WeakMap<Phaser.Sound.BaseSound, () => void>();

  preload(scene: Phaser.Scene): void {
    Object.entries(MUSIC_ASSETS).forEach(([key, path]) => {
      scene.load.audio(key, path);
    });
    Object.entries(SFX_ASSETS).forEach(([key, path]) => {
      scene.load.audio(key, path);
    });
  }

  init(sceneOrGame: Phaser.Scene | Phaser.Game): AudioLevels {
    const game = this.getGame(sceneOrGame);
    const existing = game.registry.get(REGISTRY_LEVELS_KEY) as AudioLevels | undefined;
    const levels = this.normalizeLevels(existing ?? this.loadPersistedLevels());
    game.registry.set(REGISTRY_LEVELS_KEY, levels);
    if (game.registry.get(REGISTRY_MUSIC_KEY) === undefined) {
      game.registry.set(REGISTRY_MUSIC_KEY, null);
    }
    return levels;
  }

  loadPersistedLevels(): AudioLevels {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_LEVELS };
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULT_LEVELS };
      }
      const parsed = JSON.parse(raw) as Partial<AudioLevels>;
      return this.normalizeLevels(parsed);
    } catch {
      return { ...DEFAULT_LEVELS };
    }
  }

  persistLevels(levels: AudioLevels): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.normalizeLevels(levels)));
    } catch {
      // Ignore localStorage write failures.
    }
  }

  getLevels(sceneOrGame: Phaser.Scene | Phaser.Game): AudioLevels {
    const game = this.getGame(sceneOrGame);
    const existing = game.registry.get(REGISTRY_LEVELS_KEY) as AudioLevels | undefined;
    if (existing) {
      return this.normalizeLevels(existing);
    }
    return this.init(sceneOrGame);
  }

  setLevels(sceneOrGame: Phaser.Scene | Phaser.Game, levels: AudioLevels, persist = true): AudioLevels {
    const game = this.getGame(sceneOrGame);
    const normalized = this.normalizeLevels(levels);
    game.registry.set(REGISTRY_LEVELS_KEY, normalized);
    this.applyMusicVolume(sceneOrGame);
    if (persist) {
      this.persistLevels(normalized);
    }
    return normalized;
  }

  playSfx(scene: Phaser.Scene, key: SfxKey, options?: PlaySfxOptions): Phaser.Sound.BaseSound | null {
    if (!scene.cache.audio.exists(key)) {
      return null;
    }

    const now = Date.now();
    const cooldownMs = options?.cooldownMs ?? 0;
    if (cooldownMs > 0) {
      const last = this.sfxCooldownByKey.get(key) ?? 0;
      if (now - last < cooldownMs) {
        return null;
      }
      this.sfxCooldownByKey.set(key, now);
    }

    if (!options?.allowOverlap) {
      const active = scene.sound.get(key);
      if (active?.isPlaying) {
        return active;
      }
    }

    const sound = scene.sound.add(key, {
      volume: this.getSfxVolume(scene) * (options?.volume ?? 1),
      rate: options?.rate ?? 1,
      detune: options?.detune ?? 0,
    });

    try {
      const play = () => {
        sound.play();
      };
      if (scene.sound.locked) {
        scene.sound.once('unlocked', play);
      } else {
        play();
      }
      sound.once('complete', () => {
        sound.destroy();
      });
      return sound;
    } catch {
      sound.destroy();
      return null;
    }
  }

  playMusic(
    scene: Phaser.Scene,
    key: MusicKey,
    options?: PlayMusicOptions,
  ): Phaser.Sound.BaseSound | null {
    if (!scene.cache.audio.exists(key)) {
      return null;
    }

    const existing = this.getMusic(scene);
    const restart = options?.restart ?? false;
    if (existing?.key === key && existing.isPlaying && !restart) {
      (existing as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).setVolume(
        this.getMusicVolume(scene) * (options?.volume ?? 1),
      );
      return existing;
    }

    if (existing) {
      this.detachMusicUnlockHandler(scene.sound, existing);
      existing.stop();
      existing.destroy();
    }

    const sound = scene.sound.add(key, {
      loop: options?.loop ?? true,
      volume: this.getMusicVolume(scene) * (options?.volume ?? 1),
    });

    scene.game.registry.set(REGISTRY_MUSIC_KEY, sound);

    try {
      const play = () => {
        this.musicUnlockHandlerBySound.delete(sound);
        sound.play();
      };
      if (scene.sound.locked) {
        scene.sound.once('unlocked', play);
        this.musicUnlockHandlerBySound.set(sound, play);
      } else {
        play();
      }
      return sound;
    } catch {
      this.detachMusicUnlockHandler(scene.sound, sound);
      sound.destroy();
      scene.game.registry.set(REGISTRY_MUSIC_KEY, null);
      return null;
    }
  }

  stopMusic(sceneOrGame: Phaser.Scene | Phaser.Game): void {
    const game = this.getGame(sceneOrGame);
    const music = game.registry.get(REGISTRY_MUSIC_KEY) as Phaser.Sound.BaseSound | null;
    if (!music) {
      return;
    }
    const soundManager = sceneOrGame instanceof Phaser.Scene ? sceneOrGame.sound : game.sound;
    try {
      this.detachMusicUnlockHandler(soundManager, music);
      music.stop();
      music.destroy();
    } catch {
      // Ignore lifecycle errors on shutdown transitions.
    }
    game.registry.set(REGISTRY_MUSIC_KEY, null);
  }

  applyMusicVolume(sceneOrGame: Phaser.Scene | Phaser.Game): void {
    const music = this.getMusic(sceneOrGame);
    if (music) {
      (music as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound).setVolume(
        this.getMusicVolume(sceneOrGame),
      );
    }
  }

  getMusic(sceneOrGame: Phaser.Scene | Phaser.Game): Phaser.Sound.BaseSound | null {
    const game = this.getGame(sceneOrGame);
    return (game.registry.get(REGISTRY_MUSIC_KEY) as Phaser.Sound.BaseSound | null) ?? null;
  }

  getMusicVolume(sceneOrGame: Phaser.Scene | Phaser.Game): number {
    const levels = this.getLevels(sceneOrGame);
    return (levels.master / 100) * (levels.music / 100);
  }

  getSfxVolume(sceneOrGame: Phaser.Scene | Phaser.Game): number {
    const levels = this.getLevels(sceneOrGame);
    return (levels.master / 100) * (levels.sfx / 100);
  }

  private getGame(sceneOrGame: Phaser.Scene | Phaser.Game): Phaser.Game {
    return sceneOrGame instanceof Phaser.Scene ? sceneOrGame.game : sceneOrGame;
  }

  private normalizeLevels(value?: Partial<AudioLevels>): AudioLevels {
    return {
      master: this.clampLevel(value?.master ?? DEFAULT_LEVELS.master),
      music: this.clampLevel(value?.music ?? DEFAULT_LEVELS.music),
      sfx: this.clampLevel(value?.sfx ?? DEFAULT_LEVELS.sfx),
    };
  }

  private clampLevel(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private detachMusicUnlockHandler(soundManager: Phaser.Sound.BaseSoundManager, sound: Phaser.Sound.BaseSound): void {
    const handler = this.musicUnlockHandlerBySound.get(sound);
    if (!handler) return;
    soundManager.off('unlocked', handler);
    this.musicUnlockHandlerBySound.delete(sound);
  }
}

export const AudioManager = new AudioManagerImpl();
export { MUSIC_ASSETS, SFX_ASSETS, STORAGE_KEY as AUDIO_STORAGE_KEY };
