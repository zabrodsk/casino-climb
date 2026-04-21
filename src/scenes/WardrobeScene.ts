import Phaser, { Scene, GameObjects } from 'phaser';
import {
  WARDROBE_CATALOG,
  WardrobeItem,
  getGold,
  buyItem,
  isOwned,
  equipItem,
  unequipCategory,
  getEquipped,
  getPalette,
} from '../state/wardrobeState';
import { generatePlayerTexture, SpritePalette, syncPlayerPresentation } from '../ui/playerSprite';
import { AudioManager } from '../audio/AudioManager';

type Tab = 'figure' | 'hair' | 'outfit' | 'accessory';

export class WardrobeScene extends Scene {
  private readonly W = 1024;
  private readonly H = 768;

  private activeTab: Tab = 'figure';
  private selectedItem: WardrobeItem | null = null;
  private previewPalette: SpritePalette = {};
  private previewSprite!: Phaser.GameObjects.Sprite;
  private goldText!: GameObjects.Text;
  private actionBtn!: GameObjects.Container;
  private actionBtnLabel!: GameObjects.Text;
  private actionBtnFrame!: GameObjects.Graphics;
  private itemCards: GameObjects.Container[] = [];
  private itemGridContainer!: GameObjects.Container;
  private itemViewportZone!: GameObjects.Zone;
  private itemScrollTrack!: GameObjects.Graphics;
  private itemScrollThumb!: GameObjects.Graphics;
  private itemScrollOffset = 0;
  private itemContentHeight = 0;
  private tabButtons: Map<Tab, GameObjects.Container> = new Map();

  private readonly itemPanelX = 360;
  private readonly itemPanelY = 100;
  private readonly itemPanelW = 600;
  private readonly itemPanelH = 540;
  private readonly itemViewportX = 390;
  private readonly itemViewportY = 168;
  private readonly itemViewportW = 540;
  private readonly itemViewportH = 452;
  private readonly itemScrollStep = 96;

  constructor() { super('WardrobeScene'); }

  create(): void {
    this.previewPalette = { ...getPalette() };
    this.selectedItem = null;
    this.itemCards = [];
    this.tabButtons = new Map();

    this.drawBackground();
    this.drawTitle();
    this.drawPreviewPanel();
    this.drawItemPanel();
    this.drawBottomBar();
    this.refreshPreview();
  }

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillStyle(0x090707);
    g.fillRect(0, 0, this.W, this.H);
    g.fillStyle(0x140b0f);
    g.fillRect(0, 0, this.W, this.H * 0.36);
    g.fillStyle(0x1c0d13);
    g.fillRect(0, this.H * 0.36, this.W, this.H * 0.34);
    g.fillStyle(0x10080c);
    g.fillRect(0, this.H * 0.7, this.W, this.H * 0.3);
    g.lineStyle(1, 0x5b3b2a, 0.2);
    for (let y = this.H * 0.72; y < this.H; y += 18) g.lineBetween(0, y, this.W, y);
  }

  private drawTitle(): void {
    const frame = this.add.graphics();
    frame.fillStyle(0x3a1c12, 0.9);
    frame.fillRoundedRect(this.W / 2 - 260, 18, 520, 62, 10);
    frame.lineStyle(2, 0xc9a66b, 0.9);
    frame.strokeRoundedRect(this.W / 2 - 260, 18, 520, 62, 10);

    this.add.text(this.W / 2, 49, 'WARDROBE', {
      fontFamily: 'Georgia', fontSize: '40px', color: '#ffd8a2',
      stroke: '#8c4d2a', strokeThickness: 5, letterSpacing: 3,
    }).setOrigin(0.5);

    // Close button
    const closeFrame = this.add.graphics();
    closeFrame.fillStyle(0x5d2237);
    closeFrame.fillRoundedRect(this.W - 90, 24, 60, 36, 6);
    closeFrame.lineStyle(2, 0xc9a66b, 0.8);
    closeFrame.strokeRoundedRect(this.W - 90, 24, 60, 36, 6);

    const closeZone = this.add.zone(this.W - 60, 42, 60, 36).setInteractive({ useHandCursor: true });
    this.add.text(this.W - 60, 42, 'BACK', {
      fontFamily: 'Courier New', fontSize: '16px', color: '#ffe8be',
    }).setOrigin(0.5);
    closeZone.on('pointerdown', () => {
      AudioManager.playSfx(this, 'ui-click', { volume: 0.9, cooldownMs: 50, allowOverlap: false });
      this.scene.start('MenuScene');
    });
  }

  private drawPreviewPanel(): void {
    const px = 60, py = 100, pw = 260, ph = 540;
    const bg = this.add.graphics();
    bg.fillStyle(0x1a0c11, 0.95);
    bg.fillRoundedRect(px, py, pw, ph, 10);
    bg.lineStyle(2, 0xc8a364, 0.8);
    bg.strokeRoundedRect(px, py, pw, ph, 10);

    this.add.text(px + pw / 2, py + 24, 'PREVIEW', {
      fontFamily: 'Courier New', fontSize: '18px', color: '#f0cf98', letterSpacing: 2,
    }).setOrigin(0.5);

    this.add.graphics().fillStyle(0xc8a364, 0.4).fillRect(px + 20, py + 42, pw - 40, 1);

    // Placeholder — sprite added in refreshPreview
    generatePlayerTexture(this, 'wardrobe-preview', this.previewPalette);
    this.previewSprite = this.add.sprite(px + pw / 2, py + ph / 2 + 20, 'wardrobe-preview', 1);
    this.previewSprite.setScale(5);

    // Equipped summary
    this.add.text(px + pw / 2, py + ph - 30, 'Currently equipped', {
      fontFamily: 'Courier New', fontSize: '13px', color: '#a08060',
    }).setOrigin(0.5);
  }

  private drawItemPanel(): void {
    const px = this.itemPanelX, py = this.itemPanelY, pw = this.itemPanelW, ph = this.itemPanelH;
    const bg = this.add.graphics();
    bg.fillStyle(0x1a0c11, 0.95);
    bg.fillRoundedRect(px, py, pw, ph, 10);
    bg.lineStyle(2, 0xc8a364, 0.8);
    bg.strokeRoundedRect(px, py, pw, ph, 10);

    const viewportFrame = this.add.graphics();
    viewportFrame.lineStyle(1, 0x5a3a2a, 0.45);
    viewportFrame.strokeRoundedRect(this.itemViewportX - 6, this.itemViewportY - 6, this.itemViewportW + 12, this.itemViewportH + 12, 8);

    this.itemGridContainer = this.add.container(0, 0);
    const maskGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillRect(this.itemViewportX, this.itemViewportY, this.itemViewportW, this.itemViewportH);
    this.itemGridContainer.setMask(maskGraphics.createGeometryMask());

    this.itemViewportZone = this.add.zone(
      this.itemViewportX + this.itemViewportW / 2,
      this.itemViewportY + this.itemViewportH / 2,
      this.itemViewportW,
      this.itemViewportH,
    );
    // Scene-level wheel listener scoped to the viewport bounds — avoids the
    // interactive zone blocking pointerdown from reaching item cards beneath it.
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, _targets: unknown, _dx: number, dy: number) => {
      if (
        pointer.x >= this.itemViewportX &&
        pointer.x <= this.itemViewportX + this.itemViewportW &&
        pointer.y >= this.itemViewportY &&
        pointer.y <= this.itemViewportY + this.itemViewportH
      ) {
        this.adjustScroll(dy);
      }
    });

    this.itemScrollTrack = this.add.graphics();
    this.itemScrollThumb = this.add.graphics();

    this.drawTabs(px, py, pw);
    this.drawItemGrid(px, py);
  }

  private drawTabs(panelX: number, panelY: number, panelW: number): void {
    const tabs: Tab[] = ['figure', 'hair', 'outfit', 'accessory'];
    const labels = ['FIGURE', 'HAIR', 'OUTFIT', 'ACCESSORY'];
    const tabW = Math.floor(panelW / 4);

    tabs.forEach((tab, i) => {
      const tx = panelX + i * tabW;
      const ty = panelY;
      const container = this.add.container(0, 0);

      const f = this.add.graphics();
      container.add(f);

      const label = this.add.text(tx + tabW / 2, ty + 28, labels[i], {
        fontFamily: 'Courier New', fontSize: '15px', color: '#f0cf98', letterSpacing: 1,
      }).setOrigin(0.5);
      container.add(label);

      const zone = this.add.zone(tx + tabW / 2, ty + 28, tabW, 48).setInteractive({ useHandCursor: true });
      container.add(zone);

      const redraw = (active: boolean, locked: boolean) => {
        f.clear();
        if (locked) {
          f.fillStyle(0x120a0d, 0.7);
        } else {
          f.fillStyle(active ? 0x4d1f2f : 0x1a0c11, active ? 0.95 : 0.5);
        }
        f.fillRect(tx, ty, tabW, 48);
        f.lineStyle(2, locked ? 0x3e2a2f : active ? 0xd4b27b : 0x5a3a2a, locked ? 0.8 : active ? 1 : 0.5);
        f.strokeRect(tx, ty, tabW, 48);
        label.setColor(locked ? '#5d4a4f' : active ? '#ffd8a2' : '#a08060');
        zone.input && (zone.input.cursor = locked ? 'not-allowed' : 'pointer');
      };

      redraw(tab === this.activeTab, this.isTabLocked(tab));
      this.tabButtons.set(tab, container);

      zone.on('pointerdown', () => {
        if (this.isTabLocked(tab)) return;
        if (this.activeTab === tab) return;
        AudioManager.playSfx(this, 'ui-click', { volume: 0.7, cooldownMs: 50, allowOverlap: false });
        this.activeTab = tab;
        this.selectedItem = null;
        this.itemScrollOffset = 0;
        this.refreshTabs(panelX, panelY, tabW);
        this.rebuildItemGrid();
        this.updateActionButton();
      });
    });
  }

  private drawItemGrid(panelX: number, panelY: number): void {
    this.itemCards = [];
    let items = WARDROBE_CATALOG.filter(i => i.category === this.activeTab);

    // For figure tab, prepend the free default "Street Gambler"
    if (this.activeTab === 'figure') {
      const defaultFigure: WardrobeItem = {
        id: 'figure-gambler',
        name: 'Street Gambler',
        category: 'figure',
        price: 0,
        description: 'Where it all started.',
        palette: { characterId: 'gambler' },
      };
      items = [defaultFigure, ...items];
    }

    const cardW = 160, cardH = 180, cols = 3;
    const startX = panelX + 30;
    const startY = panelY + 68;

    items.forEach((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = startX + col * (cardW + 20);
      const cy = startY + row * (cardH + 16);
      const card = this.createItemCard(item, cx, cy, cardW, cardH);
      this.itemCards.push(card);
      this.itemGridContainer.add(card);
    });

    const rows = Math.max(1, Math.ceil(items.length / cols));
    this.itemContentHeight = rows * cardH + Math.max(0, rows - 1) * 16;
    this.applyScrollPosition();
    this.redrawScrollBar();
  }

  private createItemCard(item: WardrobeItem, x: number, y: number, w: number, h: number): GameObjects.Container {
    const container = this.add.container(0, 0);
    const owned = item.id === 'figure-gambler' ? true : isOwned(item.id);
    const equipped = item.category === 'figure'
      ? getEquipped().figure === item.id
      : getEquipped()[item.category] === item.id;
    const selected = this.selectedItem?.id === item.id;
    const canAfford = item.price === 0 || getGold() >= item.price;

    const bg = this.add.graphics();
    container.add(bg);

    const redraw = (sel: boolean) => {
      bg.clear();
      const borderColor = equipped ? 0xe0a242 : sel ? 0xd4b27b : owned ? 0x6a9a6a : canAfford ? 0x5a4a3a : 0x3a2a2a;
      bg.fillStyle(sel ? 0x3a1c12 : 0x221014, 1);
      bg.fillRoundedRect(x, y, w, h, 8);
      bg.lineStyle(2, borderColor, 1);
      bg.strokeRoundedRect(x, y, w, h, 8);
      if (equipped) {
        bg.fillStyle(0xe0a242, 0.15);
        bg.fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 6);
      }
    };
    redraw(selected);

    // Color swatch
    const swatchG = this.add.graphics();
    if (item.category === 'figure') {
      // Draw a mini character silhouette swatch
      swatchG.fillStyle(0x1a1a2a);
      swatchG.fillRoundedRect(x + w / 2 - 24, y + 10, 48, 44, 4);
      swatchG.lineStyle(1, 0x4a4a6a);
      swatchG.strokeRoundedRect(x + w / 2 - 24, y + 10, 48, 44, 4);
      // Primary color dot for this character
      const charColors: Record<string, number> = {
        'gambler':     0x616770,
        'high-roller': 0xe0a242,
        'card-shark':  0x3a7a34,
        'dealer':      0x1c1c22,
        'outlaw':      0x6a4a28,
      };
      const charId = item.palette.characterId ?? 'gambler';
      const dotColor = charColors[charId] ?? 0x5a5a5a;
      swatchG.fillStyle(dotColor);
      swatchG.fillCircle(x + w / 2, y + 32, 14);
    } else if (item.palette.goldChain) {
      swatchG.fillStyle(0xe0a242);
      swatchG.fillRect(x + w / 2 - 20, y + 20, 40, 8);
      swatchG.fillStyle(0xffd878);
      swatchG.fillRect(x + w / 2 - 10, y + 21, 20, 4);
    } else if (item.category === 'hair') {
      const c1 = item.palette.hairDark ?? 0x703c20;
      const c2 = item.palette.hairMid ?? 0x975f33;
      const c3 = item.palette.hairLight ?? 0xb17949;
      swatchG.fillStyle(c1); swatchG.fillRect(x + w / 2 - 20, y + 18, 14, 28);
      swatchG.fillStyle(c2); swatchG.fillRect(x + w / 2 - 6, y + 18, 14, 28);
      swatchG.fillStyle(c3); swatchG.fillRect(x + w / 2 + 8, y + 18, 12, 28);
    } else {
      const c1 = item.palette.shirtDark ?? 0x4a4f56;
      const c2 = item.palette.shirtMid ?? 0x616770;
      const c3 = item.palette.shirtHighlight ?? 0x949da8;
      swatchG.fillStyle(c1); swatchG.fillRect(x + w / 2 - 20, y + 18, 14, 28);
      swatchG.fillStyle(c2); swatchG.fillRect(x + w / 2 - 6, y + 18, 14, 28);
      swatchG.fillStyle(c3); swatchG.fillRect(x + w / 2 + 8, y + 18, 12, 28);
    }
    container.add(swatchG);

    const nameText = this.add.text(x + w / 2, y + 60, item.name, {
      fontFamily: 'Georgia', fontSize: '16px', color: '#ffd8a2', align: 'center',
      wordWrap: { width: w - 16 },
    }).setOrigin(0.5, 0);
    container.add(nameText);

    const descText = this.add.text(x + w / 2, y + 90, item.description, {
      fontFamily: 'Courier New', fontSize: '11px', color: '#a08060', align: 'center',
      wordWrap: { width: w - 20 },
    }).setOrigin(0.5, 0);
    container.add(descText);

    const priceColor = owned ? '#4aaa4a' : canAfford ? '#e0a242' : '#7a5a5a';
    const priceLabel = owned
      ? (equipped ? 'EQUIPPED' : 'OWNED')
      : item.price === 0 ? 'FREE' : `${item.price.toLocaleString()} G`;
    const priceText = this.add.text(x + w / 2, y + h - 24, priceLabel, {
      fontFamily: 'Courier New', fontSize: '14px', color: priceColor, letterSpacing: 1,
    }).setOrigin(0.5);
    container.add(priceText);

    const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    container.add(zone);

    zone.on('pointerover', () => {
      if (this.selectedItem?.id !== item.id) {
        bg.clear();
        const borderColor = equipped ? 0xe0a242 : 0xd4b27b;
        bg.fillStyle(0x3a1c12, 1);
        bg.fillRoundedRect(x, y, w, h, 8);
        bg.lineStyle(2, borderColor, 1);
        bg.strokeRoundedRect(x, y, w, h, 8);
      }
      // For figure items, preview overrides everything with just the characterId
      const previewP: SpritePalette = item.category === 'figure'
        ? { ...item.palette }
        : { ...getPalette(), ...item.palette };
      generatePlayerTexture(this, 'wardrobe-preview', previewP);
      this.previewSprite.setTexture('wardrobe-preview');
    });

    zone.on('pointerout', () => {
      if (this.selectedItem?.id !== item.id) redraw(false);
      generatePlayerTexture(this, 'wardrobe-preview', this.previewPalette);
      this.previewSprite.setTexture('wardrobe-preview');
    });

    zone.on('pointerdown', () => {
      AudioManager.playSfx(this, 'ui-click', { volume: 0.7, cooldownMs: 50, allowOverlap: false });
      this.selectedItem = item;
      // Redraw all cards
      this.rebuildItemGrid();
      this.updateActionButton();
    });

    return container;
  }

  private rebuildItemGrid(): void {
    this.itemCards.forEach(c => c.destroy());
    this.itemCards = [];
    this.itemContentHeight = 0;
    this.drawItemGrid(this.itemPanelX, this.itemPanelY);
  }

  private drawBottomBar(): void {
    const barY = 660;

    const barBg = this.add.graphics();
    barBg.fillStyle(0x1a0c11, 0.95);
    barBg.fillRoundedRect(60, barY, 900, 80, 8);
    barBg.lineStyle(2, 0xc8a364, 0.7);
    barBg.strokeRoundedRect(60, barY, 900, 80, 8);

    this.add.text(90, barY + 28, 'WARDROBE GOLD', {
      fontFamily: 'Courier New', fontSize: '15px', color: '#a08060', letterSpacing: 1,
    });

    this.goldText = this.add.text(90, barY + 50, `${getGold().toLocaleString()} G`, {
      fontFamily: 'Georgia', fontSize: '26px', color: '#e0a242', stroke: '#3a1c12', strokeThickness: 3,
    });

    this.add.text(300, barY + 22, 'Earn gold by completing dungeon floors (20% of your coins).', {
      fontFamily: 'Courier New', fontSize: '12px', color: '#7a6a5a',
    });

    // Action button
    const btnX = 760, btnY = barY + 16, btnW = 180, btnH = 48;
    const btnContainer = this.add.container(0, 0);

    this.actionBtnFrame = this.add.graphics();
    btnContainer.add(this.actionBtnFrame);

    this.actionBtnLabel = this.add.text(btnX + btnW / 2, btnY + btnH / 2, 'SELECT AN ITEM', {
      fontFamily: 'Georgia', fontSize: '18px', color: '#ffe8be',
      stroke: '#2a160f', strokeThickness: 3,
    }).setOrigin(0.5);
    btnContainer.add(this.actionBtnLabel);

    const btnZone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH).setInteractive({ useHandCursor: true });
    btnContainer.add(btnZone);

    btnZone.on('pointerdown', () => this.onActionButton());

    this.actionBtn = btnContainer;
    this.updateActionButton();
  }

  private updateActionButton(): void {
    if (!this.actionBtnFrame || !this.actionBtnLabel) return;

    const btnX = 760, btnY = 660 + 16, btnW = 180, btnH = 48;
    const item = this.selectedItem;
    const gold = getGold();

    this.actionBtnFrame.clear();

    if (!item) {
      this.actionBtnFrame.fillStyle(0x2a1a1a);
      this.actionBtnFrame.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      this.actionBtnFrame.lineStyle(2, 0x4a3a3a);
      this.actionBtnFrame.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
      this.actionBtnLabel.setText('SELECT AN ITEM').setColor('#6a5a5a');
      return;
    }

    if (this.isTabLocked(item.category as Tab)) {
      this.actionBtnFrame.fillStyle(0x1a1416);
      this.actionBtnFrame.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      this.actionBtnFrame.lineStyle(2, 0x4a3a3f);
      this.actionBtnFrame.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
      this.actionBtnLabel.setText('STREET GAMBLER ONLY').setColor('#7b676d');
      return;
    }

    const owned = item.id === 'figure-gambler' ? true : isOwned(item.id);
    const equipped = item.category === 'figure'
      ? getEquipped().figure === item.id
      : getEquipped()[item.category] === item.id;
    const canAfford = item.price === 0 || gold >= item.price;

    if (equipped) {
      this.actionBtnFrame.fillStyle(0x3a2510);
      this.actionBtnFrame.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      this.actionBtnFrame.lineStyle(2, 0xe0a242);
      this.actionBtnFrame.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
      this.actionBtnLabel.setText('UNEQUIP').setColor('#e0a242');
    } else if (owned) {
      this.actionBtnFrame.fillStyle(0x1a3a1a);
      this.actionBtnFrame.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      this.actionBtnFrame.lineStyle(2, 0x4aaa4a);
      this.actionBtnFrame.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
      this.actionBtnLabel.setText('EQUIP').setColor('#4aaa4a');
    } else if (canAfford) {
      this.actionBtnFrame.fillStyle(0x2a1a10);
      this.actionBtnFrame.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      this.actionBtnFrame.lineStyle(2, 0xd4b27b);
      this.actionBtnFrame.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
      this.actionBtnLabel.setText(`BUY ${item.price.toLocaleString()} G`).setColor('#ffd8a2');
    } else {
      this.actionBtnFrame.fillStyle(0x1a1a1a);
      this.actionBtnFrame.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      this.actionBtnFrame.lineStyle(2, 0x4a3a3a);
      this.actionBtnFrame.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
      this.actionBtnLabel.setText(`NEED ${(item.price - gold).toLocaleString()} MORE`).setColor('#6a5a5a');
    }
  }

  private onActionButton(): void {
    const item = this.selectedItem;
    if (!item) return;
    if (this.isTabLocked(item.category as Tab)) return;

    const equipped = item.category === 'figure'
      ? getEquipped().figure === item.id
      : getEquipped()[item.category] === item.id;
    const owned = item.id === 'figure-gambler' ? true : isOwned(item.id);

    if (equipped) {
      unequipCategory(item.category);
      AudioManager.playSfx(this, 'ui-click', { volume: 0.7, cooldownMs: 50, allowOverlap: false });
    } else if (owned) {
      equipItem(item.id);
      AudioManager.playSfx(this, 'ui-click', { volume: 0.9, cooldownMs: 50, allowOverlap: false });
    } else {
      const success = buyItem(item.id);
      if (success) {
        equipItem(item.id);
        AudioManager.playSfx(this, 'wardrobe-buy', { volume: 0.8, cooldownMs: 100, allowOverlap: false });
      } else {
        AudioManager.playSfx(this, 'ui-hover', { volume: 0.3, cooldownMs: 50, allowOverlap: false });
        return;
      }
    }

    // Refresh palette, preview, UI
    this.previewPalette = { ...getPalette() };
    if (item.category === 'figure' && this.activeTab !== 'figure' && this.isCurrentFigureLocked()) {
      this.activeTab = 'figure';
      this.selectedItem = null;
    }
    this.refreshPlayerTexture();
    generatePlayerTexture(this, 'wardrobe-preview', this.previewPalette);
    this.previewSprite.setTexture('wardrobe-preview');
    this.goldText.setText(`${getGold().toLocaleString()} G`);
    this.refreshTabs(this.itemPanelX, this.itemPanelY, Math.floor(this.itemPanelW / 4));
    this.rebuildItemGrid();
    this.updateActionButton();
  }

  private refreshPreview(): void {
    this.previewPalette = { ...getPalette() };
    this.refreshPlayerTexture();
    generatePlayerTexture(this, 'wardrobe-preview', this.previewPalette);
    this.previewSprite.setTexture('wardrobe-preview');
  }

  private isCurrentFigureLocked(): boolean {
    const figure = getEquipped().figure ?? 'figure-gambler';
    return figure !== 'figure-gambler';
  }

  private isTabLocked(tab: Tab): boolean {
    return tab !== 'figure' && this.isCurrentFigureLocked();
  }

  private refreshTabs(panelX: number, panelY: number, tabW: number): void {
    const tabs: Tab[] = ['figure', 'hair', 'outfit', 'accessory'];
    this.tabButtons.forEach((container, tab) => {
      const graphics = container.list[0] as GameObjects.Graphics;
      const label = container.list[1] as GameObjects.Text;
      const zone = container.list[2] as GameObjects.Zone;
      const isActive = tab === this.activeTab;
      const isLocked = this.isTabLocked(tab);
      const tabIndex = tabs.indexOf(tab);
      const x = panelX + tabIndex * tabW;

      graphics.clear();
      if (isLocked) {
        graphics.fillStyle(0x120a0d, 0.7);
      } else {
        graphics.fillStyle(isActive ? 0x4d1f2f : 0x1a0c11, isActive ? 0.95 : 0.5);
      }
      graphics.fillRect(x, panelY, tabW, 48);
      graphics.lineStyle(2, isLocked ? 0x3e2a2f : isActive ? 0xd4b27b : 0x5a3a2a, isLocked ? 0.8 : isActive ? 1 : 0.5);
      graphics.strokeRect(x, panelY, tabW, 48);
      label.setColor(isLocked ? '#5d4a4f' : isActive ? '#ffd8a2' : '#a08060');
      if (zone.input) zone.input.cursor = isLocked ? 'not-allowed' : 'pointer';
    });
  }

  private refreshPlayerTexture(): void {
    syncPlayerPresentation(this, getPalette());
  }

  private adjustScroll(deltaY: number): void {
    if (this.itemContentHeight <= this.itemViewportH) return;
    const direction = deltaY === 0 ? 0 : deltaY > 0 ? 1 : -1;
    this.itemScrollOffset += direction * this.itemScrollStep;
    this.applyScrollPosition();
    this.redrawScrollBar();
  }

  private applyScrollPosition(): void {
    const maxOffset = Math.max(0, this.itemContentHeight - this.itemViewportH);
    this.itemScrollOffset = Phaser.Math.Clamp(this.itemScrollOffset, 0, maxOffset);
    if (this.itemGridContainer) {
      this.itemGridContainer.y = -this.itemScrollOffset;
    }
  }

  private redrawScrollBar(): void {
    if (!this.itemScrollTrack || !this.itemScrollThumb) return;

    const trackX = this.itemPanelX + this.itemPanelW - 20;
    const trackY = this.itemViewportY;
    const trackH = this.itemViewportH;

    this.itemScrollTrack.clear();
    this.itemScrollThumb.clear();

    this.itemScrollTrack.fillStyle(0x120a0d, 0.9);
    this.itemScrollTrack.fillRoundedRect(trackX, trackY, 8, trackH, 4);
    this.itemScrollTrack.lineStyle(1, 0x5a3a2a, 0.8);
    this.itemScrollTrack.strokeRoundedRect(trackX, trackY, 8, trackH, 4);

    if (this.itemContentHeight <= this.itemViewportH) {
      this.itemScrollThumb.fillStyle(0x3a2a2a, 0.8);
      this.itemScrollThumb.fillRoundedRect(trackX + 1, trackY + 1, 6, trackH - 2, 3);
      return;
    }

    const maxOffset = this.itemContentHeight - this.itemViewportH;
    const thumbH = Math.max(48, Math.round((this.itemViewportH / this.itemContentHeight) * trackH));
    const thumbTravel = trackH - thumbH;
    const thumbY = trackY + Math.round((this.itemScrollOffset / maxOffset) * thumbTravel);

    this.itemScrollThumb.fillStyle(0xd4b27b, 0.95);
    this.itemScrollThumb.fillRoundedRect(trackX + 1, thumbY, 6, thumbH, 3);
    this.itemScrollThumb.lineStyle(1, 0xf0cf98, 0.9);
    this.itemScrollThumb.strokeRoundedRect(trackX + 1, thumbY, 6, thumbH, 3);
  }
}
