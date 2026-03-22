App({
  globalData: {
    userInfo: null,
    apiBaseUrl: 'https://your-server-domain.com/api', // 替换为你的服务器地址
    // 或者使用本地开发环境
    // apiBaseUrl: 'http://localhost:5002/api',
  },

  onLaunch() {
    console.log('智能巡检小程序启动');
    
    // 检查登录状态
    this.checkLogin();
  },

  // 检查登录状态
  checkLogin() {
    const token = tt.getStorageSync('access_token');
    if (!token) {
      // 未登录，获取飞书登录凭证
      this.login();
    }
  },

  // 飞书登录
  login() {
    tt.login({
      success: (res) => {
        console.log('登录成功:', res);
        // 将 code 发送给后端换取 access_token
        this.getAccessToken(res.code);
      },
      fail: (err) => {
        console.error('登录失败:', err);
        tt.showToast({
          title: '登录失败',
          icon: 'none'
        });
      }
    });
  },

  // 获取访问令牌
  getAccessToken(code) {
    tt.request({
      url: `${this.globalData.apiBaseUrl}/auth/login`,
      method: 'POST',
      data: { code },
      success: (res) => {
        if (res.data.success) {
          tt.setStorageSync('access_token', res.data.token);
          console.log('获取token成功');
        }
      },
      fail: (err) => {
        console.error('获取token失败:', err);
      }
    });
  },

  // 全局请求方法
  request(options) {
    const token = tt.getStorageSync('access_token');
    
    return new Promise((resolve, reject) => {
      tt.request({
        ...options,
        header: {
          ...options.header,
          'Authorization': `Bearer ${token}`
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else if (res.statusCode === 401) {
            // Token过期，重新登录
            this.login();
            reject(new Error('Token过期'));
          } else {
            reject(new Error(res.data.message || '请求失败'));
          }
        },
        fail: reject
      });
    });
  }
});
