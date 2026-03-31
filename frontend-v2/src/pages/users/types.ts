import type { TagProps } from 'antd';
import {
  ROLE_ANALYSIS_VIEWER,
  ROLE_MANUAL_REVIEWER,
  ROLE_STRATEGY_CONFIGURATOR,
  ROLE_SYSTEM_ADMIN,
  ROLE_TASK_OPERATOR,
  ROLE_LABEL_MAP,
} from '@/shared/auth/permissions';

export type CreateUserFormValues = {
  username: string;
  display_name: string;
  password: string;
  roles: string[];
};

export const roleOptions = [
  { value: ROLE_SYSTEM_ADMIN, label: ROLE_LABEL_MAP[ROLE_SYSTEM_ADMIN], color: 'red' },
  { value: ROLE_STRATEGY_CONFIGURATOR, label: ROLE_LABEL_MAP[ROLE_STRATEGY_CONFIGURATOR], color: 'blue' },
  { value: ROLE_TASK_OPERATOR, label: ROLE_LABEL_MAP[ROLE_TASK_OPERATOR], color: 'cyan' },
  { value: ROLE_MANUAL_REVIEWER, label: ROLE_LABEL_MAP[ROLE_MANUAL_REVIEWER], color: 'gold' },
  { value: ROLE_ANALYSIS_VIEWER, label: ROLE_LABEL_MAP[ROLE_ANALYSIS_VIEWER], color: 'green' },
] as const satisfies Array<{ value: string; label: string; color: TagProps['color'] }>;

export const roleLabelMap = Object.fromEntries(roleOptions.map((item) => [item.value, item.label]));
export const roleColorMap = Object.fromEntries(roleOptions.map((item) => [item.value, item.color]));
