const app = getApp();

Page({
  data: {
    cameras: [],
    loading: false,
    stats: {
      totalCameras: 0,
      todayUploads: 0,
      pendingTasks: 0
    }
  },

  onLoad() {
    this.loadCameras();
    this.loadStats();
  },

  onPullDownRefresh() {
    this.loadCameras();
    this.loadStats();
    tt.stopPullDownRefresh();
  },

  // 加载巡检点位列表
  loadCameras() {
    this.setData({ loading: true });
    
    app.request({
      url: `${app.globalData.apiBaseUrl}/cameras`,
      method: 'GET'
    }).then(res => {
      if (res.success) {
        this.setData({
          cameras: res.data,
          loading: false
        });
      }
    }).catch(err => {
      console.error('加载巡检点位失败:', err);
      this.setData({ loading: false });
      tt.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
  },

  // 加载统计数据
  loadStats() {
    // 这里可以调用统计API
    this.setData({
      stats: {
        totalCameras: this.data.cameras.length || 5,
        todayUploads: 12,
        pendingTasks: 3
      }
    });
  },

  // 选择巡检点位并跳转上传页面
  selectCamera(e) {
    const cameraId = e.currentTarget.dataset.id;
    const cameraName = e.currentTarget.dataset.name;
    
    tt.navigateTo({
      url: `/pages/upload/upload?cameraId=${cameraId}&cameraName=${cameraName}`
    });
  },

  // 快速上传
  quickUpload() {
    tt.navigateTo({
      url: '/pages/upload/upload'
    });
  }
});
