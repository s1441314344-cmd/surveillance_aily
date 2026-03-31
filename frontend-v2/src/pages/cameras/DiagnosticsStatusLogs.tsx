import { Empty, Pagination, Space, Typography } from 'antd';
import type { CameraStatusLog } from '@/shared/api/configCenter';
import { CAMERA_ALERT_STATUS_LABELS, CAMERA_CONNECTION_LABELS } from '@/pages/cameras/cameraCenterConfig';
import { DataStateBlock, SectionCard, StatusBadge, UNKNOWN_LABELS } from '@/shared/ui';

const { Text } = Typography;

type DiagnosticsStatusLogsProps = {
  hasActiveCamera: boolean;
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  logs: CameraStatusLog[];
  pagedLogs: CameraStatusLog[];
  onPageChange: (page: number) => void;
};

export function DiagnosticsStatusLogs({
  hasActiveCamera,
  loading,
  page,
  pageSize,
  total,
  logs,
  pagedLogs,
  onPageChange,
}: DiagnosticsStatusLogsProps) {
  if (!hasActiveCamera) {
    return (
      <SectionCard title="状态日志">
        <Empty description="请选择一个摄像头查看状态日志" />
      </SectionCard>
    );
  }

  if (loading) {
    return (
      <SectionCard title="状态日志">
        <DataStateBlock loading minHeight={180}>
          <></>
        </DataStateBlock>
      </SectionCard>
    );
  }

  if (!logs.length) {
    return (
      <SectionCard title="状态日志">
        <Empty description="暂无状态日志" />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="状态日志">
      <Space direction="vertical" size={8} className="stack-full">
        {pagedLogs.map((item) => (
          <div key={item.id} className="console-block camera-log-item">
            <Space direction="vertical" size={2} className="stack-full">
              <Space wrap>
                <StatusBadge
                  namespace="cameraConnection"
                  value={item.connection_status}
                  label={CAMERA_CONNECTION_LABELS[item.connection_status] ?? UNKNOWN_LABELS.generic}
                />
                <StatusBadge
                  namespace="cameraAlert"
                  value={item.alert_status}
                  label={CAMERA_ALERT_STATUS_LABELS[item.alert_status] ?? UNKNOWN_LABELS.generic}
                />
                <Text type="secondary">{new Date(item.created_at).toLocaleString()}</Text>
              </Space>
              <Text type={item.last_error ? 'danger' : 'secondary'}>{item.last_error || '无错误'}</Text>
            </Space>
          </div>
        ))}
        {total > pageSize ? (
          <Pagination
            size="small"
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger={false}
            onChange={onPageChange}
            className="camera-status-pagination"
          />
        ) : null}
      </Space>
    </SectionCard>
  );
}
