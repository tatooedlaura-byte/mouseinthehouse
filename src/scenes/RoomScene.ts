import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Cat } from '../entities/Cat';
import { Crumb } from '../entities/Crumb';
import { Thread } from '../entities/Thread';
import { HidingZone } from '../entities/HidingZone';
import { HUD } from '../ui/HUD';
import { SaveSystem } from '../systems/SaveSystem';

// Fixed spawn positions
const PLAYER_SPAWN = { x: 80, y: 500 };
const CAT_SPAWN = { x: 400, y: 540 };
const CRUMB_POSITIONS = [
  { x: 150, y: 550 },
  { x: 250, y: 550 },
  { x: 350, y: 550 },
  { x: 450, y: 550 },
  { x: 550, y: 550 },
  { x: 650, y: 550 },
  { x: 200, y: 430 },
  { x: 500, y: 360 },
];
const THREAD_POSITIONS = [
  { x: 700, y: 460 },
  { x: 130, y: 430 },
  { x: 580, y: 360 },
  { x: 300, y: 550 },
];

export class RoomScene extends Phaser.Scene {
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

  constructor() {
    super({ key: 'RoomScene' });
  }

  init(data: { crumbs?: number; thread?: number; hasBed?: boolean }): void {
    // Load resource counts from data or localStorage
    const saveData = SaveSystem.load();
    this.crumbCount = data.crumbs ?? saveData.crumbs;
    this.threadCount = data.thread ?? saveData.thread;

    // Check for bed rest bonus
    this.hasBed = data.hasBed ?? false;

    // Reset all state for fresh trip
    this.isShowingCaught = false;
    this.isInvincible = false;
    this.currentHidingZone = null;
    this.hidingZones = [];
    this.crumbs = null;
    this.threads = null;
    this.caughtOverlay = null;
    this.isSweepActive = false;
  }

  shutdown(): void {
    // Clean up ALL input keys to prevent accumulation
    if (this.input.keyboard) {
      this.input.keyboard.removeAllKeys(true);
    }

    // Clean up sweep timers
    if (this.sweepTimer) {
      this.sweepTimer.remove();
      this.sweepTimer = null;
    }
    if (this.sweepWarningTimer) {
      this.sweepWarningTimer.remove();
      this.sweepWarningTimer = null;
    }

    // Clean up physics groups
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
  }

  create(): void {
    // Background - kitchen/room
    this.add.rectangle(400, 300, 800, 600, 0x2d2d44);

    // Floor tiles pattern
    this.createFloorPattern();

    // Create floor
    this.floor = this.physics.add.staticGroup();
    const floorRect = this.add.rectangle(400, 580, 800, 40, 0x4a4a6a);
    this.floor.add(floorRect);

    // Create platforms
    this.platforms = this.physics.add.staticGroup();
    this.createPlatform(200, 450, 150, 20);
    this.createPlatform(500, 380, 180, 20);
    this.createPlatform(700, 480, 120, 20);

    // Create nest entrance
    this.nestEntrance = this.add.rectangle(50, 520, 60, 100, 0x3d2817, 0.9);
    this.nestEntrance.setStrokeStyle(3, 0x8b7355);
    this.physics.add.existing(this.nestEntrance, true);

    this.add.text(50, 460, 'NEST [E]', {
      fontSize: '12px',
      color: '#8b7355',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Create hiding zones
    this.createHidingZones();

    // Spawn pickups (fresh each trip)
    this.spawnCrumbs();
    this.spawnThreads();

    // Create and reset player
    this.player = new Player(this, PLAYER_SPAWN.x, PLAYER_SPAWN.y);
    this.resetPlayer();

    // Create and reset cat
    this.cat = new Cat(this, CAT_SPAWN.x, CAT_SPAWN.y);
    this.resetCat();

    // Setup collisions
    this.physics.add.collider(this.player, this.floor);
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.cat, this.floor);

    // Crumb collection overlap
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

    // Thread collection overlap
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

    // Cat catches player overlap
    this.physics.add.overlap(
      this.player,
      this.cat,
      () => this.handleCatCollision()
    );

    // Create HUD
    this.hud = new HUD(this, 'THE ROOM (Danger!)');
    this.hud.updateCrumbs(this.crumbCount);
    this.hud.updateThread(this.threadCount);
    this.hud.showCatState(true);

    // Create caught overlay
    this.createCaughtOverlay();

    // Show trip started toast
    this.showTripStartedToast();

    // Schedule first human footsteps sweep
    this.scheduleNextSweep();
  }

  // ============ Helper Methods ============

  private spawnCrumbs(): void {
    // Clear existing crumbs if any
    if (this.crumbs) {
      this.crumbs.clear(true, true);
    }

    // Create fresh crumb group
    this.crumbs = this.physics.add.staticGroup();

    // Spawn crumbs at fixed positions
    CRUMB_POSITIONS.forEach(pos => {
      const crumb = new Crumb(this, pos.x, pos.y);
      this.add.existing(crumb);
      this.crumbs!.add(crumb);
    });
  }

  private spawnThreads(): void {
    // Clear existing threads if any
    if (this.threads) {
      this.threads.clear(true, true);
    }

    // Create fresh thread group
    this.threads = this.physics.add.staticGroup();

    // Spawn threads at fixed positions
    THREAD_POSITIONS.forEach(pos => {
      const thread = new Thread(this, pos.x, pos.y);
      this.add.existing(thread);
      this.threads!.add(thread);
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
    const toast = this.add.text(400, 100, 'Trip started!', {
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

    // Show bed rest bonus toast if applicable
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

  // ============ Scene Setup Methods ============

  private createFloorPattern(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x3a3a5a, 0.5);
    for (let x = 0; x < 800; x += 50) {
      graphics.lineBetween(x, 560, x, 600);
    }
    for (let y = 560; y < 600; y += 25) {
      graphics.lineBetween(0, y, 800, y);
    }
  }

  private createPlatform(x: number, y: number, width: number, height: number): void {
    const platform = this.add.rectangle(x, y, width, height, 0x5a5a7a);
    platform.setStrokeStyle(2, 0x6a6a8a);
    this.platforms.add(platform);
  }

  private createHidingZones(): void {
    const zone1 = new HidingZone(this, 300, 530, 80, 60);
    const zone2 = new HidingZone(this, 600, 530, 80, 60);

    this.hidingZones = [zone1, zone2];

    // Furniture visuals
    this.add.rectangle(300, 490, 100, 20, 0x5c4033).setStrokeStyle(2, 0x3d2817);
    this.add.rectangle(600, 490, 100, 20, 0x5c4033).setStrokeStyle(2, 0x3d2817);

    this.add.text(300, 470, 'Table', { fontSize: '10px', color: '#888888' }).setOrigin(0.5);
    this.add.text(600, 470, 'Chair', { fontSize: '10px', color: '#888888' }).setOrigin(0.5);
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

  // ============ Game Logic ============

  private handleCatCollision(): void {
    if (this.isShowingCaught || this.player.isHidden || this.isInvincible) return;
    if (this.cat.state !== 'chase') return;

    this.showCaughtSequence();
  }

  private showCaughtSequence(): void {
    this.isShowingCaught = true;
    this.player.setVelocity(0, 0);
    this.player.setActive(false);

    // Update subtext based on bed rest bonus
    const lossText = this.hasBed ? 'Lost 25% of crumbs (bed bonus!)' : 'Lost half your crumbs!';
    this.caughtSubtext?.setText(lossText);
    this.caughtOverlay?.setVisible(true);

    // Lose crumbs: 25% if bed rest bonus, otherwise 50%
    const lossRate = this.hasBed ? 0.25 : 0.5;
    const lostCrumbs = Math.floor(this.crumbCount * lossRate);
    this.crumbCount -= lostCrumbs;
    SaveSystem.save({ crumbs: this.crumbCount, thread: this.threadCount });

    // Reset after delay
    this.time.delayedCall(2000, () => {
      this.caughtOverlay?.setVisible(false);
      this.isShowingCaught = false;

      // Reset player and cat
      this.resetPlayer();
      this.cat.setPosition(600, 540); // Move cat away
      this.cat.state = 'patrol';

      // Brief invincibility
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

    this.player.update();
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

  // ============ Human Footsteps Sweep Hazard ============

  private scheduleNextSweep(): void {
    // Random delay between 20-35 seconds
    const delay = Phaser.Math.Between(20000, 35000);

    // Clear any existing timer
    if (this.sweepTimer) {
      this.sweepTimer.remove();
    }

    this.sweepTimer = this.time.delayedCall(delay, () => {
      this.triggerSweepWarning();
    });
  }

  private triggerSweepWarning(): void {
    // Show warning 1.5 seconds before sweep
    this.cameras.main.shake(200, 0.003);

    // Create warning text
    this.sweepWarningText = this.add.text(400, 80, 'THUMP... THUMP...', {
      fontSize: '28px',
      color: '#ff4444',
      fontStyle: 'bold',
      backgroundColor: '#000000',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(250);

    // Flash the floor red
    const floorWarning = this.add.rectangle(400, 560, 800, 60, 0xff0000, 0.3);
    floorWarning.setDepth(50);

    // Pulsing animation
    this.tweens.add({
      targets: [floorWarning, this.sweepWarningText],
      alpha: 0.5,
      duration: 200,
      yoyo: true,
      repeat: 3,
    });

    // Schedule the actual sweep after 1.5 seconds
    this.sweepWarningTimer = this.time.delayedCall(1500, () => {
      floorWarning.destroy();
      this.sweepWarningText?.destroy();
      this.triggerSweep();
    });
  }

  private triggerSweep(): void {
    this.isSweepActive = true;

    // Create danger zone along the floor
    this.sweepDangerZone = this.add.rectangle(400, 550, 800, 80, 0xff0000, 0.4);
    this.sweepDangerZone.setDepth(55);

    // Stronger screen shake
    this.cameras.main.shake(300, 0.008);

    // Show "FOOTSTEPS!" text
    const sweepText = this.add.text(400, 300, 'FOOTSTEPS!', {
      fontSize: '36px',
      color: '#ff0000',
      fontStyle: 'bold',
      backgroundColor: '#000000',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setDepth(260);

    // Fade out sweep text
    this.tweens.add({
      targets: sweepText,
      alpha: 0,
      y: 280,
      duration: 800,
      onComplete: () => sweepText.destroy(),
    });

    // Check for player hit during sweep (1 second duration)
    const sweepCheckInterval = this.time.addEvent({
      delay: 50,
      repeat: 19, // 20 checks over 1 second
      callback: () => {
        this.checkSweepHit();
      },
    });

    // End sweep after 1 second
    this.time.delayedCall(1000, () => {
      this.isSweepActive = false;
      this.sweepDangerZone?.destroy();
      this.sweepDangerZone = null;
      sweepCheckInterval.remove();

      // Schedule next sweep
      this.scheduleNextSweep();
    });
  }

  private checkSweepHit(): void {
    if (!this.isSweepActive || this.isShowingCaught || this.isInvincible) return;
    if (this.player.isHidden) return; // Safe if hidden

    // Check if player is in the danger zone (floor level)
    const playerY = this.player.y;
    const playerX = this.player.x;

    // Danger zone is roughly y: 510-590 (floor area)
    if (playerY >= 500 && playerY <= 600 && playerX >= 0 && playerX <= 800) {
      // Player caught by footsteps!
      this.showCaughtSequence();
    }
  }
}
