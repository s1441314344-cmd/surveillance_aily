export const CREATE_DASHBOARD_ID = '__create_dashboard__';

export type DashboardFormValues = {
  name: string;
  description?: string;
  definition_text: string;
  status: string;
  is_default: boolean;
};

export const DEFAULT_DEFINITION_TEXT = JSON.stringify(
  {
    widgets: [
      { type: 'kpi', metric: 'success_rate' },
      { type: 'line', metric: 'jobs_trend' },
      { type: 'table', metric: 'anomalies' },
    ],
    filters: {
      strategy_id: null,
      model_provider: null,
      time_range: '7d',
    },
  },
  null,
  2,
);

export const DEFAULT_DASHBOARD_FORM_VALUES: DashboardFormValues = {
  name: '',
  description: '',
  definition_text: DEFAULT_DEFINITION_TEXT,
  status: 'active',
  is_default: false,
};

const ALLOWED_FILTER_KEYS = new Set(['strategy_id', 'model_provider', 'anomaly_type', 'time_range']);

export function validateDashboardDefinitionLocally(definition: unknown): string[] {
  const errors: string[] = [];
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    return ['看板定义必须是 JSON 对象'];
  }

  const typedDefinition = definition as { widgets?: unknown; filters?: unknown };

  if (typedDefinition.widgets !== undefined) {
    if (!Array.isArray(typedDefinition.widgets)) {
      errors.push('widgets 必须是数组');
    } else {
      typedDefinition.widgets.forEach((widget, index) => {
        if (!widget || typeof widget !== 'object' || Array.isArray(widget)) {
          errors.push(`widgets[${index}] 必须是对象`);
          return;
        }

        const typedWidget = widget as { type?: unknown; metric?: unknown };
        if (typeof typedWidget.type !== 'string' || !typedWidget.type.trim()) {
          errors.push(`widgets[${index}].type 必须是非空字符串`);
        }
        if (typeof typedWidget.metric !== 'string' || !typedWidget.metric.trim()) {
          errors.push(`widgets[${index}].metric 必须是非空字符串`);
        }
      });
    }
  }

  if (typedDefinition.filters !== undefined) {
    if (
      !typedDefinition.filters ||
      typeof typedDefinition.filters !== 'object' ||
      Array.isArray(typedDefinition.filters)
    ) {
      errors.push('filters 必须是对象');
    } else {
      Object.entries(typedDefinition.filters).forEach(([key, value]) => {
        if (!ALLOWED_FILTER_KEYS.has(key)) {
          errors.push(`filters 不支持字段：${key}`);
          return;
        }
        if (value !== null && typeof value !== 'string') {
          errors.push(`filters.${key} 必须是字符串或 null`);
        }
      });
    }
  }

  return errors;
}
