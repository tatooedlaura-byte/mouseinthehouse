import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Cat } from '../entities/Cat';
import { Crumb } from '../entities/Crumb';
import { Thread } from '../entities/Thread';
import { HidingZone } from '../entities/HidingZone';
import { HUD } from '../ui/HUD';
import { SaveSystem } from '../systems/SaveSystem';

// Fixed spawn positions for Pantry
const PLAYER_SPAWN = { x: 750, y: 500 };
const CAT_SPAWN = { x: 300, y: 540 };
const CRUMB_POSITIONS = [
  // Floor level
  { x: 100, y: 550 },
  { x: 300, y: 550 },
  { x: 500, y: 550 },
  // Lower platforms
  { x: 120, y: 470 },
  { x: 650, y: 470 },
  // Mid platforms
  { x: 250, y: 390 },
  { x: 550, y: 390 },
  // Upper platforms
  { x: 400, y: 310 },
  { x: 150, y: 230 },
  // Top shelf
  { x: 600, y: 150 },
];
const THREAD_POSITIONS = [
  // Lower level
  { x: 180, y: 470 },
  // Mid level
  { x: 450, y: 390 },
  // Upper level
  { x: 300, y: 310 },
  // Top shelf (reward)
  { x: 550, y: 150 },
  { x: 650, y: 150 },
];

// Risky bonus spawn positions (near cat routes, exposed on floor)
const RISKY_POSITIONS = [
  { x: 350, y: 550 },  // Center floor - cat patrol area
  { x: 550, y: 550 },  // Right floor - exposed
  { x: 300, y: 400 },  // Mid platform - visible from below
];

// Pantry-specific patrol routes (different from kitchen)
const PANTRY_PATROL_ROUTES = [
  // Route 1: Left side focus
  [
    { x: 100, y: 540 },
    { x: 250, y: 540 },
    { x: 400, y: 540 },
    { x: 200, y: 540 },
  ],
  // Route 2: Center patrol
  [
    { x: 200, y: 540 },
    { x: 400, y: 540 },
    { x: 550, y: 540 },
    { x: 350, y: 540 },
  ],
  // Route 3: Wide sweep
  [
    { x: 100, y: 540 },
    { x: 350, y: 540 },
    { x: 600, y: 540 },
    { x: 400, y: 540 },
    { x: 150, y: 540 },
  ],
  // Route 4: Right side focus
  [
    { x: 400, y: 540 },
    { x: 550, y: 540 },
    { x: 700, y: 540 },
    { x: 500, y: 540 },
  ],
];

export class PantryScene extends Phaser.Scene {
  private player!: Player;
  private cat!: Cat;
  private hud!: HUD;
  private crumbs: Phaser.Physics.Arcade.StaticGroup | null = null;
  private threads: Phaser.Physics.Arcade.StaticGroup | null = null;
  private hidingZones: HidingZone[] = [];
  private floor!: Phaser.Physics.Arcade.StaticGroup;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private nestEntrance!: Phaser.GameObjects.Rectangle;

  private crumbCount = 0;
  private threadCount = 0;
  private currentHidingZone: HidingZone | null = null;
  private caughtOverlay: Phaser.GameObjects.Container | null = null;
  private caughtSubtext: Phaser.GameObjects.Text | null = null;
  private isShowingCaught = false;
  private isInvincible = false;
  private hasBed = false;

  // Human footsteps sweep hazard
  private sweepTimer: Phaser.Time.TimerEvent | null = null;
  private sweepWarningTimer: Phaser.Time.TimerEvent | null = null;
  private sweepDangerZone: Phaser.GameObjects.Rectangle | null = null;
  private sweepWarningText: Phaser.GameObjects.Text | null = null;
  private isSweepActive = false;

  // Bonus spawn tracking
  private bonusSpawns: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'PantryScene' });
  }

  init(data: { crumbs?: number; thread?: number; hasBed?: boolean }): void {
    const saveData = SaveSystem.load();
    this.crumbCount = data.crumbs ?? saveData.crumbs;
    this.threadCount = data.thread ?? saveData.thread;
    this.hasBed = data.hasBed ?? false;

    // Reset state
    this.isShowingCaught = false;
    this.isInvincible = false;
    this.currentHidingZone = null;
    this.hidingZones = [];
    this.crumbs = null;
    this.threads = null;
    this.caughtOverlay = null;
    this.isSweepActive = false;
    this.bonusSpawns = [];
  }

  shutdown(): void {
    if (this.input.keyboard) {
      this.input.keyboard.removeAllKeys(true);
    }

    if (this.sweepTimer) {
      this.sweepTimer.remove();
      this.sweepTimer = null;
    }
    if (this.sweepWarningTimer) {
      this.sweepWarningTimer.remove();
      this.sweepWarningTimer = null;
    }

    if (this.crumbs) {
      this.crumbs.clear(true, true);
      this.crumbs = null;
    }
    if (this.threads) {
      this.threads.clear(true, true);
      this.threads = null;
    }
    if (this.floor) {
      this.floor.clear(true, true);
    }
    if (this.platforms) {
      this.platforms.clear(true, true);
    }
    this.hidingZones = [];
    this.bonusSpawns.forEach(spawn => spawn.destroy());
    this.bonusSpawns = [];
  }

  create(): void {
    // Background - darker pantry color
    this.add.rectangle(400, 300, 800, 600, 0x1e1e2e);

    // Floor pattern - wooden planks style
    this.createFloorPattern();

    // Create floor
    this.floor = this.physics.add.staticGroup();
    const floorRect = this.add.rectangle(400, 580, 800, 40, 0x3a3a4a);
    this.floor.add(floorRect);

    // Create platforms - vertical progression (80px jumps are comfortable)
    this.platforms = this.physics.add.staticGroup();

    // Lower tier (y=480) - easy to reach from floor
    this.createPlatform(120, 480, 120, 16, 'Crate');
    this.createPlatform(650, 480, 100, 16, 'Box');

    // Mid tier (y=400) - reachable from lower
    this.createPlatform(280, 400, 140, 16, 'Shelf');
    this.createPlatform(520, 400, 120, 16, 'Shelf');

    // Upper tier (y=320) - reachable from mid
    this.createPlatform(400, 320, 160, 16, 'Cupboard');
    this.createPlatform(150, 320, 100, 16, 'Cabinet');

    // High tier (y=240) - reachable from upper
    this.createPlatform(280, 240, 120, 16, 'Top Shelf');
    this.createPlatform(550, 240, 140, 16, 'Top Shelf');

    // Top shelf (y=160) - highest reward area
    this.createPlatform(600, 160, 180, 16, 'Pantry Top');

    // Create nest entrance (right side for this room)
    this.nestEntrance = this.add.rectangle(750, 520, 60, 100, 0x3d2817, 0.9);
    this.nestEntrance.setStrokeStyle(3, 0x8b7355);
    this.physics.add.existing(this.nestEntrance, true);

    this.add.text(750, 460, 'NEST [E]', {
      fontSize: '12px',
      color: '#8b7355',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Create hiding zones
    this.createHidingZones();

    // Spawn pickups
    this.spawnCrumbs();
    this.spawnThreads();
    this.spawnBonusPickup();

    // Create player
    this.player = new Player(this, PLAYER_SPAWN.x, PLAYER_SPAWN.y);
    this.resetPlayer();

    // Setup camera to follow player vertically
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(400, 150); // Wide horizontal, narrow vertical deadzone
    this.cameras.main.setBounds(0, 0, 800, 600);

    // Create cat with pantry-specific routes
    this.cat = new Cat(this, CAT_SPAWN.x, CAT_SPAWN.y);
    this.cat.setPatrolRoutes(PANTRY_PATROL_ROUTES);
    this.resetCat();

    // Setup collisions
    this.physics.add.collider(this.player, this.floor);
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.cat, this.floor);

    // Crumb collection
    if (this.crumbs) {
      this.physics.add.overlap(
        this.player,
        this.crumbs,
        (_player, crumb) => {
          (crumb as Crumb).destroy();
          this.crumbCount++;
          this.hud.updateCrumbs(this.crumbCount);
          SaveSystem.save({ crumbs: this.crumbCount, thread: this.threadCount });
        }
      );
    }

    // Thread collection
    if (this.threads) {
      this.physics.add.overlap(
        this.player,
        this.threads,
        (_player, thread) => {
          (thread as Thread).destroy();
          this.threadCount++;
          this.hud.updateThread(this.threadCount);
          SaveSystem.save({ crumbs: this.crumbCount, thread: this.threadCount });
        }
      );
    }

    // Cat collision
    this.physics.add.overlap(
      this.player,
      this.cat,
      () => this.handleCatCollision()
    );

    // Create HUD
    this.hud = new HUD(this, 'THE PANTRY (Danger!)');
    this.hud.updateCrumbs(this.crumbCount);
    this.hud.updateThread(this.threadCount);
    this.hud.showCatState(true);

    // Create caught overlay
    this.createCaughtOverlay();

    // Show trip started toast
    this.showTripStartedToast();

    // Schedule sweeps
    this.scheduleNextSweep();
  }

  private spawnCrumbs(): void {
    if (this.crumbs) {
      this.crumbs.clear(true, true);
    }
    this.crumbs = this.physics.add.staticGroup();
    CRUMB_POSITIONS.forEach(pos => {
      const crumb = new Crumb(this, pos.x, pos.y);
      this.add.existing(crumb);
      this.crumbs!.add(crumb);
    });
  }

  private spawnThreads(): void {
    if (this.threads) {
      this.threads.clear(true, true);
    }
    this.threads = this.physics.add.staticGroup();
    THREAD_POSITIONS.forEach(pos => {
      const thread = new Thread(this, pos.x, pos.y);
      this.add.existing(thread);
      this.threads!.add(thread);
    });
  }

  private spawnBonusPickup(): void {
    // Clear any existing bonus spawns
    this.bonusSpawns.forEach(spawn => spawn.destroy());
    this.bonusSpawns = [];

    // Pick a random risky position
    const pos = RISKY_POSITIONS[Math.floor(Math.random() * RISKY_POSITIONS.length)];

    // 50/50 chance: thread or crumbs
    const isThreadBonus = Math.random() < 0.5;

    if (isThreadBonus) {
      // Spawn 1 bonus thread
      const thread = new Thread(this, pos.x, pos.y);
      this.add.existing(thread);
      this.threads!.add(thread);
      thread.setTint(0xffccff); // Pink tint for bonus
      this.addBonusPulse(thread);
      this.bonusSpawns.push(thread);
    } else {
      // Spawn 2-3 bonus crumbs
      const count = Phaser.Math.Between(2, 3);
      for (let i = 0; i < count; i++) {
        const offsetX = (i - 1) * 20;
        const crumb = new Crumb(this, pos.x + offsetX, pos.y);
        this.add.existing(crumb);
        this.crumbs!.add(crumb);
        crumb.setTint(0xffff88); // Yellow tint for bonus
        this.addBonusPulse(crumb);
        this.bonusSpawns.push(crumb);
      }
    }
  }

  private addBonusPulse(sprite: Phaser.GameObjects.Image): void {
    this.tweens.add({
      targets: sprite,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private resetCat(): void {
    this.cat.setPosition(CAT_SPAWN.x, CAT_SPAWN.y);
    this.cat.setVelocity(0, 0);
    this.cat.resetPatrol();
  }

  private resetPlayer(): void {
    this.player.setPosition(PLAYER_SPAWN.x, PLAYER_SPAWN.y);
    this.player.setVelocity(0, 0);
    this.player.setHidden(false);
    this.player.setAlpha(1);
    this.player.setActive(true);
  }

  private showTripStartedToast(): void {
    const toast = this.add.text(400, 100, 'Entered the Pantry!', {
      fontSize: '24px',
      color: '#00ff00',
      backgroundColor: '#000000',
      padding: { x: 16, y: 10 },
    }).setOrigin(0.5).setDepth(300);

    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: toast.y - 30,
      duration: 1000,
      delay: 1500,
      onComplete: () => toast.destroy(),
    });

    if (this.hasBed) {
      this.showRestBonusToast();
    }
  }

  private showRestBonusToast(): void {
    const toast = this.add.text(400, 140, 'Rested in bed — feeling safer.', {
      fontSize: '18px',
      color: '#88ccff',
      backgroundColor: '#000000',
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setDepth(300);

    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: toast.y - 30,
      duration: 1000,
      delay: 2000,
      onComplete: () => toast.destroy(),
    });
  }

  private createFloorPattern(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x2a2a3a, 0.5);
    // Horizontal wood plank lines
    for (let y = 560; y < 600; y += 10) {
      graphics.lineBetween(0, y, 800, y);
    }
    // Vertical separators
    for (let x = 0; x < 800; x += 80) {
      graphics.lineBetween(x, 560, x, 600);
    }
  }

  private createPlatform(x: number, y: number, width: number, height: number, label?: string): void {
    const platform = this.add.rectangle(x, y, width, height, 0x5a4a3a);
    platform.setStrokeStyle(2, 0x6a5a4a);
    this.platforms.add(platform);

    // Add shelf bracket visuals (only for platforms not at very top)
    if (y > 200) {
      const bracketLeft = this.add.rectangle(x - width/2 + 8, y + 12, 6, 16, 0x4a3a2a);
      const bracketRight = this.add.rectangle(x + width/2 - 8, y + 12, 6, 16, 0x4a3a2a);
      bracketLeft.setStrokeStyle(1, 0x5a4a3a);
      bracketRight.setStrokeStyle(1, 0x5a4a3a);
    }

    // Optional label
    if (label) {
      this.add.text(x, y - 12, label, {
        fontSize: '8px',
        color: '#666666',
      }).setOrigin(0.5);
    }
  }

  private createHidingZones(): void {
    // Hiding zone 1: Floor level - cardboard box
    const zone1 = new HidingZone(this, 200, 530, 80, 60);
    // Hiding zone 2: Floor level - crate
    const zone2 = new HidingZone(this, 450, 530, 90, 60);
    // Hiding zone 3: Upper platform - jar/container
    const zone3 = new HidingZone(this, 400, 290, 60, 40);

    this.hidingZones = [zone1, zone2, zone3];

    // Box visual (floor)
    this.add.rectangle(200, 510, 70, 50, 0x8b6914).setStrokeStyle(2, 0x6b4914);
    this.add.text(200, 480, 'Box', { fontSize: '10px', color: '#888888' }).setOrigin(0.5);

    // Crate visual (floor)
    this.add.rectangle(450, 510, 80, 50, 0x5c4033).setStrokeStyle(2, 0x3d2817);
    this.add.text(450, 480, 'Crate', { fontSize: '10px', color: '#888888' }).setOrigin(0.5);

    // Jar visual (upper platform at y=320)
    this.add.rectangle(400, 300, 40, 35, 0x4a6a8a).setStrokeStyle(2, 0x3a5a7a);
    this.add.text(400, 275, 'Jar', { fontSize: '10px', color: '#888888' }).setOrigin(0.5);
  }

  private createCaughtOverlay(): void {
    this.caughtOverlay = this.add.container(400, 300);
    this.caughtOverlay.setDepth(200);

    const bg = this.add.rectangle(0, 0, 400, 200, 0x000000, 0.9);
    const text = this.add.text(0, -30, 'CAUGHT!', {
      fontSize: '48px',
      color: '#ff0000',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.caughtSubtext = this.add.text(0, 30, '', {
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.caughtOverlay.add([bg, text, this.caughtSubtext]);
    this.caughtOverlay.setVisible(false);
  }

  private handleCatCollision(): void {
    if (this.isShowingCaught || this.player.isHidden || this.isInvincible) return;
    if (this.cat.state !== 'chase') return;
    this.showCaughtSequence();
  }

  private showCaughtSequence(): void {
    this.isShowingCaught = true;
    this.player.setVelocity(0, 0);
    this.player.setActive(false);

    const lossText = this.hasBed ? 'Lost 25% of crumbs (bed bonus!)' : 'Lost half your crumbs!';
    this.caughtSubtext?.setText(lossText);
    this.caughtOverlay?.setVisible(true);

    const lossRate = this.hasBed ? 0.25 : 0.5;
    const lostCrumbs = Math.floor(this.crumbCount * lossRate);
    this.crumbCount -= lostCrumbs;
    SaveSystem.save({ crumbs: this.crumbCount, thread: this.threadCount });

    this.time.delayedCall(2000, () => {
      this.caughtOverlay?.setVisible(false);
      this.isShowingCaught = false;

      this.resetPlayer();
      this.cat.setPosition(200, 540);
      this.cat.state = 'patrol';

      this.isInvincible = true;
      this.player.setAlpha(0.5);
      this.time.delayedCall(2000, () => {
        this.isInvincible = false;
        this.player.setAlpha(1);
      });

      this.hud.updateCrumbs(this.crumbCount);
    });
  }

  update(_time: number, delta: number): void {
    if (this.isShowingCaught) return;

    this.player.update(delta);
    this.cat.update(this.player, delta);

    this.hud.updateCatState(this.cat.getStateDisplay());
    this.hud.updateHidden(this.player.isHidden);

    this.handleHidingZones();
    this.handleNestEntrance();
  }

  private handleHidingZones(): void {
    let inAnyZone = false;
    let overlappingZone: HidingZone | null = null;

    for (const zone of this.hidingZones) {
      const zoneBody = zone.body as Phaser.Physics.Arcade.StaticBody;
      const playerBounds = this.player.getBounds();
      const zoneBounds = new Phaser.Geom.Rectangle(
        zoneBody.x, zoneBody.y, zoneBody.width, zoneBody.height
      );

      if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, zoneBounds)) {
        inAnyZone = true;
        overlappingZone = zone;
        break;
      }
    }

    if (this.player.interactJustPressed && inAnyZone && overlappingZone) {
      if (this.player.isHidden) {
        this.player.setHidden(false);
        this.currentHidingZone?.setZoneActive(false);
        this.currentHidingZone = null;
      } else {
        this.player.setHidden(true);
        this.currentHidingZone = overlappingZone;
        overlappingZone.setZoneActive(true);
      }
    }

    if (this.player.isHidden && !inAnyZone) {
      this.player.setHidden(false);
      this.currentHidingZone?.setZoneActive(false);
      this.currentHidingZone = null;
    }
  }

  private handleNestEntrance(): void {
    if (!this.player.interactJustPressed) return;

    const nestBody = this.nestEntrance.body as Phaser.Physics.Arcade.StaticBody;
    const playerBounds = this.player.getBounds();
    const nestBounds = new Phaser.Geom.Rectangle(
      nestBody.x, nestBody.y, nestBody.width, nestBody.height
    );

    if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, nestBounds)) {
      this.scene.start('NestScene', { crumbs: this.crumbCount, thread: this.threadCount });
    }
  }

  // Human footsteps sweep hazard
  private scheduleNextSweep(): void {
    const delay = Phaser.Math.Between(20000, 35000);

    if (this.sweepTimer) {
      this.sweepTimer.remove();
    }

    this.sweepTimer = this.time.delayedCall(delay, () => {
      this.triggerSweepWarning();
    });
  }

  private triggerSweepWarning(): void {
    this.cameras.main.shake(200, 0.003);

    this.sweepWarningText = this.add.text(400, 80, 'THUMP... THUMP...', {
      fontSize: '28px',
      color: '#ff4444',
      fontStyle: 'bold',
      backgroundColor: '#000000',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(250);

    const floorWarning = this.add.rectangle(400, 560, 800, 60, 0xff0000, 0.3);
    floorWarning.setDepth(50);

    this.tweens.add({
      targets: [floorWarning, this.sweepWarningText],
      alpha: 0.5,
      duration: 200,
      yoyo: true,
      repeat: 3,
    });

    this.sweepWarningTimer = this.time.delayedCall(1500, () => {
      floorWarning.destroy();
      this.sweepWarningText?.destroy();
      this.triggerSweep();
    });
  }

  private triggerSweep(): void {
    this.isSweepActive = true;

    this.sweepDangerZone = this.add.rectangle(400, 550, 800, 80, 0xff0000, 0.4);
    this.sweepDangerZone.setDepth(55);

    this.cameras.main.shake(300, 0.008);

    const sweepText = this.add.text(400, 300, 'FOOTSTEPS!', {
      fontSize: '36px',
      color: '#ff0000',
      fontStyle: 'bold',
      backgroundColor: '#000000',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setDepth(260);

    this.tweens.add({
      targets: sweepText,
      alpha: 0,
      y: 280,
      duration: 800,
      onComplete: () => sweepText.destroy(),
    });

    const sweepCheckInterval = this.time.addEvent({
      delay: 50,
      repeat: 19,
      callback: () => {
        this.checkSweepHit();
      },
    });

    this.time.delayedCall(1000, () => {
      this.isSweepActive = false;
      this.sweepDangerZone?.destroy();
      this.sweepDangerZone = null;
      sweepCheckInterval.remove();
      this.scheduleNextSweep();
    });
  }

  private checkSweepHit(): void {
    if (!this.isSweepActive || this.isShowingCaught || this.isInvincible) return;
    if (this.player.isHidden) return;

    const playerY = this.player.y;
    const playerX = this.player.x;

    if (playerY >= 500 && playerY <= 600 && playerX >= 0 && playerX <= 800) {
      this.showCaughtSequence();
    }
  }
}
