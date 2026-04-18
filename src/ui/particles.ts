export function winBurst(scene: Phaser.Scene, x: number, y: number): void {
  if (!scene.textures.exists('particle-dot')) return;
  const emitter = scene.add.particles(x, y, 'particle-dot', {
    speed: { min: 90, max: 280 },
    angle: { min: 0, max: 360 },
    scale: { start: 1.3, end: 0 },
    lifespan: 680,
    tint: [0xf8cf72, 0xff89bf, 0xffd98d, 0xffffff],
    quantity: 1,
    emitting: false,
  });
  emitter.setDepth(900);
  emitter.explode(30, x, y);
  scene.time.delayedCall(800, () => emitter.destroy());
}

export function betFlash(scene: Phaser.Scene): void {
  const { width, height } = scene.scale;
  const overlay = scene.add
    .rectangle(width / 2, height / 2, width, height, 0xf8cf72, 0.16)
    .setDepth(990)
    .setScrollFactor(0);
  scene.tweens.add({
    targets: overlay,
    alpha: 0,
    duration: 230,
    onComplete: () => overlay.destroy(),
  });
}

export function addCrtScanlines(scene: Phaser.Scene): void {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const g = scene.add.graphics().setScrollFactor(0).setDepth(998);
  g.fillStyle(0x000000, 0.07);
  for (let y = 0; y < H; y += 4) {
    g.fillRect(0, y, W, 2);
  }
}
