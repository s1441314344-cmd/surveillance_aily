import type { MessageInstance } from 'antd/es/message/interface';

export function parseDebugJsonToRecord(
  value: string,
  fallbackLabel: string,
  message: MessageInstance,
): Record<string, number> | null {
  try {
    const parsed = JSON.parse(value || '{}') as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      message.error(`${fallbackLabel}必须是 JSON 对象`);
      return null;
    }
    const result: Record<string, number> = {};
    for (const [key, rawValue] of Object.entries(parsed)) {
      const normalizedKey = key.trim().toLowerCase();
      if (!normalizedKey) {
        continue;
      }
      const numericValue = Number(rawValue);
      if (Number.isNaN(numericValue)) {
        message.error(`${fallbackLabel}中的 ${key} 不是有效数字`);
        return null;
      }
      result[normalizedKey] = numericValue;
    }
    return result;
  } catch {
    message.error(`${fallbackLabel}格式错误，请输入合法 JSON`);
    return null;
  }
}
