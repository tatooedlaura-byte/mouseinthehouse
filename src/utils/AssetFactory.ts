import Phaser from 'phaser';

// Frame definitions for furniture tileset (x, y, width, height)
// Row 1 (y=0): couch, armchair, table, door parts
// Row 2 (y=32): 2 lamps, vase, 2 chairs, bed, appliance
// Row 3 (y=64): bookshelf, chest, TVs, UI
const TILESET_FRAMES: Record<string, { x: number; y: number; w: number; h: number }> = {
  lamp: { x: 0, y: 32, w: 16, h: 32 },       // Green lamp (first item row 2)
  vase: { x: 32, y: 32, w: 16, h: 32 },      // Gray vase (after 2 lamps)
  bed: { x: 112, y: 32, w: 48, h: 32 },      // Red bed (right side row 2)
  table: { x: 80, y: 0, w: 16, h: 32 },      // Small brown table (row 1)
  bookshelf: { x: 0, y: 64, w: 32, h: 32 },  // Brown bookshelf (start row 3)
  chest: { x: 32, y: 64, w: 32, h: 32 },     // Brown dresser (row 3)
};

export class AssetFactory {
  static extractFromTileset(scene: Phaser.Scene): void {
    if (!scene.textures.exists('furniture-tileset')) return;

    const furnitureTexture = scene.textures.get('furniture-tileset');
    const source = furnitureTexture.getSourceImage() as HTMLImageElement;

    for (const [itemId, frame] of Object.entries(TILESET_FRAMES)) {
      const textureName = `item-${itemId}`;
      if (scene.textures.exists(textureName)) continue;

      // Create a canvas to extract the frame
      const canvas = document.createElement('canvas');
      canvas.width = frame.w;
      canvas.height = frame.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      // Draw the specific region from the tileset
      ctx.drawImage(source, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);

      // Add as texture
      scene.textures.addCanvas(textureName, canvas);
    }
  }

  static generateBedTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists('item-bed')) return;

    const graphics = scene.make.graphics({ x: 0, y: 0 });

    // Bed frame (straw/wood base) - 64x32 (2 tiles wide)
    graphics.fillStyle(0x8b7355, 1); // Straw color
    graphics.fillRoundedRect(2, 10, 60, 20, 4);

    // Bed legs
    graphics.fillStyle(0x5c4033, 1);
    graphics.fillRect(4, 26, 6, 6);
    graphics.fillRect(54, 26, 6, 6);

    // Straw texture lines
    graphics.lineStyle(1, 0x6b5344, 0.6);
    for (let i = 0; i < 8; i++) {
      graphics.lineBetween(6 + i * 7, 12, 8 + i * 7, 28);
    }

    // Pillow (left side)
    graphics.fillStyle(0xd4c4a8, 1);
    graphics.fillRoundedRect(4, 6, 18, 12, 3);
    graphics.lineStyle(1, 0xb8a888, 1);
    graphics.strokeRoundedRect(4, 6, 18, 12, 3);

    // Blanket/cover (right side)
    graphics.fillStyle(0x996633, 1);
    graphics.fillRoundedRect(24, 8, 34, 14, 2);
    graphics.lineStyle(1, 0x7a5229, 1);
    graphics.strokeRoundedRect(24, 8, 34, 14, 2);

    graphics.generateTexture('item-bed', 64, 32);
    graphics.destroy();
  }

  static generateLampTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists('item-lamp')) return;

    const graphics = scene.make.graphics({ x: 0, y: 0 });

    // Lamp base
    graphics.fillStyle(0x654321, 1);
    graphics.fillRect(12, 26, 8, 6);

    // Lamp pole
    graphics.fillStyle(0x8b7355, 1);
    graphics.fillRect(14, 10, 4, 18);

    // Lamp shade (glowing top)
    graphics.fillStyle(0xffd700, 1);
    graphics.fillTriangle(16, 4, 6, 14, 26, 14);

    // Inner glow
    graphics.fillStyle(0xffec80, 1);
    graphics.fillTriangle(16, 6, 10, 12, 22, 12);

    // Bright center
    graphics.fillStyle(0xffffcc, 1);
    graphics.fillCircle(16, 10, 3);

    graphics.generateTexture('item-lamp', 32, 32);
    graphics.destroy();
  }

  static generateRugTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists('item-rug')) return;

    const graphics = scene.make.graphics({ x: 0, y: 0 });

    // Rug base
    graphics.fillStyle(0xc41e3a, 1);
    graphics.fillRoundedRect(2, 8, 28, 16, 2);

    // Rug pattern
    graphics.fillStyle(0x8b0000, 1);
    graphics.fillRect(6, 12, 20, 8);

    // Fringe edges
    graphics.lineStyle(2, 0xdaa520, 1);
    graphics.strokeRoundedRect(2, 8, 28, 16, 2);

    // Center pattern
    graphics.fillStyle(0xffd700, 1);
    graphics.fillRect(14, 14, 4, 4);

    graphics.generateTexture('item-rug', 32, 32);
    graphics.destroy();
  }

  static generateTableTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists('item-table')) return;

    const graphics = scene.make.graphics({ x: 0, y: 0 });

    // Table top
    graphics.fillStyle(0x654321, 1);
    graphics.fillRect(2, 8, 28, 6);
    graphics.lineStyle(1, 0x4a3219, 1);
    graphics.strokeRect(2, 8, 28, 6);

    // Table legs
    graphics.fillStyle(0x5c4033, 1);
    graphics.fillRect(4, 14, 4, 16);
    graphics.fillRect(24, 14, 4, 16);

    // Wood grain on top
    graphics.lineStyle(1, 0x7a5a3a, 0.5);
    graphics.lineBetween(6, 10, 26, 10);
    graphics.lineBetween(8, 12, 24, 12);

    graphics.generateTexture('item-table', 32, 32);
    graphics.destroy();
  }

  static generatePlantTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists('item-plant')) return;

    const graphics = scene.make.graphics({ x: 0, y: 0 });

    // Pot
    graphics.fillStyle(0xcd7f32, 1);
    graphics.fillRect(10, 22, 12, 10);
    graphics.fillStyle(0xb8732d, 1);
    graphics.fillRect(8, 20, 16, 4);

    // Dirt
    graphics.fillStyle(0x4a3728, 1);
    graphics.fillRect(10, 20, 12, 4);

    // Leaves
    graphics.fillStyle(0x228b22, 1);
    graphics.fillCircle(16, 14, 6);
    graphics.fillCircle(12, 10, 4);
    graphics.fillCircle(20, 10, 4);
    graphics.fillCircle(16, 6, 4);

    // Leaf highlights
    graphics.fillStyle(0x32cd32, 1);
    graphics.fillCircle(14, 12, 2);
    graphics.fillCircle(18, 8, 2);

    graphics.generateTexture('item-plant', 32, 32);
    graphics.destroy();
  }

  static generateChestTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists('item-chest')) return;

    const graphics = scene.make.graphics({ x: 0, y: 0 });

    // Chest body
    graphics.fillStyle(0xcd7f32, 1);
    graphics.fillRect(4, 12, 24, 16);

    // Chest lid
    graphics.fillStyle(0xb8732d, 1);
    graphics.fillRoundedRect(2, 6, 28, 10, { tl: 4, tr: 4, bl: 0, br: 0 });

    // Metal bands
    graphics.fillStyle(0x808080, 1);
    graphics.fillRect(4, 14, 24, 2);
    graphics.fillRect(4, 22, 24, 2);

    // Lock
    graphics.fillStyle(0xffd700, 1);
    graphics.fillRect(14, 12, 4, 6);
    graphics.fillCircle(16, 10, 3);

    // Keyhole
    graphics.fillStyle(0x000000, 1);
    graphics.fillCircle(16, 10, 1);
    graphics.fillRect(15, 10, 2, 3);

    graphics.generateTexture('item-chest', 32, 32);
    graphics.destroy();
  }
}
