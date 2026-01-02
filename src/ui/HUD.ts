import Phaser from 'phaser';

export class HUD {
  private crumbsText: Phaser.GameObjects.Text;
  private threadText: Phaser.GameObjects.Text;
  private catStateText: Phaser.GameObjects.Text;
  private hiddenText: Phaser.GameObjects.Text;
  private sceneNameText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, sceneName: string) {
    // Background panel
    const panel = scene.add.rectangle(10, 10, 200, 110, 0x000000, 0.7);
    panel.setOrigin(0, 0);
    panel.setScrollFactor(0);
    panel.setDepth(100);

    // Scene name
    this.sceneNameText = scene.add.text(20, 18, sceneName, {
      fontSize: '16px',
      color: '#ffcc00',
      fontStyle: 'bold',
    });
    this.sceneNameText.setScrollFactor(0);
    this.sceneNameText.setDepth(101);

    // Crumbs counter
    this.crumbsText = scene.add.text(20, 42, 'Crumbs: 0', {
      fontSize: '14px',
      color: '#daa520',
    });
    this.crumbsText.setScrollFactor(0);
    this.crumbsText.setDepth(101);

    // Thread counter
    this.threadText = scene.add.text(20, 60, 'Thread: 0', {
      fontSize: '14px',
      color: '#cc99ff',
    });
    this.threadText.setScrollFactor(0);
    this.threadText.setDepth(101);

    // Cat state
    this.catStateText = scene.add.text(20, 80, 'Cat: SAFE', {
      fontSize: '14px',
      color: '#00ff00',
    });
    this.catStateText.setScrollFactor(0);
    this.catStateText.setDepth(101);

    // Hidden indicator
    this.hiddenText = scene.add.text(20, 100, '', {
      fontSize: '12px',
      color: '#00ccff',
    });
    this.hiddenText.setScrollFactor(0);
    this.hiddenText.setDepth(101);
  }

  updateCrumbs(count: number): void {
    this.crumbsText.setText(`Crumbs: ${count}`);
  }

  updateThread(count: number): void {
    this.threadText.setText(`Thread: ${count}`);
  }

  updateCatState(state: string): void {
    this.catStateText.setText(`Cat: ${state}`);
    switch (state) {
      case 'SAFE':
        this.catStateText.setColor('#00ff00');
        break;
      case 'ALERT':
        this.catStateText.setColor('#ffff00');
        break;
      case 'CHASE':
        this.catStateText.setColor('#ff0000');
        break;
    }
  }

  updateHidden(isHidden: boolean): void {
    this.hiddenText.setText(isHidden ? '[HIDDEN]' : '');
  }

  showCatState(show: boolean): void {
    this.catStateText.setVisible(show);
  }
}
