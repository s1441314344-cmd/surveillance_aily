import { describe, expect, it } from 'vitest';
import { getLocalDetectorErrorMessage } from '@/pages/local-detector/localDetectorErrorMessage';

describe('getLocalDetectorErrorMessage', () => {
  it('maps unauthorized responses to a stable auth message', () => {
    const error = {
      isAxiosError: true,
      response: { status: 401, data: {} },
      message: 'Request failed with status code 401',
    };

    expect(getLocalDetectorErrorMessage(error, '本地检测失败')).toBe('本地检测服务访问未授权，请检查服务访问配置');
  });

  it('maps network failures without response to a stable unavailable message', () => {
    const error = {
      isAxiosError: true,
      code: 'ERR_NETWORK',
      response: undefined,
      message: 'Network Error',
    };

    expect(getLocalDetectorErrorMessage(error, '状态检查失败')).toBe('本地检测服务不可用，请确认服务已启动并检查网络连通性');
  });

  it('maps timeout failures to a stable timeout message', () => {
    const error = {
      isAxiosError: true,
      code: 'ECONNABORTED',
      response: undefined,
      message: 'timeout of 15000ms exceeded',
    };

    expect(getLocalDetectorErrorMessage(error, '读取配置失败')).toBe('本地检测服务连接超时，请检查服务状态后重试');
  });

  it('falls back to the generic api error message for other failures', () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          detail: 'custom failure',
        },
      },
      message: 'Request failed',
    };

    expect(getLocalDetectorErrorMessage(error, '本地检测失败')).toBe('custom failure');
  });
});
