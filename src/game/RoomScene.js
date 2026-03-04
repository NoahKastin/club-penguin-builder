import Phaser from 'phaser';
import Penguin from './Penguin';
import * as socket from '../network/socket';
import { adjustMoveTarget, simulateSkid, simulateGravity } from '../../shared/collision.js';

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
    this.activeDrag = null; // { itemIndex, offsetX, offsetY }
    this.lastDragEmit = 0;
    this.pendingDragOverrides = null;
    this.skidAnimations = new Set(); // item indices currently sliding
    this.pendingGravity = new Map(); // itemIndex → gravity event data (queued while skid animating)
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

      // Check draggable items
      for (let i = this.itemZones.length - 1; i >= 0; i--) {
        const item = this.itemZones[i];
        if (!item.behavior || !item.behavior.startsWith('draggable')) continue;
        if (item.lockedBy && item.lockedBy !== this.localId) continue;
        if (
          pointer.x >= item.x && pointer.x <= item.x + item.w &&
          pointer.y >= item.y && pointer.y <= item.y + item.h
        ) {
          // If item is also skid, emit a move toward it so server triggers push
          if (item.skid && this.localId && this.penguins.has(this.localId)) {
            const penguin = this.penguins.get(this.localId);
            const targetX = item.x + item.w / 2;
            const targetY = item.y + item.h / 2;
            penguin.moveTo(targetX, targetY);
            socket.move(targetX, targetY);
          }
          this.activeDrag = {
            itemIndex: i,
            offsetX: pointer.x - (item.x + item.w / 2),
            offsetY: pointer.y - (item.y + item.h / 2),
          };
          socket.dragStart(i);
          return;
        }
      }

      // Check collectible items
      for (const item of this.itemZones) {
        if (item.behavior !== 'collectible') continue;
        if (
          pointer.x >= item.x && pointer.x <= item.x + item.w &&
          pointer.y >= item.y && pointer.y <= item.y + item.h
        ) {
          // If item is also skid, emit a move toward it so server triggers push
          if (item.skid && this.localId && this.penguins.has(this.localId)) {
            const penguin = this.penguins.get(this.localId);
            const targetX = item.x + item.w / 2;
            const targetY = item.y + item.h / 2;
            penguin.moveTo(targetX, targetY);
            socket.move(targetX, targetY);
          }
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
        // Only room-level blockers block penguin movement (not game items)
        const adjusted = adjustMoveTarget(penguin.sprite.x, penguin.sprite.y, pointer.x, pointer.y, this.getBlockers(undefined, null));
        penguin.moveTo(adjusted.x, adjusted.y);
        // Send raw target so server can detect skid pushes along original path
        socket.move(pointer.x, pointer.y);
      }
    });

    this.input.on('pointermove', (pointer) => {
      if (!this.activeDrag) return;
      const { itemIndex, offsetX, offsetY } = this.activeDrag;
      const zone = this.itemZones[itemIndex];
      if (!zone || !zone.img) return;

      const gb = zone.gameBounds;
      const minX = gb ? gb.x + zone.w / 2 : zone.w / 2;
      const maxX = gb ? gb.x + gb.w - zone.w / 2 : 800 - zone.w / 2;
      const minY = gb ? gb.y + zone.h / 2 : zone.h / 2;
      const maxY = gb ? gb.y + gb.h - zone.h / 2 : 600 - zone.h / 2;
      const cx = Math.max(minX, Math.min(maxX, pointer.x - offsetX));
      const cy = Math.max(minY, Math.min(maxY, pointer.y - offsetY));

      zone.img.setPosition(cx, cy);
      zone.x = cx - zone.w / 2;
      zone.y = cy - zone.h / 2;

      const now = Date.now();
      if (now - this.lastDragEmit >= 50) {
        this.lastDragEmit = now;
        socket.dragMove(itemIndex, zone.x, zone.y);
      }
    });

    this.input.on('pointerup', () => {
      if (!this.activeDrag) return;
      const { itemIndex } = this.activeDrag;
      const zone = this.itemZones[itemIndex];
      if (zone) {
        socket.dragMove(itemIndex, zone.x, zone.y);
      }
      socket.dragEnd(itemIndex);
      this.activeDrag = null;
    });

    this.onRoomState = (data) => {
      this.localId = data.you;
      this.walkingToExit = false;
      this.activeDrag = null;
      if (data.catalogItems) {
        Object.assign(this.catalogCache, data.catalogItems);
      }
      this.pendingDragOverrides = data.dragOverrides || null;
      this.loadRoom(data.room, data.penguins);
      this.pendingDragOverrides = null;
    };

    this.onPenguinJoined = (data) => {
      if (!this.penguins.has(data.id)) {
        this.penguins.set(
          data.id,
          new Penguin(this, data.id, data.name, data.x, data.y, data.id === this.localId, data.clothes || [], data.hideEmoji || false)
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
        if (data.hideEmoji !== undefined) penguin.setHideEmoji(data.hideEmoji);
      }
    };

    this.onItemDragStart = (data) => {
      const zone = this.itemZones[data.itemIndex];
      if (zone) zone.lockedBy = data.draggedBy;
    };

    this.onItemDragMoved = (data) => {
      const zone = this.itemZones[data.itemIndex];
      if (!zone || !zone.img) return;
      zone.x = data.x;
      zone.y = data.y;
      zone.img.setPosition(data.x + zone.w / 2, data.y + zone.h / 2);
    };

    this.onItemDragEnd = (data) => {
      const zone = this.itemZones[data.itemIndex];
      if (!zone) return;
      zone.lockedBy = null;
      if (data.x != null && data.y != null && zone.img) {
        zone.x = data.x;
        zone.y = data.y;
        zone.img.setPosition(data.x + zone.w / 2, data.y + zone.h / 2);
      }
    };

    this.onItemPushed = (data) => {
      const zone = this.itemZones[data.itemIndex];
      if (!zone || !zone.img) return;
      if (this.skidAnimations.has(data.itemIndex)) return;

      const startAnim = () => {
        if (!zone.img) return;
        const blockers = this.getBlockers(data.itemIndex, zone.gameGroup);
        const gb = zone.gameBounds;
        const boundsW = gb ? gb.w : 800;
        const boundsH = gb ? gb.h : 600;
        const boundsX = gb ? gb.x : 0;
        const boundsY = gb ? gb.y : 0;
        const frames = simulateSkid(data.startX, data.startY, zone.w, zone.h, data.vx, data.vy, blockers, boundsW, boundsH, boundsX, boundsY);
        if (frames.length < 2) return;

        this.skidAnimations.add(data.itemIndex);
        let frameIdx = 0;
        const step = () => {
          if (!this.scene || !this.scene.isActive() || !zone.img) {
            this.skidAnimations.delete(data.itemIndex);
            return;
          }
          frameIdx++;
          if (frameIdx >= frames.length) {
            this.skidAnimations.delete(data.itemIndex);
            // Check for queued gravity after skid finishes
            const pendingGrav = this.pendingGravity.get(data.itemIndex);
            if (pendingGrav) {
              this.pendingGravity.delete(data.itemIndex);
              this.onItemGravity(pendingGrav);
            }
            return;
          }
          const f = frames[frameIdx];
          zone.x = f.x;
          zone.y = f.y;
          zone.img.setPosition(f.x + zone.w / 2, f.y + zone.h / 2);
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };

      // Delay animation until penguin reaches the item (hitT = fraction along path)
      const penguinTweenDuration = Math.max(200, (data.penguinDistance || 0) * 3);
      const delay = (data.hitT || 0) * penguinTweenDuration;
      if (delay > 16) {
        setTimeout(startAnim, delay);
      } else {
        startAnim();
      }
    };

    this.onItemGravity = (data) => {
      const zone = this.itemZones[data.itemIndex];
      if (!zone || !zone.img) return;
      // If skid animation is in progress, queue gravity for after it finishes
      if (this.skidAnimations.has(data.itemIndex)) {
        this.pendingGravity.set(data.itemIndex, data);
        return;
      }

      const blockers = this.getBlockers(data.itemIndex, zone.gameGroup);
      const gb = zone.gameBounds;
      const boundsW = gb ? gb.w : 800;
      const boundsH = gb ? gb.h : 600;
      const boundsX = gb ? gb.x : 0;
      const boundsY = gb ? gb.y : 0;
      const frames = simulateGravity(data.startX, data.startY, zone.w, zone.h, data.direction, blockers, boundsW, boundsH, boundsX, boundsY);
      if (frames.length < 2) return;

      this.skidAnimations.add(data.itemIndex);
      let frameIdx = 0;
      const step = () => {
        if (!this.scene || !this.scene.isActive() || !zone.img) {
          this.skidAnimations.delete(data.itemIndex);
          return;
        }
        frameIdx++;
        if (frameIdx >= frames.length) {
          this.skidAnimations.delete(data.itemIndex);
          return;
        }
        const f = frames[frameIdx];
        zone.x = f.x;
        zone.y = f.y;
        zone.img.setPosition(f.x + zone.w / 2, f.y + zone.h / 2);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    socket.on('roomState', this.onRoomState);
    socket.on('penguinJoined', this.onPenguinJoined);
    socket.on('penguinLeft', this.onPenguinLeft);
    socket.on('penguinMoved', this.onPenguinMoved);
    socket.on('chatMessage', this.onChatMessage);
    socket.on('penguinClothesChanged', this.onPenguinClothesChanged);
    socket.on('itemDragStart', this.onItemDragStart);
    socket.on('itemDragMoved', this.onItemDragMoved);
    socket.on('itemDragEnd', this.onItemDragEnd);
    socket.on('itemPushed', this.onItemPushed);
    socket.on('itemGravity', this.onItemGravity);

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
    socket.off('itemDragStart', this.onItemDragStart);
    socket.off('itemDragMoved', this.onItemDragMoved);
    socket.off('itemDragEnd', this.onItemDragEnd);
    socket.off('itemPushed', this.onItemPushed);
    socket.off('itemGravity', this.onItemGravity);
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

    const penguin = this.penguins.get(this.localId);
    const targetX = exit.x + exit.w / 2;
    const targetY = exit.y + exit.h / 2;
    const adjusted = adjustMoveTarget(penguin.sprite.x, penguin.sprite.y, targetX, targetY, this.getBlockers(undefined, null));

    // If blocked from reaching exit, just walk to the adjusted point (don't change room)
    const reachedExit = Math.abs(adjusted.x - targetX) < 10 && Math.abs(adjusted.y - targetY) < 10;

    if (reachedExit) {
      this.walkingToExit = true;
    }

    penguin.moveTo(adjusted.x, adjusted.y);
    // Send raw target so server can detect skid pushes along original path
    socket.move(targetX, targetY);

    if (reachedExit) {
      const distance = Phaser.Math.Distance.Between(penguin.sprite.x, penguin.sprite.y, adjusted.x, adjusted.y);
      const duration = Math.max(200, distance * 3);
      this.time.delayedCall(duration + 50, () => {
        socket.changeRoom(exit.targetRoom);
      });
    }
  }

  loadRoom(room, penguinList) {
    this.dismissPickupDialog();
    this.activeDrag = null;

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
      for (let i = 0; i < room.items.length; i++) {
        const item = room.items[i];
        const override = this.pendingDragOverrides && this.pendingDragOverrides[i];
        this.loadRoomItem(item, override);
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
        new Penguin(this, p.id, p.name, p.x, p.y, p.id === this.localId, p.clothes || [], p.hideEmoji || false)
      );
    }
  }

  loadRoomItem(item, dragOverride) {
    const catItem = this.catalogCache[item.catalogId];
    if (!catItem) return;

    const effectiveX = (dragOverride && dragOverride.x != null) ? dragOverride.x : item.x;
    const effectiveY = (dragOverride && dragOverride.y != null) ? dragOverride.y : item.y;

    const cx = effectiveX + item.width / 2;
    const cy = effectiveY + item.height / 2;
    const depth = item.behavior ? 2 : 1;
    const isDraggable = item.behavior && item.behavior.startsWith('draggable');

    const textureKey = 'catalog_' + item.catalogId + '_' + (textureCounter++);

    const zone = {
      x: effectiveX, y: effectiveY, w: item.width, h: item.height,
      behavior: item.behavior,
      catalogId: item.catalogId,
      wearOffsetX: item.wearOffsetX || 0,
      wearOffsetY: item.wearOffsetY || 0,
      wearWidth: item.wearWidth || 40,
      wearHeight: item.wearHeight || 40,
      blocksMovement: !!item.blocksMovement,
      skid: !!item.skid,
      gravity: !!item.gravity,
      gameGroup: item.gameGroup || null,
      gameBounds: item.gameBounds || null,
      gameGravityDirection: item.gameGravityDirection || null,
      img: null,
      lockedBy: (dragOverride && dragOverride.draggedBy) || null,
    };

    const rotation = (item.rotation || 0) * Math.PI / 180;

    const applyEffects = (img) => {
      if (item.behavior === 'collectible' && img.postFX) {
        img.postFX.addGlow(0xffffff, 4, 0, false, 0.1, 24);
      } else if (isDraggable && img.postFX) {
        img.postFX.addGlow(0x000000, 4, 0, false, 0.1, 24);
      }
      zone.img = img;
    };

    if (this.textures.exists(textureKey)) {
      const img = this.add.image(cx, cy, textureKey).setDisplaySize(item.width, item.height).setDepth(depth).setRotation(rotation);
      applyEffects(img);
      this.itemGraphics.push(img);
    } else {
      const htmlImg = new Image();
      htmlImg.onload = () => {
        if (this.scene && this.scene.isActive()) {
          this.textures.addImage(textureKey, htmlImg);
          const img = this.add.image(cx, cy, textureKey).setDisplaySize(item.width, item.height).setDepth(depth).setRotation(rotation);
          applyEffects(img);
          this.itemGraphics.push(img);
        }
      };
      htmlImg.src = catItem.image;
    }

    this.itemZones.push(zone);
  }

  getBlockers(excludeIndex, gameGroup) {
    return this.itemZones
      .filter((z, i) => z.blocksMovement && i !== excludeIndex && z.gameGroup === (gameGroup || null))
      .map(z => ({ x: z.x, y: z.y, w: z.w, h: z.h }));
  }

  shutdown() {
    socket.off('roomState', this.onRoomState);
    socket.off('penguinJoined', this.onPenguinJoined);
    socket.off('penguinLeft', this.onPenguinLeft);
    socket.off('penguinMoved', this.onPenguinMoved);
    socket.off('chatMessage', this.onChatMessage);
    socket.off('penguinClothesChanged', this.onPenguinClothesChanged);
    socket.off('itemDragStart', this.onItemDragStart);
    socket.off('itemDragMoved', this.onItemDragMoved);
    socket.off('itemDragEnd', this.onItemDragEnd);
    socket.off('itemPushed', this.onItemPushed);
    socket.off('itemGravity', this.onItemGravity);
  }
}
