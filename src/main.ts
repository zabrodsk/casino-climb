import { AUTO, CANVAS, Game, Scale } from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameplaySettingsScene } from './scenes/GameplaySettingsScene';
import { TransitionScene } from './scenes/TransitionScene';
import { DungeonScene } from './scenes/DungeonScene';
import { CoinFlipScene } from './scenes/CoinFlipScene';
import { CrashScene } from './scenes/CrashScene';
import { BlackjackScene } from './scenes/BlackjackScene';
import { WheelScene } from './scenes/WheelScene';
import { RouletteScene } from './scenes/RouletteScene';
import { SlotMachineScene } from './scenes/SlotMachineScene';
import { VaultScene } from './scenes/VaultScene';
import { EndScene } from './scenes/EndScene';
import { OutdoorScene } from './scenes/OutdoorScene';
import { resetDeveloperModeOnLaunch } from './dev/developerHotkeys';

const isSafari = (() => {
    if (typeof navigator === 'undefined') {
        return false;
    }

    const ua = navigator.userAgent;
    return /Safari/i.test(ua) && !/Chrome|Chromium|Android/i.test(ua);
})();

const config = {
    // Safari can present a blank canvas with this scene stack under WebGL.
    // Falling back to Canvas there keeps localhost usable while other browsers stay on AUTO.
    type: isSafari ? CANVAS : AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#0a0a0a',
    pixelArt: true,
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
        },
    },
    scene: [
        BootScene,
        MenuScene,
        GameplaySettingsScene,
        TransitionScene,
        DungeonScene,
        CoinFlipScene,
        CrashScene,
        BlackjackScene,
        WheelScene,
        RouletteScene,
        SlotMachineScene,
        VaultScene,
        EndScene,
        OutdoorScene,
    ],
};

document.addEventListener('DOMContentLoaded', () => {
    resetDeveloperModeOnLaunch();
    new Game(config);
});
