import axios from 'axios';

export function getApiErrorMessage(error: unknown, fallback = '请求失败，请稍后重试') {
  if (axios.isAxiosError(error) && error) {
    const detail = error.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail.join('; ');
    }
    if (typeof detail === 'string') {
      return detail;
    }
    if (typeof error.message === 'string' && error.message) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
