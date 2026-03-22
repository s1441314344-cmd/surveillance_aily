Page({
  data: {
    result: null
  },

  onLoad(options) {
    if (options.result) {
      try {
        const result = JSON.parse(decodeURIComponent(options.result));
        this.setData({ result });
      } catch (e) {
        console.error('解析结果失败:', e);
      }
    }
  },

  // 返回首页
  goBack() {
    tt.switchTab({
      url: '/pages/index/index'
    });
  },

  // 重新上传
  uploadAgain() {
    tt.navigateBack();
  }
});
