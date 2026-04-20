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
import { generatePlayerTexture, SpritePalette } from '../ui/playerSprite';
import { AudioManager } from '../audio/AudioManager';

type Tab = 'hair' | 'outfit' | 'accessory';

export class WardrobeScene extends Scene {
  private readonly W = 1024;
  private readonly H = 768;

  private activeTab: Tab = 'hair';
  private selectedItem: WardrobeItem | null = null;
  private previewPalette: SpritePalette = {};
  private previewSprite!: Phaser.GameObjects.Sprite;
  private goldText!: GameObjects.Text;
  private actionBtn!: GameObjects.Container;
  private actionBtnLabel!: GameObjects.Text;
  private actionBtnFrame!: GameObjects.Graphics;
  private itemCards: GameObjects.Container[] = [];
  private tabButtons: Map<Tab, GameObjects.Container> = new Map();

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
    this.previewSprite = this.add.sprite(px + pw / 2, py + ph / 2 + 20, 'wardrobe-preview', 0);
    this.previewSprite.setScale(5).play('player-idle');

    // Equipped summary
    this.add.text(px + pw / 2, py + ph - 30, 'Currently equipped', {
      fontFamily: 'Courier New', fontSize: '13px', color: '#a08060',
    }).setOrigin(0.5);
  }

  private drawItemPanel(): void {
    const px = 360, py = 100, pw = 600, ph = 540;
    const bg = this.add.graphics();
    bg.fillStyle(0x1a0c11, 0.95);
    bg.fillRoundedRect(px, py, pw, ph, 10);
    bg.lineStyle(2, 0xc8a364, 0.8);
    bg.strokeRoundedRect(px, py, pw, ph, 10);

    this.drawTabs(px, py, pw);
    this.drawItemGrid(px, py);
  }

  private drawTabs(panelX: number, panelY: number, panelW: number): void {
    const tabs: Tab[] = ['hair', 'outfit', 'accessory'];
    const labels = ['HAIR', 'OUTFIT', 'ACCESSORY'];
    const tabW = Math.floor(panelW / 3);

    tabs.forEach((tab, i) => {
      const tx = panelX + i * tabW;
      const ty = panelY;
      const container = this.add.container(0, 0);

      const f = this.add.graphics();
      container.add(f);

      const label = this.add.text(tx + tabW / 2, ty + 28, labels[i], {
        fontFamily: 'Courier New', fontSize: '18px', color: '#f0cf98', letterSpacing: 1,
      }).setOrigin(0.5);
      container.add(label);

      const zone = this.add.zone(tx + tabW / 2, ty + 28, tabW, 48).setInteractive({ useHandCursor: true });
      container.add(zone);

      const redraw = (active: boolean) => {
        f.clear();
        f.fillStyle(active ? 0x4d1f2f : 0x1a0c11, active ? 0.95 : 0.5);
        f.fillRect(tx, ty, tabW, 48);
        f.lineStyle(2, active ? 0xd4b27b : 0x5a3a2a, active ? 1 : 0.5);
        f.strokeRect(tx, ty, tabW, 48);
        label.setColor(active ? '#ffd8a2' : '#a08060');
      };

      redraw(tab === this.activeTab);
      this.tabButtons.set(tab, container);

      zone.on('pointerdown', () => {
        if (this.activeTab === tab) return;
        AudioManager.playSfx(this, 'ui-click', { volume: 0.7, cooldownMs: 50, allowOverlap: false });
        this.activeTab = tab;
        this.selectedItem = null;
        this.tabButtons.forEach((c, t) => {
          const tf = c.list[0] as GameObjects.Graphics;
          const tl = c.list[1] as GameObjects.Text;
          const isActive = t === tab;
          tf.clear();
          tf.fillStyle(isActive ? 0x4d1f2f : 0x1a0c11, isActive ? 0.95 : 0.5);
          const tIdx = tabs.indexOf(t);
          tf.fillRect(panelX + tIdx * tabW, panelY, tabW, 48);
          tf.lineStyle(2, isActive ? 0xd4b27b : 0x5a3a2a, isActive ? 1 : 0.5);
          tf.strokeRect(panelX + tIdx * tabW, panelY, tabW, 48);
          tl.setColor(isActive ? '#ffd8a2' : '#a08060');
        });
        this.rebuildItemGrid();
        this.updateActionButton();
      });
    });
  }

  private drawItemGrid(panelX: number, panelY: number): void {
    this.itemCards = [];
    const items = WARDROBE_CATALOG.filter(i => i.category === this.activeTab);
    const cardW = 160, cardH = 180, cols = 3;
    const startX = panelX + 30;
    const startY = panelY + 68;

    items.forEach((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = startX + col * (cardW + 20);
      const cy = startY + row * (cardH + 16);
      this.itemCards.push(this.createItemCard(item, cx, cy, cardW, cardH));
    });
  }

  private createItemCard(item: WardrobeItem, x: number, y: number, w: number, h: number): GameObjects.Container {
    const container = this.add.container(0, 0);
    const owned = isOwned(item.id);
    const equipped = getEquipped()[item.category] === item.id;
    const selected = this.selectedItem?.id === item.id;
    const canAfford = getGold() >= item.price;

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
    if (item.palette.goldChain) {
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
    const priceLabel = owned ? (equipped ? 'EQUIPPED' : 'OWNED') : `${item.price.toLocaleString()} G`;
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
      // Show preview with this item's palette
      const previewP = { ...getPalette(), ...item.palette };
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
    this.drawItemGrid(360, 100);
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

    const owned = isOwned(item.id);
    const equipped = getEquipped()[item.category] === item.id;
    const canAfford = gold >= item.price;

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

    const equipped = getEquipped()[item.category] === item.id;
    const owned = isOwned(item.id);

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
        AudioManager.playSfx(this, 'goal-victory', { volume: 0.4, cooldownMs: 100, allowOverlap: false });
      } else {
        AudioManager.playSfx(this, 'ui-hover', { volume: 0.3, cooldownMs: 50, allowOverlap: false });
        return;
      }
    }

    // Refresh palette, preview, UI
    this.previewPalette = { ...getPalette() };
    generatePlayerTexture(this, 'wardrobe-preview', this.previewPalette);
    this.previewSprite.setTexture('wardrobe-preview');
    this.goldText.setText(`${getGold().toLocaleString()} G`);
    this.rebuildItemGrid();
    this.updateActionButton();
  }

  private refreshPreview(): void {
    this.previewPalette = { ...getPalette() };
    generatePlayerTexture(this, 'wardrobe-preview', this.previewPalette);
    this.previewSprite.setTexture('wardrobe-preview');
  }
}
