import { Space } from 'antd';
import { ALERT_STATUS_LABELS, StatusBadge } from '@/shared/ui';

type AlertSummaryBadgesProps = {
  total: number;
  open: number;
  acknowledged: number;
  resolved: number;
};

export function AlertSummaryBadges({
  total,
  open,
  acknowledged,
  resolved,
}: AlertSummaryBadgesProps) {
  return (
    <Space wrap>
      <StatusBadge namespace="generic" value="info" label={`总计 ${total}`} />
      <StatusBadge namespace="alertStatus" value="open" label={`${ALERT_STATUS_LABELS.open} ${open}`} />
      <StatusBadge namespace="alertStatus" value="acknowledged" label={`${ALERT_STATUS_LABELS.acknowledged} ${acknowledged}`} />
      <StatusBadge namespace="alertStatus" value="resolved" label={`${ALERT_STATUS_LABELS.resolved} ${resolved}`} />
    </Space>
  );
}
