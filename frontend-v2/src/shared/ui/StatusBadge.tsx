import { Tag } from 'antd';
import { getStatusBadgeColor, type StatusRegistryNamespace } from './statusRegistry';

export type StatusBadgeProps = {
  namespace?: StatusRegistryNamespace;
  value: string | null | undefined;
  label?: string;
};

export function StatusBadge({
  namespace = 'generic',
  value,
  label,
}: StatusBadgeProps) {
  const display = label ?? value ?? '-';
  return <Tag color={getStatusBadgeColor(namespace, value)}>{display}</Tag>;
}
