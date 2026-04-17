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
    tablePos: { col: 6, row: 5 },
    stairsPos: { col: 10, row: 2 },
    playerStart: { col: 3, row: 8 },
    tableLabel: 'TABLE',
    floorTextures: { primary: 'casino-carpet-a', accent: 'casino-carpet-b' },
    useCompositeTable: true,
    slotMachines: [
      { col: 3,  row: 2 },
      { col: 6,  row: 2 },
      { col: 9,  row: 2 },
      { col: 4,  row: 7 },
      { col: 8,  row: 7 },
    ],
  },
  2: {
    name: 'THE CRASH HALL',
    target: 350,
    gameSceneKey: 'CrashScene',
    propTint: { table: 0xaa4466, stairsLocked: 0x4a2a3a, stairsOpen: 0xff6688 },
    torchColor: 0xaa3366,
    torchGlow: 0xff5588,
    tablePos: { col: 7, row: 4 },
    stairsPos: { col: 2, row: 2 },
    playerStart: { col: 10, row: 8 },
    tableLabel: 'CRASH',
    floorTextures: { primary: 'stone-floor-a', accent: 'stone-floor-b' },
    useCompositeTable: false,
    slotMachines: [],
  },
};
