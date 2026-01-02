import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { HUD } from '../ui/HUD';
import { CraftingMenu } from '../ui/CraftingMenu';
import { PlacementMode } from '../ui/PlacementMode';
import { SaveSystem } from '../systems/SaveSystem';

export class NestScene extends Phaser.Scene {
  private player!: Player;
  private hud!: HUD;
  private craftingMenu!: CraftingMenu;
  private placementMode!: PlacementMode;
  private exitZone!: Phaser.GameObjects.Rectangle;
  private floor!: Phaser.Physics.Arcade.StaticGroup;
  private crumbs = 0;
  private thread = 0;

  private craftKey!: Phaser.Input.Keyboard.Key;
  private placeKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'NestScene' });
  }

  preload(): void {
    // Item sprites can be added later at: public/assets/items/{item}.png
    // Uncomment below when sprites are ready:
    // const items = ['bed', 'lamp', 'table', 'chest', 'bookshelf', 'vase'];
    // items.forEach(item => {
    //   if (!this.textures.exists(`item-${item}`)) {
    //     this.load.image(`item-${item}`, `assets/items/${item}.png`);
    //   }
    // });
  }

  init(data: { crumbs?: number; thread?: number }): void {
    // Load saved resources or use passed data
    const saveData = SaveSystem.load();
    this.crumbs = data.crumbs ?? saveData.crumbs;
    this.thread = data.thread ?? saveData.thread;
  }

  shutdown(): void {
    // Clean up input keys to prevent accumulation
    if (this.input.keyboard) {
      this.input.keyboard.removeAllKeys(true);
    }
    // Clean up UI components
    if (this.craftingMenu) {
      this.craftingMenu.destroy();
    }
    if (this.placementMode) {
      this.placementMode.destroy();
    }
  }

  create(): void {
    // Setup input keys
    if (this.input.keyboard) {
      this.craftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
      this.placeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    }

    // Background - cozy nest interior
    this.add.rectangle(400, 300, 800, 600, 0x3d2817);

    // Add some nest decoration
    this.createNestDecor();

    // Create floor
    this.floor = this.physics.add.staticGroup();
    const floorRect = this.add.rectangle(400, 570, 800, 60, 0x5c4033);
    this.floor.add(floorRect);

    // Create walls
    this.add.rectangle(20, 300, 40, 600, 0x4a3728); // Left wall
    this.add.rectangle(780, 300, 40, 600, 0x4a3728); // Right wall

    // Create exit zone (door to the room)
    this.exitZone = this.add.rectangle(750, 500, 50, 100, 0x1a1a2e, 0.8);
    this.exitZone.setStrokeStyle(3, 0xffd700);
    this.physics.add.existing(this.exitZone, true);

    // Exit label
    this.add.text(750, 440, 'EXIT [E]', {
      fontSize: '14px',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Create player
    this.player = new Player(this, 100, 500);

    // Collisions
    this.physics.add.collider(this.player, this.floor);

    // Create HUD
    this.hud = new HUD(this, 'THE NEST (Safe)');
    this.hud.updateCrumbs(this.crumbs);
    this.hud.updateThread(this.thread);
    this.hud.showCatState(false);

    // Create crafting menu
    this.craftingMenu = new CraftingMenu(
      this,
      () => this.crumbs,
      (value) => {
        this.crumbs = value;
        this.hud.updateCrumbs(this.crumbs);
      },
      () => this.thread,
      (value) => {
        this.thread = value;
        this.hud.updateThread(this.thread);
      }
    );

    // Create placement mode
    this.placementMode = new PlacementMode(this);

    // Instructions
    this.add.text(400, 120, 'Welcome to your cozy nest!', {
      fontSize: '24px',
      color: '#ffd700',
    }).setOrigin(0.5);

    this.add.text(400, 160, 'Arrow keys/WASD: Move | W/Up/Space: Jump | Shift: Sneak', {
      fontSize: '12px',
      color: '#cccccc',
    }).setOrigin(0.5);

    this.add.text(400, 180, 'C: Crafting | P: Placement Mode | E: Interact', {
      fontSize: '12px',
      color: '#88ff88',
    }).setOrigin(0.5);

    this.add.text(400, 210, 'Go through the EXIT to collect crumbs!', {
      fontSize: '14px',
      color: '#ff6666',
    }).setOrigin(0.5);
  }

  private createNestDecor(): void {
    // Straw/nest material
    const graphics = this.add.graphics();
    graphics.fillStyle(0x8b7355, 0.5);
    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(50, 750);
      const y = Phaser.Math.Between(520, 550);
      graphics.fillEllipse(x, y, Phaser.Math.Between(20, 40), 8);
    }

    // Some stored crumbs visualization (decorative)
    if (this.crumbs > 0) {
      this.add.text(100, 520, `Stored: ${this.crumbs} crumbs`, {
        fontSize: '12px',
        color: '#daa520',
      });
    }
  }

  update(): void {
    // Handle menu toggles
    if (Phaser.Input.Keyboard.JustDown(this.craftKey)) {
      if (this.placementMode.getIsActive()) {
        this.placementMode.hide();
      }
      this.craftingMenu.toggle();
    }

    if (Phaser.Input.Keyboard.JustDown(this.placeKey)) {
      if (this.craftingMenu.getIsVisible()) {
        this.craftingMenu.hide();
      }
      this.placementMode.toggle();
    }

    // Update placement mode
    this.placementMode.update();

    // Don't update player if a menu is open
    if (this.craftingMenu.getIsVisible() || this.placementMode.getIsActive()) {
      return;
    }

    this.player.update();

    // Check exit interaction
    if (this.player.interactJustPressed) {
      const exitBody = this.exitZone.body as Phaser.Physics.Arcade.StaticBody;
      const playerBounds = this.player.getBounds();
      const exitBounds = new Phaser.Geom.Rectangle(
        exitBody.x, exitBody.y, exitBody.width, exitBody.height
      );

      if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, exitBounds)) {
        const hasBed = SaveSystem.hasPlacedItem('bed');
        this.scene.start('RoomScene', { crumbs: this.crumbs, thread: this.thread, hasBed });
      }
    }
  }
}
