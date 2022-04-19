return {
  onConfigChanged(oldConfig) {
    if (
      oldConfig.global !== this.config.global ||
      oldConfig.music !== this.config.music ||
      oldConfig.sound !== this.config.sound
    ) {

      this.saveSettings({
        audio: {
          global: this.config.global,
          music: this.config.music,
          sound: this.config.sound,
        }
      });
      
    } else  if (this.config.stopFollowingOnClick !== oldConfig.stopFollowingOnClick) {
      this.saveSettings({
        game: {
          stopFollowingOnClick: this.config.stopFollowingOnClick
        }
      });
    }
  }
};
