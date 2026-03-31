export type ProviderFormValues = {
  display_name: string;
  base_url: string;
  api_key?: string;
  default_model: string;
  timeout_seconds: number;
  status: string;
};

export type DebugFormValues = {
  model?: string;
  prompt: string;
  response_format: 'text' | 'json_object' | 'json_schema' | 'auto';
  response_schema?: string;
  include_sample_image: boolean;
};

export const DEFAULT_DEBUG_VALUES: DebugFormValues = {
  model: '',
  prompt: '请返回一句调试成功确认，并说明当前模型已可用于巡检分析。',
  response_format: 'text',
  response_schema: JSON.stringify(
    {
      type: 'object',
      properties: {
        summary: { type: 'string' },
      },
      required: ['summary'],
    },
    null,
    2,
  ),
  include_sample_image: true,
};

export function parseDebugSchema(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('调试 Schema 不是合法 JSON');
  }
}
