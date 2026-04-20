import Phaser, { Scene } from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { resetRun } from '../state/coinState';
import { resetNarrativeRunState } from '../state/narrativeState';
import { getPalette } from '../state/wardrobeState';
import { syncPlayerPresentation } from '../ui/playerSprite';

/**
 * OutdoorScene — shown when the player chooses "LEAVE" after beating the vault.
 * A simple pixel-art sunny-day vignette with the player sprite standing outside.
 * After a brief hold the scene fades to the main menu.
 */
export class OutdoorScene extends Scene {
  constructor() {
    super({ key: 'OutdoorScene' });
  }

  create(): void {
    const W = 1024;
    const H = 768;

    AudioManager.stopMusic(this);

    this._drawSky(W, H);
    this._drawSun(W);
    this._drawClouds(W);
    this._drawBuilding(W, H);
    this._drawGround(W, H);
    this._drawPlayer(W, H);
    this._drawText(W, H);

    // Fade in, hold, then fade to menu on click or after 6 s
    this.cameras.main.fadeIn(600, 255, 255, 255);

    const proceed = (): void => {
      this.input.off('pointerdown', proceed);
      this.cameras.main.fadeOut(700, 255, 255, 255);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        resetNarrativeRunState();
        resetRun();
        this.scene.start('MenuScene');
      });
    };

    this.time.delayedCall(5500, proceed);
    this.input.once('pointerdown', proceed);
  }

  // ── Scene drawing helpers ────────────────────────────────────────────────

  private _drawSky(W: number, H: number): void {
    const g = this.add.graphics();

    // Sky gradient: pale blue top → warm peachy horizon
    const skyStops = [
      { y: 0,       color: 0x87ceeb },
      { y: H * 0.3, color: 0xa8d8ea },
      { y: H * 0.55, color: 0xfce4b3 },
    ];
    for (let i = 0; i < skyStops.length - 1; i++) {
      const top = skyStops[i];
      const bot = skyStops[i + 1];
      const rows = Math.ceil(bot.y - top.y);
      for (let r = 0; r < rows; r++) {
        const t = r / rows;
        const rc = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(top.color),
          Phaser.Display.Color.ValueToColor(bot.color),
          100, Math.round(t * 100),
        );
        g.fillStyle(Phaser.Display.Color.GetColor(rc.r, rc.g, rc.b), 1);
        g.fillRect(0, top.y + r, W, 1);
      }
    }
  }

  private _drawSun(W: number): void {
    const g = this.add.graphics();
    const sx = W * 0.82;
    const sy = 96;

    // Outer glow
    g.fillStyle(0xfff4b0, 0.22);
    g.fillCircle(sx, sy, 80);
    g.fillStyle(0xffe86a, 0.35);
    g.fillCircle(sx, sy, 56);

    // Sun disc
    g.fillStyle(0xffe640, 1);
    g.fillCircle(sx, sy, 38);
    g.fillStyle(0xfff078, 1);
    g.fillCircle(sx - 8, sy - 8, 20);

    // Rays
    g.lineStyle(3, 0xffd320, 0.7);
    const rayAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    rayAngles.forEach((deg) => {
      const rad = Phaser.Math.DegToRad(deg);
      const inner = 44;
      const outer = 70;
      g.lineBetween(
        sx + Math.cos(rad) * inner,
        sy + Math.sin(rad) * inner,
        sx + Math.cos(rad) * outer,
        sy + Math.sin(rad) * outer,
      );
    });

    // Twinkle
    this.tweens.add({
      targets: g,
      alpha: { from: 0.88, to: 1 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private _drawClouds(W: number): void {
    const g = this.add.graphics();

    const clouds: Array<{ x: number; y: number; scale: number }> = [
      { x: 120, y: 72, scale: 1.0 },
      { x: 340, y: 48, scale: 0.7 },
      { x: 560, y: 88, scale: 0.85 },
    ];

    clouds.forEach(({ x, y, scale }) => {
      g.fillStyle(0xffffff, 0.92);
      g.fillEllipse(x, y, 110 * scale, 44 * scale);
      g.fillEllipse(x + 28 * scale, y - 16 * scale, 80 * scale, 36 * scale);
      g.fillEllipse(x - 22 * scale, y - 10 * scale, 60 * scale, 28 * scale);
    });

    // Slow drift
    this.tweens.add({
      targets: g,
      x: 18,
      duration: 14000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private _drawBuilding(W: number, H: number): void {
    const g = this.add.graphics();
    const groundY = H * 0.62;

    // Casino building silhouette on left
    const bx = 68;
    const bw = 260;
    const bh = 220;
    const by = groundY - bh;

    // Main body
    g.fillStyle(0x4a3520, 1);
    g.fillRect(bx, by, bw, bh);
    g.fillStyle(0x5c4428, 1);
    g.fillRect(bx + 4, by + 4, bw - 8, bh - 4);

    // Facade panels
    g.fillStyle(0x3a2810, 1);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const wx = bx + 18 + col * 56;
        const wy = by + 24 + row * 46;
        g.fillRect(wx, wy, 38, 32);
        // window glow
        g.fillStyle(0xfde68a, 0.85);
        g.fillRect(wx + 2, wy + 2, 34, 28);
        g.fillStyle(0xfbbf24, 0.45);
        g.fillRect(wx + 2, wy + 2, 34, 10);
        g.fillStyle(0x3a2810, 1);
      }
    }

    // Awning
    g.fillStyle(0xb91c1c, 1);
    g.fillRect(bx - 10, groundY - 42, bw + 20, 18);
    g.fillStyle(0xfef3c7, 1);
    for (let i = 0; i < 6; i++) {
      g.fillRect(bx - 10 + i * 45, groundY - 42, 22, 18);
    }

    // Sign
    g.fillStyle(0x1c0a00, 1);
    g.fillRect(bx + 50, by - 28, 160, 30);
    g.fillStyle(0xfde68a, 1);
    this.add.text(bx + 130, by - 13, 'CASINO', {
      fontFamily: 'Georgia',
      fontSize: '18px',
      color: '#fde68a',
      stroke: '#1c0a00',
      strokeThickness: 2,
    }).setOrigin(0.5);

    // Door
    g.fillStyle(0x1c0a00, 1);
    g.fillRect(bx + bw / 2 - 18, groundY - 52, 36, 52);
    g.fillStyle(0xfbbf24, 0.3);
    g.fillRect(bx + bw / 2 - 16, groundY - 50, 15, 48);
  }

  private _drawGround(W: number, H: number): void {
    const g = this.add.graphics();
    const groundY = H * 0.62;

    // Pavement
    g.fillStyle(0xb0966e, 1);
    g.fillRect(0, groundY, W, 28);
    g.fillStyle(0xc9aa82, 1);
    g.fillRect(0, groundY, W, 6);

    // Pavement cracks / lines
    g.lineStyle(1, 0x8a7050, 0.5);
    for (let x = 0; x < W; x += 96) {
      g.lineBetween(x, groundY, x, groundY + 28);
    }

    // Grass
    g.fillStyle(0x4ade80, 1);
    g.fillRect(0, groundY + 28, W, H - groundY - 28);
    g.fillStyle(0x22c55e, 1);
    g.fillRect(0, groundY + 28, W, 12);

    // Grass tufts
    g.fillStyle(0x16a34a, 1);
    for (let x = 20; x < W; x += 38) {
      g.fillTriangle(x, groundY + 36, x + 7, groundY + 28, x + 14, groundY + 36);
    }

    // Far background: sky-meet hills
    g.fillStyle(0x86efac, 0.55);
    g.fillEllipse(W * 0.6, groundY + 12, 560, 80);
    g.fillStyle(0x4ade80, 0.65);
    g.fillEllipse(W * 0.75, groundY + 8, 320, 60);
  }

  private _drawPlayer(W: number, H: number): void {
    const groundY = H * 0.62;
    const px = W * 0.62;
    const py = groundY + 14;

    // Drop shadow
    const shadow = this.add.ellipse(px, py + 2, 36, 8, 0x000000, 0.18);
    this.tweens.add({
      targets: shadow,
      scaleX: { from: 0.9, to: 1.05 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Player sprite at 4× scale facing right
    syncPlayerPresentation(this, getPalette());
    if (this.textures.exists('player')) {
      const sprite = this.add.sprite(px, py, 'player', 0);
      sprite.setOrigin(0.5, 1).setScale(4);
      sprite.play('player-idle');
    } else {
      // Fallback rectangle if texture not yet loaded
      const fallback = this.add.graphics();
      fallback.fillStyle(0x7e8791, 1);
      fallback.fillRect(px - 16, py - 80, 32, 80);
    }
  }

  private _drawText(W: number, H: number): void {
    const groundY = H * 0.62;

    this.add.text(W / 2, groundY + 80, 'You made it out.', {
      fontFamily: 'Georgia',
      fontSize: '38px',
      color: '#1c0a00',
      stroke: '#fde68a',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(W / 2, groundY + 132, 'The sun is different when the debt is cleared.', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#3a2810',
    }).setOrigin(0.5);

    const hint = this.add.text(W / 2, H - 32, 'Click to continue', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#8a7050',
    }).setOrigin(0.5).setAlpha(0);

    this.time.delayedCall(1200, () => {
      this.tweens.add({
        targets: hint,
        alpha: { from: 0.3, to: 0.85 },
        duration: 900,
        yoyo: true,
        repeat: -1,
      });
    });
  }
}
