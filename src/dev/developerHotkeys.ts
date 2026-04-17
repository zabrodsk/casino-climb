import Phaser from 'phaser';

const DEV_UNLOCK_KEY = Phaser.Input.Keyboard.KeyCodes.F10;

export function registerDeveloperUnlockHotkey(
  scene: Phaser.Scene,
  onUnlock: () => void,
): void {
  if (!import.meta.env.DEV) {
    return;
  }

  const keyboard = scene.input.keyboard;
  if (!keyboard) {
    return;
  }

  const key = keyboard.addKey(DEV_UNLOCK_KEY);
  const handler = () => onUnlock();
  key.on('down', handler);

  scene.events.once('shutdown', () => {
    key.off('down', handler);
  });
}
