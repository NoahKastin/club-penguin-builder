import Phaser from 'phaser';
import RoomScene from './RoomScene';

export function createGame(parent) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent,
    backgroundColor: '#333333',
    scene: [RoomScene],
  });
}

export function destroyGame(game) {
  if (game) {
    game.destroy(true);
  }
}
