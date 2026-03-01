import Phaser from 'phaser';
import Penguin from './Penguin';
import * as socket from '../network/socket';

let textureCounter = 0;

export default class RoomScene extends Phaser.Scene {
  constructor() {
    super('RoomScene');
    this.penguins = new Map();
    this.localId = null;
    this.exitZones = [];
    this.exitGraphics = [];
    this.itemGraphics = [];
    this.itemZones = [];
    this.catalogCache = {};
    this.pickupDialog = null; // { bg, text, yesText, noText, yesBg, noBg }
    this.pendingPickup = null;
    this.walkingToExit = false;
  }

  create() {
    this.bg = this.add.rectangle(400, 300, 800, 600, 0x333333).setOrigin(0.5);

    this.roomLabel = this.add.text(400, 30, '', {
      fontSize: '24px',
      fontFamily: 'sans-serif',
      color: '#fff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    this.input.on('pointerdown', (pointer) => {
      // If dialog is showing, check dialog buttons
      if (this.pickupDialog) {
        const yes = this.pickupDialog.yesBg;
        const no = this.pickupDialog.noBg;
        if (pointer.x >= yes.centerX - 30 && pointer.x <= yes.centerX + 30 &&
            pointer.y >= yes.centerY - 12 && pointer.y <= yes.centerY + 12) {
          this.handlePickupYes();
          return;
        }
        if (pointer.x >= no.centerX - 30 && pointer.x <= no.centerX + 30 &&
            pointer.y >= no.centerY - 12 && pointer.y <= no.centerY + 12) {
          this.dismissPickupDialog();
          return;
        }
        // Click elsewhere dismisses dialog
        this.dismissPickupDialog();
        return;
      }

      if (this.walkingToExit) return;

      // Check collectible items
      for (const item of this.itemZones) {
        if (item.behavior !== 'collectible') continue;
        if (
          pointer.x >= item.x && pointer.x <= item.x + item.w &&
          pointer.y >= item.y && pointer.y <= item.y + item.h
        ) {
          this.showPickupDialog(item);
          return;
        }
      }

      // Check exits — walk to exit first, then transition
      for (const exit of this.exitZones) {
        if (
          pointer.x >= exit.x && pointer.x <= exit.x + exit.w &&
          pointer.y >= exit.y && pointer.y <= exit.y + exit.h
        ) {
          this.walkToExit(exit);
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

    this.onRoomState = (data) => {
      this.localId = data.you;
      this.walkingToExit = false;
      if (data.catalogItems) {
        Object.assign(this.catalogCache, data.catalogItems);
      }
      this.loadRoom(data.room, data.penguins);
    };

    this.onPenguinJoined = (data) => {
      if (!this.penguins.has(data.id)) {
        this.penguins.set(
          data.id,
          new Penguin(this, data.id, data.name, data.x, data.y, data.id === this.localId, data.clothes || [])
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

    this.onPenguinClothesChanged = (data) => {
      const penguin = this.penguins.get(data.id);
      if (penguin) {
        penguin.updateClothes(data.clothes);
      }
    };

    socket.on('roomState', this.onRoomState);
    socket.on('penguinJoined', this.onPenguinJoined);
    socket.on('penguinLeft', this.onPenguinLeft);
    socket.on('penguinMoved', this.onPenguinMoved);
    socket.on('chatMessage', this.onChatMessage);
    socket.on('penguinClothesChanged', this.onPenguinClothesChanged);

    this.events.on('destroy', this.cleanup, this);
    socket.sceneReady();
  }

  cleanup() {
    socket.off('roomState', this.onRoomState);
    socket.off('penguinJoined', this.onPenguinJoined);
    socket.off('penguinLeft', this.onPenguinLeft);
    socket.off('penguinMoved', this.onPenguinMoved);
    socket.off('chatMessage', this.onChatMessage);
    socket.off('penguinClothesChanged', this.onPenguinClothesChanged);
  }

  showPickupDialog(item) {
    this.dismissPickupDialog();
    const catItem = this.catalogCache[item.catalogId];
    if (!catItem) return;

    const name = catItem.name;
    const article = /^[aeiou]/i.test(name) ? 'an' : 'a';
    const message = `You have found ${article} ${name}.\nWould you like to pick it up?`;

    this.pendingPickup = item;

    // Blue rounded-corner dialog (classic Club Penguin style)
    const bg = this.add.graphics().setDepth(20);
    bg.fillStyle(0x2a6cb8, 0.95);
    bg.fillRoundedRect(240, 240, 320, 120, 16);
    bg.lineStyle(3, 0x6aacf8);
    bg.strokeRoundedRect(240, 240, 320, 120, 16);

    const text = this.add.text(400, 275, message, {
      fontSize: '14px',
      fontFamily: 'sans-serif',
      color: '#fff',
      align: 'center',
      wordWrap: { width: 280 },
    }).setOrigin(0.5, 0.5).setDepth(21);

    const yesBg = this.add.graphics().setDepth(20);
    yesBg.fillStyle(0x4a90d9);
    yesBg.fillRoundedRect(330, 318, 60, 24, 8);
    yesBg.lineStyle(1, 0x6aacf8);
    yesBg.strokeRoundedRect(330, 318, 60, 24, 8);
    // Store center coords for hit detection
    yesBg.centerX = 360;
    yesBg.centerY = 330;

    const yesText = this.add.text(360, 330, 'Yes', {
      fontSize: '14px', fontFamily: 'sans-serif', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);

    const noBg = this.add.graphics().setDepth(20);
    noBg.fillStyle(0x3a5570);
    noBg.fillRoundedRect(410, 318, 60, 24, 8);
    noBg.lineStyle(1, 0x6aacf8);
    noBg.strokeRoundedRect(410, 318, 60, 24, 8);
    noBg.centerX = 440;
    noBg.centerY = 330;

    const noText = this.add.text(440, 330, 'No', {
      fontSize: '14px', fontFamily: 'sans-serif', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);

    this.pickupDialog = { bg, text, yesText, noText, yesBg, noBg };
  }

  handlePickupYes() {
    if (this.pendingPickup) {
      socket.collectItem({
        catalogId: this.pendingPickup.catalogId,
        wearOffsetX: this.pendingPickup.wearOffsetX,
        wearOffsetY: this.pendingPickup.wearOffsetY,
        wearWidth: this.pendingPickup.wearWidth,
        wearHeight: this.pendingPickup.wearHeight,
      });
    }
    this.dismissPickupDialog();
  }

  dismissPickupDialog() {
    if (this.pickupDialog) {
      this.pickupDialog.bg.destroy();
      this.pickupDialog.text.destroy();
      this.pickupDialog.yesText.destroy();
      this.pickupDialog.noText.destroy();
      this.pickupDialog.yesBg.destroy();
      this.pickupDialog.noBg.destroy();
      this.pickupDialog = null;
      this.pendingPickup = null;
    }
  }

  walkToExit(exit) {
    if (!this.localId || !this.penguins.has(this.localId)) return;

    this.walkingToExit = true;
    const penguin = this.penguins.get(this.localId);
    const targetX = exit.x + exit.w / 2;
    const targetY = exit.y + exit.h / 2;

    penguin.moveTo(targetX, targetY);
    socket.move(targetX, targetY);

    const distance = Phaser.Math.Distance.Between(penguin.sprite.x, penguin.sprite.y, targetX, targetY);
    const duration = Math.max(200, distance * 3);

    this.time.delayedCall(duration + 50, () => {
      socket.changeRoom(exit.targetRoom);
    });
  }

  loadRoom(room, penguinList) {
    this.dismissPickupDialog();

    for (const penguin of this.penguins.values()) {
      penguin.destroy();
    }
    this.penguins.clear();

    for (const obj of this.exitGraphics) { obj.destroy(); }
    this.exitGraphics = [];
    this.exitZones = [];

    for (const obj of this.itemGraphics) { obj.destroy(); }
    this.itemGraphics = [];
    this.itemZones = [];

    const color = Phaser.Display.Color.HexStringToColor(room.bgColor || '#333333');
    this.bg.setFillStyle(color.color);

    // Room name hidden by default (still used in exits/editor)
    this.roomLabel.setVisible(false);

    if (room.items) {
      for (const item of room.items) {
        this.loadRoomItem(item);
      }
    }

    for (const exit of room.exits) {
      const cx = exit.x + exit.width / 2;
      const cy = exit.y + exit.height / 2;

      const rect = this.add.rectangle(cx, cy, exit.width, exit.height, 0xffffff, 0.5).setDepth(3);
      const label = this.add.text(cx, cy, exit.label, {
        fontSize: '16px',
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
        color: '#fff',
        align: 'center',
      }).setOrigin(0.5).setDepth(3);

      this.exitGraphics.push(rect, label);
      this.exitZones.push({
        x: exit.x, y: exit.y, w: exit.width, h: exit.height,
        targetRoom: exit.targetRoom,
      });
    }

    for (const p of penguinList) {
      this.penguins.set(
        p.id,
        new Penguin(this, p.id, p.name, p.x, p.y, p.id === this.localId, p.clothes || [])
      );
    }
  }

  loadRoomItem(item) {
    const catItem = this.catalogCache[item.catalogId];
    if (!catItem) return;

    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;
    const depth = item.behavior ? 2 : 1;

    const textureKey = 'catalog_' + item.catalogId + '_' + (textureCounter++);

    const zone = {
      x: item.x, y: item.y, w: item.width, h: item.height,
      behavior: item.behavior,
      catalogId: item.catalogId,
      wearOffsetX: item.wearOffsetX || 0,
      wearOffsetY: item.wearOffsetY || 0,
      wearWidth: item.wearWidth || 40,
      wearHeight: item.wearHeight || 40,
      borderGraphic: null,
    };

    if (item.behavior === 'collectible') {
      const borderRotation = (item.rotation || 0) * Math.PI / 180;
      const border = this.add.rectangle(cx, cy, item.width + 6, item.height + 6)
        .setStrokeStyle(3, 0xffffff)
        .setFillStyle(0x000000, 0)
        .setDepth(depth)
        .setRotation(borderRotation);
      this.itemGraphics.push(border);
      zone.borderGraphic = border;
    }

    const rotation = (item.rotation || 0) * Math.PI / 180;

    if (this.textures.exists(textureKey)) {
      const img = this.add.image(cx, cy, textureKey).setDisplaySize(item.width, item.height).setDepth(depth).setRotation(rotation);
      this.itemGraphics.push(img);
    } else {
      const htmlImg = new Image();
      htmlImg.onload = () => {
        if (this.scene && this.scene.isActive()) {
          this.textures.addImage(textureKey, htmlImg);
          const img = this.add.image(cx, cy, textureKey).setDisplaySize(item.width, item.height).setDepth(depth).setRotation(rotation);
          this.itemGraphics.push(img);
        }
      };
      htmlImg.src = catItem.image;
    }

    this.itemZones.push(zone);
  }

  shutdown() {
    socket.off('roomState', this.onRoomState);
    socket.off('penguinJoined', this.onPenguinJoined);
    socket.off('penguinLeft', this.onPenguinLeft);
    socket.off('penguinMoved', this.onPenguinMoved);
    socket.off('chatMessage', this.onChatMessage);
    socket.off('penguinClothesChanged', this.onPenguinClothesChanged);
  }
}
