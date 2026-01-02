import Phaser from 'phaser';
import { Player } from './Player';

export type CatState = 'patrol' | 'chase' | 'alert' | 'searching';

// Multiple patrol routes for variety - spread across room, away from nest door (left side)
const PATROL_ROUTES = [
  // Route 1: Right side patrol (away from nest)
  [
    { x: 450, y: 540 },
    { x: 600, y: 540 },
    { x: 720, y: 540 },
    { x: 550, y: 540 },
  ],
  // Route 2: Center-right sweep
  [
    { x: 350, y: 540 },
    { x: 500, y: 540 },
    { x: 650, y: 540 },
    { x: 500, y: 540 },
  ],
  // Route 3: Full room patrol
  [
    { x: 200, y: 540 },
    { x: 400, y: 540 },
    { x: 600, y: 540 },
    { x: 720, y: 540 },
  ],
  // Route 4: Erratic center
  [
    { x: 300, y: 540 },
    { x: 550, y: 540 },
    { x: 400, y: 540 },
    { x: 650, y: 540 },
    { x: 350, y: 540 },
  ],
  // Route 5: Far right focus
  [
    { x: 500, y: 540 },
    { x: 700, y: 540 },
    { x: 600, y: 540 },
    { x: 720, y: 540 },
  ],
  // Route 6: Wide sweep
  [
    { x: 250, y: 540 },
    { x: 500, y: 540 },
    { x: 700, y: 540 },
    { x: 400, y: 540 },
  ],
];

export class Cat extends Phaser.Physics.Arcade.Sprite {
  private waypoints: Phaser.Math.Vector2[] = [];
  private currentWaypointIndex = 0;
  private waypointDirection = 1; // 1 = forward, -1 = backward
  private normalDirection = 1; // Stored normal direction for double-back

  private readonly BASE_PATROL_SPEED = 80;
  private readonly CHASE_SPEED = 180;
  private readonly DETECTION_RANGE = 160;
  private readonly ALERT_TIME = 1000; // ms before chase starts
  private readonly MAX_CHASE_TIME = 5000; // ms before giving up chase
  private readonly CHASE_COOLDOWN = 2000; // ms after chase before detecting again
  private readonly SEARCH_TIME_MIN = 1000; // min search pause after chase
  private readonly SEARCH_TIME_MAX = 2000; // max search pause after chase

  // Pause state
  private isPaused = false;
  private pauseTimer = 0;
  private pauseDuration = 0;

  // Current patrol speed (with variance)
  private currentPatrolSpeed = 80;

  // Double-back state
  private isDoubleBack = false;

  public state: CatState = 'patrol';
  private alertTimer = 0;
  private chaseTimer = 0;
  private searchTimer = 0;
  private searchDuration = 0;
  private chaseCooldown = 0; // Cooldown timer after chase ends

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Create cat texture if it doesn't exist
    if (!scene.textures.exists('cat')) {
      const graphics = scene.make.graphics({ x: 0, y: 0 });
      // Cat body (orange)
      graphics.fillStyle(0xff8c00, 1);
      graphics.fillRoundedRect(8, 24, 48, 32, 8);
      // Head
      graphics.fillCircle(20, 20, 18);
      // Ears
      graphics.fillTriangle(6, 12, 14, 0, 22, 12);
      graphics.fillTriangle(18, 12, 26, 0, 34, 12);
      // Inner ears
      graphics.fillStyle(0xffc0cb, 1);
      graphics.fillTriangle(10, 12, 14, 4, 18, 12);
      graphics.fillTriangle(22, 12, 26, 4, 30, 12);
      // Eyes
      graphics.fillStyle(0x00ff00, 1);
      graphics.fillCircle(14, 18, 5);
      graphics.fillCircle(26, 18, 5);
      // Pupils
      graphics.fillStyle(0x000000, 1);
      graphics.fillEllipse(14, 18, 2, 6);
      graphics.fillEllipse(26, 18, 2, 6);
      // Nose
      graphics.fillStyle(0xffc0cb, 1);
      graphics.fillTriangle(18, 24, 22, 24, 20, 28);
      // Tail
      graphics.lineStyle(6, 0xff8c00, 1);
      graphics.beginPath();
      graphics.moveTo(56, 40);
      graphics.lineTo(64, 30);
      graphics.lineTo(60, 20);
      graphics.strokePath();
      graphics.generateTexture('cat', 68, 60);
      graphics.destroy();
    }

    super(scene, x, y, 'cat');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setSize(48, 32);
    this.setOffset(10, 24);

    // Disable gravity for cat (patrols on floor)
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    // Choose initial patrol route
    this.choosePatrolRoute();
  }

  // Choose a random patrol route for this trip
  choosePatrolRoute(): void {
    const routeIndex = Math.floor(Math.random() * PATROL_ROUTES.length);
    const route = PATROL_ROUTES[routeIndex];
    this.waypoints = route.map(p => new Phaser.Math.Vector2(p.x, p.y));

    // Start at a random waypoint in the route
    this.currentWaypointIndex = Math.floor(Math.random() * this.waypoints.length);

    // Random initial direction
    this.waypointDirection = Math.random() < 0.5 ? 1 : -1;
    this.normalDirection = this.waypointDirection;

    this.isDoubleBack = false;
    this.isPaused = false;
    this.pauseTimer = 0;
    this.currentPatrolSpeed = this.BASE_PATROL_SPEED * (0.85 + Math.random() * 0.30);
  }

  // Reset cat state for new trip
  resetPatrol(): void {
    this.choosePatrolRoute();
    this.state = 'patrol';
    this.alertTimer = 0;
    this.chaseTimer = 0;
    this.searchTimer = 0;
    this.searchDuration = 0;
    this.chaseCooldown = 0;
  }

  update(player: Player, delta: number): void {
    if (!this.body) return;

    // Update cooldown timer
    if (this.chaseCooldown > 0) {
      this.chaseCooldown -= delta;
    }

    const distanceToPlayer = Phaser.Math.Distance.Between(
      this.x, this.y,
      player.x, player.y
    );

    // Check for direct overlap (bumping into cat) - bypasses cooldown
    const directOverlap = distanceToPlayer < 30;

    // Detection is blocked during cooldown unless direct overlap
    const canDetect = this.chaseCooldown <= 0 || directOverlap;

    // State machine
    switch (this.state) {
      case 'patrol':
        this.handlePatrol(delta);
        // Check for player detection (respects cooldown)
        if (canDetect && !player.isHidden && distanceToPlayer <= this.DETECTION_RANGE) {
          this.state = 'alert';
          this.alertTimer = 0;
          this.chaseCooldown = 0; // Clear cooldown on new detection
          // Cancel any pending double-back
          this.cancelDoubleBack();
        }
        break;

      case 'alert':
        this.setVelocityX(0);
        this.alertTimer += delta;
        // If player leaves range or hides, return to patrol
        if (player.isHidden || distanceToPlayer > this.DETECTION_RANGE) {
          this.state = 'patrol';
          this.startNextWaypoint();
        } else if (this.alertTimer >= this.ALERT_TIME) {
          this.state = 'chase';
          this.chaseTimer = 0;
          // Cancel any pending double-back
          this.cancelDoubleBack();
        }
        break;

      case 'chase':
        this.handleChase(player);
        this.chaseTimer += delta;
        // If player hides or chase times out, enter searching state
        if (player.isHidden || this.chaseTimer >= this.MAX_CHASE_TIME) {
          this.enterSearchingState();
        }
        break;

      case 'searching':
        this.setVelocityX(0);
        this.searchTimer += delta;
        // After search pause, return to patrol with cooldown
        if (this.searchTimer >= this.searchDuration) {
          this.state = 'patrol';
          this.chaseCooldown = this.CHASE_COOLDOWN;
          this.cancelDoubleBack();
          this.startNextWaypoint();
        }
        break;
    }

    // Visual feedback based on state
    this.updateVisuals();
  }

  private enterSearchingState(): void {
    this.state = 'searching';
    this.searchTimer = 0;
    this.searchDuration = Phaser.Math.Between(this.SEARCH_TIME_MIN, this.SEARCH_TIME_MAX);
    this.setVelocityX(0);
  }

  private handlePatrol(delta: number): void {
    if (this.waypoints.length === 0) return;

    // Handle pause state
    if (this.isPaused) {
      this.setVelocityX(0);
      this.pauseTimer += delta;
      if (this.pauseTimer >= this.pauseDuration) {
        this.isPaused = false;
        this.startNextWaypoint();
      }
      return;
    }

    const target = this.waypoints[this.currentWaypointIndex];
    const distanceToWaypoint = Math.abs(this.x - target.x);

    if (distanceToWaypoint < 10) {
      // Reached waypoint
      this.onReachWaypoint();
      return;
    }

    // Move toward current waypoint
    const direction = target.x > this.x ? 1 : -1;
    this.setVelocityX(direction * this.currentPatrolSpeed);
    this.setFlipX(direction < 0);
  }

  private onReachWaypoint(): void {
    this.setVelocityX(0);

    // If we were in double-back mode, restore normal direction
    if (this.isDoubleBack) {
      this.waypointDirection = this.normalDirection;
      this.isDoubleBack = false;
    }

    // Calculate pause duration
    let pause = Phaser.Math.Between(300, 1400);

    // 15% chance of extended "groom pause"
    if (Math.random() < 0.15) {
      pause = Phaser.Math.Between(1800, 3200);
    }

    this.isPaused = true;
    this.pauseTimer = 0;
    this.pauseDuration = pause;

    // Advance waypoint index
    this.advanceWaypointIndex();

    // Check for double-back (10% chance)
    this.tryDoubleBack();
  }

  private advanceWaypointIndex(): void {
    this.currentWaypointIndex += this.waypointDirection;

    // Handle bounds - reverse direction at ends
    if (this.currentWaypointIndex >= this.waypoints.length) {
      this.currentWaypointIndex = this.waypoints.length - 2;
      this.waypointDirection = -1;
      this.normalDirection = -1;
    } else if (this.currentWaypointIndex < 0) {
      this.currentWaypointIndex = 1;
      this.waypointDirection = 1;
      this.normalDirection = 1;
    }

    // Clamp to valid range
    this.currentWaypointIndex = Phaser.Math.Clamp(
      this.currentWaypointIndex,
      0,
      this.waypoints.length - 1
    );
  }

  private tryDoubleBack(): void {
    // Only 10% chance
    if (Math.random() >= 0.10) return;

    // Check if double-back would be valid
    const testIndex = this.currentWaypointIndex - this.waypointDirection;
    if (testIndex < 0 || testIndex >= this.waypoints.length) {
      // Would go out of bounds, skip double-back
      return;
    }

    // Trigger double-back
    this.isDoubleBack = true;
    this.normalDirection = this.waypointDirection;
    this.waypointDirection *= -1;
    this.currentWaypointIndex = testIndex;
  }

  private cancelDoubleBack(): void {
    if (this.isDoubleBack) {
      this.waypointDirection = this.normalDirection;
      this.isDoubleBack = false;
    }
    this.isPaused = false;
    this.pauseTimer = 0;
  }

  private startNextWaypoint(): void {
    // Set randomized speed for this segment
    const speedVariance = 0.85 + Math.random() * 0.30; // 0.85 to 1.15
    this.currentPatrolSpeed = this.BASE_PATROL_SPEED * speedVariance;
  }

  private handleChase(player: Player): void {
    const direction = player.x > this.x ? 1 : -1;
    this.setVelocityX(direction * this.CHASE_SPEED);
    this.setFlipX(direction < 0);
  }

  private updateVisuals(): void {
    switch (this.state) {
      case 'patrol':
        // Slightly dimmed during cooldown
        if (this.chaseCooldown > 0) {
          this.setTint(0xaaaaff); // Bluish tint during cooldown
        } else {
          this.setTint(this.isPaused ? 0xdddddd : 0xffffff);
        }
        break;
      case 'alert':
        this.setTint(0xffff00); // Yellow when alert
        break;
      case 'chase':
        this.setTint(0xff0000); // Red when chasing
        break;
      case 'searching':
        this.setTint(0xff8800); // Orange when searching
        break;
    }
  }

  getStateDisplay(): string {
    switch (this.state) {
      case 'patrol':
        if (this.chaseCooldown > 0) return 'TIRED';
        return this.isPaused ? 'IDLE' : 'PATROL';
      case 'alert': return 'ALERT';
      case 'chase': return 'CHASE';
      case 'searching': return 'SEARCHING';
    }
  }
}
