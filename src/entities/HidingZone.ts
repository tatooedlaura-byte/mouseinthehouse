import Phaser from 'phaser';

export class HidingZone extends Phaser.GameObjects.Rectangle {
  public isActive = false;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    super(scene, x, y, width, height, 0x4a3728, 0.6);
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body

    // Add visual indicator
    this.setStrokeStyle(2, 0x8b4513);

    // Add label
    const label = scene.add.text(x, y - height / 2 - 12, 'HIDE [E]', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#4a3728',
      padding: { x: 4, y: 2 },
    });
    label.setOrigin(0.5, 0.5);
  }

  setZoneActive(active: boolean): void {
    this.isActive = active;
    this.setFillStyle(active ? 0x2d5a27 : 0x4a3728, 0.6);
    this.setStrokeStyle(2, active ? 0x4a9c3d : 0x8b4513);
  }
}
