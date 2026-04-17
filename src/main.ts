import { AUTO, Game, Scale } from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { TransitionScene } from './scenes/TransitionScene';
import { DungeonScene } from './scenes/DungeonScene';
import { CoinFlipScene } from './scenes/CoinFlipScene';
import { CrashScene } from './scenes/CrashScene';

const config = {
    type: AUTO,
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
    scene: [BootScene, MenuScene, TransitionScene, DungeonScene, CoinFlipScene, CrashScene],
};

document.addEventListener('DOMContentLoaded', () => {
    new Game(config);
});
