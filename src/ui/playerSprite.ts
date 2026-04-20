import Phaser from 'phaser';
import { GameObjects } from 'phaser';

export interface SpritePalette {
  hairDark?: number; hairMid?: number; hairLight?: number;
  shirtDark?: number; shirtMid?: number; shirtLight?: number; shirtHighlight?: number;
  goldChain?: boolean;
  characterId?: string;
}

export function generatePlayerTexture(
  scene: Phaser.Scene,
  key: string,
  palette: SpritePalette = {},
): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const g = scene.add.graphics();
  const drawFn = getDrawFn(palette.characterId ?? 'gambler');
  for (let i = 0; i < 12; i++) {
    drawFn(g, i * 32, 0, i, palette);
  }
  g.generateTexture(key, 384, 48);
  g.destroy();
  const tex = scene.textures.get(key);
  for (let i = 0; i < 12; i++) {
    tex.add(i, 0, i * 32, 0, 32, 48);
  }
}

export function syncPlayerPresentation(
  scene: Phaser.Scene,
  palette: SpritePalette = {},
  key = 'player',
): void {
  generatePlayerTexture(scene, key, palette);

  if (scene.anims.exists('player-idle')) {
    scene.anims.remove('player-idle');
  }
  scene.anims.create({
    key: 'player-idle',
    frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 3 }),
    frameRate: 4,
    repeat: -1,
  });

  if (scene.anims.exists('player-walk')) {
    scene.anims.remove('player-walk');
  }
  scene.anims.create({
    key: 'player-walk',
    frames: scene.anims.generateFrameNumbers(key, { start: 4, end: 11 }),
    frameRate: 12,
    repeat: -1,
  });
}

function getDrawFn(id: string): (g: GameObjects.Graphics, ox: number, oy: number, frameIdx: number, palette: SpritePalette) => void {
  switch (id) {
    case 'high-roller': return drawHighRollerFrame;
    case 'card-shark':  return drawCardSharkFrame;
    case 'dealer':      return drawDealerFrame;
    case 'outlaw':      return drawOutlawFrame;
    case 'tycoon':  return drawTycoonFrame;
    case 'phantom': return drawPhantomFrame;
    default:            return drawPlayerFrame;
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

function drawHighRollerFrame(
  g: GameObjects.Graphics,
  ox: number,
  oy: number,
  frameIdx: number,
  _palette: SpritePalette,
): void {
  const idle = frameIdx <= 3;
  const breath  = idle && (frameIdx === 1 || frameIdx === 3) ? 1 : 0;
  const headDip = idle && frameIdx === 2 ? 1 : 0;
  const WALK: Array<[number,number,number,number,number,number]> = [
    [ 0, -1,  1,  0,  0,  1],
    [ 1,  0,  0,  0,  0,  0],
    [ 0,  1, -1,  2,  0, -1],
    [-1,  1, -1,  0,  0, -1],
    [ 0,  1, -1,  0,  0, -1],
    [ 1,  0,  0,  0,  0,  0],
    [ 0, -1,  1,  0,  2,  1],
    [-1, -1,  1,  0,  0,  1],
  ];
  let bodyBob = 0, legLeftDX = 0, legRightDX = 0;
  let legLeftLift = 0, legRightLift = 0, armSwing = 0;
  if (!idle) [bodyBob, legLeftDX, legRightDX, legLeftLift, legRightLift, armSwing] = WALK[frameIdx - 4];
  const baseY  = idle ? oy               : oy + Math.max(0, bodyBob);
  const upperY = idle ? baseY + breath   : oy + bodyBob;
  const cx = ox + 16;

  const skin = 0xdfc7b1, skinShade = 0xbd9a80;
  const hairCol = 0x1c1c1c;
  const jacketDark = 0x111113, jacketMid = 0x1e1e22, jacketLight = 0x2e2e35;
  const shirtWhite = 0xf0eeea, shirtCream = 0xdedad4;
  const goldTie = 0xc9a242, goldTieDark = 0x8a6a1a;
  const pants = 0x111113, pantsShade = 0x1e1e22;
  const shoe = 0x0a0a10;

  const headTop = upperY + 5 + headDip;

  // Slicked hair — flat on top, side-parted
  g.fillStyle(hairCol);
  g.fillRect(cx - 7, headTop, 14, 3);
  g.fillRect(cx - 8, headTop + 2, 3, 4);
  g.fillRect(cx + 5, headTop + 2, 3, 4);
  g.fillStyle(0x2a2a2a);
  g.fillRect(cx - 1, headTop, 1, 3);
  g.fillStyle(0x333338);
  g.fillRect(cx - 5, headTop + 1, 3, 1);
  g.fillRect(cx + 2, headTop + 1, 3, 1);

  // Face
  g.fillStyle(skin);
  g.fillRect(cx - 7, headTop + 4, 14, 10);
  g.fillStyle(skinShade);
  g.fillRect(cx - 7, headTop + 13, 14, 1);
  g.fillRect(cx - 2, headTop + 10, 4, 1);

  // Eyes — sharp, confident
  g.fillStyle(0x1a1410);
  g.fillRect(cx - 3, headTop + 8, 2, 1);
  g.fillRect(cx + 1, headTop + 8, 2, 1);
  // Thin mustache
  g.fillStyle(0x1c1c1c);
  g.fillRect(cx - 2, headTop + 12, 4, 1);

  // Neck
  g.fillStyle(skin);
  g.fillRect(cx - 2, headTop + 14, 4, 3);
  g.fillStyle(skinShade);
  g.fillRect(cx - 2, headTop + 15, 4, 2);
  // Jacket shoulders
  g.fillStyle(jacketDark);
  g.fillRect(cx - 7, headTop + 14, 5, 3);
  g.fillRect(cx + 2, headTop + 14, 5, 3);
  g.fillStyle(jacketMid);
  g.fillRect(cx - 6, headTop + 15, 4, 2);
  g.fillRect(cx + 2, headTop + 15, 4, 2);

  // Body: tuxedo jacket
  const torsoTop = upperY + 22;
  g.fillStyle(jacketDark);
  g.fillRect(cx - 7, torsoTop, 14, 12);
  // White shirt front
  g.fillStyle(shirtWhite);
  g.fillRect(cx - 2, torsoTop, 4, 10);
  g.fillStyle(shirtCream);
  g.fillRect(cx - 1, torsoTop + 1, 2, 8);
  // Lapels
  g.fillStyle(jacketMid);
  g.fillRect(cx - 7, torsoTop, 5, 6);
  g.fillRect(cx + 2, torsoTop, 5, 6);
  g.fillStyle(jacketLight);
  g.fillRect(cx - 6, torsoTop + 1, 3, 4);
  g.fillRect(cx + 3, torsoTop + 1, 3, 4);
  // Gold tie / bow tie
  g.fillStyle(goldTie);
  g.fillRect(cx - 1, torsoTop + 2, 2, 2);
  g.fillStyle(goldTieDark);
  g.fillRect(cx - 1, torsoTop + 4, 2, 1);
  // Jacket bottom
  g.fillStyle(jacketDark);
  g.fillRect(cx - 7, torsoTop + 10, 14, 2);
  // Pocket square (gold)
  g.fillStyle(goldTie);
  g.fillRect(cx - 6, torsoTop + 2, 2, 2);

  // Arms: jacket sleeves with white cuffs
  const leftArmTop = torsoTop + 8 + armSwing;
  const rightArmTop = torsoTop + 8 - armSwing;
  g.fillStyle(jacketDark);
  g.fillRect(cx - 8, leftArmTop, 2, 4);
  g.fillRect(cx + 6, rightArmTop, 2, 4);
  // White cuffs
  g.fillStyle(shirtWhite);
  g.fillRect(cx - 8, leftArmTop + 4, 2, 2);
  g.fillRect(cx + 6, rightArmTop + 4, 2, 2);
  // Cufflinks (gold dot)
  g.fillStyle(goldTie);
  g.fillRect(cx - 8, leftArmTop + 4, 1, 1);
  g.fillRect(cx + 7, rightArmTop + 4, 1, 1);

  // Belt and pants
  const waistY = baseY + 34;
  g.fillStyle(0x1a1a1a);
  g.fillRect(cx - 6, waistY, 12, 1);
  g.fillStyle(pants);
  g.fillRect(cx - 6, waistY + 1, 12, 6);
  g.fillStyle(pantsShade);
  g.fillRect(cx - 5, waistY + 2, 3, 4);
  g.fillRect(cx + 2, waistY + 2, 2, 4);
  g.fillStyle(0x0a0a12);
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

function drawCardSharkFrame(
  g: GameObjects.Graphics,
  ox: number,
  oy: number,
  frameIdx: number,
  _palette: SpritePalette,
): void {
  const idle = frameIdx <= 3;
  const breath  = idle && (frameIdx === 1 || frameIdx === 3) ? 1 : 0;
  const headDip = idle && frameIdx === 2 ? 1 : 0;
  const WALK: Array<[number,number,number,number,number,number]> = [
    [ 0, -1,  1,  0,  0,  1],
    [ 1,  0,  0,  0,  0,  0],
    [ 0,  1, -1,  2,  0, -1],
    [-1,  1, -1,  0,  0, -1],
    [ 0,  1, -1,  0,  0, -1],
    [ 1,  0,  0,  0,  0,  0],
    [ 0, -1,  1,  0,  2,  1],
    [-1, -1,  1,  0,  0,  1],
  ];
  let bodyBob = 0, legLeftDX = 0, legRightDX = 0;
  let legLeftLift = 0, legRightLift = 0, armSwing = 0;
  if (!idle) [bodyBob, legLeftDX, legRightDX, legLeftLift, legRightLift, armSwing] = WALK[frameIdx - 4];
  const baseY  = idle ? oy               : oy + Math.max(0, bodyBob);
  const upperY = idle ? baseY + breath   : oy + bodyBob;
  const cx = ox + 16;

  const skin = 0xdfc7b1, skinShade = 0xbd9a80;
  const hairCol = 0x1a1010;
  const hairHigh = 0x2e1a10;
  const vestDark = 0x1a3a18, vestMid = 0x2a5a26, vestLight = 0x3a7a34;
  const shirtDark = 0x8a8060, shirtMid = 0xb0a880, shirtLight = 0xccc8a0;
  const tieDark = 0x8a1a1a, tieMid = 0xb82a2a;
  const pants = 0x1a1a22, pantsShade = 0x28283a;
  const shoe = 0x100808;

  const headTop = upperY + 5 + headDip;

  // Sharp side-parted hair
  g.fillStyle(hairCol);
  g.fillRect(cx - 7, headTop, 14, 2);
  g.fillRect(cx - 8, headTop + 2, 3, 5);
  g.fillRect(cx + 5, headTop + 2, 3, 5);
  g.fillStyle(hairHigh);
  g.fillRect(cx - 4, headTop, 4, 1);
  g.fillRect(cx + 1, headTop, 4, 1);
  g.fillStyle(0x3a2820);
  g.fillRect(cx, headTop, 1, 2);

  // Face
  g.fillStyle(skin);
  g.fillRect(cx - 7, headTop + 4, 14, 10);
  g.fillStyle(skinShade);
  g.fillRect(cx - 7, headTop + 13, 14, 1);
  g.fillRect(cx - 2, headTop + 10, 4, 1);

  // Narrow eyes, slight smirk
  g.fillStyle(0x1a100a);
  g.fillRect(cx - 3, headTop + 8, 2, 1);
  g.fillRect(cx + 1, headTop + 8, 2, 1);
  g.fillStyle(0x7a604f);
  g.fillRect(cx, headTop + 11, 3, 1);
  g.fillRect(cx - 1, headTop + 12, 2, 1);

  // Neck + shoulders
  g.fillStyle(skin);
  g.fillRect(cx - 2, headTop + 14, 4, 3);
  g.fillStyle(skinShade);
  g.fillRect(cx - 2, headTop + 15, 4, 2);
  g.fillStyle(shirtMid);
  g.fillRect(cx - 7, headTop + 14, 5, 3);
  g.fillRect(cx + 2, headTop + 14, 5, 3);
  g.fillStyle(shirtLight);
  g.fillRect(cx - 6, headTop + 15, 4, 2);
  g.fillRect(cx + 2, headTop + 15, 4, 2);

  // Body: vest over shirt
  const torsoTop = upperY + 22;
  // Shirt underneath
  g.fillStyle(shirtMid);
  g.fillRect(cx - 7, torsoTop, 14, 12);
  g.fillStyle(shirtLight);
  g.fillRect(cx - 6, torsoTop + 1, 12, 10);
  // Green vest
  g.fillStyle(vestDark);
  g.fillRect(cx - 5, torsoTop, 10, 12);
  g.fillStyle(vestMid);
  g.fillRect(cx - 4, torsoTop + 1, 8, 10);
  g.fillStyle(vestLight);
  g.fillRect(cx - 3, torsoTop + 2, 6, 8);
  // Vest opening — shirt visible in center
  g.fillStyle(shirtMid);
  g.fillRect(cx - 1, torsoTop, 2, 12);
  // Shirt collar
  g.fillStyle(shirtLight);
  g.fillRect(cx - 3, torsoTop, 2, 2);
  g.fillRect(cx + 1, torsoTop, 2, 2);
  // Red tie
  g.fillStyle(tieDark);
  g.fillRect(cx - 1, torsoTop + 2, 2, 8);
  g.fillStyle(tieMid);
  g.fillRect(cx - 1, torsoTop + 2, 1, 6);
  // Vest buttons
  g.fillStyle(vestDark);
  g.fillRect(cx - 1, torsoTop + 3, 1, 1);
  g.fillRect(cx - 1, torsoTop + 6, 1, 1);
  g.fillRect(cx - 1, torsoTop + 9, 1, 1);

  // Arms: shirt sleeves
  const leftArmTop = torsoTop + 8 + armSwing;
  const rightArmTop = torsoTop + 8 - armSwing;
  g.fillStyle(shirtDark);
  g.fillRect(cx - 8, leftArmTop, 2, 5);
  g.fillRect(cx + 6, rightArmTop, 2, 5);
  g.fillStyle(shirtMid);
  g.fillRect(cx - 8, leftArmTop, 2, 3);
  g.fillRect(cx + 6, rightArmTop, 2, 3);
  g.fillStyle(skin);
  g.fillRect(cx - 8, leftArmTop + 5, 2, 2);
  g.fillRect(cx + 6, rightArmTop + 5, 2, 2);

  // Belt and pants
  const waistY = baseY + 34;
  g.fillStyle(0x2a2020);
  g.fillRect(cx - 6, waistY, 12, 1);
  g.fillStyle(pants);
  g.fillRect(cx - 6, waistY + 1, 12, 6);
  g.fillStyle(pantsShade);
  g.fillRect(cx - 5, waistY + 2, 3, 4);
  g.fillRect(cx + 2, waistY + 2, 2, 4);
  g.fillStyle(0x181820);
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

function drawDealerFrame(
  g: GameObjects.Graphics,
  ox: number,
  oy: number,
  frameIdx: number,
  _palette: SpritePalette,
): void {
  const idle = frameIdx <= 3;
  const breath  = idle && (frameIdx === 1 || frameIdx === 3) ? 1 : 0;
  const headDip = idle && frameIdx === 2 ? 1 : 0;
  const WALK: Array<[number,number,number,number,number,number]> = [
    [ 0, -1,  1,  0,  0,  1],
    [ 1,  0,  0,  0,  0,  0],
    [ 0,  1, -1,  2,  0, -1],
    [-1,  1, -1,  0,  0, -1],
    [ 0,  1, -1,  0,  0, -1],
    [ 1,  0,  0,  0,  0,  0],
    [ 0, -1,  1,  0,  2,  1],
    [-1, -1,  1,  0,  0,  1],
  ];
  let bodyBob = 0, legLeftDX = 0, legRightDX = 0;
  let legLeftLift = 0, legRightLift = 0, armSwing = 0;
  if (!idle) [bodyBob, legLeftDX, legRightDX, legLeftLift, legRightLift, armSwing] = WALK[frameIdx - 4];
  const baseY  = idle ? oy               : oy + Math.max(0, bodyBob);
  const upperY = idle ? baseY + breath   : oy + bodyBob;
  const cx = ox + 16;

  const skin = 0xdfc7b1, skinShade = 0xbd9a80;
  const hairCol = 0x1a1a22;
  const hairHigh = 0x2a2a38;
  const shirtWhite = 0xf0f0ec, shirtShadow = 0xd0d0cc;
  const vestDark = 0x111114, vestMid = 0x1c1c22, vestRim = 0x2e2e38;
  const bowtie = 0xd4a030;
  const bowtieDark = 0x8a6818;
  const armbandCol = 0x1a3a8a;
  const pants = 0x111114, pantsShade = 0x1c1c22;
  const shoe = 0x080810;

  const headTop = upperY + 5 + headDip;

  // Neat professional hair
  g.fillStyle(hairCol);
  g.fillRect(cx - 7, headTop, 14, 3);
  g.fillRect(cx - 8, headTop + 3, 2, 3);
  g.fillRect(cx + 6, headTop + 3, 2, 3);
  g.fillStyle(hairHigh);
  g.fillRect(cx - 5, headTop + 1, 10, 1);

  // Face
  g.fillStyle(skin);
  g.fillRect(cx - 7, headTop + 4, 14, 10);
  g.fillStyle(skinShade);
  g.fillRect(cx - 7, headTop + 13, 14, 1);
  g.fillRect(cx - 2, headTop + 10, 4, 1);

  // Professional neutral expression
  g.fillStyle(0x1a1410);
  g.fillRect(cx - 3, headTop + 8, 2, 1);
  g.fillRect(cx + 1, headTop + 8, 2, 1);
  g.fillStyle(0x8b6e5a);
  g.fillRect(cx - 2, headTop + 11, 4, 1);

  // Neck + shoulders
  g.fillStyle(skin);
  g.fillRect(cx - 2, headTop + 14, 4, 3);
  g.fillStyle(skinShade);
  g.fillRect(cx - 2, headTop + 15, 4, 2);
  g.fillStyle(shirtWhite);
  g.fillRect(cx - 7, headTop + 14, 5, 3);
  g.fillRect(cx + 2, headTop + 14, 5, 3);
  g.fillStyle(shirtShadow);
  g.fillRect(cx - 6, headTop + 15, 4, 2);
  g.fillRect(cx + 2, headTop + 15, 4, 2);

  // Body: white shirt + black vest
  const torsoTop = upperY + 22;
  // White shirt base
  g.fillStyle(shirtWhite);
  g.fillRect(cx - 7, torsoTop, 14, 12);
  g.fillStyle(shirtShadow);
  g.fillRect(cx - 6, torsoTop + 8, 12, 4);
  // Black vest panels
  g.fillStyle(vestDark);
  g.fillRect(cx - 6, torsoTop, 5, 12);
  g.fillRect(cx + 1, torsoTop, 5, 12);
  g.fillStyle(vestMid);
  g.fillRect(cx - 5, torsoTop + 1, 3, 10);
  g.fillRect(cx + 2, torsoTop + 1, 3, 10);
  g.fillStyle(vestRim);
  g.fillRect(cx - 5, torsoTop, 3, 1);
  g.fillRect(cx + 2, torsoTop, 3, 1);
  // Shirt collar visible
  g.fillStyle(shirtWhite);
  g.fillRect(cx - 3, torsoTop, 2, 2);
  g.fillRect(cx + 1, torsoTop, 2, 2);
  // Gold bow tie
  g.fillStyle(bowtie);
  g.fillRect(cx - 2, torsoTop + 2, 4, 2);
  g.fillStyle(bowtieDark);
  g.fillRect(cx - 1, torsoTop + 2, 2, 2);
  g.fillStyle(bowtie);
  g.fillRect(cx, torsoTop + 2, 1, 1);
  // Shirt front center
  g.fillStyle(shirtWhite);
  g.fillRect(cx - 1, torsoTop + 4, 2, 8);
  // Shirt buttons
  g.fillStyle(shirtShadow);
  g.fillRect(cx - 1, torsoTop + 5, 1, 1);
  g.fillRect(cx - 1, torsoTop + 7, 1, 1);
  g.fillRect(cx - 1, torsoTop + 9, 1, 1);

  // Arms: white shirt sleeves with blue sleeve garter
  const leftArmTop = torsoTop + 8 + armSwing;
  const rightArmTop = torsoTop + 8 - armSwing;
  g.fillStyle(shirtWhite);
  g.fillRect(cx - 8, leftArmTop, 2, 6);
  g.fillRect(cx + 6, rightArmTop, 2, 6);
  // Blue sleeve garter
  g.fillStyle(armbandCol);
  g.fillRect(cx - 8, leftArmTop, 2, 1);
  g.fillRect(cx + 6, rightArmTop, 2, 1);
  g.fillStyle(skinShade);
  g.fillRect(cx - 8, leftArmTop + 6, 2, 1);
  g.fillRect(cx + 6, rightArmTop + 6, 2, 1);

  // Belt and pants
  const waistY = baseY + 34;
  g.fillStyle(0x0a0a10);
  g.fillRect(cx - 6, waistY, 12, 1);
  g.fillStyle(pants);
  g.fillRect(cx - 6, waistY + 1, 12, 6);
  g.fillStyle(pantsShade);
  g.fillRect(cx - 5, waistY + 2, 3, 4);
  g.fillRect(cx + 2, waistY + 2, 2, 4);
  g.fillStyle(0x080810);
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

function drawOutlawFrame(
  g: GameObjects.Graphics,
  ox: number,
  oy: number,
  frameIdx: number,
  _palette: SpritePalette,
): void {
  const idle = frameIdx <= 3;
  const breath  = idle && (frameIdx === 1 || frameIdx === 3) ? 1 : 0;
  const headDip = idle && frameIdx === 2 ? 1 : 0;
  const WALK: Array<[number,number,number,number,number,number]> = [
    [ 0, -1,  1,  0,  0,  1],
    [ 1,  0,  0,  0,  0,  0],
    [ 0,  1, -1,  2,  0, -1],
    [-1,  1, -1,  0,  0, -1],
    [ 0,  1, -1,  0,  0, -1],
    [ 1,  0,  0,  0,  0,  0],
    [ 0, -1,  1,  0,  2,  1],
    [-1, -1,  1,  0,  0,  1],
  ];
  let bodyBob = 0, legLeftDX = 0, legRightDX = 0;
  let legLeftLift = 0, legRightLift = 0, armSwing = 0;
  if (!idle) [bodyBob, legLeftDX, legRightDX, legLeftLift, legRightLift, armSwing] = WALK[frameIdx - 4];
  const baseY  = idle ? oy               : oy + Math.max(0, bodyBob);
  const upperY = idle ? baseY + breath   : oy + bodyBob;
  const cx = ox + 16;

  const skin = 0xc9a882, skinShade = 0xa88060;
  const hairCol = 0x6a3a18;
  const hairHigh = 0x8a5a2a;
  const dusterDark = 0x4a3018, dusterMid = 0x6a4a28, dusterLight = 0x8a6038;
  const dusterRim = 0xaa7848;
  const shirtDark = 0x6a3820, shirtMid = 0x8a5030;
  const bandana = 0x8a1a1a;
  const bandanaDark = 0x5a1010;
  const pants = 0x3a2818, pantsShade = 0x4a3820;
  const boot = 0x2a1a0a;
  const bootHighlight = 0x4a3018;

  const headTop = upperY + 5 + headDip;

  // Rough unkempt hair, longer sides
  g.fillStyle(hairCol);
  g.fillRect(cx - 7, headTop, 14, 2);
  g.fillRect(cx - 8, headTop + 2, 3, 6);
  g.fillRect(cx + 5, headTop + 2, 3, 6);
  g.fillRect(cx - 2, headTop + 1, 2, 2);
  g.fillRect(cx + 1, headTop + 1, 2, 2);
  g.fillStyle(hairHigh);
  g.fillRect(cx - 4, headTop + 1, 2, 1);
  g.fillRect(cx + 2, headTop + 1, 2, 1);

  // Face (tanned)
  g.fillStyle(skin);
  g.fillRect(cx - 7, headTop + 4, 14, 10);
  g.fillStyle(skinShade);
  g.fillRect(cx - 7, headTop + 13, 14, 1);
  g.fillRect(cx - 2, headTop + 10, 4, 1);

  // Rugged squinting eyes
  g.fillStyle(0x1a0e0a);
  g.fillRect(cx - 3, headTop + 8, 2, 1);
  g.fillRect(cx + 1, headTop + 8, 2, 1);
  g.fillStyle(skinShade);
  g.fillRect(cx - 3, headTop + 7, 2, 1);
  g.fillRect(cx + 1, headTop + 7, 2, 1);
  // Scar on left cheek
  g.fillStyle(0xaa7060);
  g.fillRect(cx - 4, headTop + 10, 1, 2);
  // Stubble
  g.fillStyle(0x6a3a18);
  g.fillRect(cx - 4, headTop + 13, 2, 1);
  g.fillRect(cx + 1, headTop + 13, 2, 1);
  g.fillRect(cx - 3, headTop + 12, 1, 1);
  g.fillRect(cx + 2, headTop + 12, 1, 1);
  // Tight mouth
  g.fillStyle(0x6a4a38);
  g.fillRect(cx - 2, headTop + 12, 4, 1);

  // Bandana at neck
  g.fillStyle(bandana);
  g.fillRect(cx - 4, headTop + 14, 8, 3);
  g.fillStyle(bandanaDark);
  g.fillRect(cx - 3, headTop + 16, 6, 1);

  // Duster coat shoulders
  g.fillStyle(dusterDark);
  g.fillRect(cx - 8, headTop + 14, 6, 3);
  g.fillRect(cx + 2, headTop + 14, 6, 3);
  g.fillStyle(dusterMid);
  g.fillRect(cx - 7, headTop + 15, 4, 2);
  g.fillRect(cx + 3, headTop + 15, 4, 2);

  // Body: duster coat (wider silhouette)
  const torsoTop = upperY + 22;
  // Shirt underneath (visible at collar)
  g.fillStyle(shirtMid);
  g.fillRect(cx - 2, torsoTop, 4, 4);
  // Duster coat outer
  g.fillStyle(dusterDark);
  g.fillRect(cx - 8, torsoTop, 16, 12);
  g.fillStyle(dusterMid);
  g.fillRect(cx - 7, torsoTop + 1, 14, 11);
  g.fillStyle(dusterLight);
  g.fillRect(cx - 6, torsoTop + 2, 12, 9);
  // Duster lapels (open coat front)
  g.fillStyle(dusterDark);
  g.fillRect(cx - 8, torsoTop, 5, 8);
  g.fillRect(cx + 3, torsoTop, 5, 8);
  g.fillStyle(dusterMid);
  g.fillRect(cx - 7, torsoTop + 1, 3, 7);
  g.fillRect(cx + 4, torsoTop + 1, 3, 7);
  // Duster rim/edge detail
  g.fillStyle(dusterRim);
  g.fillRect(cx - 8, torsoTop, 1, 12);
  g.fillRect(cx + 7, torsoTop, 1, 12);
  // Shirt visible in center
  g.fillStyle(shirtDark);
  g.fillRect(cx - 2, torsoTop + 2, 4, 10);
  g.fillStyle(shirtMid);
  g.fillRect(cx - 1, torsoTop + 3, 2, 8);

  // Arms: duster coat sleeves (wider, layered)
  const leftArmTop = torsoTop + 8 + armSwing;
  const rightArmTop = torsoTop + 8 - armSwing;
  g.fillStyle(dusterDark);
  g.fillRect(cx - 9, leftArmTop, 3, 5);
  g.fillRect(cx + 6, rightArmTop, 3, 5);
  g.fillStyle(dusterMid);
  g.fillRect(cx - 9, leftArmTop, 2, 4);
  g.fillRect(cx + 7, rightArmTop, 2, 4);
  // Skin at wrist
  g.fillStyle(skin);
  g.fillRect(cx - 9, leftArmTop + 5, 3, 2);
  g.fillRect(cx + 6, rightArmTop + 5, 3, 2);

  // Belt with big gold buckle
  const waistY = baseY + 34;
  g.fillStyle(0x3a2010);
  g.fillRect(cx - 6, waistY, 12, 2);
  g.fillStyle(0xc9a242);
  g.fillRect(cx - 2, waistY, 4, 2);
  g.fillStyle(0xffd878);
  g.fillRect(cx - 1, waistY, 2, 1);

  // Brown pants
  g.fillStyle(pants);
  g.fillRect(cx - 6, waistY + 2, 12, 6);
  g.fillStyle(pantsShade);
  g.fillRect(cx - 5, waistY + 3, 3, 4);
  g.fillRect(cx + 2, waistY + 3, 2, 4);
  g.fillStyle(0x2a1a0a);
  g.fillRect(cx - 1, waistY + 3, 2, 4);

  // Legs
  const leftLegX  = cx - 4 + legLeftDX;
  const rightLegX = cx + 1 + legRightDX;
  const leftLegY  = waistY + 8 + legLeftLift;
  const rightLegY = waistY + 8 + legRightLift;
  const leftLegH  = Math.max(1, 4 - legLeftLift);
  const rightLegH = Math.max(1, 4 - legRightLift);
  g.fillStyle(pants);
  g.fillRect(leftLegX, leftLegY, 3, leftLegH);
  g.fillRect(rightLegX, rightLegY, 3, rightLegH);

  // Boots (taller, chunkier)
  g.fillStyle(boot);
  g.fillRect(leftLegX - 1, leftLegY + leftLegH, 5, 3);
  g.fillRect(rightLegX - 1, rightLegY + rightLegH, 5, 3);
  g.fillStyle(bootHighlight);
  g.fillRect(leftLegX, leftLegY + leftLegH, 3, 1);
  g.fillRect(rightLegX, rightLegY + rightLegH, 3, 1);

  // Ground shadow
  g.fillStyle(0x0a0a0a, 0.3);
  g.fillEllipse(cx, oy + 46, 11, 2);
}

function drawTycoonFrame(
  g: GameObjects.Graphics,
  ox: number,
  oy: number,
  frameIdx: number,
  _palette: SpritePalette,
): void {
  const idle = frameIdx <= 3;
  const breath  = idle && (frameIdx === 1 || frameIdx === 3) ? 1 : 0;
  const headDip = idle && frameIdx === 2 ? 1 : 0;
  const WALK: Array<[number,number,number,number,number,number]> = [
    [ 0, -1,  1,  0,  0,  1],
    [ 1,  0,  0,  0,  0,  0],
    [ 0,  1, -1,  2,  0, -1],
    [-1,  1, -1,  0,  0, -1],
    [ 0,  1, -1,  0,  0, -1],
    [ 1,  0,  0,  0,  0,  0],
    [ 0, -1,  1,  0,  2,  1],
    [-1, -1,  1,  0,  0,  1],
  ];
  let bodyBob = 0, legLeftDX = 0, legRightDX = 0;
  let legLeftLift = 0, legRightLift = 0, armSwing = 0;
  if (!idle) [bodyBob, legLeftDX, legRightDX, legLeftLift, legRightLift, armSwing] = WALK[frameIdx - 4];
  const baseY  = idle ? oy               : oy + Math.max(0, bodyBob);
  const upperY = idle ? baseY + breath   : oy + bodyBob;
  const cx = ox + 16;

  const skin = 0xecd4b4, skinShade = 0xc8a882;
  const hatBlack = 0x18181e, hatDark = 0x242430, hatBand = 0xc9a242;
  const silverHair = 0x9898a8, silverLight = 0xb8b8c8;
  const mustache = 0xb0a898;
  const monocle = 0xd4a030;
  const suitDark = 0x18202e, suitMid = 0x263040;
  const vestDark = 0x7a5a10, vestMid = 0xb08030, vestLight = 0xd4a040;
  const chainGold = 0xffc840;
  const shirtWhite = 0xf0ece0;
  const pantsDark = 0x141422, pantsMid = 0x202032;
  const shoe = 0x08080e;

  const headTop = upperY + 5 + headDip;

  // Top hat crown (sits above normal headTop)
  g.fillStyle(hatBlack);
  g.fillRect(cx - 5, headTop - 4, 10, 4);
  g.fillStyle(hatDark);
  g.fillRect(cx - 4, headTop - 3, 8, 3);
  // Gold band
  g.fillStyle(hatBand);
  g.fillRect(cx - 5, headTop - 1, 10, 1);
  // Brim
  g.fillStyle(hatBlack);
  g.fillRect(cx - 8, headTop, 16, 2);
  g.fillStyle(hatDark);
  g.fillRect(cx - 8, headTop, 16, 1);

  // Silver hair at sides below brim
  g.fillStyle(silverHair);
  g.fillRect(cx - 8, headTop + 2, 2, 4);
  g.fillRect(cx + 6, headTop + 2, 2, 4);
  g.fillStyle(silverLight);
  g.fillRect(cx - 7, headTop + 2, 1, 2);
  g.fillRect(cx + 6, headTop + 2, 1, 2);

  // Face (pale, distinguished)
  g.fillStyle(skin);
  g.fillRect(cx - 6, headTop + 2, 12, 12);
  g.fillStyle(skinShade);
  g.fillRect(cx - 6, headTop + 13, 12, 1);
  g.fillRect(cx - 2, headTop + 10, 4, 1);

  // Left eye
  g.fillStyle(0x1a1410);
  g.fillRect(cx - 3, headTop + 7, 2, 1);
  // Right eye with monocle
  g.fillStyle(0x1a1410);
  g.fillRect(cx + 1, headTop + 7, 2, 1);
  g.fillStyle(monocle);
  g.fillRect(cx + 1, headTop + 6, 2, 1);
  g.fillRect(cx + 1, headTop + 8, 2, 1);
  g.fillRect(cx, headTop + 7, 1, 1);
  g.fillRect(cx + 3, headTop + 7, 1, 1);
  g.fillRect(cx + 3, headTop + 8, 1, 2);

  // Full silver mustache
  g.fillStyle(mustache);
  g.fillRect(cx - 3, headTop + 10, 6, 2);
  g.fillStyle(silverLight);
  g.fillRect(cx - 2, headTop + 10, 4, 1);

  // Neck + white collar
  g.fillStyle(skin);
  g.fillRect(cx - 2, headTop + 14, 4, 3);
  g.fillStyle(skinShade);
  g.fillRect(cx - 2, headTop + 15, 4, 2);
  g.fillStyle(shirtWhite);
  g.fillRect(cx - 3, headTop + 14, 2, 3);
  g.fillRect(cx + 1, headTop + 14, 2, 3);
  g.fillStyle(suitDark);
  g.fillRect(cx - 7, headTop + 14, 5, 3);
  g.fillRect(cx + 2, headTop + 14, 5, 3);
  g.fillStyle(suitMid);
  g.fillRect(cx - 6, headTop + 15, 4, 2);
  g.fillRect(cx + 2, headTop + 15, 4, 2);

  // Body: charcoal suit with gold waistcoat
  const torsoTop = upperY + 22;
  g.fillStyle(suitDark);
  g.fillRect(cx - 7, torsoTop, 14, 12);
  // Gold waistcoat center
  g.fillStyle(vestDark);
  g.fillRect(cx - 2, torsoTop, 4, 12);
  g.fillStyle(vestMid);
  g.fillRect(cx - 1, torsoTop + 1, 2, 10);
  g.fillStyle(vestLight);
  g.fillRect(cx - 1, torsoTop + 2, 1, 8);
  // Waistcoat buttons
  g.fillStyle(hatBand);
  g.fillRect(cx, torsoTop + 2, 1, 1);
  g.fillRect(cx, torsoTop + 5, 1, 1);
  g.fillRect(cx, torsoTop + 8, 1, 1);
  // White shirt collar visible at top
  g.fillStyle(shirtWhite);
  g.fillRect(cx - 4, torsoTop, 2, 2);
  g.fillRect(cx + 2, torsoTop, 2, 2);
  // Suit lapels
  g.fillStyle(suitMid);
  g.fillRect(cx - 7, torsoTop, 5, 7);
  g.fillRect(cx + 2, torsoTop, 5, 7);
  g.fillStyle(0x30384a);
  g.fillRect(cx - 6, torsoTop + 1, 3, 5);
  g.fillRect(cx + 3, torsoTop + 1, 3, 5);
  // Gold watch chain
  g.fillStyle(chainGold);
  g.fillRect(cx - 1, torsoTop + 9, 5, 1);

  // Arms: suit sleeves with white cuffs
  const leftArmTop = torsoTop + 8 + armSwing;
  const rightArmTop = torsoTop + 8 - armSwing;
  g.fillStyle(suitDark);
  g.fillRect(cx - 8, leftArmTop, 2, 4);
  g.fillRect(cx + 6, rightArmTop, 2, 4);
  g.fillStyle(suitMid);
  g.fillRect(cx - 8, leftArmTop, 2, 3);
  g.fillRect(cx + 6, rightArmTop, 2, 3);
  g.fillStyle(shirtWhite);
  g.fillRect(cx - 8, leftArmTop + 4, 2, 2);
  g.fillRect(cx + 6, rightArmTop + 4, 2, 2);
  g.fillStyle(chainGold);
  g.fillRect(cx - 8, leftArmTop + 4, 1, 1);
  g.fillRect(cx + 7, rightArmTop + 4, 1, 1);

  // Belt
  const waistY = baseY + 34;
  g.fillStyle(0x181820);
  g.fillRect(cx - 6, waistY, 12, 1);
  g.fillStyle(pantsDark);
  g.fillRect(cx - 6, waistY + 1, 12, 6);
  g.fillStyle(pantsMid);
  g.fillRect(cx - 5, waistY + 2, 3, 4);
  g.fillRect(cx + 2, waistY + 2, 2, 4);
  g.fillStyle(0x0c0c1a);
  g.fillRect(cx - 1, waistY + 3, 2, 4);

  // Legs
  const leftLegX  = cx - 4 + legLeftDX;
  const rightLegX = cx + 1 + legRightDX;
  const leftLegY  = waistY + 7 + legLeftLift;
  const rightLegY = waistY + 7 + legRightLift;
  const leftLegH  = Math.max(1, 4 - legLeftLift);
  const rightLegH = Math.max(1, 4 - legRightLift);
  g.fillStyle(pantsDark);
  g.fillRect(leftLegX, leftLegY, 3, leftLegH);
  g.fillRect(rightLegX, rightLegY, 3, rightLegH);

  // Polished shoes with highlight
  g.fillStyle(shoe);
  g.fillRect(leftLegX - 1, leftLegY + leftLegH, 4, 2);
  g.fillRect(rightLegX - 1, rightLegY + rightLegH, 4, 2);
  g.fillStyle(0x1a1a2a);
  g.fillRect(leftLegX, leftLegY + leftLegH, 2, 1);
  g.fillRect(rightLegX, rightLegY + rightLegH, 2, 1);

  // Ground shadow
  g.fillStyle(0x0a0a0a, 0.3);
  g.fillEllipse(cx, oy + 46, 11, 2);
}

function drawPhantomFrame(
  g: GameObjects.Graphics,
  ox: number,
  oy: number,
  frameIdx: number,
  _palette: SpritePalette,
): void {
  const idle = frameIdx <= 3;
  const breath  = idle && (frameIdx === 1 || frameIdx === 3) ? 1 : 0;
  const headDip = idle && frameIdx === 2 ? 1 : 0;
  const WALK: Array<[number,number,number,number,number,number]> = [
    [ 0, -1,  1,  0,  0,  1],
    [ 1,  0,  0,  0,  0,  0],
    [ 0,  1, -1,  2,  0, -1],
    [-1,  1, -1,  0,  0, -1],
    [ 0,  1, -1,  0,  0, -1],
    [ 1,  0,  0,  0,  0,  0],
    [ 0, -1,  1,  0,  2,  1],
    [-1, -1,  1,  0,  0,  1],
  ];
  let bodyBob = 0, legLeftDX = 0, legRightDX = 0;
  let legLeftLift = 0, legRightLift = 0, armSwing = 0;
  if (!idle) [bodyBob, legLeftDX, legRightDX, legLeftLift, legRightLift, armSwing] = WALK[frameIdx - 4];
  const baseY  = idle ? oy               : oy + Math.max(0, bodyBob);
  const upperY = idle ? baseY + breath   : oy + bodyBob;
  const cx = ox + 16;

  const skin = 0xdfc7b1, skinShade = 0xbd9a80;
  const hairCol = 0x06060c, hairHigh = 0x10101c;
  const maskIvory = 0xf4f0e8, maskShadow = 0xd8d4c8, maskEdge = 0xb0aca4;
  const amberEye = 0xc08818;
  const cravatWhite = 0xf0ece0, cravatCream = 0xd8d4c4;
  const coatBlack = 0x06060a, coatDark = 0x0e0e18, coatEdge = 0x1c1c2a;
  const shirtWhite = 0xf0ece0;
  const pants = 0x08080e, pantsMid = 0x121220;
  const shoe = 0x04040a;
  const buckle = 0xb8b8c0;

  const headTop = upperY + 5 + headDip;

  // Slicked-back hair with widow's peak
  g.fillStyle(hairCol);
  g.fillRect(cx - 7, headTop, 14, 3);
  g.fillRect(cx - 8, headTop + 2, 2, 5);
  g.fillRect(cx + 6, headTop + 2, 2, 5);
  g.fillStyle(hairHigh);
  g.fillRect(cx - 4, headTop, 3, 1);
  g.fillRect(cx + 1, headTop, 3, 1);
  // Widow's peak center dip
  g.fillStyle(hairCol);
  g.fillRect(cx, headTop + 3, 1, 1);

  // Face — left half skin, right half masked
  g.fillStyle(skin);
  g.fillRect(cx - 7, headTop + 4, 8, 10);
  g.fillStyle(skinShade);
  g.fillRect(cx - 7, headTop + 13, 8, 1);
  g.fillRect(cx - 2, headTop + 10, 3, 1);

  // White mask — right half of face
  g.fillStyle(maskIvory);
  g.fillRect(cx, headTop + 4, 8, 10);
  g.fillStyle(maskShadow);
  g.fillRect(cx, headTop + 13, 8, 1);
  // Mask left edge
  g.fillStyle(maskEdge);
  g.fillRect(cx, headTop + 4, 1, 10);
  // Subtle mask highlight
  g.fillStyle(0xfcf8f0);
  g.fillRect(cx + 2, headTop + 5, 3, 2);

  // Left eye (normal)
  g.fillStyle(0x1a1410);
  g.fillRect(cx - 3, headTop + 8, 2, 1);

  // Right eye — amber, on mask
  g.fillStyle(amberEye);
  g.fillRect(cx + 1, headTop + 8, 2, 1);
  g.fillStyle(0xf0c030);
  g.fillRect(cx + 1, headTop + 8, 1, 1);

  // Subtle mouth (left side only)
  g.fillStyle(0x7a5a48);
  g.fillRect(cx - 2, headTop + 11, 2, 1);

  // White ruffled cravat at neck
  g.fillStyle(skin);
  g.fillRect(cx - 2, headTop + 14, 4, 3);
  g.fillStyle(cravatWhite);
  g.fillRect(cx - 3, headTop + 14, 6, 3);
  g.fillStyle(cravatCream);
  g.fillRect(cx - 2, headTop + 15, 4, 2);
  g.fillRect(cx - 1, headTop + 14, 2, 1);
  g.fillStyle(0xc4c0b0);
  g.fillRect(cx - 3, headTop + 15, 1, 2);
  g.fillRect(cx + 2, headTop + 15, 1, 2);

  // Jacket shoulders
  g.fillStyle(coatBlack);
  g.fillRect(cx - 7, headTop + 14, 5, 3);
  g.fillRect(cx + 2, headTop + 14, 5, 3);
  g.fillStyle(coatDark);
  g.fillRect(cx - 6, headTop + 15, 4, 2);
  g.fillRect(cx + 2, headTop + 15, 4, 2);

  // Body: tailcoat
  const torsoTop = upperY + 22;
  g.fillStyle(coatBlack);
  g.fillRect(cx - 8, torsoTop, 16, 12);
  // White shirt front (ruffled)
  g.fillStyle(shirtWhite);
  g.fillRect(cx - 2, torsoTop, 4, 10);
  g.fillStyle(0xe0dcd0);
  g.fillRect(cx - 1, torsoTop + 1, 2, 8);
  // Ruffle lines on shirt
  g.fillStyle(0xc8c4b8);
  g.fillRect(cx - 2, torsoTop + 2, 1, 6);
  g.fillRect(cx + 1, torsoTop + 2, 1, 6);
  // Cravat bow at collar
  g.fillStyle(cravatWhite);
  g.fillRect(cx - 1, torsoTop, 2, 2);
  // Lapels
  g.fillStyle(coatDark);
  g.fillRect(cx - 8, torsoTop, 6, 8);
  g.fillRect(cx + 2, torsoTop, 6, 8);
  g.fillStyle(coatEdge);
  g.fillRect(cx - 7, torsoTop + 1, 4, 6);
  g.fillRect(cx + 3, torsoTop + 1, 4, 6);
  // Pocket square (white)
  g.fillStyle(shirtWhite);
  g.fillRect(cx - 6, torsoTop + 2, 2, 2);

  // Arms: tailcoat sleeves
  const leftArmTop = torsoTop + 8 + armSwing;
  const rightArmTop = torsoTop + 8 - armSwing;
  g.fillStyle(coatBlack);
  g.fillRect(cx - 8, leftArmTop, 2, 4);
  g.fillRect(cx + 6, rightArmTop, 2, 4);
  g.fillStyle(coatDark);
  g.fillRect(cx - 8, leftArmTop, 2, 3);
  g.fillRect(cx + 6, rightArmTop, 2, 3);
  g.fillStyle(shirtWhite);
  g.fillRect(cx - 8, leftArmTop + 4, 2, 2);
  g.fillRect(cx + 6, rightArmTop + 4, 2, 2);

  // Belt
  const waistY = baseY + 34;
  g.fillStyle(0x0a0a0a);
  g.fillRect(cx - 6, waistY, 12, 1);
  g.fillStyle(pants);
  g.fillRect(cx - 6, waistY + 1, 12, 6);
  g.fillStyle(pantsMid);
  g.fillRect(cx - 5, waistY + 2, 3, 4);
  g.fillRect(cx + 2, waistY + 2, 2, 4);
  g.fillStyle(0x060612);
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

  // Black shoes with silver buckle
  g.fillStyle(shoe);
  g.fillRect(leftLegX - 1, leftLegY + leftLegH, 4, 2);
  g.fillRect(rightLegX - 1, rightLegY + rightLegH, 4, 2);
  g.fillStyle(buckle);
  g.fillRect(leftLegX, leftLegY + leftLegH, 1, 1);
  g.fillRect(rightLegX, rightLegY + rightLegH, 1, 1);

  // Ground shadow
  g.fillStyle(0x0a0a0a, 0.3);
  g.fillEllipse(cx, oy + 46, 11, 2);
}
