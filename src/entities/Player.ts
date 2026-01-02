import Phaser from 'phaser';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;

  private readonly WALK_SPEED = 200;
  private readonly SNEAK_SPEED = 80;
  private readonly JUMP_VELOCITY = -400;

  public isHidden = false;
  public interactJustPressed = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Create texture if it doesn't exist
    if (!scene.textures.exists('player')) {
      const graphics = scene.make.graphics({ x: 0, y: 0 });
      // Mouse body (gray oval)
      graphics.fillStyle(0x8b7355, 1);
      graphics.fillEllipse(16, 20, 28, 24);
      // Ears
      graphics.fillStyle(0xd4a574, 1);
      graphics.fillCircle(6, 8, 6);
      graphics.fillCircle(26, 8, 6);
      // Eyes
      graphics.fillStyle(0x000000, 1);
      graphics.fillCircle(10, 16, 3);
      graphics.fillCircle(22, 16, 3);
      // Nose
      graphics.fillStyle(0xffc0cb, 1);
      graphics.fillCircle(16, 22, 3);
      // Tail
      graphics.lineStyle(3, 0xd4a574, 1);
      graphics.beginPath();
      graphics.moveTo(16, 32);
      graphics.lineTo(16, 40);
      graphics.strokePath();
      graphics.generateTexture('player', 32, 44);
      graphics.destroy();
    }

    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setBounce(0);
    this.setSize(24, 32);
    this.setOffset(4, 8);

    // Setup input
    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.wasd = {
        W: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.shiftKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
      this.interactKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      this.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }
  }

  update(): void {
    if (!this.body) return;

    const body = this.body as Phaser.Physics.Arcade.Body;
    const onFloor = body.blocked.down || body.touching.down;

    // Check sneak
    const isSneaking = this.shiftKey.isDown;
    const speed = isSneaking ? this.SNEAK_SPEED : this.WALK_SPEED;

    // Horizontal movement
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;

    if (left) {
      this.setVelocityX(-speed);
      this.setFlipX(true);
    } else if (right) {
      this.setVelocityX(speed);
      this.setFlipX(false);
    } else {
      this.setVelocityX(0);
    }

    // Jump
    const jumpPressed = this.cursors.up.isDown || this.wasd.W.isDown || this.spaceKey.isDown;
    if (jumpPressed && onFloor) {
      this.setVelocityY(this.JUMP_VELOCITY);
    }

    // Interact (E key) - track just pressed
    this.interactJustPressed = Phaser.Input.Keyboard.JustDown(this.interactKey);

    // Visual feedback for hidden state
    this.setAlpha(this.isHidden ? 0.4 : 1);

    // Tint when sneaking
    this.setTint(isSneaking ? 0xaaaaaa : 0xffffff);
  }

  setHidden(hidden: boolean): void {
    this.isHidden = hidden;
  }
}
