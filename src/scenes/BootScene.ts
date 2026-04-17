import { Scene } from 'phaser';

export class BootScene extends Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    create() {
        const { width, height } = this.scale;

        this.add.text(width / 2, height / 2 - 30, 'THE HOUSE ALWAYS WINS', {
            fontSize: '48px',
            color: '#ffffff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 + 40, 'Phase 0 Complete', {
            fontSize: '18px',
            color: '#666666',
            fontFamily: 'monospace',
        }).setOrigin(0.5);
    }
}
