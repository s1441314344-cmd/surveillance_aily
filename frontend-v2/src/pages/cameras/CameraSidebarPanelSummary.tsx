import { Space } from 'antd';
import { StatusBadge } from '@/shared/ui';

type CameraSidebarPanelSummaryProps = {
  statusSummary: {
    online: number;
    warning: number;
    offline: number;
    unknown: number;
  };
};

export function CameraSidebarPanelSummary({ statusSummary }: CameraSidebarPanelSummaryProps) {
  return (
    <div className="camera-status-summary">
      <Space wrap size={8}>
        <StatusBadge namespace="cameraConnection" value="online" label={`在线 ${statusSummary.online}`} />
        <StatusBadge namespace="cameraConnection" value="warning" label={`告警 ${statusSummary.warning}`} />
        <StatusBadge namespace="cameraConnection" value="offline" label={`离线 ${statusSummary.offline}`} />
        <StatusBadge namespace="cameraConnection" value="unknown" label={`未监测 ${statusSummary.unknown}`} />
      </Space>
    </div>
  );
}
