import Phaser from 'phaser';

export default class Penguin {
  constructor(scene, id, name, x, y, isLocal) {
    this.scene = scene;
    this.id = id;
    this.isLocal = isLocal;

    // Penguin emoji
    this.sprite = scene.add.text(x, y, '🐧', {
      fontSize: '40px',
    }).setOrigin(0.5, 1).setDepth(5);

    // Name label above penguin
    this.nameLabel = scene.add.text(x, y - 50, name, {
      fontSize: '14px',
      fontFamily: 'sans-serif',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 6, y: 2 },
      align: 'center',
    }).setOrigin(0.5, 1).setDepth(6);

    // Speech bubble (hidden by default)
    this.bubble = scene.add.text(x, y - 70, '', {
      fontSize: '14px',
      fontFamily: 'sans-serif',
      color: '#000',
      backgroundColor: '#fff',
      padding: { x: 8, y: 4 },
      align: 'center',
      wordWrap: { width: 180 },
    }).setOrigin(0.5, 1).setDepth(7).setVisible(false);

    this.bubbleTimer = null;
  }

  moveTo(x, y) {
    // Stop any existing tweens so they don't fight the new destination
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.killTweensOf(this.nameLabel);
    this.scene.tweens.killTweensOf(this.bubble);

    const distance = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, x, y);
    const duration = Math.max(200, distance * 3);

    // Tween sprite to target
    this.scene.tweens.add({
      targets: this.sprite,
      x,
      y,
      duration,
      ease: 'Power2',
    });

    // Tween name label
    this.scene.tweens.add({
      targets: this.nameLabel,
      x,
      y: y - 50,
      duration,
      ease: 'Power2',
    });

    // Tween bubble
    this.scene.tweens.add({
      targets: this.bubble,
      x,
      y: y - 70,
      duration,
      ease: 'Power2',
    });
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
    if (this.bubbleTimer) {
      this.bubbleTimer.destroy();
    }
    this.sprite.destroy();
    this.nameLabel.destroy();
    this.bubble.destroy();
  }
}
