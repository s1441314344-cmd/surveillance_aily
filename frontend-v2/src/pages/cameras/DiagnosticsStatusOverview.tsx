import { Descriptions, Empty } from 'antd';
import type { CameraStatus } from '@/shared/api/configCenter';
import { CAMERA_ALERT_STATUS_LABELS, CAMERA_CONNECTION_LABELS } from '@/pages/cameras/cameraCenterConfig';
import { DataStateBlock, SectionCard, StatusBadge, UNKNOWN_LABELS } from '@/shared/ui';

type DiagnosticsStatusOverviewProps = {
  hasActiveCamera: boolean;
  loading: boolean;
  status: CameraStatus | null;
};

export function DiagnosticsStatusOverview({
  hasActiveCamera,
  loading,
  status,
}: DiagnosticsStatusOverviewProps) {
  return (
    <SectionCard title="状态概览">
      {hasActiveCamera ? (
        loading ? (
          <DataStateBlock loading minHeight={180}>
            <></>
          </DataStateBlock>
        ) : (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="连接状态">
              <StatusBadge
                namespace="cameraConnection"
                value={status?.connection_status ?? 'unknown'}
                label={CAMERA_CONNECTION_LABELS[status?.connection_status ?? 'unknown'] ?? UNKNOWN_LABELS.generic}
              />
            </Descriptions.Item>
            <Descriptions.Item label="告警状态">
              <StatusBadge
                namespace="cameraAlert"
                value={status?.alert_status ?? 'unknown'}
                label={CAMERA_ALERT_STATUS_LABELS[status?.alert_status ?? 'unknown'] ?? UNKNOWN_LABELS.generic}
              />
            </Descriptions.Item>
            <Descriptions.Item label="最近检查时间">
              {status?.last_checked_at ?? '尚未检查'}
            </Descriptions.Item>
            <Descriptions.Item label="最近错误">
              {status?.last_error || '无'}
            </Descriptions.Item>
          </Descriptions>
        )
      ) : (
        <Empty description="请选择一个摄像头查看状态" />
      )}
    </SectionCard>
  );
}
