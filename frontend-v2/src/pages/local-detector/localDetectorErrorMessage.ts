import axios from 'axios';
import { getApiErrorMessage } from '@/shared/utils/apiErrorMessage';

export function getLocalDetectorErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) {
      return '本地检测服务访问未授权，请检查服务访问配置';
    }

    if (error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')) {
      return '本地检测服务连接超时，请检查服务状态后重试';
    }

    if (!error.response) {
      return '本地检测服务不可用，请确认服务已启动并检查网络连通性';
    }
  }

  return getApiErrorMessage(error, fallback);
}
