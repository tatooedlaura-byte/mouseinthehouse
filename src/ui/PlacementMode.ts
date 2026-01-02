import Phaser from 'phaser';
import { SaveSystem, PlacementData } from '../systems/SaveSystem';
import { RECIPES, Recipe } from './CraftingMenu';

const GRID_COLS = 8;
const GRID_ROWS = 5;
const TILE_SIZE = 32;
const GRID_OFFSET_X = 144;
const GRID_OFFSET_Y = 280;

// Layer depths
const DEPTH_GLOW = 3;
const DEPTH_ITEMS = 5;
const DEPTH_GRID = 6;
const DEPTH_GHOST = 10;
const DEPTH_UI = 100;

export class PlacementMode {
  private scene: Phaser.Scene;
  private isActive = false;

  // Display layers
  private glowLayer: Phaser.GameObjects.Container;
  private itemLayer: Phaser.GameObjects.Container;

  private gridGraphics: Phaser.GameObjects.Graphics;
  private ghostSprite: Phaser.GameObjects.Sprite | null = null;
  private ghostOutline: Phaser.GameObjects.Rectangle;
  private ghostLabel: Phaser.GameObjects.Text;
  private selectedItemIndex = 0;
  private availableItems: Recipe[] = [];
  private cursorX = 0;
  private cursorY = 0;

  private modeText: Phaser.GameObjects.Text;
  private placingText: Phaser.GameObjects.Text;
  private instructionText: Phaser.GameObjects.Text;

  private arrowKeys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private tabKey!: Phaser.Input.Keyboard.Key;
  private placeKey!: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Setup input
    if (scene.input.keyboard) {
      this.arrowKeys = scene.input.keyboard.createCursorKeys();
      this.tabKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
      this.placeKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    }

    // Create display layers with proper depth ordering
    this.glowLayer = scene.add.container(0, 0);
    this.glowLayer.setDepth(DEPTH_GLOW);

    this.itemLayer = scene.add.container(0, 0);
    this.itemLayer.setDepth(DEPTH_ITEMS);

    // Create grid graphics
    this.gridGraphics = scene.add.graphics();
    this.gridGraphics.setDepth(DEPTH_GRID);
    this.gridGraphics.setVisible(false);

    // Create ghost outline (for showing valid/invalid placement)
    this.ghostOutline = scene.add.rectangle(0, 0, TILE_SIZE - 2, TILE_SIZE - 2, 0x000000, 0);
    this.ghostOutline.setStrokeStyle(2, 0x00ff00);
    this.ghostOutline.setDepth(DEPTH_GHOST + 1);
    this.ghostOutline.setVisible(false);

    // Ghost label for item name
    this.ghostLabel = scene.add.text(0, 0, '', {
      fontSize: '8px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.ghostLabel.setDepth(DEPTH_GHOST + 2);
    this.ghostLabel.setVisible(false);

    // Mode indicator text
    this.modeText = scene.add.text(400, 240, 'PLACEMENT MODE', {
      fontSize: '18px',
      color: '#00ff00',
      fontStyle: 'bold',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5);
    this.modeText.setDepth(DEPTH_UI);
    this.modeText.setVisible(false);

    // "Placing: X" text
    this.placingText = scene.add.text(400, 265, '', {
      fontSize: '14px',
      color: '#ffd700',
      backgroundColor: '#000000',
      padding: { x: 8, y: 3 },
    }).setOrigin(0.5);
    this.placingText.setDepth(DEPTH_UI);
    this.placingText.setVisible(false);

    // Instruction text
    this.instructionText = scene.add.text(400, 455, 'Arrows: Move | Tab: Cycle Item | E: Place | P: Exit', {
      fontSize: '11px',
      color: '#aaaaaa',
      backgroundColor: '#000000',
      padding: { x: 8, y: 3 },
    }).setOrigin(0.5);
    this.instructionText.setDepth(DEPTH_UI);
    this.instructionText.setVisible(false);

    // Load and render existing placements (including glows)
    this.loadPlacements();
  }

  private drawGrid(): void {
    this.gridGraphics.clear();

    // Faint grid lines
    this.gridGraphics.lineStyle(1, 0x6b8e6b, 0.3);

    // Vertical lines
    for (let x = 0; x <= GRID_COLS; x++) {
      const px = GRID_OFFSET_X + x * TILE_SIZE;
      this.gridGraphics.lineBetween(px, GRID_OFFSET_Y, px, GRID_OFFSET_Y + GRID_ROWS * TILE_SIZE);
    }

    // Horizontal lines
    for (let y = 0; y <= GRID_ROWS; y++) {
      const py = GRID_OFFSET_Y + y * TILE_SIZE;
      this.gridGraphics.lineBetween(GRID_OFFSET_X, py, GRID_OFFSET_X + GRID_COLS * TILE_SIZE, py);
    }

    // Grid boundary
    this.gridGraphics.lineStyle(2, 0x6b8e6b, 0.6);
    this.gridGraphics.strokeRect(
      GRID_OFFSET_X,
      GRID_OFFSET_Y,
      GRID_COLS * TILE_SIZE,
      GRID_ROWS * TILE_SIZE
    );
  }

  private loadPlacements(): void {
    const placements = SaveSystem.getPlacements();
    placements.forEach(p => this.renderPlacedItem(p));
  }

  private gridToWorld(gx: number, gy: number): { x: number; y: number } {
    return {
      x: GRID_OFFSET_X + gx * TILE_SIZE + TILE_SIZE / 2,
      y: GRID_OFFSET_Y + gy * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  private addLampGlow(worldX: number, worldY: number): void {
    // Create soft glow using multiple circles with decreasing alpha
    const glowContainer = this.scene.add.container(worldX, worldY);

    // Outer glow layers (larger, more transparent)
    const glowLayers = [
      { radius: 60, alpha: 0.05, color: 0xffd700 },
      { radius: 48, alpha: 0.08, color: 0xffd700 },
      { radius: 36, alpha: 0.12, color: 0xffec80 },
      { radius: 24, alpha: 0.18, color: 0xffec80 },
      { radius: 14, alpha: 0.25, color: 0xffffaa },
    ];

    glowLayers.forEach(layer => {
      const glow = this.scene.add.circle(0, 0, layer.radius, layer.color, layer.alpha);
      glowContainer.add(glow);
    });

    // Add a subtle pulsing animation
    this.scene.tweens.add({
      targets: glowContainer,
      scaleX: 1.1,
      scaleY: 1.1,
      alpha: 0.8,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.glowLayer.add(glowContainer);
  }

  private renderPlacedItem(placement: PlacementData): void {
    const recipe = RECIPES.find(r => r.id === placement.id);
    if (!recipe) return;

    // Calculate position - for multi-tile items, offset to center on footprint
    const offsetX = (recipe.width - 1) * TILE_SIZE / 2;
    const { x: px, y: py } = this.gridToWorld(placement.gx, placement.gy);
    const centerX = px + offsetX;
    // Bottom of tile for bottom-aligned sprites
    const bottomY = py + TILE_SIZE / 2;

    // If it's a lamp, add glow first (behind the item)
    if (placement.id === 'lamp') {
      this.addLampGlow(centerX, py);
    }

    const textureName = `item-${recipe.id}`;

    // Check if sprite texture exists
    if (this.scene.textures.exists(textureName)) {
      const sprite = this.scene.add.sprite(centerX, bottomY, textureName);
      sprite.setOrigin(0.5, 1); // Bottom-center aligned
      sprite.setScale(2); // Scale 2x for pixel art
      this.itemLayer.add(sprite);
    } else {
      // Fallback to colored rectangle for items without sprites
      const container = this.scene.add.container(centerX, py);
      const rect = this.scene.add.rectangle(0, 0, TILE_SIZE - 4, TILE_SIZE - 4, recipe.color);
      rect.setStrokeStyle(1, 0x000000);
      container.add(rect);
      const label = this.scene.add.text(0, 0, recipe.name, {
        fontSize: '8px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add(label);
      this.itemLayer.add(container);
    }
  }

  private updateAvailableItems(): void {
    this.availableItems = RECIPES.filter(r => SaveSystem.getItemCount(r.id) > 0);
    if (this.selectedItemIndex >= this.availableItems.length) {
      this.selectedItemIndex = 0;
    }
  }

  private updateGhostPreview(): void {
    if (this.availableItems.length === 0) return;

    const selected = this.availableItems[this.selectedItemIndex];
    const textureName = `item-${selected.id}`;

    // Calculate position - for multi-tile items, offset to center on footprint
    const offsetX = (selected.width - 1) * TILE_SIZE / 2;
    const { x: px, y: py } = this.gridToWorld(this.cursorX, this.cursorY);
    const centerX = px + offsetX;
    // Bottom of tile for bottom-aligned sprites
    const bottomY = py + TILE_SIZE / 2;

    // Check if sprite texture exists
    const hasTexture = this.scene.textures.exists(textureName);

    // Create or update ghost sprite
    if (hasTexture) {
      const targetWidth = selected.width * TILE_SIZE;
      const targetHeight = selected.height * TILE_SIZE;

      if (!this.ghostSprite || this.ghostSprite.texture.key !== textureName) {
        if (this.ghostSprite) {
          this.ghostSprite.destroy();
        }
        this.ghostSprite = this.scene.add.sprite(centerX, bottomY, textureName);
        this.ghostSprite.setOrigin(0.5, 1); // Bottom-center aligned
        this.ghostSprite.setDisplaySize(targetWidth, targetHeight);
        this.ghostSprite.setDepth(DEPTH_GHOST);
        this.ghostSprite.setAlpha(0.6);
      } else {
        this.ghostSprite.setPosition(centerX, bottomY);
        this.ghostSprite.setDisplaySize(targetWidth, targetHeight);
      }
      this.ghostSprite.setVisible(true);
    } else {
      // No texture, hide ghost sprite
      if (this.ghostSprite) {
        this.ghostSprite.setVisible(false);
      }
    }

    // Update outline size for multi-tile items
    const outlineWidth = selected.width * TILE_SIZE - 2;
    const outlineHeight = selected.height * TILE_SIZE - 2;
    this.ghostOutline.setSize(outlineWidth, outlineHeight);
    this.ghostOutline.setPosition(centerX, py);
    this.ghostOutline.setVisible(true);

    // Update label position
    this.ghostLabel.setPosition(centerX, py + TILE_SIZE / 2 + 8);
    this.ghostLabel.setText(selected.name);

    // Check if any cell in the footprint is occupied
    let occupied = false;
    for (let dx = 0; dx < selected.width; dx++) {
      for (let dy = 0; dy < selected.height; dy++) {
        if (SaveSystem.isGridOccupied(this.cursorX + dx, this.cursorY + dy)) {
          occupied = true;
          break;
        }
      }
      if (occupied) break;
    }

    // Check if footprint fits within grid
    if (this.cursorX + selected.width > GRID_COLS || this.cursorY + selected.height > GRID_ROWS) {
      occupied = true;
    }

    this.ghostOutline.setStrokeStyle(2, occupied ? 0xff0000 : 0x00ff00);

    // Update placing text with stock count
    const stock = SaveSystem.getItemCount(selected.id);
    this.placingText.setText(`Placing: ${selected.name} (${stock} in stock)`);
  }

  private showToast(message: string): void {
    const toast = this.scene.add.text(400, 500, message, {
      fontSize: '16px',
      color: '#00ff00',
      backgroundColor: '#000000',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(200);

    this.scene.tweens.add({
      targets: toast,
      alpha: 0,
      y: toast.y - 30,
      duration: 1000,
      delay: 500,
      onComplete: () => toast.destroy(),
    });
  }

  toggle(): boolean {
    this.updateAvailableItems();

    if (this.availableItems.length === 0) {
      const msg = this.scene.add.text(400, 300, 'No items crafted yet!\nPress C to craft.', {
        fontSize: '18px',
        color: '#ff6666',
        backgroundColor: '#000000',
        padding: { x: 12, y: 8 },
        align: 'center',
      }).setOrigin(0.5).setDepth(200);

      this.scene.time.delayedCall(1500, () => msg.destroy());
      return false;
    }

    this.isActive = !this.isActive;

    this.gridGraphics.setVisible(this.isActive);
    this.ghostOutline.setVisible(this.isActive);
    this.ghostLabel.setVisible(this.isActive);
    if (this.ghostSprite) this.ghostSprite.setVisible(this.isActive);
    this.modeText.setVisible(this.isActive);
    this.placingText.setVisible(this.isActive);
    this.instructionText.setVisible(this.isActive);

    if (this.isActive) {
      this.drawGrid();
      this.updateGhostPreview();
    }

    return this.isActive;
  }

  update(): void {
    if (!this.isActive) return;

    // Arrow key movement
    if (Phaser.Input.Keyboard.JustDown(this.arrowKeys.left)) {
      this.cursorX = Math.max(0, this.cursorX - 1);
      this.updateGhostPreview();
    }
    if (Phaser.Input.Keyboard.JustDown(this.arrowKeys.right)) {
      this.cursorX = Math.min(GRID_COLS - 1, this.cursorX + 1);
      this.updateGhostPreview();
    }
    if (Phaser.Input.Keyboard.JustDown(this.arrowKeys.up)) {
      this.cursorY = Math.max(0, this.cursorY - 1);
      this.updateGhostPreview();
    }
    if (Phaser.Input.Keyboard.JustDown(this.arrowKeys.down)) {
      this.cursorY = Math.min(GRID_ROWS - 1, this.cursorY + 1);
      this.updateGhostPreview();
    }

    // Tab to cycle items
    if (Phaser.Input.Keyboard.JustDown(this.tabKey)) {
      if (this.availableItems.length > 1) {
        this.selectedItemIndex = (this.selectedItemIndex + 1) % this.availableItems.length;
        this.updateGhostPreview();
      }
    }

    // E to place
    if (Phaser.Input.Keyboard.JustDown(this.placeKey)) {
      this.placeItem();
    }
  }

  private placeItem(): void {
    if (this.availableItems.length === 0) return;

    const selected = this.availableItems[this.selectedItemIndex];

    // Check if footprint fits within grid
    if (this.cursorX + selected.width > GRID_COLS || this.cursorY + selected.height > GRID_ROWS) {
      this.scene.cameras.main.shake(100, 0.005);
      return;
    }

    // Check if any cell in the footprint is occupied
    for (let dx = 0; dx < selected.width; dx++) {
      for (let dy = 0; dy < selected.height; dy++) {
        if (SaveSystem.isGridOccupied(this.cursorX + dx, this.cursorY + dy)) {
          this.scene.cameras.main.shake(100, 0.005);
          return;
        }
      }
    }

    if (!SaveSystem.removeItem(selected.id)) {
      this.scene.cameras.main.shake(100, 0.005);
      return;
    }

    const placement: PlacementData = {
      id: selected.id,
      gx: this.cursorX,
      gy: this.cursorY,
    };

    SaveSystem.addPlacement(placement);
    this.renderPlacedItem(placement);

    const remaining = SaveSystem.getItemCount(selected.id);
    this.showToast(`Placed ${selected.name} (${remaining} left)`);

    this.updateAvailableItems();

    if (this.availableItems.length === 0) {
      this.showToast('No more items to place!');
      this.hide();
      return;
    }

    this.updateGhostPreview();
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  hide(): void {
    this.isActive = false;
    this.gridGraphics.setVisible(false);
    this.ghostOutline.setVisible(false);
    this.ghostLabel.setVisible(false);
    if (this.ghostSprite) this.ghostSprite.setVisible(false);
    this.modeText.setVisible(false);
    this.placingText.setVisible(false);
    this.instructionText.setVisible(false);
  }

  destroy(): void {
    this.glowLayer.destroy();
    this.itemLayer.destroy();
    this.gridGraphics.destroy();
    this.ghostOutline.destroy();
    this.ghostLabel.destroy();
    if (this.ghostSprite) this.ghostSprite.destroy();
    this.modeText.destroy();
    this.placingText.destroy();
    this.instructionText.destroy();
  }
}
