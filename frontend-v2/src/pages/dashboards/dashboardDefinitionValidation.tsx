import { App } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import { validateDashboardDefinitionLocally } from '@/pages/dashboards/types';

function showValidationErrors(modal: ReturnType<typeof App.useApp>['modal'], errors: string[]) {
  modal.error({
    title: '看板定义校验失败',
    content: (
      <ul className="page-bullet-list">
        {errors.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    ),
  });
}

export function parseDashboardDefinitionText(
  rawText: string,
  message: MessageInstance,
  modal: ReturnType<typeof App.useApp>['modal'],
) {
  let definition: Record<string, unknown>;
  try {
    definition = JSON.parse(rawText);
  } catch {
    message.error('看板定义 JSON 不是合法格式');
    return null;
  }

  const definitionErrors = validateDashboardDefinitionLocally(definition);
  if (definitionErrors.length > 0) {
    showValidationErrors(modal, definitionErrors);
    return null;
  }

  return definition;
}
