export interface FloorConfig {
  name: string;
  target: number;
  gameSceneKey: string;
  propTint: {
    table: number;
    stairsLocked: number;
    stairsOpen: number;
  };
  torchColor: number;
  torchGlow: number;
  tablePos: { col: number; row: number };
  stairsPos: { col: number; row: number };
  playerStart: { col: number; row: number };
  tableLabel: string;
  floorTextures: { primary: string; accent: string };
  useCompositeTable: boolean;
  compositeTableTexture?: string;
  slotMachines: Array<{ col: number; row: number }>;
}

export const FLOOR_CONFIG: Record<number, FloorConfig> = {
  1: {
    name: 'THE LOBBY',
    target: 300,
    gameSceneKey: 'CoinFlipScene',
    propTint: { table: 0xc9a66b, stairsLocked: 0x6a4a2a, stairsOpen: 0xffdd88 },
    torchColor: 0xff8833,
    torchGlow: 0xffee00,
    tablePos: { col: 8, row: 6 },
    stairsPos: { col: 14, row: 2 },
    playerStart: { col: 4, row: 10 },
    tableLabel: 'TABLE',
    floorTextures: { primary: 'casino-carpet-a', accent: 'casino-carpet-b' },
    useCompositeTable: true,
    compositeTableTexture: 'table-lobby',
    slotMachines: [
      { col: 3,  row: 2 },
      { col: 6,  row: 2 },
      { col: 9,  row: 2 },
      { col: 12, row: 2 },
      { col: 4,  row: 9 },
      { col: 12, row: 9 },
    ],
  },
  2: {
    name: 'THE CRASH HALL',
    target: 350,
    gameSceneKey: 'CrashScene',
    propTint: { table: 0xaa4466, stairsLocked: 0x4a2a3a, stairsOpen: 0xff6688 },
    torchColor: 0xaa3366,
    torchGlow: 0xff5588,
    tablePos: { col: 8, row: 6 },
    stairsPos: { col: 14, row: 2 },
    playerStart: { col: 4, row: 10 },
    tableLabel: 'CRASH',
    floorTextures: { primary: 'crash-floor-a', accent: 'crash-floor-b' },
    useCompositeTable: true,
    compositeTableTexture: 'table-crash',
    slotMachines: [
      { col: 3,  row: 2 },
      { col: 6,  row: 2 },
      { col: 10, row: 2 },
      { col: 13, row: 2 },
      { col: 4,  row: 9 },
      { col: 12, row: 9 },
    ],
  },
  3: {
    name: 'THE BLACKJACK PARLOR',
    target: 400,
    gameSceneKey: 'BlackjackScene',
    propTint: { table: 0x1d6b47, stairsLocked: 0x5a4630, stairsOpen: 0xf5cf7f },
    torchColor: 0xd8a24b,
    torchGlow: 0xffe29a,
    tablePos: { col: 8, row: 6 },
    stairsPos: { col: 14, row: 2 },
    playerStart: { col: 4, row: 10 },
    tableLabel: 'BLACKJACK',
    floorTextures: { primary: 'parlor-floor-a', accent: 'parlor-floor-b' },
    useCompositeTable: true,
    compositeTableTexture: 'table-blackjack',
    slotMachines: [
      { col: 3,  row: 2 },
      { col: 13, row: 2 },
      { col: 4,  row: 9 },
      { col: 12, row: 9 },
    ],
  },
};
