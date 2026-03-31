export const CREATE_STRATEGY_ID = '__create__';

export type StrategyFormValues = {
  name: string;
  scene_description: string;
  prompt_template: string;
  model_provider: string;
  model_name: string;
  result_format: 'json_schema' | 'json_object' | 'auto' | 'text';
  response_schema_text: string;
  status: string;
};

export const DEFAULT_SCHEMA = JSON.stringify(
  {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      has_issue: { type: 'boolean' },
    },
    required: ['summary', 'has_issue'],
  },
  null,
  2,
);

export const DEFAULT_STRATEGY_FORM_VALUES: StrategyFormValues = {
  name: '',
  scene_description: '',
  prompt_template: '',
  model_provider: 'zhipu',
  model_name: 'glm-4v-plus',
  result_format: 'json_schema',
  response_schema_text: DEFAULT_SCHEMA,
  status: 'active',
};
