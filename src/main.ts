import Phaser from 'phaser';
import { NestScene } from './scenes/NestScene';
import { RoomScene } from './scenes/RoomScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#2d2d44',
  pixelArt: true, // Crisp pixel art scaling (nearest neighbor)
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 800 },
      debug: false,
    },
  },
  scene: [NestScene, RoomScene],
};

new Phaser.Game(config);
