import Phaser from 'phaser';
import { getCoins, setCoins } from '../state/coinState';
import { AudioManager } from '../audio/AudioManager';

const DEV_UNLOCK_KEY = Phaser.Input.Keyboard.KeyCodes.F10;
const DEV_MODE_STORAGE_KEY = 'casino.devMode.enabled';
const DEV_MODE_PREVIOUS_COINS_KEY = 'casino.devMode.previousCoins';

export function isDeveloperModeEnabled(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  return window.localStorage.getItem(DEV_MODE_STORAGE_KEY) === '1';
}

export function enableDeveloperMode(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    if (!isDeveloperModeEnabled()) {
      window.localStorage.setItem(DEV_MODE_PREVIOUS_COINS_KEY, String(getCoins()));
    }
    window.localStorage.setItem(DEV_MODE_STORAGE_KEY, '1');
  } catch {
    // Ignore storage errors in dev helper.
  }
}

export function disableDeveloperMode(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const previousCoinsRaw = window.localStorage.getItem(DEV_MODE_PREVIOUS_COINS_KEY);
    if (previousCoinsRaw !== null) {
      const parsed = Number(previousCoinsRaw);
      if (Number.isFinite(parsed)) {
        setCoins(Math.max(0, Math.round(parsed)));
      }
    }
    window.localStorage.removeItem(DEV_MODE_PREVIOUS_COINS_KEY);
    window.localStorage.removeItem(DEV_MODE_STORAGE_KEY);
  } catch {
    // Ignore storage errors in dev helper.
  }
}

export function resetDeveloperModeOnLaunch(): void {
  disableDeveloperMode();
}

export function toggleDeveloperMode(): boolean {
  if (isDeveloperModeEnabled()) {
    disableDeveloperMode();
    return false;
  }
  enableDeveloperMode();
  return true;
}

export function registerDeveloperUnlockHotkey(
  scene: Phaser.Scene,
  onEnable?: () => void,
  onDisable?: () => void,
): void {
  const keyboard = scene.input.keyboard;
  if (!keyboard) {
    return;
  }

  const key = keyboard.addKey(DEV_UNLOCK_KEY);
  const handler = () => {
    const enabled = toggleDeveloperMode();
    if (enabled) {
      AudioManager.playSfx(scene, 'dev-mode-on', { volume: 0.95, cooldownMs: 120, allowOverlap: false });
      onEnable?.();
      return;
    }
    AudioManager.playSfx(scene, 'dev-mode-off', { volume: 1.4, cooldownMs: 120, allowOverlap: false });
    onDisable?.();
  };
  key.on('down', handler);

  scene.events.once('shutdown', () => {
    key.off('down', handler);
  });
}
