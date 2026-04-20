import Phaser from 'phaser';
import RexVirtualJoystick from 'phaser3-rex-plugins/plugins/virtualjoystick.js';

interface RexJoystick {
  forceX: number;
  forceY: number;
  force: number;
  destroy(): void;
}

export class VirtualJoystick {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rex: RexJoystick;

  readonly bx: number;
  readonly by: number;

  get dx(): number { return this.rex.forceX; }
  get dy(): number { return this.rex.forceY; }

  constructor(scene: Phaser.Scene) {
    this.bx = 90;
    this.by = scene.scale.height - 90;

    const base = scene.add.arc(this.bx, this.by, 52)
      .setFillStyle(0x000000, 0.30)
      .setStrokeStyle(2, 0xe0a242, 0.65)
      .setScrollFactor(0)
      .setDepth(200);

    const thumb = scene.add.arc(this.bx, this.by, 24)
      .setFillStyle(0xe0a242, 0.75)
      .setStrokeStyle(1, 0xffffff, 0.4)
      .setScrollFactor(0)
      .setDepth(201);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.rex = new (RexVirtualJoystick as any)(scene, {
      x: this.bx,
      y: this.by,
      radius: 60,
      base,
      thumb,
      dir: '8dir',
      forceMin: 8,
      fixed: true,
    }) as RexJoystick;
  }

  destroy(): void {
    this.rex.destroy();
  }
}
