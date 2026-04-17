import Phaser from 'phaser';

export const THEME = {
  // Backgrounds
  bgDeep:       0x120819,  // deepest purple
  bgPanel:      0x271537,  // panel bg
  bgPanelAlt:   0x2a1a35,  // checker alt
  bgPanelDark:  0x110910,  // modal bg (at 0.92 alpha)
  bgInset:      0x321f41,  // checker primary

  // Accents
  pink:         0xff89bf,
  pinkStroke:   0xff327b,
  pinkDeep:     0x611231,
  pinkHover:    0x7c173f,

  // Warm gold family
  goldBright:   0xf8cf72,
  goldPrimary:  0xe2b95f,
  goldDim:      0xe6bc61,
  goldText:     0xf7dc96,
  goldWindow:   0xffd07a,
  goldLamp:     0xffd878,

  // Wood / outlines
  woodDark:     0x4b2e10,
  woodDeep:     0x2e1b00,
  woodMid:      0x3a2720,

  // Text
  ivory:        0xfff4d1,
  ivorySoft:    0xf0e3bd,
  offWhite:     0xfff4d1,

  // Status
  winGreen:     0x7ef5a6,
  loseRed:      0xff5a72,
} as const;

// Hex string versions for TextStyle colors
export const COLOR = {
  goldText:   '#f7dc96',
  goldBright: '#f8cf72',
  ivory:      '#fff4d1',
  ivorySoft:  '#f0e3bd',
  pink:       '#ff89bf',
  pinkStroke: '#ff327b',
  woodDeep:   '#2e1b00',
  winGreen:   '#7ef5a6',
  loseRed:    '#ff5a72',
} as const;

export const FONT = {
  mono: 'monospace',
};

/**
 * Draw a menu-style 3-layer nested pixel button (gold outer → wood inset → burgundy inner).
 * Always drawn with sharp rectangles (no rounded corners) to match the menu aesthetic.
 * Pass `hover: true` to switch to the brighter/hover palette.
 */
export function drawNestedButton(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  w: number,
  h: number,
  hover: boolean,
): void {
  g.clear();
  g.fillStyle(hover ? THEME.goldBright : THEME.goldPrimary, 1);
  g.fillRect(cx - w / 2, cy - h / 2, w, h);

  g.fillStyle(THEME.woodDark, 1);
  g.fillRect(cx - w / 2 + 6, cy - h / 2 + 6, w - 12, h - 12);

  g.fillStyle(hover ? THEME.pinkHover : THEME.pinkDeep, 1);
  g.fillRect(cx - w / 2 + 10, cy - h / 2 + 10, w - 20, h - 20);
}

/**
 * Draw a framed panel: deep-purple fill + thick gold border, no rounded corners.
 */
export function drawFramedPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { alpha?: number; border?: number; borderWidth?: number; fill?: number },
): void {
  const alpha = opts?.alpha ?? 0.92;
  const border = opts?.border ?? THEME.goldDim;
  const borderWidth = opts?.borderWidth ?? 3;
  const fill = opts?.fill ?? THEME.bgPanelDark;

  g.clear();
  g.fillStyle(fill, alpha);
  g.fillRect(x, y, w, h);
  g.lineStyle(borderWidth, border, 1);
  g.strokeRect(x, y, w, h);
}

/**
 * Standard button-label TextStyle: ivory fill, dark wood stroke, big pixel look.
 */
export function buttonLabelStyle(fontSize = 30): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT.mono,
    fontSize: `${fontSize}px`,
    color: COLOR.ivory,
    stroke: COLOR.woodDeep,
    strokeThickness: 5,
  };
}

/**
 * Dramatic pink-stroke title style (mirrors the CASINO sign).
 */
export function neonTitleStyle(fontSize = 40): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT.mono,
    fontSize: `${fontSize}px`,
    color: COLOR.pink,
    stroke: COLOR.pinkStroke,
    strokeThickness: 8,
  };
}

/**
 * Gold-on-dark body text style.
 */
export function bodyTextStyle(fontSize = 22): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT.mono,
    fontSize: `${fontSize}px`,
    color: COLOR.ivorySoft,
  };
}
