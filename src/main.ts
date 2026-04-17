import { AUTO, Game, Scale } from 'phaser';
import { BootScene } from './scenes/BootScene';

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
    scene: [BootScene],
};

document.addEventListener('DOMContentLoaded', () => {
    new Game(config);
});
