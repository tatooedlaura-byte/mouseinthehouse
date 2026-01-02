import Phaser from 'phaser';

export class Crumb extends Phaser.GameObjects.Image {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Create crumb texture if it doesn't exist
    if (!scene.textures.exists('crumb')) {
      const graphics = scene.add.graphics({ x: 0, y: 0 });
      // Bright yellow/gold crumb - very visible
      graphics.fillStyle(0xffff00, 1);
      graphics.fillCircle(10, 10, 8);
      graphics.fillStyle(0xffa500, 1);
      graphics.fillCircle(10, 10, 5);
      // Sparkle
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(7, 7, 2);
      graphics.generateTexture('crumb', 20, 20);
      graphics.destroy();
    }

    super(scene, x, y, 'crumb');

    // Make crumbs visible above other elements
    this.setDepth(50);
    this.setScale(1.5);
  }
}
