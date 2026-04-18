export interface FloorInteractable {
  pos: { col: number; row: number };
  gameSceneKey: string;
  tableLabel: string;
  compositeTableTexture?: string;
  /** Render scale for the composite sprite; mirrors WheelScene default (2) for the wheel. */
  spriteScale?: number;
}

export interface FloorConfig {
  name: string;
  target: number;
  mode?: 'table' | 'crossing';
  displayFloorNumber?: number;
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
  /** Optional additional interactive stations on this floor (beyond the primary tablePos). */
  interactables?: FloorInteractable[];
  slotMachines: Array<{ col: number; row: number }>;
  crossing?: {
    laneCount: number;
    laneSpacing: number;
    columnSpacing: number;
    startMultiplier: number;
    multiplierStep: number;
    speedBase: number;
    speedStep: number;
    speedVariance: number;
    respawnJitter: number;
    cardWidth: number;
    cardHeight: number;
    chipX: number;
    laneTop: number;
    laneBottom: number;
    cameraZoom: number;
    startPromptRadius: number;
    barricadeWidth: number;
    defaultBet: number;
  };
}

export const FLOOR_CONFIG: Record<number, FloorConfig> = {
  1: {
    name: 'THE LOBBY',
    target: 250,
    mode: 'table',
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
    mode: 'table',
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
    target: 450,
    mode: 'table',
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
  4: {
    name: 'ROOM OF FATE',
    target: 0,
    mode: 'table',
    gameSceneKey: 'WheelScene',
    propTint: { table: 0xd7b56a, stairsLocked: 0x4b1b20, stairsOpen: 0xffe29a },
    torchColor: 0xf08f34,
    torchGlow: 0xffd781,
    tablePos: { col: 8, row: 6 },
    stairsPos: { col: 14, row: 2 },
    playerStart: { col: 8, row: 10 },
    tableLabel: 'WHEEL',
    floorTextures: { primary: 'fate-floor-a', accent: 'fate-floor-b' },
    useCompositeTable: true,
    compositeTableTexture: 'table-wheel',
    interactables: [
      {
        pos: { col: 13, row: 7 },
        gameSceneKey: 'RouletteScene',
        tableLabel: 'ROULETTE',
        compositeTableTexture: 'table-roulette',
        spriteScale: 2,
      },
      {
        pos: { col: 3, row: 7 },
        gameSceneKey: 'SlotMachineScene',
        tableLabel: 'SLOTS',
        compositeTableTexture: 'slot-machine-big',
        spriteScale: 1,
      },
    ],
    slotMachines: [
      { col: 3, row: 2 },
      { col: 13, row: 2 },
    ],
  },
  5: {
    name: 'THE CHIP CROSS',
    target: 600,
    mode: 'crossing',
    gameSceneKey: '',
    propTint: { table: 0xb03a5b, stairsLocked: 0x4e1830, stairsOpen: 0xf6cf79 },
    torchColor: 0xe45f78,
    torchGlow: 0xffd9a3,
    tablePos: { col: 8, row: 6 },
    stairsPos: { col: 14, row: 2 },
    playerStart: { col: 2, row: 10 },
    tableLabel: 'CHIP CROSS',
    floorTextures: { primary: 'poker-floor-a', accent: 'poker-floor-b' },
    useCompositeTable: false,
    slotMachines: [],
    crossing: {
      laneCount: 6,
      laneSpacing: 22,
      columnSpacing: 32,
      startMultiplier: 1,
      multiplierStep: 0.35,
      speedBase: 118,
      speedStep: 18,
      speedVariance: 34,
      respawnJitter: 56,
      cardWidth: 18,
      cardHeight: 12,
      chipX: 64,
      laneTop: 92,
      laneBottom: 194,
      cameraZoom: 5.85,
      startPromptRadius: 22,
      barricadeWidth: 24,
      defaultBet: 25,
    },
  },
  6: {
    name: 'THE VAULT',
    target: 0,
    mode: 'table',
    gameSceneKey: 'VaultScene',
    propTint: { table: 0xb7c7d8, stairsLocked: 0x394552, stairsOpen: 0xe6f0f8 },
    torchColor: 0xa7c3df,
    torchGlow: 0xe2eef9,
    tablePos: { col: 8, row: 6 },
    stairsPos: { col: 14, row: 2 },
    playerStart: { col: 4, row: 10 },
    tableLabel: 'VAULT',
    floorTextures: { primary: 'vault-floor-a', accent: 'vault-floor-b' },
    useCompositeTable: true,
    compositeTableTexture: 'table-vault',
    slotMachines: [],
  },
};
