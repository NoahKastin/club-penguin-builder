import Phaser from 'phaser';
import Penguin from './Penguin';
import * as socket from '../network/socket';

export default class RoomScene extends Phaser.Scene {
  constructor() {
    super('RoomScene');
    this.penguins = new Map();
    this.localId = null;
    this.exitZones = []; // { x, y, w, h, targetRoom }
    this.exitGraphics = []; // Phaser display objects to destroy on room change
  }

  create() {
    // Background (updated in loadRoom)
    this.bg = this.add.rectangle(400, 300, 800, 600, 0x333333).setOrigin(0.5);

    this.roomLabel = this.add.text(400, 30, '', {
      fontSize: '24px',
      fontFamily: 'sans-serif',
      color: '#fff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Single scene-level click handler — checks exits first, then moves
    this.input.on('pointerdown', (pointer) => {
      // Check exits
      for (const exit of this.exitZones) {
        if (
          pointer.x >= exit.x && pointer.x <= exit.x + exit.w &&
          pointer.y >= exit.y && pointer.y <= exit.y + exit.h
        ) {
          socket.changeRoom(exit.targetRoom);
          return;
        }
      }

      // Move local penguin
      if (this.localId && this.penguins.has(this.localId)) {
        const penguin = this.penguins.get(this.localId);
        penguin.moveTo(pointer.x, pointer.y);
        socket.move(pointer.x, pointer.y);
      }
    });

    // Socket event handlers
    this.onRoomState = (data) => {
      this.localId = data.you;
      this.loadRoom(data.room, data.penguins);
    };

    this.onPenguinJoined = (data) => {
      if (!this.penguins.has(data.id)) {
        this.penguins.set(
          data.id,
          new Penguin(this, data.id, data.name, data.x, data.y, data.id === this.localId)
        );
      }
    };

    this.onPenguinLeft = (data) => {
      const penguin = this.penguins.get(data.id);
      if (penguin) {
        penguin.destroy();
        this.penguins.delete(data.id);
      }
    };

    this.onPenguinMoved = (data) => {
      const penguin = this.penguins.get(data.id);
      if (penguin) {
        penguin.moveTo(data.x, data.y);
      }
    };

    this.onChatMessage = (data) => {
      const penguin = this.penguins.get(data.id);
      if (penguin) {
        penguin.showMessage(data.message);
      }
    };

    socket.on('roomState', this.onRoomState);
    socket.on('penguinJoined', this.onPenguinJoined);
    socket.on('penguinLeft', this.onPenguinLeft);
    socket.on('penguinMoved', this.onPenguinMoved);
    socket.on('chatMessage', this.onChatMessage);

    // Signal that listeners are registered and it's safe to join
    socket.sceneReady();
  }

  loadRoom(room, penguinList) {
    // Clear existing penguins
    for (const penguin of this.penguins.values()) {
      penguin.destroy();
    }
    this.penguins.clear();

    // Clear exit graphics
    for (const obj of this.exitGraphics) {
      obj.destroy();
    }
    this.exitGraphics = [];
    this.exitZones = [];

    // Set background
    const color = Phaser.Display.Color.HexStringToColor(room.bgColor);
    this.bg.setFillStyle(color.color);
    this.roomLabel.setText(room.name);

    // Draw exits (visual only — click detection is coordinate-based)
    for (const exit of room.exits) {
      const cx = exit.x + exit.width / 2;
      const cy = exit.y + exit.height / 2;

      const rect = this.add.rectangle(cx, cy, exit.width, exit.height, 0xffffff, 0.5);
      const label = this.add.text(cx, cy, exit.label, {
        fontSize: '16px',
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
        color: '#fff',
        align: 'center',
      }).setOrigin(0.5);

      this.exitGraphics.push(rect, label);
      this.exitZones.push({
        x: exit.x,
        y: exit.y,
        w: exit.width,
        h: exit.height,
        targetRoom: exit.targetRoom,
      });
    }

    // Create penguins
    for (const p of penguinList) {
      this.penguins.set(
        p.id,
        new Penguin(this, p.id, p.name, p.x, p.y, p.id === this.localId)
      );
    }
  }

  shutdown() {
    socket.off('roomState', this.onRoomState);
    socket.off('penguinJoined', this.onPenguinJoined);
    socket.off('penguinLeft', this.onPenguinLeft);
    socket.off('penguinMoved', this.onPenguinMoved);
    socket.off('chatMessage', this.onChatMessage);
  }
}
