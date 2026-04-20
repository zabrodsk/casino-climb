import { SpritePalette } from '../ui/playerSprite';

const KEYS = {
  gold:    'wardrobe.gold',
  owned:   'wardrobe.owned',
  equip:   'wardrobe.equipped',
};

export interface WardrobeItem {
  id: string;
  name: string;
  category: 'hair' | 'outfit' | 'accessory' | 'figure';
  price: number;
  palette: SpritePalette;
  description: string;
}

export interface WardrobeEquipped {
  hair?: string;
  outfit?: string;
  accessory?: string;
  figure?: string;
}

export const WARDROBE_CATALOG: WardrobeItem[] = [
  // --- Figures ---
  {
    id: 'figure-high-roller',
    name: 'High Roller',
    category: 'figure',
    price: 6000,
    description: 'Tuxedo, cufflinks, gold tie. Born at the top table.',
    palette: { characterId: 'high-roller' },
  },
  {
    id: 'figure-card-shark',
    name: 'Card Shark',
    category: 'figure',
    price: 6000,
    description: 'Green vest, red tie. Counts cards, beats houses.',
    palette: { characterId: 'card-shark' },
  },
  {
    id: 'figure-dealer',
    name: 'The Dealer',
    category: 'figure',
    price: 6000,
    description: 'White shirt, black vest, gold bow tie. The house.',
    palette: { characterId: 'dealer' },
  },
  {
    id: 'figure-outlaw',
    name: 'Outlaw',
    category: 'figure',
    price: 6000,
    description: 'Duster coat, bandana, stubble. Rides in, takes all.',
    palette: { characterId: 'outlaw' },
  },
  {
    id: 'figure-tycoon',
    name: 'The Tycoon',
    category: 'figure',
    price: 9000,
    description: 'Old money, new schemes. Top hat, monocle, gold chain.',
    palette: { characterId: 'tycoon' },
  },
  {
    id: 'figure-phantom',
    name: 'The Phantom',
    category: 'figure',
    price: 9000,
    description: 'No one knows his face. Half-mask, tailcoat, amber eye.',
    palette: { characterId: 'phantom' },
  },
  // --- Hair ---
  {
    id: 'hair-blonde',
    name: 'Casino Blonde',
    category: 'hair',
    price: 800,
    description: 'Sun-kissed gold. The lucky look.',
    palette: { hairDark: 0x9a7318, hairMid: 0xc9a642, hairLight: 0xe8c96a },
  },
  {
    id: 'hair-crimson',
    name: 'Crimson Dye',
    category: 'hair',
    price: 1500,
    description: 'Bold red. You want them to notice.',
    palette: { hairDark: 0x7a1010, hairMid: 0xbe2828, hairLight: 0xe04040 },
  },
  {
    id: 'hair-silver',
    name: 'Silver Fox',
    category: 'hair',
    price: 3000,
    description: 'The color of experience — and winning.',
    palette: { hairDark: 0x8a8a8a, hairMid: 0xb8b8b8, hairLight: 0xe0e0e0 },
  },
  // --- Outfits ---
  {
    id: 'outfit-red',
    name: 'Red Jacket',
    category: 'outfit',
    price: 1200,
    description: 'Red for danger. Red for luck.',
    palette: { shirtDark: 0x5a1010, shirtMid: 0x8a2020, shirtLight: 0xb83030, shirtHighlight: 0xd84040 },
  },
  {
    id: 'outfit-gold',
    name: 'Vegas Gold',
    category: 'outfit',
    price: 2500,
    description: "Dress like the money you're about to make.",
    palette: { shirtDark: 0x7a5a10, shirtMid: 0xb08030, shirtLight: 0xd8a840, shirtHighlight: 0xf0c060 },
  },
  {
    id: 'outfit-tux',
    name: 'Diamond Tux',
    category: 'outfit',
    price: 5000,
    description: "For those who've reached the top floor.",
    palette: { shirtDark: 0x181818, shirtMid: 0xd0d0d8, shirtLight: 0xeceff5, shirtHighlight: 0xffffff },
  },
  // --- Accessories ---
  {
    id: 'acc-chain',
    name: 'Gold Chain',
    category: 'accessory',
    price: 400,
    description: 'A little bling never hurt anybody.',
    palette: { goldChain: true },
  },
];

function ls(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, val: string): void {
  try { localStorage.setItem(key, val); } catch { /* */ }
}

export function getGold(): number {
  return parseInt(ls(KEYS.gold) ?? '0', 10);
}

export function creditGold(amount: number): void {
  if (amount <= 0) return;
  lsSet(KEYS.gold, String(getGold() + Math.floor(amount)));
}

export function getOwnedIds(): string[] {
  try { return JSON.parse(ls(KEYS.owned) ?? '[]'); } catch { return []; }
}

export function isOwned(id: string): boolean {
  return getOwnedIds().includes(id);
}

export function buyItem(id: string): boolean {
  const item = WARDROBE_CATALOG.find(i => i.id === id);
  if (!item) return false;
  if (isOwned(id)) return false;
  const gold = getGold();
  if (gold < item.price) return false;
  lsSet(KEYS.gold, String(gold - item.price));
  const owned = getOwnedIds();
  owned.push(id);
  lsSet(KEYS.owned, JSON.stringify(owned));
  return true;
}

export function getEquipped(): WardrobeEquipped {
  try { return JSON.parse(ls(KEYS.equip) ?? '{}'); } catch { return {}; }
}

export function equipItem(id: string): void {
  // figure-gambler is the free default — always equippable without ownership check
  if (id === 'figure-gambler') {
    const eq = getEquipped();
    (eq as Record<string, string>)['figure'] = id;
    lsSet(KEYS.equip, JSON.stringify(eq));
    return;
  }
  const item = WARDROBE_CATALOG.find(i => i.id === id);
  if (!item || !isOwned(id)) return;
  const eq = getEquipped();
  (eq as Record<string, string>)[item.category] = id;
  lsSet(KEYS.equip, JSON.stringify(eq));
}

export function unequipCategory(cat: string): void {
  const eq = getEquipped();
  delete (eq as Record<string, string>)[cat];
  lsSet(KEYS.equip, JSON.stringify(eq));
}

export function getPalette(): SpritePalette {
  const eq = getEquipped();
  const result: SpritePalette = {};
  const activeFigure = eq.figure ?? 'figure-gambler';
  const isStreetGambler = activeFigure === 'figure-gambler';
  // Apply figure first (sets characterId)
  if (eq.figure) {
    if (eq.figure === 'figure-gambler') {
      result.characterId = 'gambler';
    } else {
      const item = WARDROBE_CATALOG.find(i => i.id === eq.figure);
      if (item) Object.assign(result, item.palette);
    }
  }
  // Hair/outfit/accessory are only meant to customize the Street Gambler base.
  if (isStreetGambler) {
    for (const cat of ['hair', 'outfit', 'accessory'] as const) {
      const id = eq[cat];
      if (!id) continue;
      const item = WARDROBE_CATALOG.find(i => i.id === id);
      if (!item) continue;
      Object.assign(result, item.palette);
    }
  }
  return result;
}
