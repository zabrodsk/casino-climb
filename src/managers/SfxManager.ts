export type SfxKey =
  | 'sfx-btn-click'
  | 'sfx-slider-drag'
  | 'sfx-footstep'
  | 'sfx-door-approach'
  | 'sfx-stairs-unlock'
  | 'sfx-coin-gain'
  | 'sfx-coin-loss'
  | 'sfx-coin-spin'
  | 'sfx-coin-land-win'
  | 'sfx-coin-land-lose'
  | 'sfx-crash-start'
  | 'sfx-crash-riser'
  | 'sfx-crash-cashout'
  | 'sfx-crash-explode'
  | 'sfx-card-deal'
  | 'sfx-card-flip'
  | 'sfx-bj-win'
  | 'sfx-bj-lose'
  | 'sfx-bj-push'
  | 'sfx-bj-blackjack'
  | 'sfx-transition-sting'
  | 'sfx-coin-tick';

export const SFX_PATHS: Record<SfxKey, string> = {
  'sfx-btn-click':        'assets/audio/sfx-btn-click.mp3',
  'sfx-slider-drag':      'assets/audio/sfx-slider-drag.mp3',
  'sfx-footstep':         'assets/audio/sfx-footstep.mp3',
  'sfx-door-approach':    'assets/audio/sfx-door-approach.mp3',
  'sfx-stairs-unlock':    'assets/audio/sfx-stairs-unlock.mp3',
  'sfx-coin-gain':        'assets/audio/sfx-coin-gain.mp3',
  'sfx-coin-loss':        'assets/audio/sfx-coin-loss.mp3',
  'sfx-coin-spin':        'assets/audio/sfx-coin-spin.mp3',
  'sfx-coin-land-win':    'assets/audio/sfx-coin-land-win.mp3',
  'sfx-coin-land-lose':   'assets/audio/sfx-coin-land-lose.mp3',
  'sfx-crash-start':      'assets/audio/sfx-crash-start.mp3',
  'sfx-crash-riser':      'assets/audio/sfx-crash-riser.mp3',
  'sfx-crash-cashout':    'assets/audio/sfx-crash-cashout.mp3',
  'sfx-crash-explode':    'assets/audio/sfx-crash-explode.mp3',
  'sfx-card-deal':        'assets/audio/sfx-card-deal.mp3',
  'sfx-card-flip':        'assets/audio/sfx-card-flip.mp3',
  'sfx-bj-win':           'assets/audio/sfx-bj-win.mp3',
  'sfx-bj-lose':          'assets/audio/sfx-bj-lose.mp3',
  'sfx-bj-push':          'assets/audio/sfx-bj-push.mp3',
  'sfx-bj-blackjack':     'assets/audio/sfx-bj-blackjack.mp3',
  'sfx-transition-sting': 'assets/audio/sfx-transition-sting.mp3',
  'sfx-coin-tick':        'assets/audio/sfx-coin-tick.mp3',
};

export class SfxManager {
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Effective SFX volume = (master / 100) * (sfx / 100) */
  getVolume(): number {
    const levels = this.scene.game.registry.get('soundLevels') as
      | { master: number; sfx: number }
      | undefined;
    if (!levels) return 0.6;
    return (levels.master / 100) * (levels.sfx / 100);
  }

  /**
   * Play a one-shot SFX. Returns the sound instance (or null if the key isn't
   * loaded yet, so callers can safely ignore the return value).
   */
  play(
    key: SfxKey,
    options?: Phaser.Types.Sound.SoundConfig,
  ): void {
    if (!this.scene.cache.audio.has(key)) return;
    this.scene.sound.play(key, { volume: this.getVolume(), ...options });
  }
}
