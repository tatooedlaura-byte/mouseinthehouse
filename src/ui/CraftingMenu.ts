import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem';

export interface RecipeCost {
  crumbs: number;
  thread: number;
}

export interface Recipe {
  id: string;
  name: string;
  cost: RecipeCost;
  color: number;
  width: number; // Width in grid tiles
  height: number; // Height in grid tiles
}

export const RECIPES: Recipe[] = [
  { id: 'bed', name: 'BED', cost: { crumbs: 8, thread: 2 }, color: 0x8b4513, width: 2, height: 1 },
  { id: 'lamp', name: 'LAMP', cost: { crumbs: 10, thread: 1 }, color: 0xffd700, width: 1, height: 1 },
  { id: 'table', name: 'TABLE', cost: { crumbs: 12, thread: 0 }, color: 0x654321, width: 1, height: 1 },
  { id: 'chest', name: 'CHEST', cost: { crumbs: 20, thread: 0 }, color: 0xcd7f32, width: 1, height: 1 },
  { id: 'bookshelf', name: 'BOOKSHELF', cost: { crumbs: 8, thread: 0 }, color: 0x8b4513, width: 1, height: 1 },
  { id: 'vase', name: 'VASE', cost: { crumbs: 6, thread: 0 }, color: 0x4682b4, width: 1, height: 1 },
];

interface ButtonData {
  recipe: Recipe;
  craftBtn: Phaser.GameObjects.Text;
  bg: Phaser.GameObjects.Rectangle;
  zone: Phaser.GameObjects.Zone;
}

export class CraftingMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private isVisible = false;
  private resourcesText!: Phaser.GameObjects.Text;
  private buttonData: ButtonData[] = [];
  private getCrumbs: () => number;
  private setCrumbs: (value: number) => void;
  private getThread: () => number;
  private setThread: (value: number) => void;

  constructor(
    scene: Phaser.Scene,
    getCrumbs: () => number,
    setCrumbs: (value: number) => void,
    getThread: () => number,
    setThread: (value: number) => void
  ) {
    this.scene = scene;
    this.getCrumbs = getCrumbs;
    this.setCrumbs = setCrumbs;
    this.getThread = getThread;
    this.setThread = setThread;

    // Create container for menu (centered on screen)
    this.container = scene.add.container(400, 300);
    this.container.setDepth(150);
    this.container.setVisible(false);

    // Background panel (sized for 6 recipes)
    const bg = scene.add.rectangle(0, 0, 300, 420, 0x000000, 0.9);
    bg.setStrokeStyle(3, 0xffd700);
    this.container.add(bg);

    // Title
    const title = scene.add.text(0, -180, 'CRAFTING', {
      fontSize: '24px',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(title);

    // Resources display
    this.resourcesText = scene.add.text(0, -145, '', {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.container.add(this.resourcesText);
    this.updateResourcesDisplay();

    // Create recipe buttons
    RECIPES.forEach((recipe, index) => {
      this.createRecipeButton(recipe, index);
    });

    // Close instruction
    const closeText = scene.add.text(0, 185, 'Press C to close | Click to craft', {
      fontSize: '12px',
      color: '#888888',
    }).setOrigin(0.5);
    this.container.add(closeText);
  }

  private updateResourcesDisplay(): void {
    this.resourcesText.setText(`Crumbs: ${this.getCrumbs()}  |  Thread: ${this.getThread()}`);
  }

  private canAfford(recipe: Recipe): boolean {
    return this.getCrumbs() >= recipe.cost.crumbs && this.getThread() >= recipe.cost.thread;
  }

  private formatCost(recipe: Recipe): string {
    const parts: string[] = [];
    if (recipe.cost.crumbs > 0) parts.push(`${recipe.cost.crumbs} crumbs`);
    if (recipe.cost.thread > 0) parts.push(`${recipe.cost.thread} thread`);
    return parts.join(', ') || 'Free';
  }

  private createRecipeButton(recipe: Recipe, index: number): void {
    // Local Y position relative to container center
    const y = -105 + index * 55;

    // Button background (local coords)
    const bg = this.scene.add.rectangle(0, y, 250, 50, 0x333333);
    bg.setStrokeStyle(2, 0x666666);
    this.container.add(bg);

    // Item color preview
    const preview = this.scene.add.rectangle(-100, y, 30, 30, recipe.color);
    this.container.add(preview);

    // Recipe name and cost
    const nameText = this.scene.add.text(-60, y - 10, recipe.name, {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.container.add(nameText);

    const costText = this.scene.add.text(-60, y + 10, `Cost: ${this.formatCost(recipe)}`, {
      fontSize: '11px',
      color: '#aaaaaa',
    });
    this.container.add(costText);

    // Craft button label
    const craftBtn = this.scene.add.text(80, y, 'CRAFT', {
      fontSize: '14px',
      color: '#000000',
      backgroundColor: '#00ff00',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5);
    this.container.add(craftBtn);

    // Interactive zone (world coords since zones aren't in container)
    const zone = this.scene.add.zone(400, 300 + y, 250, 50);
    zone.setDepth(160);
    zone.setVisible(false); // Start hidden
    zone.disableInteractive(); // Start disabled

    zone.on('pointerover', () => {
      if (zone.input?.enabled) {
        bg.setFillStyle(0x555555);
      }
    });

    zone.on('pointerout', () => {
      bg.setFillStyle(0x333333);
    });

    zone.on('pointerdown', () => {
      this.handleCraft(recipe);
    });

    // Store references
    this.buttonData.push({ recipe, craftBtn, bg, zone });
  }

  private handleCraft(recipe: Recipe): void {
    if (!this.canAfford(recipe)) return;

    // Deduct both resources
    const newCrumbs = this.getCrumbs() - recipe.cost.crumbs;
    const newThread = this.getThread() - recipe.cost.thread;
    this.setCrumbs(newCrumbs);
    this.setThread(newThread);
    SaveSystem.save({ crumbs: newCrumbs, thread: newThread });
    SaveSystem.addItem(recipe.id);

    // Show feedback
    const count = SaveSystem.getItemCount(recipe.id);
    this.showToast(`Crafted ${recipe.name}! (${count} in stock)`);
    this.updateButtons();
  }

  private showToast(message: string): void {
    const toast = this.scene.add.text(400, 200, message, {
      fontSize: '18px',
      color: '#00ff00',
      backgroundColor: '#000000',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(200);

    this.scene.tweens.add({
      targets: toast,
      alpha: 0,
      y: toast.y - 30,
      duration: 800,
      delay: 400,
      onComplete: () => toast.destroy(),
    });
  }

  private updateButtons(): void {
    this.updateResourcesDisplay();

    this.buttonData.forEach(data => {
      const { recipe, craftBtn, bg, zone } = data;
      const stock = SaveSystem.getItemCount(recipe.id);
      const affordable = this.canAfford(recipe);

      if (affordable) {
        craftBtn.setText(stock > 0 ? `CRAFT (${stock})` : 'CRAFT');
        craftBtn.setBackgroundColor('#00ff00');
        craftBtn.setColor('#000000');
        bg.setFillStyle(0x333333);
        zone.setInteractive({ useHandCursor: true });
      } else {
        craftBtn.setText(stock > 0 ? `(${stock} owned)` : 'CRAFT');
        craftBtn.setBackgroundColor(stock > 0 ? '#666666' : '#ff0000');
        craftBtn.setColor('#ffffff');
        bg.setFillStyle(0x222222);
        zone.disableInteractive();
      }
    });
  }

  toggle(): void {
    this.isVisible = !this.isVisible;
    this.container.setVisible(this.isVisible);

    // Toggle zone visibility and interactivity
    if (this.isVisible) {
      this.buttonData.forEach(data => {
        data.zone.setVisible(true);
      });
      this.updateButtons();
    } else {
      this.buttonData.forEach(data => {
        data.zone.setVisible(false);
        data.zone.disableInteractive();
      });
    }
  }

  hide(): void {
    this.isVisible = false;
    this.container.setVisible(false);
    this.buttonData.forEach(data => {
      data.zone.setVisible(false);
      data.zone.disableInteractive();
    });
  }

  getIsVisible(): boolean {
    return this.isVisible;
  }

  destroy(): void {
    // Clean up zones (they're not in the container)
    this.buttonData.forEach(data => {
      data.zone.destroy();
    });
    this.buttonData = [];
    this.container.destroy();
  }
}
