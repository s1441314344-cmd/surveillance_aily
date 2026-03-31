import { Button, Space, Typography } from 'antd';
import { SectionCard } from '@/shared/ui';

const { Text } = Typography;

type DiagnosticsToolbarProps = {
  hasCameras: boolean;
  hasActiveCamera: boolean;
  sweepLoading: boolean;
  checkLoading: boolean;
  diagnoseLoading: boolean;
  onSweepAll: () => void;
  onCheck: () => void;
  onDiagnose: () => void;
};

export function DiagnosticsToolbar({
  hasCameras,
  hasActiveCamera,
  sweepLoading,
  checkLoading,
  diagnoseLoading,
  onSweepAll,
  onCheck,
  onDiagnose,
}: DiagnosticsToolbarProps) {
  return (
    <SectionCard
      title="诊断工具栏"
      actions={(
        <Space>
          <Button size="small" loading={sweepLoading} disabled={!hasCameras} onClick={onSweepAll}>
            全量巡检
          </Button>
          <Button size="small" loading={checkLoading} disabled={!hasActiveCamera} onClick={onCheck}>
            立即检查
          </Button>
          <Button
            size="small"
            type="primary"
            loading={diagnoseLoading}
            disabled={!hasActiveCamera}
            onClick={onDiagnose}
            data-testid="cameras-diagnose-btn"
          >
            深度诊断
          </Button>
        </Space>
      )}
    >
      <Text type="secondary">
        诊断页聚焦设备健康度、状态变化和排障信息，避免和设备编辑、媒体操作混在一起。
      </Text>
    </SectionCard>
  );
}
