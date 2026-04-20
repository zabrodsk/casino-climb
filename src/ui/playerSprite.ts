import Phaser from 'phaser';
import { GameObjects } from 'phaser';

export interface SpritePalette {
  hairDark?: number;
  hairMid?: number;
  hairLight?: number;
  shirtDark?: number;
  shirtMid?: number;
  shirtLight?: number;
  shirtHighlight?: number;
  goldChain?: boolean;
}

export function generatePlayerTexture(
  scene: Phaser.Scene,
  key: string,
  palette: SpritePalette = {},
): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const g = scene.add.graphics();
  for (let i = 0; i < 12; i++) {
    drawPlayerFrame(g, i * 32, 0, i, palette);
  }
  g.generateTexture(key, 384, 48);
  g.destroy();
  const tex = scene.textures.get(key);
  for (let i = 0; i < 12; i++) {
    tex.add(i, 0, i * 32, 0, 32, 48);
  }
}

function drawPlayerFrame(
  g: GameObjects.Graphics,
  ox: number,
  oy: number,
  frameIdx: number,
  palette: SpritePalette,
): void {
  const idle = frameIdx <= 3;

  // Idle breathing (upper body only)
  const breath  = idle && (frameIdx === 1 || frameIdx === 3) ? 1 : 0;
  const headDip = idle && frameIdx === 2 ? 1 : 0;

  // 8-frame walk table: [bodyBob, lDX, rDX, lLift, rLift, armSwing]
  const WALK: Array<[number,number,number,number,number,number]> = [
    [ 0, -1,  1,  0,  0,  1],  // f4:  right foot contact
    [ 1,  0,  0,  0,  0,  0],  // f5:  recoil — body dips
    [ 0,  1, -1,  2,  0, -1],  // f6:  left knee up (passing)
    [-1,  1, -1,  0,  0, -1],  // f7:  left foot contact — body rises
    [ 0,  1, -1,  0,  0, -1],  // f8:  left foot settling
    [ 1,  0,  0,  0,  0,  0],  // f9:  recoil — body dips
    [ 0, -1,  1,  0,  2,  1],  // f10: right knee up (passing)
    [-1, -1,  1,  0,  0,  1],  // f11: right foot contact — body rises
  ];

  let bodyBob = 0, legLeftDX = 0, legRightDX = 0;
  let legLeftLift = 0, legRightLift = 0, armSwing = 0;
  if (!idle) {
    [bodyBob, legLeftDX, legRightDX, legLeftLift, legRightLift, armSwing] = WALK[frameIdx - 4];
  }

  const baseY  = idle ? oy               : oy + Math.max(0, bodyBob);
  const upperY = idle ? baseY + breath   : oy + bodyBob;

  const cx = ox + 16;

  const skin = 0xdfc7b1;
  const skinShade = 0xbd9a80;
  const hairDark      = palette.hairDark      ?? 0x703c20;
  const hairMid       = palette.hairMid       ?? 0x975f33;
  const hairLight     = palette.hairLight     ?? 0xb17949;
  const shirtDark     = palette.shirtDark     ?? 0x4a4f56;
  const shirtMid      = palette.shirtMid      ?? 0x616770;
  const shirtLight    = palette.shirtLight    ?? 0x7e8791;
  const shirtHighlight = palette.shirtHighlight ?? 0x949da8;
  const grimeDark = 0x4f453a;
  const seam = 0x565c65;
  const dirt = 0x6e5a44;
  const pants = 0x2b2a2d;
  const pantsShade = 0x3a393d;
  const belt = 0x6d4727;
  const shoe = 0x2a1f19;

  // Head (large chibi head with messy brown hair)
  const headTop = upperY + 5 + headDip;
  g.fillStyle(hairDark);
  g.fillRect(cx - 7, headTop, 14, 2);
  g.fillRect(cx - 8, headTop + 2, 16, 2);
  g.fillStyle(hairMid);
  g.fillRect(cx - 6, headTop + 1, 4, 2);
  g.fillRect(cx + 1, headTop + 1, 4, 2);
  g.fillRect(cx - 1, headTop + 3, 4, 2);
  g.fillStyle(hairLight);
  g.fillRect(cx - 4, headTop + 1, 2, 1);
  g.fillRect(cx + 2, headTop + 2, 2, 1);
  g.fillRect(cx - 1, headTop + 2, 1, 1);
  g.fillRect(cx + 4, headTop + 3, 1, 1);
  g.fillStyle(hairDark);
  g.fillRect(cx - 8, headTop + 4, 2, 4);
  g.fillRect(cx + 6, headTop + 4, 2, 4);
  g.fillRect(cx - 2, headTop + 4, 1, 3);

  g.fillStyle(skin);
  g.fillRect(cx - 7, headTop + 4, 14, 10);
  g.fillStyle(skinShade);
  g.fillRect(cx - 7, headTop + 13, 14, 1);
  g.fillRect(cx - 2, headTop + 10, 4, 1); // nose/lip shade

  // Friendlier facial detail
  g.fillStyle(0x2f2721);
  g.fillRect(cx - 3, headTop + 8, 1, 1);
  g.fillRect(cx + 2, headTop + 8, 1, 1);
  g.fillStyle(0xcdad93);
  g.fillRect(cx - 5, headTop + 9, 1, 1);
  g.fillRect(cx + 4, headTop + 9, 1, 1);
  g.fillStyle(0x8b6e5a);
  g.fillRect(cx - 1, headTop + 11, 2, 1); // soft smile
  g.fillStyle(0x7a604f);
  g.fillRect(cx - 2, headTop + 12, 4, 1);

  // Neck + shoulders
  g.fillStyle(skin);
  g.fillRect(cx - 2, headTop + 14, 4, 3);
  g.fillStyle(skinShade);
  g.fillRect(cx - 2, headTop + 15, 4, 2);
  g.fillStyle(shirtDark);
  g.fillRect(cx - 7, headTop + 14, 5, 3);  // left shoulder
  g.fillRect(cx + 2, headTop + 14, 5, 3);  // right shoulder
  g.fillStyle(shirtMid);
  g.fillRect(cx - 6, headTop + 15, 4, 2);  // left shoulder highlight
  g.fillRect(cx + 2, headTop + 15, 4, 2);  // right shoulder highlight

  // Body: shirt
  const torsoTop = upperY + 22;
  g.fillStyle(shirtDark);
  g.fillRect(cx - 7, torsoTop, 14, 2);
  g.fillStyle(shirtMid);
  g.fillRect(cx - 6, torsoTop + 1, 12, 1);
  g.fillStyle(shirtMid);
  g.fillRect(cx - 7, torsoTop + 2, 14, 10);
  g.fillStyle(shirtLight);
  g.fillRect(cx - 6, torsoTop + 3, 12, 8);
  g.fillStyle(shirtHighlight);
  g.fillRect(cx - 5, torsoTop + 4, 2, 6);
  g.fillRect(cx + 2, torsoTop + 4, 2, 5);

  // Collar
  g.fillStyle(shirtDark);
  g.fillRect(cx - 3, torsoTop + 2, 2, 2);
  g.fillRect(cx + 1, torsoTop + 2, 2, 2);
  g.fillStyle(shirtMid);
  g.fillRect(cx - 1, torsoTop + 3, 2, 1);

  // Dirt/stains/wear
  g.fillStyle(dirt);
  g.fillRect(cx - 4, torsoTop + 5, 2, 2);
  g.fillRect(cx + 2, torsoTop + 7, 1, 2);
  g.fillRect(cx - 1, torsoTop + 9, 2, 1);
  g.fillStyle(grimeDark);
  g.fillRect(cx - 6, torsoTop + 10, 2, 1);
  g.fillRect(cx + 3, torsoTop + 9, 2, 1);

  // Gold chain accessory — drawn after collar so it isn't overwritten
  if (palette.goldChain) {
    g.fillStyle(0xe0a242);
    g.fillRect(cx - 4, torsoTop + 1, 8, 1);
    g.fillStyle(0xffd878);
    g.fillRect(cx - 2, torsoTop + 1, 4, 1);
  }

  // Shirt seams/creases
  g.fillStyle(seam);
  g.fillRect(cx - 1, torsoTop + 4, 1, 6);
  g.fillRect(cx - 2, torsoTop + 7, 1, 2);
  g.fillRect(cx + 1, torsoTop + 6, 1, 2);

  // Sleeves/arms (short swing)
  const leftArmTop = torsoTop + 8 + armSwing;
  const rightArmTop = torsoTop + 8 - armSwing;
  g.fillStyle(shirtMid);
  g.fillRect(cx - 8, leftArmTop, 2, 5);
  g.fillRect(cx + 6, rightArmTop, 2, 5);
  g.fillStyle(shirtDark);
  g.fillRect(cx - 8, leftArmTop + 4, 2, 1);
  g.fillRect(cx + 6, rightArmTop + 4, 2, 1);
  g.fillStyle(skin);
  g.fillRect(cx - 8, leftArmTop + 5, 2, 2);
  g.fillRect(cx + 6, rightArmTop + 5, 2, 2);

  // Belt and pants
  const waistY = baseY + 34;
  g.fillStyle(belt);
  g.fillRect(cx - 6, waistY, 12, 1);
  g.fillStyle(pants);
  g.fillRect(cx - 6, waistY + 1, 12, 6);
  g.fillStyle(pantsShade);
  g.fillRect(cx - 5, waistY + 2, 3, 4);
  g.fillRect(cx + 2, waistY + 2, 2, 4);
  g.fillStyle(0x222225);
  g.fillRect(cx - 1, waistY + 3, 2, 4);

  // Legs
  const leftLegX  = cx - 4 + legLeftDX;
  const rightLegX = cx + 1 + legRightDX;
  const leftLegY  = waistY + 7 + legLeftLift;
  const rightLegY = waistY + 7 + legRightLift;
  const leftLegH  = Math.max(1, 4 - legLeftLift);
  const rightLegH = Math.max(1, 4 - legRightLift);
  g.fillStyle(pants);
  g.fillRect(leftLegX, leftLegY, 3, leftLegH);
  g.fillRect(rightLegX, rightLegY, 3, rightLegH);

  // Shoes
  g.fillStyle(shoe);
  g.fillRect(leftLegX - 1, leftLegY + leftLegH, 4, 2);
  g.fillRect(rightLegX - 1, rightLegY + rightLegH, 4, 2);

  // Ground shadow
  g.fillStyle(0x0a0a0a, 0.3);
  g.fillEllipse(cx, oy + 46, 11, 2);
}
