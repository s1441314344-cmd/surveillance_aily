const app = getApp();

Page({
  data: {
    cameraId: '',
    cameraName: '',
    cameras: [],
    detectType: 'person',
    uploadMode: 'aily',
    imagePath: '',
    uploading: false,
    result: null
  },

  onLoad(options) {
    // 如果传入了巡检点位ID
    if (options.cameraId) {
      this.setData({
        cameraId: options.cameraId,
        cameraName: options.cameraName || options.cameraId
      });
    }
    
    // 加载巡检点位列表
    this.loadCameras();
  },

  // 加载巡检点位
  loadCameras() {
    app.request({
      url: `${app.globalData.apiBaseUrl}/cameras`,
      method: 'GET'
    }).then(res => {
      if (res.success) {
        this.setData({ cameras: res.data });
        
        // 如果没有预选点位，默认选择第一个
        if (!this.data.cameraId && res.data.length > 0) {
          this.setData({
            cameraId: res.data[0].id,
            cameraName: res.data[0].name
          });
        }
      }
    }).catch(err => {
      console.error('加载巡检点位失败:', err);
    });
  },

  // 选择巡检点位
  onCameraChange(e) {
    const index = e.detail.value;
    const camera = this.data.cameras[index];
    this.setData({
      cameraId: camera.id,
      cameraName: camera.name
    });
  },

  // 选择检测类型
  onDetectTypeChange(e) {
    this.setData({ detectType: e.detail.value });
  },

  // 选择上传模式
  onUploadModeChange(e) {
    this.setData({ uploadMode: e.detail.value });
  },

  // 选择图片
  chooseImage() {
    tt.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          imagePath: res.tempFilePaths[0],
          result: null
        });
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        tt.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },

  // 上传图片
  uploadImage() {
    if (!this.data.imagePath) {
      tt.showToast({
        title: '请先选择图片',
        icon: 'none'
      });
      return;
    }

    if (!this.data.cameraId) {
      tt.showToast({
        title: '请选择巡检点位',
        icon: 'none'
      });
      return;
    }

    this.setData({ uploading: true });

    // 显示加载提示
    tt.showLoading({
      title: '上传中...',
      mask: true
    });

    // 上传文件
    tt.uploadFile({
      url: `${app.globalData.apiBaseUrl}/upload`,
      filePath: this.data.imagePath,
      name: 'image',
      formData: {
        camera_id: this.data.cameraId,
        detect_type: this.data.detectType,
        upload_mode: this.data.uploadMode
      },
      header: {
        'Authorization': `Bearer ${tt.getStorageSync('access_token')}`
      },
      success: (res) => {
        tt.hideLoading();
        
        const data = JSON.parse(res.data);
        
        if (data.success) {
          this.setData({
            result: data.data,
            uploading: false
          });
          
          tt.showToast({
            title: '上传成功',
            icon: 'success'
          });

          // 跳转到结果页面
          setTimeout(() => {
            tt.navigateTo({
              url: `/pages/result/result?result=${encodeURIComponent(JSON.stringify(data.data))}`
            });
          }, 1500);
        } else {
          this.setData({ uploading: false });
          tt.showToast({
            title: data.error || '上传失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        tt.hideLoading();
        this.setData({ uploading: false });
        
        console.error('上传失败:', err);
        tt.showToast({
          title: '上传失败，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 预览图片
  previewImage() {
    if (this.data.imagePath) {
      tt.previewImage({
        urls: [this.data.imagePath]
      });
    }
  }
});
