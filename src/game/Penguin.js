import Phaser from 'phaser';

let clothesTextureCounter = 0;

export default class Penguin {
  constructor(scene, id, name, x, y, isLocal, clothes = []) {
    this.scene = scene;
    this.id = id;
    this.isLocal = isLocal;
    this.x = x;
    this.y = y;

    // Gray circle under local player only
    this.shadow = null;
    if (isLocal) {
      this.shadow = scene.add.circle(x, y, 18, 0x888888, 0.4).setDepth(4);
    }

    // Penguin emoji
    this.sprite = scene.add.text(x, y, '\u{1F427}', {
      fontSize: '40px',
    }).setOrigin(0.5, 1).setDepth(5);

    // Name label below penguin
    this.nameLabel = scene.add.text(x, y + 8, name, {
      fontSize: '14px',
      fontFamily: 'sans-serif',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 6, y: 2 },
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(6);

    // Speech bubble above penguin
    this.bubble = scene.add.text(x, y - 50, '', {
      fontSize: '14px',
      fontFamily: 'sans-serif',
      color: '#000',
      backgroundColor: '#fff',
      padding: { x: 8, y: 4 },
      align: 'center',
      wordWrap: { width: 180 },
    }).setOrigin(0.5, 1).setDepth(7).setVisible(false);

    this.bubbleTimer = null;
    this.clothesSprites = [];

    if (clothes.length > 0) {
      this.updateClothes(clothes);
    }
  }

  updateClothes(clothes) {
    for (const c of this.clothesSprites) {
      c.sprite.destroy();
    }
    this.clothesSprites = [];

    for (let i = 0; i < clothes.length; i++) {
      const item = clothes[i];
      const depth = 5 + 0.1 * (i + 1);
      const offsetX = item.wearOffsetX || 0;
      const offsetY = item.wearOffsetY || 0;
      const w = item.wearWidth || 40;
      const h = item.wearHeight || 40;

      const cx = this.x + offsetX;
      const cy = this.y - 20 + offsetY;

      const textureKey = 'clothes_' + item.catalogId + '_' + (clothesTextureCounter++);

      const htmlImg = new Image();
      htmlImg.onload = () => {
        if (this.scene && this.scene.scene && this.scene.scene.isActive()) {
          this.scene.textures.addImage(textureKey, htmlImg);
          const sprite = this.scene.add.image(cx, cy, textureKey)
            .setDisplaySize(w, h)
            .setDepth(depth);
          this.clothesSprites.push({ sprite, offsetX, offsetY: offsetY - 20 });
        }
      };
      htmlImg.src = item.image;
    }
  }

  moveTo(x, y) {
    this.x = x;
    this.y = y;

    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.killTweensOf(this.nameLabel);
    this.scene.tweens.killTweensOf(this.bubble);
    if (this.shadow) this.scene.tweens.killTweensOf(this.shadow);

    const distance = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, x, y);
    const duration = Math.max(200, distance * 3);

    this.scene.tweens.add({
      targets: this.sprite,
      x, y, duration, ease: 'Power2',
    });

    // Name label below
    this.scene.tweens.add({
      targets: this.nameLabel,
      x, y: y + 8, duration, ease: 'Power2',
    });

    // Bubble above
    this.scene.tweens.add({
      targets: this.bubble,
      x, y: y - 50, duration, ease: 'Power2',
    });

    // Shadow
    if (this.shadow) {
      this.scene.tweens.add({
        targets: this.shadow,
        x, y, duration, ease: 'Power2',
      });
    }

    // Clothes
    for (const c of this.clothesSprites) {
      this.scene.tweens.killTweensOf(c.sprite);
      this.scene.tweens.add({
        targets: c.sprite,
        x: x + c.offsetX,
        y: y + c.offsetY,
        duration, ease: 'Power2',
      });
    }
  }

  showMessage(text) {
    this.bubble.setText(text);
    this.bubble.setVisible(true);

    if (this.bubbleTimer) {
      this.bubbleTimer.destroy();
    }

    this.bubbleTimer = this.scene.time.delayedCall(4000, () => {
      this.bubble.setVisible(false);
    });
  }

  destroy() {
    if (this.bubbleTimer) this.bubbleTimer.destroy();
    this.sprite.destroy();
    this.nameLabel.destroy();
    this.bubble.destroy();
    if (this.shadow) this.shadow.destroy();
    for (const c of this.clothesSprites) {
      c.sprite.destroy();
    }
    this.clothesSprites = [];
  }
}
