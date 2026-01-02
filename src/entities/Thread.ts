import Phaser from 'phaser';

export class Thread extends Phaser.GameObjects.Image {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Create thread texture if it doesn't exist
    if (!scene.textures.exists('thread')) {
      const graphics = scene.make.graphics({ x: 0, y: 0 });
      // Thread spool shape - purple/blue color
      graphics.fillStyle(0x9966cc, 1);
      graphics.fillRoundedRect(4, 2, 12, 16, 2);
      // Thread wrapped around
      graphics.lineStyle(2, 0xcc99ff, 1);
      graphics.beginPath();
      graphics.moveTo(4, 6);
      graphics.lineTo(16, 6);
      graphics.moveTo(4, 10);
      graphics.lineTo(16, 10);
      graphics.moveTo(4, 14);
      graphics.lineTo(16, 14);
      graphics.strokePath();
      // Spool ends
      graphics.fillStyle(0x663399, 1);
      graphics.fillRect(2, 0, 16, 3);
      graphics.fillRect(2, 17, 16, 3);
      graphics.generateTexture('thread', 20, 20);
      graphics.destroy();
    }

    super(scene, x, y, 'thread');
    scene.physics.add.existing(this, true);
    this.setDepth(10);
    this.setScale(1.2);
  }
}
