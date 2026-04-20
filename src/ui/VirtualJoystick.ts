import Phaser from 'phaser';

export class VirtualJoystick {
  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private scene: Phaser.Scene;
  private activePointerId = -1;

  readonly maxRadius = 52;
  readonly bx: number;
  readonly by: number;

  dx = 0;
  dy = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bx = 90;
    this.by = scene.scale.height - 90;

    this.base = scene.add.arc(this.bx, this.by, this.maxRadius)
      .setFillStyle(0x000000, 0.35)
      .setStrokeStyle(3, 0xe0a242, 0.8)
      .setScrollFactor(0)
      .setDepth(1000);

    this.thumb = scene.add.arc(this.bx, this.by, 26)
      .setFillStyle(0xe0a242, 0.85)
      .setStrokeStyle(2, 0xffffff, 0.5)
      .setScrollFactor(0)
      .setDepth(1001);

    scene.input.on('pointerdown',      this.onDown, this);
    scene.input.on('pointermove',      this.onMove, this);
    scene.input.on('pointerup',        this.onUp,   this);
    scene.input.on('pointerupoutside', this.onUp,   this);
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.activePointerId !== -1) return;
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    if (p.x > W / 2 || p.y < H / 2) return;
    this.activePointerId = p.id;
    this.updateThumb(p.x, p.y);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.activePointerId) return;
    this.updateThumb(p.x, p.y);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id !== this.activePointerId) return;
    this.activePointerId = -1;
    this.thumb.setPosition(this.bx, this.by);
    this.dx = 0;
    this.dy = 0;
  }

  private updateThumb(px: number, py: number): void {
    const dx = px - this.bx;
    const dy = py - this.by;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, this.maxRadius);
    const angle = Math.atan2(dy, dx);
    this.thumb.setPosition(
      this.bx + Math.cos(angle) * clamped,
      this.by + Math.sin(angle) * clamped,
    );
    const deadzone = 8;
    this.dx = dist > deadzone ? Math.cos(angle) : 0;
    this.dy = dist > deadzone ? Math.sin(angle) : 0;
  }

  destroy(): void {
    this.scene.input.off('pointerdown',      this.onDown, this);
    this.scene.input.off('pointermove',      this.onMove, this);
    this.scene.input.off('pointerup',        this.onUp,   this);
    this.scene.input.off('pointerupoutside', this.onUp,   this);
    this.base.destroy();
    this.thumb.destroy();
  }
}
